import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ztabtbqtscjfvrautczj.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_rcwvxz__6OSfGvStqD5ryQ_stxVev4q',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
);
