import { supabase } from '@/lib/supabaseClient';
import type { AnalyzeInput, AnalyzeResult } from '@/lib/analyzeTypes';
import { LimitError, CooldownError } from '@/lib/analyzeTypes';

/**
 * Calls POST /api/analyze with the current session's access token.
 * @throws LimitError when status 402 (free limit reached)
 * @throws CooldownError when status 429 (scenario cooldown)
 * @throws Error for other failures
 */
export async function analyzeSituation(input: AnalyzeInput): Promise<AnalyzeResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Not signed in');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  let res: Response;
  try {
    res = await fetch('/api/analyze', {
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
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    if (text && text.trim().startsWith('{')) {
      body = (JSON.parse(text) as Record<string, unknown>) ?? {};
    }
  } catch {
    /* body stays {} */
  }

  if (res.status === 402 && body?.error === 'LIMIT') {
    throw new LimitError((body?.message as string) ?? 'Free limit reached');
  }

  if (res.status === 429 && body?.error === 'COOLDOWN') {
    throw new CooldownError(
      (body?.message as string) ?? 'You already checked this recently.',
      typeof body?.retry_after_hours === 'number' ? body.retry_after_hours : 6
    );
  }

  if (!res.ok) {
    const errObj = body?.error;
    let message: string;
    if (typeof errObj === 'object' && errObj != null && typeof (errObj as { message?: unknown }).message === 'string') {
      message = (errObj as { message: string }).message;
    } else if (typeof body?.message === 'string') {
      message = body.message;
    } else if (typeof body?.error === 'string') {
      message = body.error;
    } else if (text && text.length > 0 && !text.trim().startsWith('{')) {
      message = `Request failed (${res.status}): ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`;
    } else {
      message = `Request failed (${res.status})`;
    }
    throw new Error(message);
  }

  return body as unknown as AnalyzeResult;
}
