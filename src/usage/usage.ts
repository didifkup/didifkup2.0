import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserUsageRow {
  user_id: string;
  analyses_used: number;
  updated_at: string;
}

/**
 * Fetch a user's usage row, inserting a default record if missing.
 */
export async function getOrCreateUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<UserUsageRow> {
  if (!userId) {
    throw new Error('[usage] userId is required');
  }

  const { data, error } = await supabase
    .from('user_usage')
    .select('user_id, analyses_used, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[usage] Failed to fetch usage: ${error.message}`);
  }

  if (data) {
    return {
      user_id: data.user_id,
      analyses_used: data.analyses_used ?? 0,
      updated_at: data.updated_at,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('user_usage')
    .insert({ user_id: userId })
    .select('user_id, analyses_used, updated_at')
    .single();

  if (insertError) {
    throw new Error(`[usage] Failed to create usage row: ${insertError.message}`);
  }

  return {
    user_id: inserted.user_id,
    analyses_used: inserted.analyses_used ?? 0,
    updated_at: inserted.updated_at,
  };
}

/**
 * Increment analyses_used for the user and return the updated row.
 */
export async function incrementUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<UserUsageRow> {
  const current = await getOrCreateUsage(supabase, userId);
  const nextCount = (current.analyses_used ?? 0) + 1;

  const { data, error } = await supabase
    .from('user_usage')
    .update({
      analyses_used: nextCount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('user_id, analyses_used, updated_at')
    .single();

  if (error) {
    throw new Error(`[usage] Failed to increment usage: ${error.message}`);
  }

  return {
    user_id: data.user_id,
    analyses_used: data.analyses_used ?? nextCount,
    updated_at: data.updated_at,
  };
}
