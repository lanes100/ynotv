# ynoTV

[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-AGPL%20v3-green.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue)](./README.md)
[![Chat Server](https://img.shields.io/badge/chat-discord-7289da.svg)](https://discord.gg/e5eGa5QETB)

A feature-rich, open source IPTV player for Windows built on [Tauri v2](https://tauri.app) and [mpv](https://mpv.io). Was made for my personal use with features I wanted.
Built with the help of AI.

[Documentation](https://tbeezy.github.io/ynotvdoc)

[![Watch the video](https://i.imgur.com/a4x1L28.png)](https://streamable.com/jxjq9n)

[Video Demonstration](https://streamable.com/jxjq9n)

---


## Features

- Supports M3U, Xtream Codes, and Stalker portals with multiple EPG support
- Grid style EPG with preview window
- Catchup channel support with a Cache Time Shift for instant replays
- Automatic stream fallback when it detects a stalled/dead stream
- VOD support with rich metadata powered by TMDB and RPDB, with saved progress
- Subsource subtitle integration for VODs
- Set Backup DNS/URLs to automatically swap when current one fails
- Favorites and Custom groups from any source
- Rename/Hide/Sort Categories/Channels easily in any way you want
- Built in EPG Editor to change tvgid/logo or automatch to a different one
- Embedded MPV for playback, with option to set custom parameters
- Multiview with resizable PiP and can support up to four simultaneous streams in a 2x2 grid.
- Instant Channel and EPG search with advanced options
- Watchlist and Reminder with an autoswap when a program goes live
- Built in DVR to record any streams
- Dedicated Sports tab with real-time scores and detailed game stats
- TV Calendar powered by TVMaze to auto-set reminders for upcoming shows
- Reprogrammable hotkeys for fast interaction
- 40+ built-in themes for any style you may prefer

---

<details>
<summary>Building from Source</summary>

## Building from Source

### Prerequisites

- **Node.js** 20.x or higher
- **pnpm** 9.x or higher — install with `npm install -g pnpm` (the project specifies `9.1.0` via the `packageManager` field; if you have [corepack](https://nodejs.org/api/corepack.html) enabled, the correct version is used automatically)
- **Rust** (latest stable) — required for the Tauri backend. Install via [rustup](https://rustup.rs/)
- **Git**

**Windows additional requirements:**
- [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — required for Tauri's rendering engine
- Visual Studio 2022 with C++ build tools
- Windows 10 SDK

### Instructions

**1. Clone the repository**

```bash
git clone https://github.com/tbeezy/ynotv.git
cd ynotv
```

**2. Install dependencies**

```bash
pnpm install
```

**3. Download mpv sidecar**

FFmpeg is downloaded automatically during the build step, but mpv (and yt-dlp) must be downloaded manually first:

```bash
bash scripts/download-mpv-tauri.sh
```

*(Optional)* If you also want to pre-download FFmpeg manually:
```bash
cd packages/app
node scripts/download-ffmpeg.js
cd ../..
```

**4. Run in development mode**

```bash
pnpm dev
```

This starts both the Vite UI dev server and the Tauri app concurrently.

**5. Build for production**

```bash
pnpm tauri build
```

Build output is located at:

```
packages/app/src-tauri/target/release/bundle/
```

</details>

---

<details>
<summary>Data & File Locations</summary>

## Data & File Locations

### Configuration

```
%APPDATA%\com.ynotv.app\
├── settings.json          # Sources, shortcuts, and preferences
└── .windows-state.json    # Window size and position
```

### Database (SQLite)

```
%LOCALAPPDATA%\com.ynotv.app\app.db
```

The database stores channels, categories, EPG programs (7-day window), VOD movies and series, watchlist entries, reminders, DVR schedules and recordings, channel metadata, and source sync timestamps.

### Logs

Debug logging can be enabled in Settings > Debug. Log output is written to:

```
%APPDATA%\com.ynotv.app\logs\app.log
```

### DVR Recordings

The recording directory is configurable in Settings > DVR. The default location is:

```
%USERPROFILE%\Videos\ynoTV Recordings\
```

</details>

---

<details>
<summary>Keyboard Shortcuts</summary>

## Keyboard Shortcuts

All shortcuts are fully customizable in Settings > Shortcuts.

### Playback

| Action | Default |
|---|---|
| Play / Pause | `Space` |
| Seek Forward | `Right Arrow` |
| Seek Backward | `Left Arrow` |
| Mute / Unmute | `M` |
| Select Subtitle (Modal) | `J` |
| Select Audio Track (Modal) | `A` |
| Toggle Fullscreen | `F` |
| Replay Last Stream | `Q` |

### Navigation

| Action | Default |
|---|---|
| Channel Up | `Up Arrow` |
| Channel Down | `Down Arrow` |

### Interface

| Action | Default |
|---|---|
| Toggle Live TV (Guide + Categories) | `L` |
| Toggle Guide | `G` |
| Toggle Categories | `C` |
| Toggle DVR | `R` |
| Toggle Sports | `U` |
| Toggle TV Calendar | `T` |
| Toggle Settings | `,` |
| Show / Hide Stats | `I` |
| Focus Search | `S` |
| Toggle EPG View Layout | `E` |
| Close / Back | `Esc` |

### Layout

| Action | Default |
|---|---|
| Layout: Main View | `1` |
| Layout: Picture in Picture | `2` |
| Layout: Big + Bottom Bar | `3` |
| Layout: 2×2 Grid | `4` |

</details>

---

## Disclaimer

ynoTV is a media player only. It does not provide, host, distribute, or facilitate access to any streaming services, broadcast content, channel lists, or IPTV subscriptions of any kind.

All content, streams, and playlists are sourced, configured, and managed solely by the end user. The developers have no knowledge of, control over, or responsibility for any third-party content accessed through the application.

Users are solely responsible for ensuring that any content they access complies with the laws and regulations applicable in their jurisdiction. The developers do not condone or support the use of this application to access unlicensed or unauthorized content.

Metadata displayed within the application is sourced from publicly available third-party databases including TVMaze and TMDB. ynoTV does not claim ownership of this metadata.

---

## Credits

ynoTV builds on the following open source projects and services:

- [sbtlTV](https://github.com/thesubtleties/sbtlTV) — original foundation
- [Tauri](https://tauri.app) — desktop application framework
- [mpv](https://mpv.io) — video playback engine
- [FFmpeg](https://ffmpeg.org) — recording and thumbnail generation
- [React](https://react.dev) — UI library
- [TVMaze](https://www.tvmaze.com) — TV schedule and show metadata
- [TMDB](https://www.themoviedb.org) — movie and series metadata
- [MY-1 Mac Stalker Player](https://github.com/Cyogenus/IPTV-MAC-STALKER-PLAYER-BY-MY-1) - Stalker integration

---

## License

[GNU Affero General Public License v3.0](./LICENSE)
