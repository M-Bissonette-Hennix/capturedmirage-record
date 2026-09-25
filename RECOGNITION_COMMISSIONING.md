# RECORD Remote Recognition Commissioning

Status: commissioning scaffold. Do not merge/enable in production until the deployed surfaces pass the checks in this document.

## Production topology

```
iPhone / Safari / RECORD PWA
https://record.officeofmethod.com
        |
        | HTTPS, device-signed request
        v
Vercel public proxy
https://recognition.record.officeofmethod.com/api
        |
        | external rewrite, no provider secret
        v
Cloudflare Worker
https://record-recognition-gateway.<account>.workers.dev
        |
        +-- Durable Object: RecordSecurityCoordinator
        |     - one-use bootstrap registration
        |     - device public-key registry
        |     - nonce replay rejection
        |     - per-device rate/budget limits
        |     - exact idempotency binding/cache
        |
        +-- OpenAI Responses API
              - model: gpt-5.6-terra
              - image detail: original
              - strict Structured Outputs
              - store: false
              - observations only, never historical authority
```

The authority chain remains:

**Vision proposes -> chess logic constrains -> user certifies -> CAPTUREDMIRAGE analyzes.**

The gateway never returns `correctMove`, never invokes Stockfish, never repairs a move from opening theory or chess quality, and signs the returned observation envelope so RECORD can verify which gateway produced it.

## Why two Office of Method subdomains

### `record.officeofmethod.com`

This is the dedicated RECORD application origin.

A dedicated origin is required because the GitHub Pages commissioning origin is deliberately treated as shared/public infrastructure by RECORD's security policy. Remote recognition is fail-closed unless:

- `dedicatedOrigin === true`;
- the actual browser origin exactly equals `requiredOrigin`;
- both frontend and gateway are HTTPS;
- a pinned P-256 gateway public key is present;
- the configured gateway URL is non-empty;
- the browser is not on `*.github.io`.

### `recognition.record.officeofmethod.com`

This is the public gateway address used by the PWA.

It is implemented as a small Vercel external-rewrite project in front of the Cloudflare Worker. This avoids moving the existing `officeofmethod.com` zone to Cloudflare merely to obtain one Worker hostname. The proxy contains no API key and no signing private key.

The stateful security boundary remains in Cloudflare because the gateway uses a Durable Object for atomic registration, replay, rate/budget and idempotency state.

## Files added for commissioning

- `vercel.json` - dedicated frontend Vercel build from verified `dist/`.
- `gateway/wrangler.jsonc` - Cloudflare Worker + Durable Object configuration.
- `scripts/recognition-bootstrap.mjs` - local key/capability generation and public production config generation.
- `scripts/verify-recognition-production.mjs` - live origin/runtime/CORS verification.
- `recognition-proxy/` - Vercel external rewrite project for the public gateway hostname.
- `.record-secrets/` - generated locally and gitignored. Never commit this directory.

## Phase 0 - prerequisites

Use a Windows machine with:

- Git;
- Node.js 22 or newer;
- npm;
- GitHub access to `M-Bissonette-Hennix/capturedmirage-record`;
- a Cloudflare account;
- the existing Office of Method Vercel team;
- an OpenAI API key with access to the Responses API and `gpt-5.6-terra`.

Do not paste provider credentials into GitHub, Vercel source, `config/runtime.json`, browser local settings or the PWA.

## Phase 1 - get the commissioning branch locally

From an existing clone:

```powershell
git fetch origin
git switch record-recognition-commissioning
git pull --ff-only origin record-recognition-commissioning
npm ci
npm run check
```

The branch must be clean before continuing:

```powershell
git status --short
```

Expected: no output.

## Phase 2 - generate local commissioning credentials

From the repository root:

```powershell
npm run recognition:init
```

This creates the ignored local directory:

```
.record-secrets/
```

Important generated files include:

- `gateway-private-jwk.json` - P-256 signing private key. SECRET.
- `gateway-public-jwk.json` - matching public verification key.
- `gateway-key-id.txt` - response signing key identifier.
- `bootstrap-token-id.txt` - registration capability identifier.
- `bootstrap-secret.txt` - registration capability secret. SECRET.
- `bootstrap-capability.txt` - `TOKEN_ID.SECRET`; enter this once in RECORD during device registration. SECRET.
- `deploy-cloudflare.ps1` - locally generated deployment wrapper.

The private signing key and bootstrap capability must remain outside Git.

Do not use `--force` unless intentionally rotating all generated commissioning credentials before production use.

## Phase 3 - authenticate Wrangler safely

Wrangler can keep OAuth credentials in the operating-system keyring. Run:

```powershell
npx wrangler@4.138.0 login --use-keyring
```

Complete the Cloudflare browser authorization.

Then verify the active account:

```powershell
npx wrangler@4.138.0 whoami
```

