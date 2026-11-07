/*
  Data layer. Every page talks to window.NQ.data, which uses Supabase when it
  is configured, or the browser's local storage in preview mode.
*/
(function () {
  const cfg = window.NQ_CONFIG;
  const live = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  /* ---------- Preview-mode storage ---------- */
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem("nq:" + key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("nq:" + key, JSON.stringify(value)); } catch { /* storage blocked */ }
    },
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  const previewUser = { id: "preview-user", name: "Preview trader", avatar: null, isAdmin: true };
  const sampleVideos = [
    { id: "s1", title: "What inducement really is", description: "How price builds a pool of stops before the real move, and how to spot it on NQ.", category: "Inducement & liquidity", created_at: "2026-10-20T14:00:00Z", sample: true },
    { id: "s2", title: "Reading the NY open", description: "The first 30 minutes: where the trap usually sets, and when to stay flat.", category: "Live recaps", created_at: "2026-10-24T14:00:00Z", sample: true },
    { id: "s3", title: "Sizing NQ vs MNQ", description: "Turning a stop in points into dollars, and picking contract size from your risk.", category: "Foundations", created_at: "2026-10-28T14:00:00Z", sample: true },
  ];

  /* ---------- Auth ---------- */
  function toUser(u) {
    if (!u) return null;
    const m = u.user_metadata || {};
    return {
      id: u.id,
      name: m.custom_claims?.global_name || m.full_name || m.name || m.user_name || "Trader",
      avatar: m.avatar_url || m.picture || null,
      isAdmin: false,
    };
  }

  async function getUser() {
    if (!live) return store.get("session", null) ? previewUser : null;
    const { data } = await sb.auth.getSession();
    const user = toUser(data.session?.user);
    if (user) {
      const { data: row } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      user.isAdmin = Boolean(row);
    }
    return user;
  }

  async function signIn() {
    if (!live) {
      store.set("session", true);
      location.reload();
      return;
    }
    await sb.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: location.href.split("#")[0], scopes: "identify email" },
    });
  }

  async function signOut() {
    if (!live) store.set("session", null);
    else await sb.auth.signOut();
    location.href = "index.html";
  }

  /* ---------- Videos ---------- */
  async function listVideos() {
    if (!live) return [...store.get("videos", []), ...sampleVideos].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await sb.from("videos").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async function uploadVideo(file, meta, onProgress) {
    if (!live) {
      const row = { id: uid(), ...meta, created_at: new Date().toISOString(), file_name: file.name, preview_only: true };
      store.set("videos", [row, ...store.get("videos", [])]);
      onProgress?.(100);
      return row;
    }
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const path = `${Date.now()}-${safeName}`;
    onProgress?.(10);
    const { error: upErr } = await sb.storage.from(cfg.VIDEO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    onProgress?.(90);
    const { data, error } = await sb.from("videos").insert({ ...meta, storage_path: path }).select().single();
    if (error) throw error;
    onProgress?.(100);
    return data;
  }

  async function deleteVideo(video) {
    if (!live) {
      store.set("videos", store.get("videos", []).filter((v) => v.id !== video.id));
      return;
    }
    if (video.storage_path) await sb.storage.from(cfg.VIDEO_BUCKET).remove([video.storage_path]);
    const { error } = await sb.from("videos").delete().eq("id", video.id);
    if (error) throw error;
  }

  async function videoUrl(video) {
    if (!live || !video.storage_path) return null;
    const { data, error } = await sb.storage.from(cfg.VIDEO_BUCKET).createSignedUrl(video.storage_path, 60 * 60 * 3);
    if (error) throw error;
    return data.signedUrl;
  }

  /* ---------- Journal ---------- */
  async function listTrades() {
    if (!live) return store.get("trades", []).sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    const { data, error } = await sb.from("journal_entries").select("*").order("trade_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async function saveTrade(trade) {
    if (!live) {
      const all = store.get("trades", []);
      if (trade.id) {
        store.set("trades", all.map((t) => (t.id === trade.id ? { ...t, ...trade } : t)));
      } else {
        store.set("trades", [{ ...trade, id: uid(), created_at: new Date().toISOString() }, ...all]);
      }
      return;
    }
    const { id, ...fields } = trade;
    const query = id ? sb.from("journal_entries").update(fields).eq("id", id) : sb.from("journal_entries").insert(fields);
    const { error } = await query;
    if (error) throw error;
  }

  async function deleteTrade(id) {
    if (!live) {
      store.set("trades", store.get("trades", []).filter((t) => t.id !== id));
      return;
    }
    const { error } = await sb.from("journal_entries").delete().eq("id", id);
    if (error) throw error;
  }

  window.NQ = window.NQ || {};
  window.NQ.data = { live, getUser, signIn, signOut, listVideos, uploadVideo, deleteVideo, videoUrl, listTrades, saveTrade, deleteTrade };
})();
