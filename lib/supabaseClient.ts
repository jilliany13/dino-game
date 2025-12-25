import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Do not throw during SSR import; fail when used at runtime.
  console.warn('Supabase environment variables are not set.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export default supabase;
