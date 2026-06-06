use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use rust_cast::{
    CastDevice,
    channels::{
        media::{Media, StreamType, Metadata, GenericMediaMetadata, Image},
        receiver::CastDeviceApp,
    },
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
}

pub struct CastSession {
    pub device: CastDevice<'static>,
    pub device_ip: String,
    pub device_name: String,
    pub transport_id: Option<String>,
    pub session_id: Option<String>,
    pub media_session_id: Option<i32>,
}

pub struct CastManager {
    pub session: Mutex<Option<CastSession>>,
    pub devices: Mutex<Vec<DiscoveredDevice>>,
    pub discovery_active: Mutex<bool>,
    pub mdns_daemon: Mutex<Option<ServiceDaemon>>,
}

impl CastManager {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
            devices: Mutex::new(Vec::new()),
            discovery_active: Mutex::new(false),
            mdns_daemon: Mutex::new(None),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CastStatus {
    connected: bool,
    device_name: String,
    player_state: String,
    current_time: f64,
    duration: f64,
    volume: f32,
    muted: bool,
}

fn disconnect_internal(state: &CastManager, app_handle: &AppHandle) {
    let mut session_guard = state.session.lock();
    if let Some(session) = session_guard.take() {
        if let (Some(transport_id), Some(media_session_id)) = (&session.transport_id, session.media_session_id) {
            let _ = session.device.media.stop(transport_id.as_str(), media_session_id);
        }
        if let Some(ref session_id) = session.session_id {
            let _ = session.device.receiver.stop_app(session_id.as_str());
        }
        let _ = session.device.connection.disconnect("receiver-0".to_string());
    }

    let _ = app_handle.emit("cast-status", CastStatus {
        connected: false,
        device_name: "".to_string(),
        player_state: "IDLE".to_string(),
        current_time: 0.0,
        duration: 0.0,
        volume: 1.0,
        muted: false,
    });
}

#[tauri::command]
pub fn cast_start_discovery(
    state: State<'_, Arc<CastManager>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let mut discovery_active = state.discovery_active.lock();
    if *discovery_active {
        return Ok(());
    }

    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = mdns.browse("_googlecast._tcp.local.").map_err(|e| e.to_string())?;

    *discovery_active = true;
    *state.mdns_daemon.lock() = Some(mdns.clone());
    *state.devices.lock() = Vec::new();

    let state_clone = state.inner().clone();
    let app_handle_clone = app_handle.clone();

    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            // Check if discovery was deactivated
            if !*state_clone.discovery_active.lock() {
                break;
            }

            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let id = info.get_fullname().to_string();
                    let name = info.get_property_val_str("fn")
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| {
                            id.split('.')
                                .next()
                                .unwrap_or("Unknown Chromecast")
                                .to_string()
                        });

