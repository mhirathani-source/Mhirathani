# Mobile installation and disabled WhatsApp reminders

## Requested public URLs

- Website: `https://prime-boxing-academy.replit.app/`
- Installation page: `https://prime-boxing-academy.replit.app/download`

These are the requested target URLs, not a claim that Publishing has attached the domain. Before rollout, verify the domain in Publishing and choose Public visibility. Keep Clerk login, approval and server permissions enabled. Do not overwrite production data with development fixtures.

The publishing metadata checked during this work still returned the old `Prime1academy.replit.app` domain with password protection. The requested domain returned HTTP 404. The owner must complete the domain/visibility settings and Publish; the agent does not publish automatically.

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

## WhatsApp: manual ordinary-app mode

Member reminders open a `wa.me` chat with a prefilled Arabic message. A staff member reviews it and presses Send in ordinary WhatsApp or WhatsApp Web.

There is no automatic or scheduled sending, and the application cannot confirm delivery or record new manual sends. Existing Business settings, templates, credentials and historical reminder logs remain stored; the app no longer uses or changes them.

The old server-side Meta adapter remains dormant for compatibility, but application routes reject Business template/settings changes and API sends. The scheduler is a no-op. Do not describe the old adapter tests as proof that live messages are enabled.

The settings page explains the manual flow. A valid phone number is required; Jordanian local mobile numbers are normalized for the chat link. No database migration or data cleanup is required.

## Verification

- Club manager and API server TypeScript checks, plus API server build.
- `node --experimental-strip-types --test artifacts/club-manager/tests/whatsappLink.test.ts`: Jordanian and international phone normalization and prefilled link construction.
- `/api/healthz` returned HTTP 200 after restart.
- The public sign-in page loaded. The browser preview was not authenticated, so the signed-in member screen was verified by code/type checks rather than visual interaction.
