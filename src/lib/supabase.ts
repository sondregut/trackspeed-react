import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hkvrttatbpjwzuuckbqj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0iEVyPNj-hGzhPc9t5A-wQ_cy4ug9R-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
