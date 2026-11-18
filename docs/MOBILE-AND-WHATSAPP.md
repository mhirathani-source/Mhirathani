# Mobile installation and manual WhatsApp reminders

## Verified production URLs

- Website: `https://prime1academy.replit.app/`
- Installation page: `https://prime1academy.replit.app/download`

These URLs were read from the active Replit deployment metadata. Keep Clerk login, approval and server permissions enabled. Do not overwrite production data with development fixtures.

The active deployment is password-protected at the Replit level. To make the install page publicly reachable, set deployment visibility to Public in Publishing and publish again; this does not remove the app's Clerk sign-in or backend permissions. The requested `prime-boxing-academy.replit.app` domain is not attached and returned HTTP 404 when checked.

## PWA

The web app includes `manifest.json`, `service-worker.js`, PNG icons at 192 and 512 pixels, and an Apple touch icon. Android uses the browser's real `beforeinstallprompt` event, captured before React loads; if unavailable it shows Chrome installation instructions. iPhone/iPad uses Safari → Share → Add to Home Screen. A website cannot silently install an iOS app.

The QR code is generated locally in the browser for the requested website URL. No external QR service is contacted.

Only public assets and the safe offline page are cached. Login, API, membership, finance and session responses are never cached for offline use. Saving club operations requires Internet access.

## Capacitor native project

- App identifier: `com.primeboxingacademy.app`.
- Existing Android and iOS projects are retained and synchronized.
- The native WebView loads the trusted HTTPS hosted website rather than opening the old external-browser portal.
- This is an online hosted wrapper, not a separately reimplemented offline app. Server updates apply to its hosted UI.
- An offline error page retries the hosted website after connectivity returns.
- `pnpm --filter @workspace/club-manager run native:sync` builds and synchronizes the web assets.
- Signed release APK/AAB and iOS IPA/App Store distribution still require signing and native release builds; synchronization is not a signed installer.
- The previously generated debug APK predates this change and must not be presented as this updated native version.
- Before distribution, test login, renewal/payment forms, logout, external sign-in providers and network recovery on real Android/iOS devices. Browser-based PWA checks do not prove native OAuth compatibility.

## WhatsApp: manual only

The club no longer sends messages through WhatsApp Business Platform, Meta credentials, or a scheduled sender. The WhatsApp settings page stores an Arabic message template; the member-profile action prepares a `wa.me` chat link with the member's international phone number and message text.

The employee reviews and sends the message manually inside WhatsApp. The system records a request to open the chat, not proof that WhatsApp opened, that the employee pressed Send, or that the message was delivered. Previous reminder rows are retained and displayed as legacy records. No WhatsApp schema or member data is removed.

On mobile, the operating system opens the WhatsApp app associated with `wa.me`; if both standard WhatsApp and WhatsApp Business are installed, the operating system may use the user's default app or show an app chooser.

## Verification

- Both frontend and backend TypeScript checks and production builds.
- `node --test api/whatsapp/manual.test.cjs`: Jordanian phone normalization, invalid-number rejection, Arabic template expansion and URL encoding.
- `node artifacts/club-manager/tools/check-mobile.mjs`: manifest, icon sizes, install-event capture, sensitive-route worker bypass and native host configuration.
- Server role permissions continue to gate editing the message template and opening a member chat.
- Capacitor sync for Android/iOS. This does not replace real-device release acceptance.
