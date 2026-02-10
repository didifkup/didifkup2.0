import type { AnalyzeInput } from './analyzeSchema.js';
import type { AnalyzeOutput } from './analyzeSchema.js';

/** Today's date as YYYY-MM-DD in UTC */
function todayUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Yesterday's date as YYYY-MM-DD in UTC */
function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Insert scenario and update streaks after successful analysis.
 * Non-blocking: logs errors but does not throw.
 */
export async function recordScenarioAndStreak(
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  userId: string,
  input: AnalyzeInput,
  inputHash: string,
  result: AnalyzeOutput
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const today = todayUtc();

    await supabase.from('didifkup_scenarios').insert({
      user_id: userId,
      input_hash: inputHash,
      happened: input.happened,
      you_did: input.youDid,
      they_did: input.theyDid,
      relationship: input.relationship ?? null,
      context: input.context ?? null,
      tone: input.tone,
      result: result as unknown as Record<string, unknown>,
      verdict: result.verdict,
    });
  } catch (err) {
    console.error('[analyze] scenario insert error:', err instanceof Error ? err.message : err);
  }

  try {
    const { data: row } = await supabase
      .from('didifkup_streaks')
      .select('last_checkin_date, current_streak, best_streak, total_checks')
      .eq('user_id', userId)
      .maybeSingle();

    const last = row?.last_checkin_date ?? null;
    const currentStreak = row?.current_streak ?? 0;
    const bestStreak = row?.best_streak ?? 0;
    const totalChecks = (row?.total_checks ?? 0) + 1;

    let newStreak: number;
    if (last === today) {
      newStreak = currentStreak;
    } else if (last === yesterdayUtc()) {
      newStreak = currentStreak + 1;
    } else {
      newStreak = 1;
    }
    const newBest = Math.max(bestStreak, newStreak);

    await supabase
      .from('didifkup_streaks')
      .upsert(
        {
          user_id: userId,
          last_checkin_date: today,
          current_streak: newStreak,
          best_streak: newBest,
          total_checks: totalChecks,
        },
        { onConflict: 'user_id' }
      );
  } catch (err) {
    console.error('[analyze] streak update error:', err instanceof Error ? err.message : err);
  }
}
