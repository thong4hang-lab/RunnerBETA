/* Trade journal: log trades, auto-calculate risk to reward and P&L, show stats. */
(async function () {
  const { data, escapeHtml } = window.NQ;
  const cfg = window.NQ_CONFIG;
  const user = await window.NQ.ready;
  if (!user) return;

  const FEELINGS = ["Calm", "Confident", "Patient", "Anxious", "FOMO", "Revenge", "Bored", "Tired", "Overconfident"];
  const PLAN_LABEL = { yes: "Followed plan", partly: "Partly followed", no: "Broke plan" };

  const form = document.getElementById("trade-form");
  const panel = document.getElementById("trade-panel");
  const newBtn = document.getElementById("new-trade");
  const status = document.getElementById("trade-status");
  const saveBtn = document.getElementById("save-trade");
  const list = document.getElementById("entries");

  let trades = [];

  form.instrument.innerHTML = Object.keys(cfg.INSTRUMENTS).map((k) => `<option>${k}</option>`).join("");
  const feelingOpts = FEELINGS.map((f) => `<option>${f}</option>`).join("");
  form.emotion_before.innerHTML = feelingOpts;
  form.emotion_after.innerHTML = feelingOpts;

  const num = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
  const money = (n) => (n < 0 ? "-" : n > 0 ? "+" : "") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const rFmt = (n) => (n > 0 ? "+" : "") + n.toFixed(2) + "R";

  /* The maths, shared by the live form and the saved list. */
  function calc(t) {
    const entry = num(t.entry), stop = num(t.stop), target = num(t.target), exit = num(t.exit_price);
    const contracts = num(t.contracts) || 1;
    const perPoint = cfg.INSTRUMENTS[t.instrument] ?? 20;
    const dir = t.direction === "short" ? -1 : 1;
    const out = { riskPts: null, riskUsd: null, rr: null, resultR: null, pnl: null };
    if (entry === null || stop === null) return out;
    const riskPts = (entry - stop) * dir;
    if (riskPts <= 0) return { ...out, badStop: true };
    out.riskPts = riskPts;
    out.riskUsd = riskPts * perPoint * contracts;
    if (target !== null) out.rr = ((target - entry) * dir) / riskPts;
    if (exit !== null) {
      const pts = (exit - entry) * dir;
      out.resultR = pts / riskPts;
      out.pnl = pts * perPoint * contracts;
    }
    return out;
  }

  function readForm() {
    const f = new FormData(form);
    return Object.fromEntries(f.entries());
  }

  function updateCalc() {
    const c = calc(readForm());
    const set = (id, text) => (document.getElementById(id).textContent = text);
    if (c.badStop) {
      set("c-risk", "Stop is on the wrong side");
      ["c-rr", "c-r", "c-pnl"].forEach((id) => set(id, "–"));
      return;
    }
    set("c-risk", c.riskPts === null ? "–" : `${+c.riskPts.toFixed(2)} pts · $${Math.round(c.riskUsd).toLocaleString()}`);
    set("c-rr", c.rr === null ? "–" : `1 : ${c.rr.toFixed(2)}`);
    set("c-r", c.resultR === null ? "Open" : rFmt(c.resultR));
    set("c-pnl", c.pnl === null ? "–" : money(c.pnl));
  }
  form.addEventListener("input", updateCalc);

  function renderStats() {
    const closed = trades.map((t) => ({ t, c: calc(t) })).filter((x) => x.c.resultR !== null);
    const wins = closed.filter((x) => x.c.pnl > 0).length;
    const set = (id, text) => (document.getElementById(id).textContent = text);
    set("s-count", trades.length);
    set("s-win", closed.length ? Math.round((wins / closed.length) * 100) + "%" : "–");
    set("s-avg", closed.length ? rFmt(closed.reduce((s, x) => s + x.c.resultR, 0) / closed.length) : "–");
    set("s-pnl", closed.length ? money(closed.reduce((s, x) => s + x.c.pnl, 0)) : "–");
    set("s-plan", trades.length ? Math.round((trades.filter((t) => t.followed_plan === "yes").length / trades.length) * 100) + "%" : "–");
  }

  function renderList() {
    if (!trades.length) {
      list.innerHTML = `<div class="empty"><h3>No trades yet</h3><p>Log your first trade, and your stats will start building here.</p></div>`;
      return;
    }
    list.innerHTML = trades
      .map((t) => {
        const c = calc(t);
        const resultClass = c.pnl === null ? "" : c.pnl >= 0 ? "win" : "loss";
        const resultText = c.resultR === null ? "Open" : `${rFmt(c.resultR)}`;
        const block = (label, text, wide) =>
          text ? `<div class="${wide ? "wide" : ""}"><h4>${label}</h4><p>${escapeHtml(text)}</p></div>` : "";
        const date = new Date(t.trade_date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        return `
        <details class="entry">
          <summary>
            <span class="date">${date}</span>
            <span class="title">${escapeHtml(t.instrument)} ${t.direction === "short" ? "Short" : "Long"}<small>${escapeHtml(t.setup || "")}</small></span>
            <span class="tag">${PLAN_LABEL[t.followed_plan] || ""}</span>
            <span class="result ${resultClass}">${resultText}</span>
          </summary>
          <div class="entry-body">
            ${block("Entry / stop / target / exit", [t.entry, t.stop, t.target || "–", t.exit_price || "open"].join("  /  "))}
            ${block("Contracts and risk", c.riskUsd ? `${t.contracts} × ${t.instrument}, risking $${Math.round(c.riskUsd).toLocaleString()}` : "")}
            ${block("Planned R:R and P&L", `${c.rr !== null ? "1 : " + c.rr.toFixed(2) : "No target"}${c.pnl !== null ? ", " + money(c.pnl) : ""}`)}
            ${block("Why I took it", t.reason, true)}
            ${block("Feelings", `${t.emotion_before || "–"} before, ${t.emotion_after || "–"} after`)}
            ${block("In my head", t.psychology, true)}
            ${block("Lesson", t.lesson, true)}
            ${t.chart_url ? `<div class="wide"><h4>Chart</h4><p><a href="${escapeHtml(t.chart_url)}" target="_blank" rel="noopener noreferrer">Open chart</a></p></div>` : ""}
            <div class="entry-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit="${escapeHtml(t.id)}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete="${escapeHtml(t.id)}">Delete</button>
            </div>
          </div>
        </details>`;
      })
      .join("");
  }

  async function load() {
    try {
      trades = await data.listTrades();
    } catch (err) {
      list.innerHTML = `<div class="empty"><h3>Your journal didn't load</h3><p>${escapeHtml(err.message)}. Refresh to try again.</p></div>`;
      return;
    }
    renderStats();
    renderList();
  }

  function openForm(trade) {
    form.reset();
    status.textContent = "";
    status.classList.remove("is-error");
    form.elements.id.value = trade?.id || "";
    document.getElementById("trade-form-title").textContent = trade ? "Edit trade" : "Log a trade";
    form.trade_date.value = trade?.trade_date || new Date().toLocaleDateString("en-CA");
    if (trade) {
      for (const [k, v] of Object.entries(trade)) {
        const el = form.elements[k];
        if (!el || k === "direction") continue;
        el.value = v ?? "";
      }
      form.querySelector(`input[name="direction"][value="${trade.direction}"]`).checked = true;
    }
    panel.hidden = false;
    newBtn.setAttribute("aria-expanded", "true");
    updateCalc();
    panel.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    form.trade_date.focus({ preventScroll: true });
  }

  function closeForm() {
    panel.hidden = true;
    newBtn.setAttribute("aria-expanded", "false");
    newBtn.focus();
  }

  newBtn.addEventListener("click", () => (panel.hidden ? openForm(null) : closeForm()));
  document.getElementById("cancel-trade").addEventListener("click", closeForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.classList.remove("is-error");
    const raw = readForm();
    const c = calc(raw);
    const fail = (msg, field) => { status.textContent = msg; status.classList.add("is-error"); form.elements[field]?.focus(); };
    if (!raw.trade_date) return fail("Add the date of the trade.", "trade_date");
    if (num(raw.entry) === null) return fail("Add your entry price.", "entry");
    if (num(raw.stop) === null) return fail("Add your stop loss.", "stop");
    if (c.badStop) return fail(`For a ${raw.direction} trade, the stop must be ${raw.direction === "long" ? "below" : "above"} the entry.`, "stop");

    const trade = {
      trade_date: raw.trade_date,
      instrument: raw.instrument,
      direction: raw.direction,
      contracts: num(raw.contracts) || 1,
      entry: num(raw.entry),
      stop: num(raw.stop),
      target: num(raw.target),
      exit_price: num(raw.exit_price),
      setup: raw.setup.trim(),
      chart_url: raw.chart_url.trim(),
      reason: raw.reason.trim(),
      emotion_before: raw.emotion_before,
      emotion_after: raw.emotion_after,
      followed_plan: raw.followed_plan,
      psychology: raw.psychology.trim(),
      lesson: raw.lesson.trim(),
    };
    if (raw.id) trade.id = raw.id;

    saveBtn.disabled = true;
    try {
      await data.saveTrade(trade);
      await load();
      closeForm();
    } catch (err) {
      fail("Couldn't save the trade: " + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });

  list.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");
    if (edit) openForm(trades.find((t) => t.id === edit.dataset.edit));
    if (del) {
      if (!confirm("Delete this trade from your journal?")) return;
      try {
        await data.deleteTrade(del.dataset.delete);
        await load();
      } catch (err) {
        alert("Couldn't delete the trade: " + err.message);
      }
    }
  });

  load();
})();
