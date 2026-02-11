import type { AnalyzeInput } from './analyzeSchema.js';
import type { AnalyzeOutput } from './analyzeSchema.js';

/** Yesterday's date as YYYY-MM-DD in UTC */
function yesterdayUtc(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

/**
 * Insert scenario and update streaks after successful analysis.
 * Non-blocking: logs errors but does not throw.
 */
export async function recordScenarioAndStreak(
  supabase: any,
  userId: string,
  input: AnalyzeInput,
  inputHash: string,
  result: AnalyzeOutput
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const scenarios = supabase.from('didifkup_scenarios') as any;
    const verdictFromRisk = (result as { risk?: { label?: string } }).risk?.label?.replace(/\s*RISK\s*$/i, '').toLowerCase() ?? 'medium';
    await scenarios.insert({
      user_id: userId,
      input_hash: inputHash,
      happened: input.happened,
      you_did: input.youDid,
      they_did: input.theyDid,
      relationship: input.relationship ?? null,
      context: input.context ?? null,
      tone: input.tone,
      result: result as unknown as Record<string, unknown>,
      verdict: verdictFromRisk,
    });
  } catch (err) {
    console.error('[analyze] scenario insert error:', err instanceof Error ? err.message : err);
  }

  try {
    const streaks = supabase.from('didifkup_streaks') as any;
    const { data: row } = await streaks
      .select('last_checkin_date, current_streak, best_streak, total_checks')
      .eq('user_id', userId)
      .maybeSingle();

    const last = row != null && row.last_checkin_date != null ? String(row.last_checkin_date).slice(0, 10) : null;
    const currentStreak = row != null && row.current_streak != null ? Number(row.current_streak) : 0;
    const bestStreak = row != null && row.best_streak != null ? Number(row.best_streak) : 0;
    const totalChecks = (row != null && row.total_checks != null ? Number(row.total_checks) : 0) + 1;

    let newStreak: number;
    if (last === today) {
      newStreak = currentStreak;
    } else if (last === yesterdayUtc()) {
      newStreak = currentStreak + 1;
    } else {
      newStreak = 1;
    }
    const newBest = Math.max(bestStreak, newStreak);

    await streaks.upsert(
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
