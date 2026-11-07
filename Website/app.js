/* Shared header behaviour: Discord sign-in chip, account menu, live server counts. */
(function () {
  const cfg = window.NQ_CONFIG;
  const data = window.NQ.data;

  const icons = {
    discord: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.64 12.64 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.74 19.74 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.12l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1 0 .13 12.3 12.3 0 0 1-1.87.89.08.08 0 0 0-.04.1c.36.7.77 1.36 1.22 2a.08.08 0 0 0 .09.02 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  };

  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function signInButton(extraClass = "") {
    return `<button type="button" class="btn btn-primary ${extraClass}" data-signin>${icons.discord}<span>Sign in<span class="long-label"> with Discord</span></span></button>`;
  }

  function renderAccount(slot, user) {
    if (!user) {
      slot.innerHTML = signInButton("btn-sm");
      return;
    }
    const initial = escapeHtml(user.name.charAt(0).toUpperCase());
    const avatar = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="" width="32" height="32" referrerpolicy="no-referrer">`
      : `<span class="avatar-fallback" aria-hidden="true">${initial}</span>`;
    slot.innerHTML = `
      <div class="account">
        <button type="button" class="account-chip" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu for ${escapeHtml(user.name)}">
          ${avatar}
          <span class="account-text"><small>${icons.discord}Discord</small><strong>${escapeHtml(user.name)}</strong></span>
          ${icons.chevron}
        </button>
        <div class="account-menu" role="menu" hidden>
          <a role="menuitem" href="library.html">Library</a>
          <a role="menuitem" href="journal.html">My journal</a>
          <button role="menuitem" type="button" data-signout>Sign out</button>
        </div>
      </div>`;

    const chip = slot.querySelector(".account-chip");
    const menu = slot.querySelector(".account-menu");
    const setOpen = (open) => {
      menu.hidden = !open;
      chip.setAttribute("aria-expanded", String(open));
    };
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(menu.hidden);
    });
    document.addEventListener("click", (e) => { if (!slot.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) { setOpen(false); chip.focus(); }
    });
  }

  async function loadServerStats() {
    const el = document.querySelector("[data-server-stats]");
    const code = (cfg.DISCORD_INVITE_URL || "").split("/").filter(Boolean).pop();
    if (!el || !code) return;
    try {
      const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`);
      if (!res.ok) return;
      const info = await res.json();
      const fmt = (n) => Number(n || 0).toLocaleString();
      el.innerHTML = `<span class="live-dot" aria-hidden="true"></span>${fmt(info.approximate_presence_count)} online · ${fmt(info.approximate_member_count)} members`;
      el.classList.add("is-on");
    } catch { /* counts are optional */ }
  }

  function wireInviteLinks() {
    document.querySelectorAll("[data-invite]").forEach((a) => {
      if (cfg.DISCORD_INVITE_URL) {
        a.href = cfg.DISCORD_INVITE_URL;
        a.target = "_blank";
        a.rel = "noopener";
      } else {
        a.hidden = true;
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-signin]")) data.signIn();
    if (e.target.closest("[data-signout]")) data.signOut();
  });

  // Each page waits on this to know who is signed in.
  const ready = data.getUser().catch(() => null).then((user) => {
    const slot = document.querySelector("[data-account]");
    if (slot) renderAccount(slot, user);
    document.querySelectorAll("[data-signed-out]").forEach((el) => (el.hidden = Boolean(user)));
    document.querySelectorAll("[data-signed-in]").forEach((el) => (el.hidden = !user));
    if (!data.live) document.querySelectorAll(".preview-banner").forEach((el) => el.classList.add("is-on"));
    return user;
  });

  // Put the Discord logo on every sign-in button written in the HTML.
  document.querySelectorAll("button[data-signin]").forEach((b) => {
    if (!b.querySelector("svg")) b.insertAdjacentHTML("afterbegin", icons.discord);
  });

  wireInviteLinks();
  loadServerStats();

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  Object.assign(window.NQ, { ready, icons, escapeHtml, signInButton });
})();
