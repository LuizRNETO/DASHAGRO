import { createClient } from '@supabase/supabase-js';

// Credentials provided by the user
const supabaseUrl = process.env.SUPABASE_URL || 'https://wbwpmorgrrcgfjmimuyv.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_Mhrdwuy3wercfJO8BwMFRQ_EEVPELP5';

// Initialize Supabase Client
export const supabase = createClient(supabaseUrl, supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials missing. Database features might not work as expected.");
}