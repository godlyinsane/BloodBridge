# RaktSetu Feature Hub

This branch adds the Feature Hub to the existing RaktSetu MERN application. It preserves the existing donor, recipient, camp, blood-bank, admin, inventory and traceability flows. It does **not** add the previously excluded voice assistant or consent-based donor privacy vault.

## Feature areas

1. **Shortage forecasting:** a least-squares regression fitted to recent daily request units, blended with the recent 7-day baseline. It reports trend direction and in-sample mean absolute error; this is a lightweight data-fitted model, not a large externally trained AI system.
2. **Notifications:** in-app donor notifications, with optional email/push webhook delivery. SMS notifications are intentionally deferred and are not sent by Feature Hub.
3. **Inventory integration:** existing scoped hospital API endpoints plus a validated admin JSON import. Imported units start quarantined and pending screening.
4. **Donor appointment booking:** public booking form with server-side validation, a MongoDB-backed rate limiter shared across serverless instances, idempotent retry references, confirmation status, and offline retry queue.
5. **Emergency logistics:** OSRM road-route attempt with a clearly labelled straight-line fallback when routing is unavailable. Not live-traffic navigation.
6. **Donor profile/history:** authenticated donor endpoint and UI showing linked appointment history and eligibility reminder context.
7. **Digital donor ID/certificates:** QR-enabled donor ID and exportable record for completed appointments. These are RaktSetu records, not government IDs or substitutes for official blood-bank certificates.
8. **Blood-bank map directory:** optional coordinates, address, phone, opening hours and directions links. Existing donor map and camp directory remain intact.
9. **Request-risk review:** explainable repeated-demand flags for human review only; requests are never automatically denied.
10. **Language/accessibility:** English/Hindi booking labels, semantic labels and status messages. Clinical/legal text still needs professional translation review.
11. **Hospital integration hub:** existing scoped API keys and partner endpoints under `/api/advanced/integrations`.
12. **Donor retention:** verified donor reminder candidates and in-app re-engagement. SMS is intentionally deferred.
13. **Cold-chain tracking:** audited temperature events. Staff must enter the applicable component-specific limits; out-of-range readings quarantine an eligible unit for review.
14. **Analytics:** aggregate-only analytics and JSON exports that omit donor/recipient names.
15. **Backup/recovery:** daily Vercel Cron trigger at 03:00 UTC, plus an admin manual trigger. Actual backups require a trusted external backup webhook or managed MongoDB backups.
16. **Security:** role-protected routes, input validation, scoped partner keys, public appointment throttling, timing-safe cron-secret comparison, and no secret values in diagnostics.
17. **Testing/monitoring:** Node test coverage for planning/validation policies, backend syntax checks, frontend production build CI, and protected runtime diagnostics.
18. **Low-network mode:** offline appointment requests are stored in browser local storage and retried when connectivity returns. Live matching/inventory still require connectivity.

## Environment configuration

Required by the existing application:
- `MONGO_URI`
- `JWT_SECRET` (at least 32 characters)

Optional feature integrations:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `DEFAULT_SMS_COUNTRY_CODE` (defaults to `+91`)
- `NOTIFICATION_WEBHOOK_URL` (trusted HTTPS provider endpoint for email and/or push delivery)
- `NOTIFICATION_WEBHOOK_TOKEN` (required bearer token whenever the email/push webhook is enabled)
- `MONGODB_BACKUP_WEBHOOK` (trusted HTTPS endpoint that starts a backup in the chosen provider)
- `MONGODB_BACKUP_WEBHOOK_TOKEN` (required bearer token for the backup webhook)
- `CRON_SECRET` (at least 32 characters; Vercel Cron sends this as `Authorization: Bearer <secret>`)

Do not put these secrets in frontend environment variables or commit them to GitHub. Configure them in Vercel Project Settings → Environment Variables. The scheduled backup returns a configuration error until the cron secret, backup webhook URL, and backup webhook token are configured. The external webhook must create/verify the actual backup; RaktSetu does not fabricate a successful backup when the provider is unavailable. Partner integration readiness is reported only when an active, non-expired integration key exists. Appointment rate limits are stored in MongoDB using a keyed hash of the client address, not a raw IP address.

## Main API endpoints

- Public: `GET /api/features/languages`, `GET /api/features/map/banks`, `POST /api/features/appointments/book`
- Donor-authenticated: `GET /api/features/donor/profile`, `GET /api/features/donor/digital-id`, `GET /api/features/donor/certificate/:appointmentId`
- Admin-authenticated: `GET /api/features/forecast`, `POST /api/features/notifications/send`, `POST /api/features/inventory/import`, `POST /api/features/logistics/route`, `GET /api/features/risk-review`, `GET /api/features/retention/candidates`, `POST /api/features/retention/send`, `POST /api/features/cold-chain/:unitCode`, `GET /api/features/cold-chain`, `GET /api/features/analytics`, `GET /api/features/integration/status`, `GET /api/features/diagnostics`, `POST /api/features/backup/trigger`
- Vercel Cron: `GET /api/features/backup/cron` (protected by `CRON_SECRET`)

## Safety notes

- Forecasts, risk indicators and donor reminder dates are decision-support hints, not medical clearance.
- Inventory must pass authorized screening before it can become available.
- Out-of-range cold-chain readings are quarantined for review, not automatically discarded.
- A completed-appointment certificate only confirms the appointment record. Official donation certificates remain the blood bank's responsibility.
- Email and push requests are sent to a configurable HTTPS webhook; that provider must map the donor ID to an email address or push subscription. SMS notifications are intentionally disabled in Feature Hub for this release and will be implemented later. Email and push are not considered configured until their provider credentials are present. Existing donor authentication flows are otherwise unchanged.
