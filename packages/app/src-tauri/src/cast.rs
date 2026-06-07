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
    pub device_port: u16,
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
        log::info!("[Cast] Disconnecting from Cast session for device: {}", session.device_name);
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
    log::info!("[Cast] Starting discovery...");
    let mut discovery_active = state.discovery_active.lock();
    if *discovery_active {
        return Ok(());
    }

    let mdns = ServiceDaemon::new().map_err(|e| {
        log::error!("[Cast] Failed to create ServiceDaemon: {:?}", e);
        e.to_string()
    })?;
    let receiver = mdns.browse("_googlecast._tcp.local.").map_err(|e| {
        log::error!("[Cast] Failed to browse: {:?}", e);
        e.to_string()
    })?;

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
                        log::info!("[Cast] Discovered Chromecast device: {} ({}:{})", name, ip, port);

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
    log::info!("[Cast] Stopping discovery");
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
    log::info!("[Cast] Connecting to Chromecast: {} at {}:{}", name, ip, port);
    // Disconnect existing if any
    disconnect_internal(&state, &app_handle);

    // Connect to the device
    let device = CastDevice::connect_without_host_verification(ip.clone(), port)
        .map_err(|e| {
            let err_msg = format!("Failed to connect to {}: {:?}", name, e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;

    device.connection
        .connect("receiver-0".to_string())
        .map_err(|e| {
            let err_msg = format!("Failed receiver connection: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;

    device.heartbeat.ping().map_err(|e| {
        let err_msg = format!("Failed heartbeat: {:?}", e);
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;

    // Create session
    let mut session_guard = state.session.lock();
    *session_guard = Some(CastSession {
        device,
        device_ip: ip,
        device_port: port,
        device_name: name.clone(),
        transport_id: None,
        session_id: None,
        media_session_id: None,
    });

    log::info!("[Cast] Connected successfully to device: {}", name);

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
        if let Some(ref s) = *session_guard {
            log::warn!("[Cast] Connection to device {} lost (ping error or disconnected)", s.device_name);
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
    log::info!("[Cast] Disconnect requested by client");
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
    log::info!(
        "[Cast] Load media requested: url=\"{}\", title=\"{}\", mime_type=\"{}\"",
        url,
        title,
        mime_type
    );
    let mut session_guard = state.session.lock();
    let session = session_guard.as_mut().ok_or_else(|| {
        let err_msg = "No active cast session".to_string();
        log::error!("[Cast] Load media failed: {}", err_msg);
        err_msg
    })?;

    // Clear stale IDs so the polling thread skips media queries during channel transitions.
    // Without this, the poller can race with launch_app() using an old media_session_id,
    // causing INVALID_MEDIA_SESSION_ID errors when switching channels while casting.
    session.transport_id = None;
    session.media_session_id = None;

    // Try to launch the media receiver. On connection errors (e.g. Windows 10053
    // WSAECONNABORTED when the Chromecast resets the TCP socket after a network hiccup),
    // reconnect the device socket and retry once before giving up.
    let app = match session.device.receiver.launch_app(&CastDeviceApp::DefaultMediaReceiver) {
        Ok(app) => {
            log::info!("[Cast] DefaultMediaReceiver launched successfully (session_id={})", app.session_id);
            app
        }
        Err(e) => {
            let err_str = format!("{:?}", e);
            let is_conn_err = err_str.contains("10053")
                || err_str.contains("ConnectionAborted")
                || err_str.contains("ConnectionReset")
                || err_str.contains("BrokenPipe")
                || err_str.to_lowercase().contains("connection");
            if !is_conn_err {
                let err_msg = format!("Failed to launch media receiver: {:?}", e);
                log::error!("[Cast] {}", err_msg);
                return Err(err_msg);
            }
            log::warn!("[Cast] Connection error on launch_app ({}), reconnecting...", err_str);
            let ip = session.device_ip.clone();
            let port = session.device_port;
            let new_device = CastDevice::connect_without_host_verification(ip.clone(), port)
                .map_err(|e2| {
                    let err_msg = format!("Reconnect to {} failed: {:?}", ip, e2);
                    log::error!("[Cast] {}", err_msg);
                    err_msg
                })?;
            new_device.connection.connect("receiver-0".to_string())
                .map_err(|e2| {
                    let err_msg = format!("Reconnect receiver channel failed: {:?}", e2);
                    log::error!("[Cast] {}", err_msg);
                    err_msg
                })?;
            new_device.heartbeat.ping()
                .map_err(|e2| {
                    let err_msg = format!("Reconnect heartbeat failed: {:?}", e2);
                    log::error!("[Cast] {}", err_msg);
                    err_msg
                })?;
            session.device = new_device;
            let retry_app = session.device.receiver.launch_app(&CastDeviceApp::DefaultMediaReceiver)
                .map_err(|e2| {
                    let err_msg = format!("Failed to launch media receiver after reconnect: {:?}", e2);
                    log::error!("[Cast] {}", err_msg);
                    err_msg
                })?;
            log::info!("[Cast] DefaultMediaReceiver launched successfully after reconnect (session_id={})", retry_app.session_id);
            retry_app
        }
    };

    session.device.connection.connect(app.transport_id.as_str())
        .map_err(|e| {
            let err_msg = format!("Failed to connect to media receiver: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;

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

    log::info!("[Cast] Sending LOAD media message to device...");
    let status = session.device.media.load(app.transport_id.as_str(), app.session_id.as_str(), &media)
        .map_err(|e| {
            let err_msg = format!("Failed to load media: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;

    session.transport_id = Some(app.transport_id.to_string());
    session.session_id = Some(app.session_id.to_string());
    if let Some(entry) = status.entries.first() {
        session.media_session_id = Some(entry.media_session_id);
        log::info!("[Cast] Media loaded successfully! Media Session ID: {}", entry.media_session_id);
    } else {
        session.media_session_id = None;
        log::warn!("[Cast] Media loaded, but response returned no media entries");
    }

    Ok(())
}

#[tauri::command]
pub fn cast_play(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Play command received");
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| {
        let err_msg = "No active cast session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;
    
    let transport_id = session.transport_id.as_ref().ok_or_else(|| {
        let err_msg = "No media loaded".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;
    let media_session_id = session.media_session_id.ok_or_else(|| {
        let err_msg = "No media session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;

    session.device.media.play(transport_id.as_str(), media_session_id)
        .map_err(|e| {
            let err_msg = format!("Failed to play: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;
    Ok(())
}

#[tauri::command]
pub fn cast_pause(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Pause command received");
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| {
        let err_msg = "No active cast session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;
    
    let transport_id = session.transport_id.as_ref().ok_or_else(|| {
        let err_msg = "No media loaded".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;
    let media_session_id = session.media_session_id.ok_or_else(|| {
        let err_msg = "No media session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;

    session.device.media.pause(transport_id.as_str(), media_session_id)
        .map_err(|e| {
            let err_msg = format!("Failed to pause: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;
    Ok(())
}

#[tauri::command]
pub fn cast_seek(seconds: f32, state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Seek command received (seconds={})", seconds);
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| {
        let err_msg = "No active cast session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;
    
    let transport_id = session.transport_id.as_ref().ok_or_else(|| {
        let err_msg = "No media loaded".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;
    let media_session_id = session.media_session_id.ok_or_else(|| {
        let err_msg = "No media session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;

    session.device.media.seek(transport_id.as_str(), media_session_id, Some(seconds), None)
        .map_err(|e| {
            let err_msg = format!("Failed to seek: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;
    Ok(())
}

#[tauri::command]
pub fn cast_set_volume(level: f32, state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Set volume command received (level={})", level);
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| {
        let err_msg = "No active cast session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;

    session.device.receiver.set_volume(level)
        .map_err(|e| {
            let err_msg = format!("Failed to set volume: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;
    Ok(())
}

#[tauri::command]
pub fn cast_toggle_mute(state: State<'_, Arc<CastManager>>) -> Result<(), String> {
    log::info!("[Cast] Toggle mute command received");
    let session_guard = state.session.lock();
    let session = session_guard.as_ref().ok_or_else(|| {
        let err_msg = "No active cast session".to_string();
        log::error!("[Cast] {}", err_msg);
        err_msg
    })?;

    let mut muted = false;
    if let Ok(recv_status) = session.device.receiver.get_status() {
        muted = recv_status.volume.muted.unwrap_or(false);
    }

    session.device.receiver.set_volume(!muted)
        .map_err(|e| {
            let err_msg = format!("Failed to toggle mute: {:?}", e);
            log::error!("[Cast] {}", err_msg);
            err_msg
        })?;
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
