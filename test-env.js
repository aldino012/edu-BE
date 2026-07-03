require("dotenv").config();

console.log("=== DEBUG ENV ===");
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "✅ Ada" : "❌ Kosong");
console.log(
  "SUPABASE_ANON_KEY:",
  process.env.SUPABASE_ANON_KEY ? "✅ Ada" : "❌ Kosong",
);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Ada" : "❌ Kosong",
);

if (process.env.SUPABASE_ANON_KEY) {
  console.log("ANON_KEY length:", process.env.SUPABASE_ANON_KEY.length);
  console.log(
    "ANON_KEY start:",
    process.env.SUPABASE_ANON_KEY.substring(0, 30),
  );
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(
    "SERVICE_KEY length:",
    process.env.SUPABASE_SERVICE_ROLE_KEY.length,
  );
  console.log(
    "SERVICE_KEY start:",
    process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 30),
  );
}
