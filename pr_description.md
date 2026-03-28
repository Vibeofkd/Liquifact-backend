## Summary

Adds **optional API key authentication** for trusted machine-to-machine (service-to-service) clients. Keys are scoped to specific permissions and support instant revocation — all without requiring a database.

Closes: *(link the relevant issue here, e.g. `#42`)*

---

## Motivation

The existing `authenticateJWT` middleware is designed for user-facing sessions. Service clients (e.g. a billing pipeline, a data-ingestion worker) do not hold user sessions — they need a simpler, long-lived credential with tightly scoped permissions. API keys fill this gap while remaining fully compatible with the existing JWT path.

---

## What Changed

### [src/config/apiKeys.js](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/src/config/apiKeys.js) *(new)*
- Parses and validates the `API_KEYS` environment variable — a semicolon-separated list of JSON objects.
- Enforces structural constraints on every entry: `lf_` prefix, minimum key length (10 chars), non-empty `clientId`, non-empty `scopes` array drawn from the allowlist, optional boolean `revoked` flag.
- Builds a `Map<key → entry>` for O(1) lookup and detects duplicate keys at startup.
- Registry is loaded fresh on every middleware invocation (no module-level cache) so that environment changes in tests — and future live-reload scenarios — work correctly without interference.

### [src/middleware/apiKeyAuth.js](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/src/middleware/apiKeyAuth.js) *(new)*
- Express middleware factory: [authenticateApiKey({ requiredScope?, env? })](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/src/middleware/apiKeyAuth.js#25-83).
- Three-stage validation per request:
  1. **Presence** — `401` if `X-API-Key` header is missing or blank.
  2. **Registry lookup + revocation** — `401` if key is unknown or revoked.
  3. **Scope check** (optional) — `403` if `requiredScope` is set but the key does not hold it.
- On success, populates `req.apiClient = { clientId, scopes }` for downstream handlers.

### [tests/unit/apiKeyAuth.test.js](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/tests/unit/apiKeyAuth.test.js) *(new)*
42 tests across 14 `describe` blocks covering:
- [parseApiKeys](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/src/config/apiKeys.js#100-132), [validateEntry](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/src/config/apiKeys.js#40-99), [buildKeyRegistry](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/src/config/apiKeys.js#133-154), [loadApiKeyRegistry](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/src/config/apiKeys.js#155-168) (pure unit tests — no HTTP)
- Middleware: missing key, blank key, invalid key, revoked key, scope mismatch, scope match, all-scope pass, whitespace trimming, empty registry, malformed `API_KEYS` env

### [README.md](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/README.md) *(updated)*
New **API Key Authentication** section covering: header name, `API_KEYS` schema table, scope table, error-response table, zero-downtime key rotation steps, and a usage code example.
Updated **Project structure** diagram to include all new files.

### [.env.example](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/.env.example) *(updated)*
Documents `API_KEYS` format, per-field schema, a copy-paste example with one active and one revoked entry, key rotation notes, and `JWT_SECRET`.

### [.gitignore](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/.gitignore) *(updated)*
Added `coverage` to prevent the Jest coverage report from being tracked.

---

## Available Scopes

| Scope | Grants access to |
|---|---|
| `invoices:read` | `GET /api/invoices` — list active invoices |
| `invoices:write` | `POST /api/invoices` — create / modify invoices |
| `escrow:read` | `GET /api/escrow/:id` — read escrow state |

---

## Key Rotation (zero-downtime)

1. **Add** the new key entry alongside the existing one in `API_KEYS`.
2. **Deploy** — both keys accept traffic.
3. **Update** the calling service to use the new key.
4. **Revoke** the old key: set `"revoked": true` in its entry and redeploy.
5. *(Optional)* Remove the revoked entry in a follow-up deploy.

---

## Security Notes

- Keys must carry the `lf_` prefix and be at least 10 characters — prevents accidental short / generic strings from being accepted.
- Revocation is checked on **every request** with no TTL window; a revoked key is rejected immediately after deploy.
- No secrets are logged. `req.apiClient` exposes only `clientId` and `scopes`, never the raw key.
- A `security/detect-object-injection` false-positive on the constant-keyed header access (`req.headers[API_KEY_HEADER]`) is suppressed with an inline `eslint-disable` comment, consistent with the pattern already used in [src/index.js](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/src/index.js).
- The [env](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/.env) parameter on both [loadApiKeyRegistry](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/src/config/apiKeys.js#155-168) and [authenticateApiKey](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/src/middleware/apiKeyAuth.js#25-83) defaults to `process.env` but can be overridden in tests — this keeps tests fully isolated without module-level mocking.

---

## Test Output

```
PASS  tests/unit/apiKeyAuth.test.js
  config/apiKeys — parseApiKeys         (11 tests)
  config/apiKeys — validateEntry        (12 tests)
  config/apiKeys — buildKeyRegistry      (3 tests)
  config/apiKeys — loadApiKeyRegistry    (2 tests)
  middleware/apiKeyAuth — ...           (14 tests)

Tests: 42 passed, 42 total

--------------|---------|----------|---------|---------|
File          | % Stmts | % Branch | % Funcs | % Lines |
--------------|---------|----------|---------|---------|
apiKeys.js    |     100 |    97.05 |     100 |     100 |
apiKeyAuth.js |     100 |    86.66 |     100 |     100 |
--------------|---------|----------|---------|---------|
```

> The two uncovered branches are the `env = process.env` default-parameter paths — intentionally unreachable in tests where [env](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/.env) is always passed explicitly.
>
> 📄 Full test file: [tests/unit/apiKeyAuth.test.js](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/tests/unit/apiKeyAuth.test.js)

---

## Usage Example

> Source: [src/middleware/apiKeyAuth.js](https://github.com/dohoudaniel/Liquifact-backend/blob/feature/api-key-auth-mode/src/middleware/apiKeyAuth.js)

```js
const { authenticateApiKey } = require('./src/middleware/apiKeyAuth');

// Any valid, non-revoked key accepted
app.get('/api/invoices', authenticateApiKey(), handler);

// Scope-guarded — key must hold invoices:write
app.post('/api/invoices', authenticateApiKey({ requiredScope: 'invoices:write' }), handler);
```

`req.apiClient` on a successful request:
```json
{
  "clientId": "billing-service",
  "scopes": ["invoices:read", "invoices:write"]
}
```

---

## Checklist

- [x] New files follow JSDoc requirements enforced by `eslint-plugin-jsdoc`
- [x] `npm run lint` passes with zero errors on new files
- [x] 42 tests written; all pass
- [x] 100% statement and line coverage on both new source files
- [x] [README.md](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/README.md) updated
- [x] [.env.example](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/.env.example) updated with schema, example, and rotation notes
- [x] `coverage/` added to [.gitignore](file:///home/dohoudanielfavour/Aetheris/Open-Source/Liquifact-backend/.gitignore)
- [x] No breaking changes to existing routes or middleware
