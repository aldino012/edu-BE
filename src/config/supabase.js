const { createClient } = require("@supabase/supabase-js");

let supabaseUser = null;
let supabaseAdmin = null;
let config = null;

const getConfig = () => {
  if (!config) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("🔍 Loading Supabase Config:", {
      SUPABASE_URL: SUPABASE_URL ? "✅" : "❌",
      SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "✅" : "❌",
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY ? "✅" : "❌",
    });

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "❌ Missing Supabase credentials in .env. Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    config = {
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  return config;
};

const getSupabaseUser = () => {
  if (!supabaseUser) {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
    supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseUser;
};

const getSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseAdmin;
};

module.exports = {
  get supabaseUser() {
    return getSupabaseUser();
  },
  get supabaseAdmin() {
    return getSupabaseAdmin();
  },
  get SUPABASE_URL() {
    return getConfig().SUPABASE_URL;
  },
  get SUPABASE_ANON_KEY() {
    return getConfig().SUPABASE_ANON_KEY;
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return getConfig().SUPABASE_SERVICE_ROLE_KEY;
  },
};
