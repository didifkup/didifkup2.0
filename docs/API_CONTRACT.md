# POST /api/analyze — Request/Response Contract

## Request

- **Method:** POST
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <supabase_access_token>`
- **Body:** JSON matching `AnalyzeInput`:

```ts
{
  happened: string;      // required, 1–2000 chars
  youDid: string;        // required, 1–2000 chars
  theyDid: string;       // required, 1–2000 chars
  relationship?: string | null;  // optional, max 2000 chars
  context?: string | null;       // optional, max 2000 chars
  tone: 'soft' | 'neutral' | 'firm';
}
```

## Success Response (HTTP 200)

Both the OpenAI path and the fallback path return the same shape (Emotional Stabilizer — ≤180 words total):

```ts
{
  risk: { label: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK'; score: number };
  stabilization: string;
  interpretation: string;
  nextMove: string;
  usedFallback?: boolean;  // present when fallback was used (OpenAI unavailable)
}
```

## Error Response (HTTP 4xx/5xx)

```ts
{ ok: false, error: { code: string; message: string } }
```

Special cases (legacy shape for client compatibility):

- **402** `{ error: 'LIMIT', message: '...' }` — Free limit reached
- **429** `{ error: 'COOLDOWN', message: '...', retry_after_hours: number }` — Scenario cooldown
- **503** `{ ok: false, error: { code: 'ANALYSIS_UNAVAILABLE', message: '...' } }` — OpenAI response could not be parsed (retry once; then friendly error)
