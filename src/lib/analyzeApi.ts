import { supabase } from '@/lib/supabaseClient';
import type { AnalyzeInput, AnalyzeResult } from '@/lib/analyzeTypes';
import { LimitError } from '@/lib/analyzeTypes';

/**
 * Calls POST /api/analyze with the current session's access token.
 * @throws LimitError when status 402 (free limit reached)
 * @throws Error for other failures
 */
export async function analyzeSituation(input: AnalyzeInput): Promise<AnalyzeResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not signed in');
  }

  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  const url = `${base}/api/analyze`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      happened: input.happened,
      youDid: input.youDid,
      theyDid: input.theyDid,
      relationship: input.relationship ?? null,
      context: input.context ?? null,
      tone: input.tone,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 402 && body?.error === 'LIMIT') {
    throw new LimitError(body?.message ?? 'Free limit reached');
  }

  if (!res.ok) {
    throw new Error(body?.message ?? body?.error ?? `Request failed (${res.status})`);
  }

  return body as AnalyzeResult;
}
