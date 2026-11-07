/*
  Runner's trades: candlestick charts redrawn from his screenshots, with the
  same entries, exits, profit zones and liquidity markings. Candles draw in
  from left to right when a chart scrolls into view, and the result numbers
  count up. Prices in the specs below come from the screenshots; the candles
  in between are generated to follow the same path.
*/
(function () {
  const canvases = [...document.querySelectorAll("[data-trade-chart]")];
  const counters = [...document.querySelectorAll("[data-count]")];
  if (!canvases.length && !counters.length) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CHARTS = {
    // NQ1! 1H: short 8 from 29,934.50 after the spike over 30,000; 28,321.25 at screenshot
    sweep: {
      seed: 5, candles: 74, tEnd: 0.8, noise: 70, wick: 55,
      min: 27750, max: 30450,
      ticks: [28000, 28400, 28800, 29200, 29600, 30000, 30400],
      path: [[0, 29450], [0.04, 29300], [0.08, 29700], [0.14, 29880], [0.2, 29960], [0.24, 29920], [0.27, 29934],
        [0.33, 29620], [0.37, 29460], [0.4, 29520], [0.43, 28950], [0.47, 28720], [0.52, 28480], [0.56, 28260],
        [0.6, 28680], [0.66, 28820], [0.7, 28760], [0.73, 28420], [0.765, 28240], [0.8, 28321]],
      spikes: [{ t: 0.25, high: 30185 }, { t: 0.56, low: 28205 }, { t: 0.775, low: 28190 }],
      zone: { t0: 0.27, t1: 0.94, from: 29934.5, to: 27830 },
      entry: 29934.5,
      last: 28321.25,
      tag: { t: 0.29, price: 29934.5, qty: "−8", text: "+$257,920" },
    },
    // NQ1! 15m: short 4 @ 31,254.25, covered 4 @ 30,892.50; 30,963.75 at screenshot
    bos: {
      seed: 9, candles: 86, tEnd: 0.86, noise: 14, wick: 10,
      min: 30840, max: 31292,
      ticks: [30880, 30960, 31040, 31120, 31200, 31280],
      path: [[0, 31150], [0.03, 31228], [0.06, 31170], [0.09, 31138], [0.12, 31195], [0.16, 31212], [0.2, 31228],
        [0.235, 31250], [0.25, 31254], [0.3, 31185], [0.36, 31160], [0.42, 31105], [0.5, 31082], [0.56, 31060],
        [0.62, 31040], [0.66, 31012], [0.7, 30962], [0.735, 30900], [0.75, 30893], [0.8, 30930], [0.86, 30964]],
      spikes: [{ t: 0.03, high: 31262 }, { t: 0.24, high: 31270 }, { t: 0.09, low: 31122 }, { t: 0.745, low: 30872 }],
      zone: { t0: 0.25, t1: 0.745, from: 31254.25, to: 30892.5 },
      risk: { t0: 0.25, t1: 0.745, from: 31254.25, to: 31268 },
      lines: [
        { price: 31263, t0: 0, t1: 0.24, dash: true, label: "$$", side: "start" },
        { price: 31122, t0: 0.04, t1: 0.17, label: "BOS", below: true, side: "start" },
        { price: 31010, t0: 0, t1: 0.72, label: "$$$", side: "start" },
        { price: 30975, t0: 0, t1: 0.72, label: "$$$", side: "start" },
        { price: 30915, t0: 0, t1: 0.72, label: "$$$", side: "start" },
      ],
      trend: { t0: 0.25, p0: 31254.25, t1: 0.745, p1: 30892.5 },
      marks: [
        { t: 0.25, price: 31270, dir: "down", text: "4 @ 31,254.25" },
        { t: 0.745, price: 30872, dir: "up", text: "4 @ 30,892.50" },
      ],
      entry: 31254.25,
      last: 30963.75,
    },
  };

  function interp(path, t) {
    for (let i = 1; i < path.length; i++) {
      if (t <= path[i][0]) {
        const [t0, p0] = path[i - 1], [t1, p1] = path[i];
        return p0 + (p1 - p0) * ((t - t0) / (t1 - t0 || 1));
      }
    }
    return path[path.length - 1][1];
  }

  function makeCandles(spec) {
    const rand = rng(spec.seed);
    const out = [];
    let prev = interp(spec.path, 0);
    for (let i = 0; i < spec.candles; i++) {
      const t = (i / (spec.candles - 1)) * spec.tEnd;
      const open = prev;
      const close = i === spec.candles - 1 ? spec.last : interp(spec.path, t) + (rand() - 0.5) * spec.noise;
      out.push({
        t, open, close,
        high: Math.max(open, close) + rand() * spec.wick,
        low: Math.min(open, close) - rand() * spec.wick,
      });
      prev = close;
    }
    for (const s of spec.spikes || []) {
      const k = out.reduce((best, c) => (Math.abs(c.t - s.t) < Math.abs(best.t - s.t) ? c : best));
      if (s.high) k.high = Math.max(k.high, s.high);
      if (s.low) k.low = Math.min(k.low, s.low);
    }
    return out;
  }

  const price = (p) => p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function axisBox(c, x, y, text, bg, fg) {
    c.font = '600 11px "Zen Kaku Gothic New", system-ui, sans-serif';
    const w = c.measureText(text).width + 12;
    c.fillStyle = bg;
    roundRect(c, x, y - 10, w, 20, 4);
    c.fill();
    c.fillStyle = fg;
    c.fillText(text, x + 6, y + 0.5);
  }

  function draw(canvas, spec, candles, progress) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    const axisW = W < 420 ? 64 : 76, padT = 18, padB = 18, padL = 10;
    const plotW = W - axisW - padL, plotH = H - padT - padB;
    const x = (t) => padL + t * plotW;
    const y = (p) => padT + ((spec.max - p) / (spec.max - spec.min)) * plotH;
    c.textBaseline = "middle";

    // grid and price axis
    c.font = '11px "Zen Kaku Gothic New", system-ui, sans-serif';
    for (const p of spec.ticks) {
      c.strokeStyle = "rgba(255, 255, 255, 0.05)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(padL, Math.round(y(p)) + 0.5);
      c.lineTo(W - axisW, Math.round(y(p)) + 0.5);
      c.stroke();
      c.fillStyle = "rgba(255, 255, 255, 0.42)";
      c.fillText(price(p), W - axisW + 8, y(p));
    }

    const overlay = Math.max(0, Math.min(1, (progress - 0.1) / 0.45));
    c.globalAlpha = overlay;

    if (spec.zone) {
      const z = spec.zone;
      c.fillStyle = "rgba(245, 169, 196, 0.13)";
      c.fillRect(x(z.t0), y(z.from), x(z.t1) - x(z.t0), y(z.to) - y(z.from));
      c.strokeStyle = "rgba(245, 169, 196, 0.45)";
      c.beginPath();
      c.moveTo(x(z.t0), y(z.to) + 0.5);
      c.lineTo(x(z.t1), y(z.to) + 0.5);
      c.stroke();
    }
    if (spec.risk) {
      const r = spec.risk;
      c.fillStyle = "rgba(255, 122, 122, 0.22)";
      c.fillRect(x(r.t0), y(r.to), x(r.t1) - x(r.t0), y(r.from) - y(r.to));
    }

    for (const L of spec.lines || []) {
      c.strokeStyle = "rgba(255, 255, 255, 0.45)";
      c.setLineDash(L.dash ? [4, 4] : []);
      c.beginPath();
      c.moveTo(x(L.t0), Math.round(y(L.price)) + 0.5);
      c.lineTo(x(L.t1), Math.round(y(L.price)) + 0.5);
      c.stroke();
      c.setLineDash([]);
      c.font = 'italic 600 11px "Zen Kaku Gothic New", system-ui, sans-serif';
      c.fillStyle = "rgba(255, 255, 255, 0.82)";
      const tw = c.measureText(L.label).width;
      const lx = L.side === "start" ? x(L.t0) + 4 : x(L.t1) - tw - 4;
      c.fillText(L.label, lx, y(L.price) + (L.below ? 9 : -8));
    }

    // entry line across the chart
    if (spec.entry) {
      c.strokeStyle = "rgba(245, 169, 196, 0.7)";
      c.setLineDash([2, 3]);
      c.beginPath();
      c.moveTo(padL, Math.round(y(spec.entry)) + 0.5);
      c.lineTo(W - axisW, Math.round(y(spec.entry)) + 0.5);
      c.stroke();
      c.setLineDash([]);
    }
    c.globalAlpha = 1;

    // candles
    const n = Math.max(0, Math.floor(candles.length * Math.min(1, progress)));
    const cw = Math.max(1.6, (plotW * (spec.tEnd / candles.length)) * 0.62);
    for (let i = 0; i < n; i++) {
      const k = candles[i];
      const up = k.close >= k.open;
      const cx = Math.round(x(k.t)) + 0.5;
      c.strokeStyle = c.fillStyle = up ? "rgba(246, 243, 244, 0.88)" : "#f5a9c4";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx, y(k.high));
      c.lineTo(cx, y(k.low));
      c.stroke();
      const top = y(Math.max(k.open, k.close));
      const h = Math.max(1, y(Math.min(k.open, k.close)) - top);
      c.fillRect(cx - cw / 2, top, cw, h);
    }

    c.globalAlpha = overlay;
    if (spec.trend) {
      const tr = spec.trend;
      c.strokeStyle = "rgba(255, 255, 255, 0.75)";
      c.setLineDash([2, 4]);
      c.beginPath();
      c.moveTo(x(tr.t0), y(tr.p0));
      c.lineTo(x(tr.t1), y(tr.p1));
      c.stroke();
      c.setLineDash([]);
    }
    for (const m of spec.marks || []) {
      const mx = x(m.t), my = y(m.price);
      c.fillStyle = m.dir === "down" ? "#f6f3f4" : "#f5a9c4";
      c.beginPath();
      if (m.dir === "down") { c.moveTo(mx - 5, my - 8); c.lineTo(mx + 5, my - 8); c.lineTo(mx, my); }
      else { c.moveTo(mx - 5, my + 8); c.lineTo(mx + 5, my + 8); c.lineTo(mx, my); }
      c.fill();
      c.font = '600 11px "Zen Kaku Gothic New", system-ui, sans-serif';
      c.fillStyle = "rgba(255, 255, 255, 0.9)";
      const tw = c.measureText(m.text).width;
      c.fillText(m.text, Math.min(Math.max(padL, mx - tw / 2), W - axisW - tw - 4), m.dir === "down" ? my - 18 : my + 18);
    }
    if (spec.tag) {
      const tx = x(spec.tag.t), ty = y(spec.tag.price);
      c.font = '700 12px "Zen Kaku Gothic New", system-ui, sans-serif';
      const qw = c.measureText(spec.tag.qty).width + 14;
      const vw = c.measureText(spec.tag.text).width + 16;
      c.fillStyle = "#ee86ab";
      roundRect(c, tx, ty - 12, qw, 24, 5);
      c.fill();
      c.fillStyle = "rgba(10, 9, 12, 0.92)";
      roundRect(c, tx + qw + 2, ty - 12, vw, 24, 5);
      c.fill();
      c.strokeStyle = "rgba(245, 169, 196, 0.6)";
      c.stroke();
      c.fillStyle = "#16070d";
      c.fillText(spec.tag.qty, tx + 7, ty + 0.5);
      c.fillStyle = "#f5a9c4";
      c.fillText(spec.tag.text, tx + qw + 10, ty + 0.5);
    }

    // price boxes on the axis
    if (spec.entry) axisBox(c, W - axisW + 2, y(spec.entry), price(spec.entry), "#ee86ab", "#16070d");
    c.globalAlpha = 1;
    if (n === candles.length) {
      c.strokeStyle = "rgba(255, 255, 255, 0.35)";
      c.setLineDash([1, 3]);
      c.beginPath();
      c.moveTo(padL, Math.round(y(spec.last)) + 0.5);
      c.lineTo(W - axisW, Math.round(y(spec.last)) + 0.5);
      c.stroke();
      c.setLineDash([]);
      axisBox(c, W - axisW + 2, y(spec.last), price(spec.last), "#f6f3f4", "#0a090b");
    }
  }

  const charts = canvases.map((canvas) => {
    const spec = CHARTS[canvas.dataset.tradeChart];
    return { canvas, spec, candles: makeCandles(spec), progress: reduceMotion ? 1 : 0, started: reduceMotion };
  });

  function animateChart(ch) {
    const start = performance.now(), dur = 1700;
    (function step(now) {
      const t = Math.min(1, (now - start) / dur);
      ch.progress = 1 - Math.pow(1 - t, 3);
      draw(ch.canvas, ch.spec, ch.candles, ch.progress);
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* Count a number up from zero, keeping its prefix, suffix and decimals. */
  function countUp(el) {
    const target = Number(el.dataset.count);
    const d = Number(el.dataset.decimals || 0);
    const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    const fmt = (v) => pre + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) + suf;
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const start = performance.now(), dur = 1800;
    (function step(now) {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const ch = charts.find((c) => c.canvas === e.target);
      if (ch) { ch.started = true; reduceMotion ? draw(ch.canvas, ch.spec, ch.candles, 1) : animateChart(ch); }
      else if (e.target.dataset.count) countUp(e.target);
      else e.target.classList.add("is-in");
    }
  }, { threshold: 0.35 });

  const start = () => {
    charts.forEach((ch) => { draw(ch.canvas, ch.spec, ch.candles, ch.progress); io.observe(ch.canvas); });
    counters.forEach((el) => io.observe(el));
    document.querySelectorAll(".perf-bars").forEach((el) => io.observe(el));
  };
  (document.fonts?.ready || Promise.resolve()).then(start);

  /* Original screenshots open full size in a viewer. */
  const viewer = document.getElementById("proof-viewer");
  if (viewer) {
    const img = viewer.querySelector("img");
    let opener = null;
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-proof]");
      if (!btn) return;
      opener = btn;
      img.src = btn.dataset.proof;
      img.alt = btn.dataset.proofAlt || "";
      viewer.showModal();
    });
    viewer.querySelector(".proof-close").addEventListener("click", () => viewer.close());
    viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });
    viewer.addEventListener("close", () => opener?.focus());
  }

  let lastW = innerWidth, timer;
  addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth === lastW) return;
      lastW = innerWidth;
      charts.forEach((ch) => draw(ch.canvas, ch.spec, ch.candles, ch.started ? 1 : ch.progress));
    }, 150);
  });
})();
