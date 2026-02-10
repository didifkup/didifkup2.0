import { createHash } from 'node:crypto';
import type { AnalyzeInput } from './analyzeSchema.js';

const COOLDOWN_HOURS = 6;
const TABLE = 'didifkup_scenario_hashes';

export function computeInputHash(input: AnalyzeInput): string {
  const s = [
    input.happened,
    input.youDid,
    input.theyDid,
    input.relationship ?? '',
    input.context ?? '',
    input.tone,
  ].join('\0');
  return createHash('sha256').update(s).digest('hex');
}

export interface CooldownCheckResult {
  ok: true;
} | {
  ok: false;
  status: 429;
  retryAfterHours: number;
}

/**
 * Check if user is in cooldown for this scenario. Returns ok:false with 429 if blocked.
 * Call only for free users; Pro users bypass.
 */
export async function checkScenarioCooldown(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  userId: string,
  inputHash: string
): Promise<CooldownCheckResult> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('last_seen_at')
      .eq('user_id', userId)
      .eq('input_hash', inputHash)
      .maybeSingle();

    if (error) {
      console.error('[analyze] scenario cooldown fetch error:', error.message);
      return { ok: true };
    }

    const lastSeen = data?.last_seen_at;
    if (!lastSeen) return { ok: true };

    const last = new Date(lastSeen).getTime();
    const now = Date.now();
    const hoursSince = (now - last) / (1000 * 60 * 60);
    if (hoursSince >= COOLDOWN_HOURS) return { ok: true };

    const retryAfterHours = Math.ceil(COOLDOWN_HOURS - hoursSince);
    return { ok: false, status: 429, retryAfterHours };
  } catch (err) {
    console.error('[analyze] scenario cooldown error:', err instanceof Error ? err.message : err);
    return { ok: true };
  }
}

/**
 * Upsert scenario hash after successful analysis.
 */
export async function recordScenarioSeen(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  userId: string,
  inputHash: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, input_hash: inputHash, last_seen_at: now },
        { onConflict: 'user_id,input_hash' }
      );
  } catch (err) {
    console.error('[analyze] scenario record error:', err instanceof Error ? err.message : err);
  }
}
