/*
  Four seasons, four phases of a market. Each panel is an ink-wash painting
  drawn in the browser: misty peaks, a single tree, and a horizon that is the
  price path for that phase. The horizon line is an SVG stroke that draws
  itself when the panel scrolls into view.
*/
(function () {
  const panels = [...document.querySelectorAll("[data-season]")];
  if (!panels.length) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SEASONS = {
    spring: { seed: 3, bloom: 0.35, falling: 10, snow: 0, sky: [214, 196, 206], disc: { x: 0.24, y: 0.2, r: 0.07, a: 0.35 } },
    summer: { seed: 8, bloom: 1, falling: 26, snow: 0, sky: [226, 206, 214], disc: { x: 0.78, y: 0.16, r: 0.1, a: 0.42 } },
    autumn: { seed: 21, bloom: 0.4, falling: 70, snow: 0, sky: [210, 188, 190], disc: { x: 0.3, y: 0.3, r: 0.13, a: 0.3 } },
    winter: { seed: 34, bloom: 0, falling: 0, snow: 160, sky: [190, 194, 204], disc: { x: 0.74, y: 0.18, r: 0.05, a: 0.55 } },
  };

  /* The horizon: one shape per market phase, from 0 (left) to 1 (right). */
  function horizon(season, t, rand) {
    const n = (rand() - 0.5) * 0.018;
    switch (season) {
      case "spring": { // a quiet range, a quick flush below it (the spring), then lift
        const range = Math.sin(t * 19) * 0.018;
        const flush = -0.07 * Math.exp(-Math.pow((t - 0.66) / 0.035, 2));
        const lift = t > 0.72 ? (t - 0.72) * 0.22 : 0;
        return range + flush + lift + n;
      }
      case "summer": // a steady climb in steps
        return (t * 0.32) + Math.sin(t * 22) * 0.012 - 0.12 + n;
      case "autumn": { // rounding top with a failed push higher
        const top = -Math.pow((t - 0.45) * 1.7, 2) * 0.24 + 0.12;
        const upthrust = 0.05 * Math.exp(-Math.pow((t - 0.6) / 0.03, 2));
        return top + upthrust + Math.sin(t * 30) * 0.01 + n;
      }
      case "winter": // a slide down
        return 0.14 - t * 0.3 + Math.sin(t * 17) * 0.014 + n;
    }
    return 0;
  }

  function paint(panel) {
    const season = panel.dataset.season;
    const S = SEASONS[season];
    const canvas = panel.querySelector("canvas");
    const svg = panel.querySelector("svg");
    const W = Math.max(1, Math.round(canvas.clientWidth));
    const H = Math.max(1, Math.round(canvas.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rand = rng(S.seed);
    const [sr, sg, sb] = S.sky;

    // paper
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1b191e");
    bg.addColorStop(1, "#0a090b");
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    const wash = c.createRadialGradient(W * 0.55, H * 0.45, 0, W * 0.55, H * 0.45, W * 0.9);
    wash.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, 0.16)`);
    wash.addColorStop(1, `rgba(${sr}, ${sg}, ${sb}, 0)`);
    c.fillStyle = wash;
    c.fillRect(0, 0, W, H);

    // sun or moon
    const d = S.disc;
    const dr = d.r * W;
    const halo = c.createRadialGradient(d.x * W, d.y * H, dr * 0.5, d.x * W, d.y * H, dr * 3.5);
    halo.addColorStop(0, `rgba(255, 236, 244, ${d.a * 0.35})`);
    halo.addColorStop(1, "rgba(255, 236, 244, 0)");
    c.fillStyle = halo;
    c.fillRect(0, 0, W, H);
    c.fillStyle = `rgba(250, 236, 242, ${d.a})`;
    c.beginPath();
    c.arc(d.x * W, d.y * H, dr, 0, Math.PI * 2);
    c.fill();

    // ink-wash peaks, two bands fading into mist
    [[0.52, 0.32, 0.26], [0.62, 0.24, 0.4]].forEach(([base, height, alpha]) => {
      const b = base * H, hh = height * H;
      const g = c.createLinearGradient(0, b - hh, 0, b + H * 0.08);
      g.addColorStop(0, `rgba(${sr - 40}, ${sg - 40}, ${sb - 36}, ${alpha})`);
      g.addColorStop(1, `rgba(${sr - 40}, ${sg - 40}, ${sb - 36}, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-10, b + H * 0.1);
      let x = -10;
      while (x < W + 20) {
        const spire = rand() < 0.3;
        const ph = hh * (spire ? 0.7 + rand() * 0.3 : 0.25 + rand() * 0.35);
        const wd = W * (spire ? 0.05 + rand() * 0.05 : 0.1 + rand() * 0.14);
        c.quadraticCurveTo(x + wd * 0.15, b - ph * 0.6, x + wd * 0.4, b - ph);
        c.quadraticCurveTo(x + wd * 0.55, b - ph - 3, x + wd * 0.7, b - ph * 0.8);
        c.quadraticCurveTo(x + wd * 0.9, b - ph * 0.3, x + wd, b - hh * 0.1 * rand());
        x += wd;
      }
      c.lineTo(W + 20, b + H * 0.1);
      c.closePath();
      c.fill();
    });

    // horizon = price path
    const pts = [];
    const steps = 64;
    const baseY = H * 0.74;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([t * W, baseY - horizon(season, t, rand) * H]);
    }
    const land = c.createLinearGradient(0, baseY - H * 0.15, 0, H);
    land.addColorStop(0, "#151317");
    land.addColorStop(1, "#060507");
    c.fillStyle = land;
    c.beginPath();
    c.moveTo(0, H);
    pts.forEach(([x, y]) => c.lineTo(x, y));
    c.lineTo(W, H);
    c.closePath();
    c.fill();

    // the tree stands on the line
    const ti = Math.round(steps * 0.64);
    const [tx, ty] = pts[ti];
    const size = H * 0.26;
    const tips = [];
    c.lineCap = "round";
    c.strokeStyle = "#0b0a0c";
    function branch(x, y, ang, len, wid, depth) {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const bend = (rand() - 0.5) * 0.7;
      c.lineWidth = wid;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(ang + bend) * len * 0.5, y + Math.sin(ang + bend) * len * 0.5, x2, y2);
      c.stroke();
      if (depth <= 2) tips.push([x2, y2, ang]);
      if (!depth) return;
      const kids = rand() < 0.35 ? 3 : 2;
      for (let i = 0; i < kids; i++) {
        branch(x2, y2, ang + (i - (kids - 1) / 2) * (0.45 + rand() * 0.4), len * (0.66 + rand() * 0.14), Math.max(0.6, wid * 0.62), depth - 1);
      }
    }
    // trunk
    c.lineWidth = size * 0.09;
    c.beginPath();
    c.moveTo(tx, ty + 2);
    c.quadraticCurveTo(tx - size * 0.08, ty - size * 0.3, tx + size * 0.02, ty - size * 0.5);
    c.stroke();
    [-2.3, -1.75, -1.3, -0.8].forEach((a) => branch(tx + size * 0.02, ty - size * 0.5, a, size * (0.32 + rand() * 0.1), size * 0.045, 5));

    // blossoms
    if (S.bloom > 0) {
      for (const [x, y] of tips) {
        if (rand() > S.bloom) continue;
        const n = 2 + Math.floor(rand() * 4 * S.bloom);
        for (let i = 0; i < n; i++) {
          const r = (2 + rand() * 6) * (W / 320);
          const bx = x + (rand() - 0.5) * 14, by = y + (rand() - 0.5) * 12;
          const g = c.createRadialGradient(bx, by, 0, bx, by, r);
          const col = rand() < 0.3 ? "255, 236, 244" : "240, 172, 198";
          g.addColorStop(0, `rgba(${col}, 0.85)`);
          g.addColorStop(1, `rgba(${col}, 0)`);
          c.fillStyle = g;
          c.fillRect(bx - r, by - r, r * 2, r * 2);
        }
      }
    }
    // snow resting on the branches
    if (S.snow) {
      c.fillStyle = "rgba(240, 242, 248, 0.8)";
      for (const [x, y] of tips) {
        if (rand() < 0.78) continue;
        c.beginPath();
        c.ellipse(x, y - 1, 1.2 + rand() * 1.8, 0.6 + rand() * 0.6, 0, 0, Math.PI * 2);
        c.fill();
      }
    }

    // falling petals or snow
    for (let i = 0; i < S.falling; i++) {
      const x = tx + (rand() - 0.6) * W * 0.9, y = ty - size * 0.8 + rand() * size * 1.2;
      c.save();
      c.translate(x, y);
      c.rotate(rand() * Math.PI);
      c.globalAlpha = 0.4 + rand() * 0.5;
      c.fillStyle = season === "autumn" && rand() < 0.5 ? "#c98a9e" : "#f4bccf";
      c.beginPath();
      c.ellipse(0, 0, 2 + rand() * 2, 1 + rand(), 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    for (let i = 0; i < S.snow; i++) {
      c.globalAlpha = 0.25 + rand() * 0.6;
      c.fillStyle = "#f3f4f8";
      c.beginPath();
      c.arc(rand() * W, rand() * H * 0.95, 0.6 + rand() * 1.6, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // paper grain and vignette
    for (let i = 0; i < (W * H) / 90; i++) {
      c.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.08)";
      c.fillRect(rand() * W, rand() * H, 1, 1);
    }
    const vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);

    // the drawn horizon line on top
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const path = svg.querySelector("path");
    path.setAttribute("d", "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L"));
    const dot = svg.querySelector("circle");
    if (dot) {
      const [ex, ey] = pts[pts.length - 1];
      dot.setAttribute("cx", (ex - 3).toFixed(1));
      dot.setAttribute("cy", ey.toFixed(1));
    }
  }

  function paintAll() { panels.forEach(paint); }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("is-drawn"); io.unobserve(e.target); }
    }
  }, { threshold: 0.35 });
  panels.forEach((p) => (reduceMotion ? p.classList.add("is-drawn") : io.observe(p)));

  let lastW = innerWidth, t;
  addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; paintAll(); } }, 200);
  });
  // wait for layout (and fonts) before measuring
  if (document.readyState === "complete") paintAll();
  else addEventListener("load", paintAll);
})();
