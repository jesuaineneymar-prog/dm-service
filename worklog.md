---
Task ID: 1
Agent: Super Z (main)
Task: Deploy new ManyChat API key + integrate TikTok DM via Browserless.io

Work Log:
- Deployed new ManyChat API key 11902014:fd7146f21be3466e88dc1613f93267c3 to Vercel (replacing invalid key)
- Researched AliMantach/tiktok-streak-bot (375 lines, Playwright-based TikTok DM via DOM automation)
- Installed playwright-core (NOT playwright — no browser binaries needed, Browserless.io provides browser)
- Created src/lib/tiktok-dm.ts — full TikTok DM engine with Browserless.io integration
  - Dynamic imports for playwright-core and db (avoids Vercel serverless bundling issues)
  - Cookie-based session persistence in SystemSetting table
  - Anti-detection: custom UA, human-like typing (30ms/char), popup dismissal
  - Login via email/password or Google OAuth
  - Single DM, bulk DM, screenshot debug, session management
- Created src/app/cmd/tiktok-dm/route.ts — API route with actions: status, login, send, bulk_send, clear_session, screenshot
- Updated src/app/cmd/outbound/route.ts — added tiktok_dm action and TikTok status
- Updated next.config.ts — added playwright-core to serverExternalPackages
- Added env vars: BROWSERLESS_TOKEN, TIKTOK_USERNAME, TIKTOK_PASSWORD

Stage Summary:
- ManyChat key deployed but API returns 'Wrong token' (key may need verification in ManyChat dashboard)
- TikTok DM engine deployed and status endpoint confirmed working
- Browserless token shows 'missing' — user needs to provide their Browserless.io API token
- Files created: src/lib/tiktok-dm.ts, src/app/cmd/tiktok-dm/route.ts
- Files modified: next.config.ts, src/lib/config.ts, src/app/cmd/outbound/route.ts, package.json
