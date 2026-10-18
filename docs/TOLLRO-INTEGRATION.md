# TollRo integration status — 2026-10-18

## Implemented

The vehicle regulatory profile and fleet compliance dashboard are now implemented; see `COMPLIANCE.md`. Vehicles without confirmed registration details remain unknown. Historical vignettes are retained as records but do not satisfy TollRo, and the vehicle dashboard never treats a document expiry date as proof of a paid TollRo journey.

Official-portal handoff from owner trip details and both driver trip surfaces. Uses the selected trip's assigned truck, route and planned date. Details are copied only on user action; portal navigation contains no vehicle/trip query parameters and uses no-referrer. Demo content is labeled. Clipboard denial leaves selectable text. Cancelled trips do not offer the handoff.

This is NOT an API integration. It does not calculate tolls, buy a ticket, start a charging session, retrieve invoices, upload evidence or establish payment/validity. QFleet tracking is not a replacement for the official TollRo app/device. No external request is sent by the component until the user opens the official link.

## Required external dependency

Obtain official integration documentation and permission from CNAIR/STRR or a contracted toll provider. No public, usable API contract was identified in this review. A portal login alone is not API access. Do not reverse-engineer login/payment requests or invent endpoints.

Official references:
- https://portal.etoll.ro/web/guest/rotoll
- https://portal.etoll.ro/

Ask the provider for:
1. Supported operations and Romania availability: quotes, route tickets, payment status, invoices, cancellation/refund; supported vehicle categories.
2. Sandbox URL, OpenAPI/schema, test account, authentication scopes and credential rotation.
3. Production onboarding/accreditation/contract requirements and usage costs.
4. Idempotency and retry semantics, timeout recovery/status lookup, signed webhooks and reconciliation exports.
5. Vehicle requirements, route/time validity rules, timezone, currency, VAT and fare coverage/versioning.

Do not send keys in chat. Install secrets server-side via the deployment provider's environment settings after the contract is known; never NEXT_PUBLIC variables.

## Implementation after API access

- Extend the existing tenant-scoped regulatory profile with any provider-required fields (axles, CO2 class, dimensions). Add exact Romanian route points and start time; never assume all kilometres are taxable.
- Persist quote separately from purchase intent, official ticket and settled charge; include provider IDs, timestamps, original currency/VAT and evidence source.
- Owner confirmation for each purchase; driver normally reads assigned trip evidence. Never initiate payment on page load or start QFleet tracking as TollRo tracking.
- Stable idempotency key across retries; unknown timeout is pending verification, not failure to repay. Webhooks authenticated, replay-protected and tenant-mapped server-side.
- Reconcile provider totals before inclusion in trip costs; prevent duplicate charges and vignette/fixed-cost double counting.
- Tests: cross-firm/driver isolation, expired/incorrect route ticket, unknown/partial payment, duplicate callbacks, revoked credentials, cancellation/refund, provider downtime and amount/currency mismatch.

## Acceptance gate

Automatic integration cannot be called live until a real sandbox quote and ticket/status lifecycle are validated and production access is authorized. Opening the portal or manually recording a payment is never evidence of provider confirmation.
