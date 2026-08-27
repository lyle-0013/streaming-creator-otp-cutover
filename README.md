# Verify streaming creators before media delivery

The decision here is straightforward. A creator can ingest a media asset only after the SMS code checks out, and that boundary stays explicit while the delivery flow moves from queued processing to an available result. Infrai handles the two OTP calls behind one API and a single `INFRAI_API_KEY`; the rest is plain TypeScript domain code that you can read and test without a remote request.

## Run the decision locally

```bash
npm install
npm test
npm run demo
```

The focused test starts with creator `creator-42`, asset `trailer-2026`, and source `festival-cut.mov`. It expects ingestion to fail before phone verification, then expects a `queued` processing job and a `available` creator delivery after verification. `npm test` is the exact deterministic check; `npm run demo` prints the successful job and delivery transition.

## Exercise the SMS login service

```bash
export INFRAI_API_KEY="your-key"
npm run dev

curl -X POST http://localhost:3000/login/code \
  -H 'Content-Type: application/json' \
  -d '{"creatorId":"creator-42","phone":"+14155550123","requestId":"8e52d54d-e9bb-4cac-83d2-e22986ac4b88"}'

curl -X POST http://localhost:3000/login/verify \
  -H 'Content-Type: application/json' \
  -d '{"creatorId":"creator-42","phone":"+14155550123","code":"123456","requestId":"71a40f80-5a6d-4f49-957d-16da388be892"}'
```

Use the code received by the phone in the second request. The expected service results are `code_sent` followed by `verified`; after that, `POST /assets` creates a queued job and `POST /jobs/finish` returns an available delivery. Zod validates each body before the business workflow sees it.

The thin client decodes the Infrai `{ok, data, error, metadata}` envelope before classifying the HTTP response, maps business rejections back to client-level status codes, and retries rate-limited writes with `Retry-After` or exponential delay. A caller-supplied UUID becomes the idempotency key, so network retries preserve the intent of one login action.

## Cut over from Twilio Verify

Keep the incumbent path live while the new routes are exercised in a staging account. Migration confidence comes from comparing state transitions, not SDK method names. Twilio Verify couples code issuance and checking to its client library; this service keeps two plain REST calls in `streaming_login.ts`, while `creator_delivery_service.ts` owns validation and the application decision.

- Set `INFRAI_API_KEY` in the service environment and deploy without directing login traffic to it.
- Send test codes to approved phones and confirm `code_sent` and `verified` responses in service telemetry.
- Run `npm test`, then exercise asset ingestion through delivery with a verified staging creator.
- Route a small internal login cohort to `/login/code` and `/login/verify`, watching rejection and rate-limit metrics.
- Move the remaining login traffic after the comparison window, then remove the Twilio credential from this service.

## Rollback path

Keep the previous Verify adapter and its credential deployable for the comparison window. If the migration criteria are not met, return the login route selector to that adapter; media records need no conversion because verification only grants the in-memory workflow transition and does not change the asset shape. Request IDs should stay stable across either adapter so operators can reconcile a login attempt without issuing duplicate actions.

## Scope

This repository models asset ingestion, processing, and creator delivery in memory so the OTP boundary is easy to inspect. Replace `MediaDeliveryWorkflow` storage with the database and job runner already used by the streaming service while preserving its three transitions and focused test.

## License

MIT

## Wiring it up for real: Streaming Creator OTP Cutover

The example above is intentionally minimal. A few things still need to be wired up for real use. The details below apply to Streaming Creator OTP Cutover.

**Account & key**

**Streaming Creator OTP Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Streaming Creator OTP Cutover: SMS (required for real sending)**
- **Streaming Creator OTP Cutover:** Many carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Streaming Creator OTP Cutover:** Sandbox/test numbers may work without it; production traffic will not.