                    let addresses = info.get_addresses();
                    if let Some(address) = addresses.iter().next() {
                        let ip = address.to_string();
                        let port = info.get_port();

                        let device = DiscoveredDevice {
                            id: id.clone(),
                            name: name.clone(),
                            ip: ip.clone(),
                            port,
                        };

                        let mut devices = state_clone.devices.lock();
                        if !devices.iter().any(|d| d.id == id) {
                            devices.push(device.clone());
                            let _ = app_handle_clone.emit("cast-device-found", devices.clone());
                        }
                    }
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn cast_stop_discovery(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    let mut discovery_active = state.discovery_active.lock();
    if !*discovery_active {
        return Ok(());
    }

    *discovery_active = false;
    if let Some(mdns) = state.mdns_daemon.lock().take() {
        let _ = mdns.stop_browse("_googlecast._tcp.local.");
    }
    *state.devices.lock() = Vec::new();

    Ok(())
}

#[tauri::command]
pub fn cast_connect(
    ip: String,
    port: u16,
    name: String,
    state: State<'_, Arc<CastManager>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Disconnect existing if any
    disconnect_internal(&state, &app_handle);

    // Connect to the device
    let device = CastDevice::connect_without_host_verification(ip.clone(), port)
        .map_err(|e| format!("Failed to connect to {}: {:?}", name, e))?;

    device.connection
        .connect("receiver-0".to_string())
        .map_err(|e| format!("Failed receiver connection: {:?}", e))?;

    device.heartbeat.ping().map_err(|e| format!("Failed heartbeat: {:?}", e))?;

    // Create session
    let mut session_guard = state.session.lock();
    *session_guard = Some(CastSession {
        device,
        device_ip: ip,
        device_name: name.clone(),
        transport_id: None,
        session_id: None,
        media_session_id: None,
    });

    // Spawn polling thread for this session
    let state_clone = state.inner().clone();
    let app_handle_clone = app_handle.clone();
    let name_clone = name.clone();

    std::thread::spawn(move || {
        let mut error_count = 0;
        loop {
            std::thread::sleep(Duration::from_millis(1500));

            // Check if this session is still active
            let mut session_opt = state_clone.session.lock();
            if session_opt.is_none() {
                break;
            }

            let session = session_opt.as_mut().unwrap();

            // Perform ping
            if let Err(_) = session.device.heartbeat.ping() {
                error_count += 1;
                if error_count > 3 {
                    break;
                }
                continue;
            }

            // Get receiver status (volume/muted)
            let mut volume = 1.0;
            let mut muted = false;
            if let Ok(recv_status) = session.device.receiver.get_status() {
                volume = recv_status.volume.level.unwrap_or(1.0);
                muted = recv_status.volume.muted.unwrap_or(false);
            }

            // Get media status if we have transport_id and media_session_id
            let mut player_state = "IDLE".to_string();
            let mut current_time = 0.0;
            let mut duration = 0.0;

            if let (Some(transport_id), Some(media_session_id)) = (&session.transport_id, session.media_session_id) {
                if let Ok(media_status) = session.device.media.get_status(transport_id.as_str(), Some(media_session_id)) {
                    if let Some(entry) = media_status.entries.first() {
                        player_state = entry.player_state.to_string();
                        current_time = entry.current_time.unwrap_or(0.0) as f64;
                        if let Some(ref media) = entry.media {
                            duration = media.duration.unwrap_or(0.0) as f64;
                        }
                    }
                }
            }

            let _ = app_handle_clone.emit("cast-status", CastStatus {
                connected: true,
                device_name: name_clone.clone(),
                player_state,
                current_time,
                duration,
                volume,
                muted,
            });

            error_count = 0;
        }

        // If loop exited due to errors or disconnected, clean up
        let mut session_guard = state_clone.session.lock();
        if let Some(ref _s) = *session_guard {
            *session_guard = None;
            let _ = app_handle_clone.emit("cast-status", CastStatus {
                connected: false,
                device_name: "".to_string(),
                player_state: "IDLE".to_string(),
                current_time: 0.0,
                duration: 0.0,
                volume: 1.0,
                muted: false,
            });
        }
    });

    Ok(())
}

#[tauri::command]
pub fn cast_disconnect(
    state: State<'_, Arc<CastManager>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    disconnect_internal(&state, &app_handle);
    Ok(())
}

#[tauri::command]
pub fn cast_load_media(
    url: String,
    title: String,
    subtitle: String,
    mime_type: String,
    state: State<'_, Arc<CastManager>>,
) -> Result<(), String> {
    let mut session_guard = state.session.lock();
    let session = session_guard.as_mut().ok_or_else(|| "No active cast session".to_string())?;

    // Clear stale IDs so the polling thread skips media queries during channel transitions.
    // Without this, the poller can race with launch_app() using an old media_session_id,
    // causing INVALID_MEDIA_SESSION_ID errors when switching channels while casting.
    session.transport_id = None;
    session.media_session_id = None;

    let app = session.device.receiver.launch_app(&CastDeviceApp::DefaultMediaReceiver)
        .map_err(|e| format!("Failed to launch media receiver: {:?}", e))?;

    session.device.connection.connect(app.transport_id.as_str())
        .map_err(|e| format!("Failed to connect to media receiver: {:?}", e))?;

    let stream_type = if subtitle.to_lowercase().contains("live") {
        StreamType::Live
    } else {
        StreamType::Buffered
    };

    let media = Media {
        content_id: url,
        stream_type,
        content_type: mime_type,
        duration: None,
        metadata: Some(Metadata::Generic(GenericMediaMetadata {
            title: Some(title),
            subtitle: Some(subtitle),
            images: vec![],
            release_date: None,
        })),
    };

    let status = session.device.media.load(app.transport_id.as_str(), app.session_id.as_str(), &media)
        .map_err(|e| format!("Failed to load media: {:?}", e))?;

    session.transport_id = Some(app.transport_id.to_string());
    session.session_id = Some(app.session_id.to_string());
    if let Some(entry) = status.entries.first() {
        session.media_session_id = Some(entry.media_session_id);
    } else {
        session.media_session_id = None;
    }

    Ok(())
}

#[tauri::command]
pub fn cast_play(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| "No active cast session".to_string())?;
    
