# BloodBridge advanced operations API

These endpoints provide the advanced operations workspace and API foundations for BloodBridge. They are not a substitute for clinical review, validated blood-bank software, road-routing providers, or a security assessment.

## Admin endpoints
All require `Authorization: Bearer <admin-token>`.

- `GET /api/advanced/forecast?days=30` — transparent rolling-average shortage signal by blood group.
- `GET /api/advanced/inventory` — inventory list; optional `bloodBankId`, `status`, `group` filters.
- `POST /api/advanced/inventory` — create a traceable unit; new units always start Pending and Quarantined. A create payload cannot bypass screening by claiming a Passed result.
- `GET /api/advanced/trace/:unitCode` — unit plus audit history; the admin UI generates QR labels locally and supports printing.
- `PATCH /api/advanced/inventory/:id/testing` — record `Pending`, `Passed`, or `Failed` screening; failed/pending units remain quarantined and the change is audited.
- `PATCH /api/advanced/inventory/:id/status` — status transitions; recall/quarantine requires reason.
- `GET /api/advanced/inventory/alerts` — expiry within 7 days, expired and recalled units.
- `POST /api/advanced/logistics/route` — nearest-neighbour ordering of up to 20 supplied coordinate destinations.
- `GET /api/advanced/risk-review` — repeated-request heuristic flags for human review.
- `POST /api/advanced/resilience/simulate` — what-if demand spike / blood-bank closure simulation; the total extra-demand units are distributed exactly across groups.
- `GET /api/advanced/audit?limit=50` — recent sensitive-operation audit events.
- `GET /api/advanced/integrations/keys` — list metadata for provisioned keys (never raw keys or hashes).
- `POST /api/advanced/integrations/keys` — create a scoped integration key. The raw key is returned once only.
- `PATCH /api/advanced/integrations/keys/:id/revoke` — revoke an integration key immediately.

## Hospital / blood-bank integration endpoints
Send `x-bloodbridge-api-key: <key>`:

- `GET /api/advanced/integrations/requests` requires `requests:read`.
- `GET /api/advanced/integrations/inventory` requires `inventory:read`.
- `POST /api/advanced/integrations/inventory` requires `inventory:write`.

Keys are hashed at rest, support expiry/scopes, can be revoked from the admin workspace, and are limited to 120 requests per key per UTC minute using MongoDB-backed counters shared across backend instances. Old counter documents expire automatically after their retention window. The compound unique index must be present in the deployed database for concurrent first requests to share one counter safely.

## Automated checks\n\n- Backend policy tests run with `npm test` (Node.js built-in test runner) and cover coordinate bounds, invalid coordinate inputs, expiry/screening gates, and manual quarantine protection. CI runs these tests plus backend JavaScript syntax checks and the frontend smoke tests/build. These checks do not replace a live MongoDB-backed integration test.\n\n## Safety and operational notes

- The forecast is a rolling-average baseline, not a trained AI/ML model. It can be inaccurate if requests or inventory are incomplete.
- Inventory units with pending or failed testing are quarantined; only units explicitly recorded as test-passed and unexpired can be marked available. Integration API keys can register units but cannot self-certify testing: integration-created units always start Pending and Quarantined. Ensure test status is set only by authorized, verified blood-bank staff.
- QR labels are generated locally in the browser with the unit trace URL encoded; the code contains only the unit code, not donor or patient data. Scanning opens the app with the trace code prefilled; admin sign-in is required to retrieve the protected audit history.
- Route ordering uses straight-line distance and a rough 30 km/h estimate, not road routing or live traffic.
- Risk flags are explainable heuristics and never automatically block or label users as fraudulent.
- Resilience simulation distributes the requested extra-demand total as evenly as possible across blood groups (including any remainder) as a simple scenario assumption.
- Offline service worker caches the app shell and successfully fetched same-origin static JS/CSS assets for a better offline launch. A visible offline banner clarifies that matching, requests, and live inventory still require connectivity. It deliberately does not cache API responses or donor/patient data. Treat inventory as unavailable while offline; cached screens do not indicate live stock.
- API integration and inventory APIs require TLS in deployment. Use least-privilege admin accounts, secret management, rate limits, audit monitoring, backups, retention policies and a security review.
- These APIs do not make clinical compatibility, transfusion, donor eligibility or allocation decisions. Qualified blood-bank staff must verify all relevant decisions.
