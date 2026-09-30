# Mobile app (Android + iOS) via Capacitor

The app stays a Next.js web app. Capacitor wraps it in a native shell that loads
the **deployed Vercel URL** (hybrid mode), so Server Components / Server Actions
keep working — a static export can't run them.

## One-time setup (Android, on Windows)
```powershell
cd E:\Schnitzery
# 1. set server.url in capacitor.config.ts to the real Vercel URL
npm i @capacitor/android      # platform package (required before `cap add`)
npx cap add android
npx cap sync
npx cap open android          # opens Android Studio
```
In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Distribute without a store (sideload)
Share `app-debug.apk` via a link / QR / Drive. Users tap it, allow "install from
unknown sources" once, done. No Play Store, no fee, no review.
- For a public Play Store listing later: build a signed **release AAB**
  (`Build → Generate Signed Bundle`), Google Play dev account is $25 one-time.

## iOS (needs a Mac + Xcode)
```bash
npm i @capacitor/ios
npx cap add ios
npx cap sync
npx cap open ios
```
No free APK-style sideload on iOS. Options:
- **PWA add-to-home-screen** — free, use for the demo now.
- **TestFlight** — install-by-link for testers; needs Apple Developer $99/yr.
- **App Store** — official listing; same $99/yr + review.

## Key point about updates
Because the shell loads the Vercel URL, deploying to Vercel updates the app
automatically. Only rebuild the APK/IPA when you change the app icon, name,
splash, or add native plugins.

## Prerequisites
- Android: Android Studio (SDK + build tools).
- iOS: a Mac with Xcode.
- `server.url` in `capacitor.config.ts` must point at the live deployment.