    let transport_id = session.transport_id.as_ref().ok_or_else(|| "No media loaded".to_string())?;
    let media_session_id = session.media_session_id.ok_or_else(|| "No media session".to_string())?;

    session.device.media.play(transport_id.as_str(), media_session_id)
        .map_err(|e| format!("Failed to play: {:?}", e))?;
    Ok(())
}

#[tauri::command]
pub fn cast_pause(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| "No active cast session".to_string())?;
    
    let transport_id = session.transport_id.as_ref().ok_or_else(|| "No media loaded".to_string())?;
    let media_session_id = session.media_session_id.ok_or_else(|| "No media session".to_string())?;

    session.device.media.pause(transport_id.as_str(), media_session_id)
        .map_err(|e| format!("Failed to pause: {:?}", e))?;
    Ok(())
}

#[tauri::command]
pub fn cast_seek(seconds: f32, state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| "No active cast session".to_string())?;
    
    let transport_id = session.transport_id.as_ref().ok_or_else(|| "No media loaded".to_string())?;
    let media_session_id = session.media_session_id.ok_or_else(|| "No media session".to_string())?;

    session.device.media.seek(transport_id.as_str(), media_session_id, Some(seconds), None)
        .map_err(|e| format!("Failed to seek: {:?}", e))?;
    Ok(())
}

#[tauri::command]
pub fn cast_set_volume(level: f32, state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| "No active cast session".to_string())?;

    session.device.receiver.set_volume(level)
        .map_err(|e| format!("Failed to set volume: {:?}", e))?;
    Ok(())
}

#[tauri::command]
pub fn cast_toggle_mute(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| "No active cast session".to_string())?;

    let mut muted = false;
    if let Ok(recv_status) = session.device.receiver.get_status() {
        muted = recv_status.volume.muted.unwrap_or(false);
    }

    session.device.receiver.set_volume(!muted)
        .map_err(|e| format!("Failed to toggle mute: {:?}", e))?;
    Ok(())
}

/// Resolves a stream URL by following HTTP redirects server-side.
/// Xtreamcode / IPTV servers often serve a redirect (302/301) from the
/// hostname-based URL to the actual CDN IP with a time-limited token:
///   http://kstv.us:8080/live/.../15966.m3u8
///   → http://206.212.244.183:25461/live/.../15966.m3u8?token=...
/// The Chromecast cannot follow these redirects reliably (the token may be
/// bound to the requesting IP). By following the redirect from the app
/// (same LAN IP as the Chromecast is on), the final URL can be sent
/// directly to the Chromecast without it needing to resolve anything.
#[tauri::command]
pub async fn cast_resolve_url(url: String) -> Result<String, String> {
    // Build a reqwest client that follows redirects automatically (default)
    // but with a short timeout so we don't block the UI.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::limited(10))
        .danger_accept_invalid_certs(true) // some IPTV servers use self-signed certs
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // Use a GET with a Range header to get just the first byte — avoids
    // downloading the actual stream content while still forcing the server
    // to issue the redirect chain that ends at the real CDN URL.
    let response = client
        .get(&url)
        .header("Range", "bytes=0-0")
        .header("User-Agent", "Mozilla/5.0 (compatible; Chromecast)")
        .send()
        .await
        .map_err(|e| format!("Failed to resolve URL: {}", e))?;

    // reqwest exposes the final URL after following all redirects
    let final_url = response.url().to_string();
    log::info!("[Cast] Resolved URL: {} -> {}", url, final_url);
    Ok(final_url)
}
