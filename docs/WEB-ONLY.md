# Web-only plan (mobile browser and laptop browser)

No app store, no native apps. One URL, installable as a PWA.

## Browsers
Latest two versions of Safari (iOS 16.4+ and macOS), Chrome, Edge, Firefox.

## Things that differ from native
- **Storage can vanish.** Safari deletes IndexedDB and localStorage after 7 days of Safari use
  without interaction; Home Screen web apps are exempt. Private mode and "clear site data" also
  erase it. Recovery phrase is mandatory; request persistent storage; graceful "key not found".
- **Install.** iPhone has no automatic install prompt. Show a short "Share, then Add to Home
  Screen" guide. Chrome on Android and desktop can offer an install prompt.
- **Notifications.** Web push on iOS needs iOS 16.4+ and a Home Screen install, and has had
  reliability reports. Optional, generic text only. The in-app countdown is the main reminder.
- **Voice.** Chrome records WebM/Opus, Safari tends to record audio/mp4, and some sources say
  Safari cannot play Opus natively. Use `isTypeSupported`; test iPhone to Android both ways;
  add a small encoder or transcode if playback fails. Start recording from a tap only.
- **Photos.** `input type=file`. HEIC may not decode on some laptops: show a friendly message.
  Canvas re-encode strips EXIF and location.
- **Downloads.** iPhone saves to Files. Zips are built in memory: keep caps so they fit.
- **Two devices.** Add another device: short-lived QR code or link from the phone, or enter the
  recovery phrase on the laptop.
- **Instagram in-app browser.** Detect (user agent contains Instagram or FB markers) and ask
  people to open in Safari or Chrome before handling any key.
- **Background tabs.** Realtime may disconnect; reconnect and refetch on visibility change.
  Timers use timestamps.
- **Layout.** Phone-first single column; laptop gets a wider two-column layout. Keyboard
  navigation, visible focus, 44 px touch targets, respects reduced motion and dark mode.
- **Security headers.** Strict CSP via Cloudflare Pages `_headers`; no inline scripts in production.

## Testing
Automated: Playwright on Chromium, WebKit, Firefox with mobile and desktop viewports.
Manual checklist per release: real iPhone Safari (browser and Home Screen), Android Chrome,
Instagram in-app browser, laptop Chrome and Safari, iPhone-to-Android voice note round trip,
low-end Android performance.
