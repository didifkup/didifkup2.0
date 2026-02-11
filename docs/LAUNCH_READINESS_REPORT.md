# Launch Readiness Report — POST /api/analyze

## Summary

| Check | Status |
|-------|--------|
| Local dev | PASS |
| Production routing | PASS |
| OPTIONS preflight | PASS |
| POST success/fallback | PASS |
| Billing-ready OpenAI | PASS |
| Security basics | PASS |

---

## 1. Local dev

- **dev:api** `vercel dev --listen 3000` — API on port 3000
- **dev** `vite` — Frontend on 517x
- **dev:all** — Both via concurrently
- Vite proxy forwards `/api` to `http://localhost:3000` (override with `API_PROXY_TARGET`)

## 2. Production routing

- `vercel.json` rewrite `/((?!api/).*)` → `/index.html` — excludes `/api/*`
- `/api/analyze` maps to `api/analyze.ts` serverless function

## 3. OPTIONS

- Returns 200 with CORS: Allow-Origin (echo), Allow-Methods (POST, OPTIONS), Allow-Headers (Content-Type, Authorization), Vary: Origin

## 4. POST / Fallback

- OpenAI path and fallback path return the same `AnalyzeResult` shape
- OpenAI billing/quota/timeout → fallback analysis, HTTP 200, optional `usedFallback: true`
- Invalid input → 400 with `{ ok: false, error: { code, message } }`

## 5. Billing-ready OpenAI

- OpenAI only called in `api/_lib/analyzePost.ts` (server-side)
- `OPENAI_API_KEY` validated via `getAnalyzeEnv()` at runtime
- No code changes needed when billing is enabled

## 6. Security basics

- Body size cap: 50 KB (413 if exceeded)
- Per-IP rate limit: 30 req/min (in-memory)
- OpenAI timeout: 25 s → fallback on timeout

---

## Remaining risks

- **Rate limit**: In-memory only; resets on cold start; not shared across instances
- **Supabase tables**: `user_usage`, `didifkup_scenario_hashes`, etc. must exist (migrations applied)