## Phase 4 - deploy the stateful recognition Worker

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".record-secrets\deploy-cloudflare.ps1"
```

The script prompts for the OpenAI API key using a non-echoing secure prompt.

It then creates one temporary ignored JSON secret bundle in `.record-secrets`, deploys the Worker with `--secrets-file`, and deletes that temporary bundle in a `finally` block.

The deployed Worker requires:

- `RECORD_GATEWAY_PRIVATE_JWK`
- `RECORD_GATEWAY_PUBLIC_JWK`
- `RECORD_GATEWAY_KEY_ID`
- `RECORD_BOOTSTRAP_TOKEN_ID`
- `RECORD_BOOTSTRAP_SECRET`
- `RECORD_OPENAI_API_KEY`

Non-secret production configuration is frozen in `gateway/wrangler.jsonc`:

- exact allowed browser origin: `https://record.officeofmethod.com`;
- provider: `openai-responses`;
- model: `gpt-5.6-terra`;
- provider timeout: 30 seconds;
- registration limit: 5/minute;
- recognition burst limit: 10/minute/device;
- initial daily recognition budget: 25/device.

Cloudflare should print a production Worker URL resembling:

```
https://record-recognition-gateway.<your-account-subdomain>.workers.dev
```

Copy that exact HTTPS origin.

Test its no-secret health endpoint:

```powershell
Invoke-RestMethod "https://record-recognition-gateway.<your-account-subdomain>.workers.dev/healthz"
```

Expected fields include:

```json
{
  "ok": true,
  "service": "record-recognition-gateway"
}
```

## Phase 5 - generate the tracked public production configuration

Run, substituting the exact Worker origin:

```powershell
node scripts/recognition-bootstrap.mjs --worker-origin "https://record-recognition-gateway.<your-account-subdomain>.workers.dev"
```

This changes/creates only public deployable configuration:

- `config/runtime.production.json`
- `recognition-proxy/vercel.json`

The repository's normal `config/runtime.json` is **not changed**. GitHub Pages and ordinary local builds therefore remain fixture-only/fail-closed. Only the dedicated Vercel frontend uses `npm run build:production`, which reads `config/runtime.production.json`.

The resulting **dedicated-origin production runtime** is intentionally:

```text
dedicatedOrigin = true
requiredOrigin = https://record.officeofmethod.com
gatewayEnabled = true
gatewayUrl = https://recognition.record.officeofmethod.com/api
providerProfile = remote
gatewayPublicJwk = <generated public P-256 key>
```

The private P-256 key remains only in Cloudflare plus your ignored local backup.

Inspect Git status:

```powershell
git status --short
```

There must be no `.record-secrets` path in the output.

Now rerun all local gates:

```powershell
npm run check
npm run build
npm run check:dist
npm run build:production
npm run check:dist
```

The normal `npm run build` should report that the remote gateway is disabled. The subsequent `npm run build:production` should explicitly report that the remote gateway is enabled.

## Phase 6 - commit the public production configuration

After the gates pass:

```powershell
git add config/runtime.production.json recognition-proxy/vercel.json
git commit -m "Commission RECORD dedicated origin and public recognition proxy"
git push origin record-recognition-commissioning
```

Do not add `.record-secrets`.

## Phase 7 - create the dedicated RECORD Vercel project

The existing Office of Method Vercel team already owns the working `officeofmethod.com` project. Create a separate project for RECORD rather than modifying the main site.

In Vercel:

1. Open the **Office of Method** team.
2. Select **Add New -> Project**.
3. Import the GitHub repository `M-Bissonette-Hennix/capturedmirage-record`.
4. Use the repository root as **Root Directory**.
5. Name the project something explicit such as `capturedmirage-record`.
6. Do not override the tracked `vercel.json`.
7. Confirm the effective build settings are:
   - Install: `npm ci`
   - Build: `npm run build`
   - Output Directory: `dist`
8. Deploy the branch after the public production configuration has been committed.
9. Open **Project Settings -> Domains**.
10. Add:
    `record.officeofmethod.com`

Because `officeofmethod.com` is already attached to the same Vercel team, Vercel may be able to configure the subdomain automatically. If Vercel instead displays a required DNS record, create exactly the record it shows. Do not change the apex or `www` records for the existing Office of Method site.

Wait until Vercel shows the domain as valid and HTTPS is active.

Confirm:

```powershell
Invoke-WebRequest "https://record.officeofmethod.com/" -UseBasicParsing
Invoke-RestMethod "https://record.officeofmethod.com/config/runtime.json"
```

Do not continue if the **deployed production** runtime still says `gatewayEnabled: false` or `providerProfile: fixture`.

## Phase 8 - create the recognition proxy Vercel project

Create a second Vercel project from the same GitHub repository:

1. **Add New -> Project**.
2. Import `M-Bissonette-Hennix/capturedmirage-record` again.
3. Set **Root Directory** to:
   `recognition-proxy`
4. Name it, for example:
   `record-recognition-proxy`
5. Deploy.
6. In **Settings -> Domains**, add:
   `recognition.record.officeofmethod.com`
7. If Vercel requests a DNS record, create exactly that record without modifying the main site's apex/`www` configuration.

The generated `recognition-proxy/vercel.json` sends:

- `/` -> Worker `/healthz`;
- `/api/:path*` -> Worker `/:path*`.

Therefore:

