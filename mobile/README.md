# Mobile Version - Game Arcade

This directory contains the mobile-optimized version of the Game Arcade (Top War & Ski Slope).

## What's Different from Desktop Version?

### Touch Controls
- **Top War**: Virtual joystick for movement + action buttons for shooting and rockets
- **Ski Slope**: Large left/right buttons for easy thumb control

### Responsive Design
- Full-screen canvas that adapts to any mobile screen size
- Optimized UI elements (smaller stats badges, buttons)
- Mobile-friendly menu cards

### Progressive Web App (PWA) Features
- `manifest.json` for installable app experience
- Viewport meta tags for proper mobile rendering
- Fullscreen mode support
- No zoom/scroll on touch

## How to Test

### Local Testing
1. Open `index.html` in a browser
2. Open Chrome DevTools (F12)
3. Click the device toolbar icon (Ctrl+Shift+M)
4. Select a mobile device (e.g., iPhone 12, Galaxy S21)
5. Refresh the page

### On Your Phone
1. Run a local server:
   ```powershell
   python -m http.server 8000
   ```
2. Find your computer's local IP (run `ipconfig` in PowerShell)
3. On your phone, go to `http://YOUR_IP:8000/mobile/`

## Publishing to Google Play Store

### Option 1: Trusted Web Activity (TWA) - Recommended
Uses Google's Bubblewrap tool to wrap your web app:

1. **Host your game**:
   - Upload the mobile folder to a web host (GitHub Pages, Netlify, Vercel, etc.)
   - Must be served over HTTPS
   
2. **Install Bubblewrap**:
   ```powershell
   npm install -g @bubblewrap/cli
   ```

3. **Initialize TWA**:
   ```powershell
   bubblewrap init --manifest https://your-site.com/mobile/manifest.json
   ```

4. **Build APK**:
   ```powershell
   bubblewrap build
   ```

5. **Upload to Play Console**:
   - Go to https://play.google.com/console
   - Create new app
   - Upload the generated APK
   - Fill in store listing details
   - Submit for review

### Option 2: PWA (No Play Store)
Users can install directly from your website:
1. Host on HTTPS
2. Users visit site in Chrome mobile
3. Chrome prompts "Add to Home Screen"
4. App installs like a native app

### Required Assets for Play Store
- **Icon**: 512x512 PNG (included in manifest.json)
- **Screenshots**: 2-8 screenshots of your game
- **Feature Graphic**: 1024x500 banner image
- **Privacy Policy**: Required URL

## Controls Reference

### Top War
- **Joystick**: Move player up/down/left/right
- **SHOOT Button**: Fire bullets (auto-repeats when held)
- **ROCKET Button**: Launch guided rockets (cooldown applies)

### Ski Slope
- **◀ Button**: Move skier left
- **▶ Button**: Move skier right

## Browser Compatibility
- Chrome/Edge (recommended)
- Safari (iOS 11.3+)
- Firefox
- Samsung Internet

## File Structure
```
mobile/
├── index.html          # Mobile-optimized HTML with touch UI
├── game.js            # Top War with joystick controls
├── ski-game.js        # Ski Slope with button controls
├── menu-background.js # Background animation (unchanged)
├── style.css          # Mobile-responsive styles
├── manifest.json      # PWA manifest
└── README.md          # This file
```

## Notes
- The desktop version in the parent directory remains unchanged
- Both versions can coexist
- Touch controls are hidden on desktop, keyboard controls work on mobile as fallback
- Audio autoplay may be blocked on some browsers until user interaction

## Future Enhancements
- Add haptic feedback (vibration) on collisions
- Implement accelerometer tilt controls
- Add high score leaderboard (requires backend)
- Create app icons (192x192 and 512x512)
