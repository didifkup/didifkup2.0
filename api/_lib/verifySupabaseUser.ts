/** Verify Supabase user via Auth REST API. Returns user id or null. */
export async function verifySupabaseUser(
  accessToken: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ id: string } | null> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseKey,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? { id: user.id } : null;
}
