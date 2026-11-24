# BloodBridge Emergency Response and Donor Operations

This feature set is available to authenticated administrators under the **Emergency response & donor operations** panel.

## Features
- **Emergency request tracking:** admin can update Open, Matched, and Fulfilled milestones with timestamped notes. `GET /api/productivity/tracking/:id` exposes only a short reference, blood group, unit count, urgency, status and milestones; it omits recipient identity and precise location.
- **Shortage heatmap:** `GET /api/productivity/heatmap` aggregates open requests by city/state/blood group. It is a request-demand map, not a geospatial map or inventory-aware prediction.
- **Donation appointments:** admin-only `GET/POST /api/productivity/appointments` and `PATCH /api/productivity/appointments/:id` support booking and status changes. Booking is not medical clearance.
- **Smart alert center:** `GET /api/productivity/alerts` lists high-urgency requests and expiring, expired, quarantined, and recalled units. Acknowledgements are recorded in the operations audit trail. This implementation does not send SMS, email, or push notifications.
- **Eligibility reminder candidates:** `GET /api/productivity/eligibility-reminders` lists verified donor records with at least 90 days since recorded last donation. It is a reminder queue only; it does not determine medical eligibility or send messages.
- **Aggregate analytics and CSV:** `GET /api/productivity/reports` returns counts by request, inventory, donor-verification, and appointment status. The browser exports these aggregates to CSV without personal names.
- **Expiry and recall monitoring:** included in the alert center and remains consistent with the inventory unit status safeguards.

## Configuration and limitations
No new third-party service or environment variable is required. All administrative endpoints use the existing JWT admin middleware. The public tracking endpoint is read-only and returns non-identifying status information; treat request IDs as private references and avoid publishing them. Appointment records are administrative records and are not a substitute for a donor-facing booking workflow, identity verification, or clinical screening.

Before production deployment, add automated integration tests, role-specific authorization review, rate limiting, notification-provider integration (if needed), retention policies, and operational monitoring. Eligibility intervals depend on donation type, local guidelines, and medical review; the 90-day threshold is only a configurable reminder heuristic.
