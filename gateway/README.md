# RECORD 0.3.3 Recognition Gateway Reference

The gateway is commissioned separately from GitHub Pages. Do not enable remote recognition until RECORD is served from a dedicated HTTPS origin.

## Required bindings/configuration

- `RECORD_ALLOWED_ORIGIN` — exact dedicated RECORD origin.
- `RECORD_BOOTSTRAP_TOKEN_ID` / `RECORD_BOOTSTRAP_SECRET` — one-use registration capability values; never commit secrets.
- `RECORD_GATEWAY_PRIVATE_JWK` — P-256 response-signing private JWK.
- `RECORD_GATEWAY_PUBLIC_JWK` — matching public JWK, pinned into the frontend runtime configuration.
- `RECORD_GATEWAY_KEY_ID` — signing-key identifier.
- `RECORD_REGISTRATION_PER_MINUTE`, `RECORD_REQUESTS_PER_MINUTE`, `RECORD_DAILY_REQUEST_LIMIT` — bounded abuse controls.
- `RECORD_PROVIDER_MODE` — `fixture` or a concrete adapter such as `openai-responses`.
- Provider-specific backend credentials (for the OpenAI adapter, `OPENAI_API_KEY` and configured model as expected by `providers.mjs`).
- `RECORD_SECURITY` — Durable Object namespace bound to `RecordSecurityCoordinator`.

## Security coordinator

The Durable Object reference provides a single transaction domain for:

- one-use bootstrap consumption;
- registered-device uniqueness;
- device signature authorization;
- nonce replay state;
- burst/daily accounting;
- device-namespaced/full-binding idempotency reservations;
- response completion/release.

This closes the non-atomic KV race weakness identified in the 0.2 hostile audit.

## Recognition request

The browser sends `application/octet-stream` consisting of bounded metadata length + JSON metadata + exact recognition JPEG derivative bytes. Request headers bind device ID, timestamp, nonce, body SHA-256, signature and idempotency key.

The worker independently recomputes both body SHA-256 and derivative-image SHA-256 before provider invocation.

## Provider boundary

Provider adapters return structured observations. The bundled OpenAI Responses adapter uses image input plus strict JSON-Schema Structured Outputs and explicitly sets `store:false`; provider/org retention policy must still be reviewed during commissioning. The worker rejects a provider attempt to introduce `correctMove`, validates the normalized envelope and signs it with the gateway key.

The gateway contains no Stockfish repair, opening-theory assumption or historical chess authority.

## Commissioning requirement

Source correctness is not deployment evidence. Before real recognition is enabled, adversarially test the deployed origin/gateway for bootstrap reuse, device overwrite, replay races, concurrent rate/budget behavior, exact retry, deliberate rerun, provider timeout/oversize response, key rotation and hostile document content.
