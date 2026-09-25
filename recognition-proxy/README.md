# RECORD Recognition Public Proxy

This directory is intended to be imported as a second Vercel project with project root `recognition-proxy` and custom domain:

`https://recognition.record.officeofmethod.com/`

The deployed project does not contain provider credentials or recognition logic. It is a Vercel external-origin rewrite layer in front of the Cloudflare Worker.

After the Cloudflare Worker is deployed, run from the repository root:

```
node scripts/recognition-bootstrap.mjs --worker-origin https://<worker>.<account>.workers.dev
```

That writes `recognition-proxy/vercel.json` with:

- `/` -> Worker `/healthz`
- `/api/:path*` -> Worker `/:path*`
- no caching for API traffic

The browser therefore uses `https://recognition.record.officeofmethod.com/api` as the RECORD gateway URL while the actual stateful gateway remains the Cloudflare Worker.

The external rewrite is intentionally used instead of a Vercel Function. RECORD recognition request bodies can be larger than the Vercel Function request-body ceiling; native external rewrites proxy the request without introducing that Function hop.
