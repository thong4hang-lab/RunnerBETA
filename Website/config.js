/*
  Runner settings.
  Fill these in after following SETUP.md. While SUPABASE_URL is empty,
  the site runs in "preview mode": a pretend Discord login, and videos and
  journal entries are kept only in this browser.
*/
window.NQ_CONFIG = {
  // From Supabase: Project Settings → API
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Your Discord invite link, e.g. "https://discord.gg/abc123".
  // Used for the "Join the Discord" buttons and the live online/member count.
  DISCORD_INVITE_URL: "",

  // Name of the storage bucket that holds lesson videos (see supabase/schema.sql)
  VIDEO_BUCKET: "videos",

  // Video categories shown as filters in the library
  VIDEO_CATEGORIES: ["Foundations", "Market structure", "Inducement & liquidity", "Live recaps", "Psychology"],

  // Instruments offered in the journal, with dollars per 1 point move per contract
  INSTRUMENTS: {
    NQ: 20,
    MNQ: 2,
    ES: 50,
    MES: 5,
  },
};
