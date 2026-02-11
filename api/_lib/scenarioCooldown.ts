import crypto from 'node:crypto';

const COOLDOWN_HOURS = 6;
const TABLE = 'didifkup_scenario_hashes';

export function computeInputHash(input: {
  happened: string;
  youDid: string;
  theyDid: string;
  relationship?: string;
  context?: string;
  tone: string;
}): string {
  const s = [
    (input.happened ?? '').trim(),
    (input.youDid ?? '').trim(),
    (input.theyDid ?? '').trim(),
    (input.relationship ?? '').trim(),
    (input.context ?? '').trim(),
    (input.tone ?? '').trim(),
  ].join('\0');
  return crypto.createHash('sha256').update(s).digest('hex');
}

export async function checkScenarioCooldown(
  supabase: any,
  userId: string,
  inputHash: string
): Promise<{ ok: true } | { ok: false; retryAfterHours: number }> {
  try {
    const tbl = supabase.from(TABLE) as any;
    const { data, error } = await tbl
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

    const remaining = COOLDOWN_HOURS - hoursSince;
    const retryAfterHours = Math.round(remaining * 10) / 10;
    return { ok: false, retryAfterHours };
  } catch (err) {
    console.error('[analyze] scenario cooldown error:', err instanceof Error ? err.message : err);
    return { ok: true };
  }
}

export async function recordScenarioSeen(
  supabase: any,
  userId: string,
  inputHash: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const tbl = supabase.from(TABLE) as any;
    await tbl.upsert(
      { user_id: userId, input_hash: inputHash, last_seen_at: now },
      { onConflict: 'user_id,input_hash' }
    );
  } catch (err) {
    console.error('[analyze] scenario record error:', err instanceof Error ? err.message : err);
  }
}
