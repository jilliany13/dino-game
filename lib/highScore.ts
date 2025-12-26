import supabase from './supabaseClient';

export async function getHighScore(userId: string): Promise<number | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('high_score')
    .eq('id', userId)
    .limit(1)
    .single();
  if (error) {
    console.warn('getHighScore error', error);
    return null;
  }
  return data?.high_score ?? 0;
}

export async function updateHighScore(userId: string, score: number): Promise<boolean> {
  // verify session user
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData?.session?.user?.id;
  if (!sessionUserId || sessionUserId !== userId) {
    throw new Error('Invalid session or user mismatch');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ high_score: score })
    .eq('id', userId);

  if (error) {
    console.warn('updateHighScore error', error);
    return false;
  }
  return true;
}
