import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://fhoovfgrecxrxbtogray.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_04rWqBmJCZO35h6a_FYdlA_Sksznwb3";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase URL or Anon Key is missing."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
