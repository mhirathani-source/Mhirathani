# Mobile installation and disabled WhatsApp reminders

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

## WhatsApp: OFF by default

Server-only adapter: `api/whatsapp/reminders.js`, used by the existing database-backed sender/scheduler. It is not a publicly accessible unauthenticated sending endpoint.

The owner has a switch in **لوحة التحكم والإعدادات → الإعدادات العامة → تذكيرات واتساب**. The persisted default is OFF. Missing credentials are a normal disabled state and do not prevent compilation or startup.

Later add these through Replit Secrets, including the production environment:

- `META_WHATSAPP_TOKEN`
- `META_PHONE_NUMBER_ID`

Never paste the token into chat, a frontend environment variable or the settings UI. Re-publish after changing production configuration if required by Publishing, and turn the owner switch ON only after preparing Meta-approved Arabic templates.

The expired-membership template is `prime_subscription_expired` (`ar`) with three body parameters: member name, plan name and subscription end date. Other existing templates support two days before expiry, the expiry day and manual reminders. With direct Meta credentials, Meta enforces template approval; the UI's draft status is not a claim of approval. A WABA ID remains useful for submitting and synchronizing template statuses through the existing settings page.

The scheduler skips renewed, paused, cancelled and archived members as applicable. It selects only the latest eligible expired contract per member, uses database deduplication, and logs accepted/failed requests. Accepted does not mean delivered. Failed/uncertain requests are not automatically retried in a way that might send duplicates; delivery webhooks and managed retry policy remain part of the existing official WhatsApp rollout.

The scheduler runs while the API process is running and does not require a signed-in manager. Autoscale can sleep, so guaranteed timed delivery still needs an always-running service or an authenticated external scheduler. No live messages were sent during this implementation.

## Verification

- Both frontend and backend TypeScript checks and production builds.
- `node --test api/whatsapp/reminders.test.cjs`: OFF/no-credentials performs zero requests, mocked official template payload, explicit errors and expired-contract selection.
- `node artifacts/club-manager/tools/check-mobile.mjs`: manifest, icon sizes, install-event capture, sensitive-route worker bypass and native host configuration.
- Admin HTTP integration checks reject staff access and reject enabling an unconfigured sender.
- Capacitor sync for Android/iOS. This does not replace real-device release acceptance.