```powershell
Invoke-RestMethod "https://recognition.record.officeofmethod.com/"
```

must return the Worker health payload.

## Phase 9 - verify the complete public topology

From the repository root:

```powershell
npm run recognition:verify
```

The verifier requires all of the following:

- `https://record.officeofmethod.com/` is live and looks like RECORD;
- production `runtime.json` enables the dedicated remote gateway;
- the pinned P-256 public key is present;
- `https://recognition.record.officeofmethod.com/api/healthz` reaches the Worker;
- CORS preflight from the exact RECORD origin succeeds;
- a foreign origin is rejected.

Do not register a device until this verifier passes.

## Phase 10 - migrate existing local RECORD data to the new origin

Browser storage is origin-scoped.

Your existing GitHub Pages installation and the new dedicated domain are different origins:

```
https://m-bissonette-hennix.github.io/capturedmirage-record/
https://record.officeofmethod.com/
```

IndexedDB does not automatically transfer between them.

Before deleting the old Home Screen installation:

1. Open the old GitHub Pages RECORD.
2. Go to **LIBRARY**.
3. Export a verified RECORD backup.
4. Save it to Files/iCloud Drive.
5. Open `https://record.officeofmethod.com/` in Safari.
6. Restore that backup.
7. Confirm game counts, source pages and at least one Capsule/PGN.
8. Only after validation, replace the old Home Screen icon with the dedicated-origin installation.

Do not rely on IndexedDB alone as archival truth.

## Phase 11 - register the iPhone with the gateway

On the new dedicated-origin PWA:

1. Open **SYSTEM**.
2. Open **Recognition gateway / Configure**.
3. Select the remote provider profile if it is not already selected.
4. On the commissioning computer, open:
   `.record-secrets/bootstrap-capability.txt`
5. Copy the complete `TOKEN_ID.SECRET` value.
6. Paste it into the bootstrap capability field in RECORD.
7. Select **REGISTER DEVICE**.

The bootstrap capability is one-use. The gateway stores only the device public key and marks the capability consumed atomically.

After registration, SYSTEM should show the device as registered.

Keep the ignored local commissioning secrets in secure offline storage until commissioning is complete. The bootstrap capability itself is already consumed after successful registration.

## Phase 12 - first real recognition test

Use a disposable/noncritical scoresheet first.

1. Create a new test RECORD.
2. Capture a clear JPEG/PNG scoresheet page.
3. Confirm source hash and capture-quality warnings.
4. Select **RECOGNIZE**.
5. RECORD creates a signed request over the derived JPEG.
6. The gateway verifies:
   - exact allowed origin;
   - registered device;
   - request signature;
   - timestamp;
   - nonce;
   - body SHA-256;
   - derived-image SHA-256;
   - idempotency binding;
   - rate/daily budget.
7. The gateway sends only the locally derived recognition JPEG to the configured OpenAI model.
8. The provider returns strict observation data.
9. The gateway validates it, signs the envelope and caches the exact idempotent response.
10. RECORD verifies the pinned gateway signature before accepting the observations.

Then inspect REVIEW rather than accepting reconstruction blindly.

Expected doctrine remains:

**Recognition is evidence-adjacent assistance, not historical authority.**

## Phase 13 - commissioning acceptance tests

Before using remote recognition for tournament records, explicitly test:

- wrong-origin request -> rejected;
- reused bootstrap capability -> rejected;
- unregistered device recognition -> rejected;
- body mutation -> rejected;
- derivative SHA mismatch -> rejected;
- nonce replay -> rejected;
- exact retry -> same cached response;
- deliberate rerun -> new request identity and supersession relation;
- provider timeout -> retryable failure;
- malformed provider output -> gateway 502/fail-closed;
- provider attempt to introduce historical authority -> rejected;
- response signature mismatch -> rejected by browser;
- 25/day device budget -> enforced;
- offline queue resumes only when RECORD is foregrounded/online;
- source mutation invalidates stale recognition/certification relationships;
- final certification still requires human review.

## Phase 14 - operational security

Never commit or place in frontend code:

- OpenAI API key;
- gateway private JWK;
- bootstrap secret/capability.

Public/tracked values are allowed to include:

- `record.officeofmethod.com`;
- `recognition.record.officeofmethod.com`;
- Worker public health URL;
- gateway key ID;
- gateway public JWK.

The OpenAI adapter uses the Responses API with `store:false`, original-detail image input and a strict observation-only JSON schema. Provider/org retention and API billing should still be reviewed as part of ongoing operations.

The initial recognition budget is intentionally conservative. Raise it only after observing real tournament usage and cost.

## Rollback

If anything behaves unexpectedly, fail closed by replacing `config/runtime.production.json` with:

```json
{
  "dedicatedOrigin": false,
  "requiredOrigin": "",
  "gatewayEnabled": false,
  "gatewayUrl": "",
  "gatewayPublicJwk": null,
  "providerProfile": "fixture"
}
```

Redeploy the frontend.

This immediately removes the browser's ability to invoke remote recognition. Existing source evidence, manual reconstruction, certification, PGN, Capsule and backup workflows remain available.
