# FFmpeg Auto-Download for DVR

## How It Works

The app automatically downloads FFmpeg during the build process:

1. **Before each build**, the script `packages/app/scripts/download-ffmpeg.js` runs
2. **Detects your platform** (Windows/Mac/Linux)
3. **Downloads or copies FFmpeg** from official sources
4. **Places the binary** in `packages/app/src-tauri/bin/`
5. **Tauri bundles** it with your installer

## For Developers

### First Build
```bash
# The prebuild script will automatically download FFmpeg
pnpm run build
```

### Manual Download (if needed)
```bash
cd packages/app
node scripts/download-ffmpeg.js
```

### Skip Download (if already exists)
The script checks if FFmpeg already exists and skips download if found.

## For CI/CD

GitHub Actions and other CI systems will automatically download FFmpeg during the build process. No manual setup required!

## Download Sources

- **Windows**: https://github.com/BtbN/FFmpeg-Builds/releases (latest win64-gpl build)
- **Mac**: Copied from system (Homebrew installation)
- **Linux**: https://johnvansickle.com/ffmpeg/ (static builds)

## Requirements

### Windows
- **PowerShell** with `Expand-Archive` (built into Windows 10/11)
- Fallback to **7-Zip** if PowerShell extraction fails

### Mac
- FFmpeg installed via Homebrew:
  ```bash
  brew install ffmpeg
  ```

### Linux
- Built-in `tar` command

## Troubleshooting

### "PowerShell extraction failed" error (Windows)
The script will automatically try 7-Zip as a fallback. If both fail:
1. The downloaded archive will be in `packages/app/src-tauri/bin/`
2. Extract it manually
3. Copy `ffmpeg.exe` to `packages/app/src-tauri/bin/ffmpeg-x86_64-pc-windows-msvc.exe`

### "FFmpeg not found" error (Mac)
Install FFmpeg via Homebrew:
```bash
brew install ffmpeg
```

### Manual extraction
If automatic extraction fails:
1. The downloaded archive will be in `packages/app/src-tauri/bin/`
2. Extract it manually
3. Copy `ffmpeg.exe` (or `ffmpeg` on Mac/Linux) to `packages/app/src-tauri/bin/`
