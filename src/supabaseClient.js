import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://tacbchlqcmawlnxdgydm.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ag3s7wjFCNstNbSFTAMHWQ_qfS8C3cN";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
