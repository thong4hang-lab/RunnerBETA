/*
  The living background: a lone sakura tree in a misty valley of rock spires.

  Painted as five depth layers (sky, far, mid and near ridges, then the tree
  and ground) so the scene can drift with the mouse and scroll. On top of
  that: a pale moon that rises as you read, the sky slowly darkening, petals
  that the cursor can blow around, a burst of petals where you click, and a
  faint glitter in the crown.

  Respects prefers-reduced-motion (one still frame, no parallax) and pauses
  while the tab is hidden.
*/
(function () {
  const canvas = document.getElementById("sakura-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(pointer: fine)");
  const PAD = 72; // extra paint around each layer so parallax never shows an edge

  let w = 0, h = 0, dpr = 1;
  let layers = [];
  let canopy = [];
  let canopyBox = { x: 0, y: 0, r: 0 };
  let groundY = 0;
  let petals = [];
  let gusts = []; // petals from click bursts; they fall once and are gone
  let sparks = [];
  let bottomFade = null;
  let running = false, last = 0;

  const look = { x: 0, y: 0, tx: 0, ty: 0 }; // eased mouse position, -1..1
  const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, t: 0 };
  let scrollEase = 0;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function petalPath(c, r) {
    c.beginPath();
    c.moveTo(0, r);
    c.bezierCurveTo(r * 1.05, r * 0.35, r * 0.7, -r, r * 0.18, -r * 0.85);
    c.lineTo(0, -r * 0.55);
    c.lineTo(-r * 0.18, -r * 0.85);
    c.bezierCurveTo(-r * 0.7, -r, -r * 1.05, r * 0.35, 0, r);
    c.closePath();
  }

  function makeLayer(depth, res, paint) {
    const off = document.createElement("canvas");
    off.width = Math.round((w + PAD * 2) * res);
    off.height = Math.round((h + PAD * 2) * res);
    const c = off.getContext("2d");
    c.scale(res, res);
    c.translate(PAD, PAD);
    paint(c);
    return { canvas: off, depth };
  }

  /* ---------- Painting the still layers ---------- */

  function paintSky(c, rand) {
    const sky = c.createLinearGradient(0, -PAD, 0, h + PAD);
    sky.addColorStop(0, "#5c5a60");
    sky.addColorStop(0.35, "#3c3b40");
    sky.addColorStop(0.7, "#1a191c");
    sky.addColorStop(1, "#050505");
    c.fillStyle = sky;
    c.fillRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);
    for (let i = 0; i < 28; i++) {
      const x = rand() * w, y = rand() * h * 0.42, r = 80 + rand() * 240;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(204, 200, 208, 0.10)");
      g.addColorStop(1, "rgba(204, 200, 208, 0)");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function paintRidge(c, rand, L) {
    c.fillStyle = L.color;
    c.beginPath();
    let x = -PAD - 20;
    c.moveTo(x, h + PAD);
    c.lineTo(x, L.base - L.height * 0.15);
    while (x < w + PAD + 40) {
      // rock pillars: steep sides, rounded tops, the odd tall spire
      const spire = rand() < 0.22;
      const peakH = spire ? L.height * (0.75 + rand() * 0.25) : L.height * (0.3 + rand() * 0.35);
      const width = spire ? 26 + rand() * 30 : 50 + rand() * 80;
      const top = L.base - peakH;
      const valley = L.base - L.height * (0.08 + rand() * 0.18);
      c.quadraticCurveTo(x + width * 0.12, top + peakH * 0.35, x + width * 0.35, top + 4);
      c.quadraticCurveTo(x + width * 0.5, top - 6, x + width * 0.65, top + 6);
      c.quadraticCurveTo(x + width * 0.9, top + peakH * 0.4, x + width, valley);
      x += width;
    }
    c.lineTo(x, h + PAD);
    c.closePath();
    c.fill();

    const fogTop = L.base - L.height * 0.6;
    const fog = c.createLinearGradient(0, fogTop, 0, L.base);
    fog.addColorStop(0, "rgba(150, 148, 156, 0)");
    fog.addColorStop(1, `rgba(150, 148, 156, ${L.fog})`);
    c.fillStyle = fog;
    c.fillRect(-PAD, fogTop, w + PAD * 2, L.height * 0.6 + 2);
    // mist keeps rolling below the ridge line
    const low = c.createLinearGradient(0, L.base, 0, L.base + h * 0.12);
    low.addColorStop(0, `rgba(150, 148, 156, ${L.fog * 0.6})`);
    low.addColorStop(1, "rgba(150, 148, 156, 0)");
    c.fillStyle = low;
    c.fillRect(-PAD, L.base, w + PAD * 2, h * 0.12);
  }

  function paintTree(c, rand) {
    const narrow = w < 760;
    const scale = Math.min(w / 1400, h / 820) * (narrow ? 1.25 : 1);

    // ground
    const ground = c.createLinearGradient(0, groundY, 0, h + PAD);
    ground.addColorStop(0, "#141316");
    ground.addColorStop(1, "#000");
    c.fillStyle = ground;
    c.fillRect(-PAD, groundY, w + PAD * 2, h - groundY + PAD);

    const trunkX = w * 0.7;
    const trunkH = h * 0.3;
    const trunkW = Math.max(26, 70 * scale);
    const topX = trunkX - trunkW * 0.15;
    const topY = groundY - trunkH;

    // trunk with flared roots
    const bark = c.createLinearGradient(trunkX - trunkW, 0, trunkX + trunkW, 0);
    bark.addColorStop(0, "#4a4447");
    bark.addColorStop(0.45, "#2b2729");
    bark.addColorStop(1, "#141213");
    c.fillStyle = bark;
    c.beginPath();
    c.moveTo(trunkX - trunkW * 1.6, groundY + 4);
    c.bezierCurveTo(trunkX - trunkW * 0.7, groundY - 6, trunkX - trunkW * 0.75, groundY - trunkH * 0.5, topX - trunkW * 0.45, topY);
    c.lineTo(topX + trunkW * 0.45, topY);
    c.bezierCurveTo(trunkX + trunkW * 0.55, groundY - trunkH * 0.5, trunkX + trunkW * 0.6, groundY - 6, trunkX + trunkW * 1.7, groundY + 4);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255, 240, 245, 0.06)";
    c.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      const ox = (rand() - 0.5) * trunkW * 0.9;
      c.beginPath();
      c.moveTo(trunkX + ox, groundY - 4);
      c.bezierCurveTo(trunkX + ox + 6, groundY - trunkH * 0.4, topX + ox * 0.6 - 4, groundY - trunkH * 0.7, topX + ox * 0.5, topY + 6);
      c.stroke();
    }

    // branches
    const tips = [];
    c.lineCap = "round";
    function grow(x, y, ang, len, wid, depth) {
      const bend = (rand() - 0.5) * 0.6;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      c.strokeStyle = depth > 3 ? "#272325" : "#3a3537";
      c.lineWidth = wid;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(ang + bend) * len * 0.5, y + Math.sin(ang + bend) * len * 0.5, x2, y2);
      c.stroke();
      if (depth <= 2) tips.push({ x: x2, y: y2 });
      if (depth === 0) return;
      const kids = rand() < 0.4 ? 3 : 2;
      for (let i = 0; i < kids; i++) {
        const spread = (i - (kids - 1) / 2) * (0.5 + rand() * 0.4);
        grow(x2, y2, ang + spread, len * (0.68 + rand() * 0.12), Math.max(1, wid * 0.62), depth - 1);
      }
    }
    const mainLen = trunkH * 0.4;
    [-2.4, -1.95, -1.57, -1.2, -0.75].forEach((a) =>
      grow(topX, topY + 6, a + (rand() - 0.5) * 0.15, mainLen * (0.8 + rand() * 0.35), trunkW * 0.36, 5)
    );

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of tips) {
      minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
    }
    canopyBox = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, r: (maxX - minX) / 2 };
    canopy = tips;
    const ry = (maxY - minY) / 2;

    // blossom crown: soft dabs, shaded underneath, near-white where the light hits
    const spots = tips.slice();
    for (let i = 0; i < tips.length * 0.6; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.8;
      spots.push({ x: canopyBox.x + Math.cos(a) * canopyBox.r * d, y: canopyBox.y + Math.sin(a) * ry * d });
    }
    function dab(x, y, r, rgb, a) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb}, ${a})`);
      g.addColorStop(0.55, `rgba(${rgb}, ${a * 0.7})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const passes = [
      { colors: ["150, 88, 112", "176, 104, 132"], alpha: 0.55, size: 1.2, dy: 12, n: 5 },
      { colors: ["233, 168, 192", "242, 188, 208", "229, 154, 182"], alpha: 0.6, size: 1, dy: 0, n: 7 },
      { colors: ["248, 211, 225", "251, 228, 237", "255, 255, 255"], alpha: 0.55, size: 0.6, dy: -12, n: 5 },
    ];
    for (const p of passes) {
      for (const s of spots) {
        const lean = p.dy < 0 ? -6 : 0;
        for (let i = 0; i < p.n; i++) {
          const r = ((6 + rand() * 14) * p.size + 3) * Math.max(0.7, scale * 1.1);
          const x = s.x + (rand() - 0.5) * 40 * scale + lean * scale;
          const y = s.y + (rand() - 0.5) * 34 * scale + p.dy * scale;
          dab(x, y, r, p.colors[Math.floor(rand() * p.colors.length)], p.alpha * (0.45 + rand() * 0.55));
        }
      }
    }
    for (let i = 0; i < spots.length * 6; i++) {
      const s = spots[Math.floor(rand() * spots.length)];
      c.globalAlpha = 0.35 + rand() * 0.5;
      c.fillStyle = rand() < 0.5 ? "#ffffff" : "#f7c9da";
      c.beginPath();
      c.arc(s.x + (rand() - 0.5) * 50 * scale, s.y + (rand() - 0.5) * 44 * scale - 6, 0.8 + rand() * 1.4, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    const glow = c.createRadialGradient(canopyBox.x, canopyBox.y, 0, canopyBox.x, canopyBox.y, canopyBox.r * 1.6);
    glow.addColorStop(0, "rgba(245, 169, 196, 0.16)");
    glow.addColorStop(1, "rgba(245, 169, 196, 0)");
    c.fillStyle = glow;
    c.fillRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);

    // fallen petals around the roots
    for (let i = 0; i < 260; i++) {
      const spreadX = canopyBox.r * 1.4;
      const x = trunkX + (rand() - 0.5) * 2 * spreadX * Math.sqrt(rand());
      const y = groundY + rand() * Math.min(26, h - groundY - 4);
      c.globalAlpha = 0.25 + rand() * 0.5;
      c.fillStyle = rand() < 0.3 ? "#fbe4ed" : "#e9a8c0";
      c.beginPath();
      c.ellipse(x, y, 1.6 + rand() * 1.8, 0.8 + rand() * 0.6, rand() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function paintScene() {
    const rand = rng(11);
    const narrow = w < 760;
    groundY = h * (narrow ? 0.9 : 0.86);
    const backRes = Math.min(dpr, 1);
    const frontRes = Math.min(dpr, 1.5);

    layers = [
      makeLayer(0, backRes, (c) => paintSky(c, rand)),
      makeLayer(0.18, backRes, (c) => paintRidge(c, rand, { base: groundY - h * 0.2, height: h * 0.32, color: "#4b4a50", fog: 0.5 })),
      makeLayer(0.38, backRes, (c) => paintRidge(c, rand, { base: groundY - h * 0.08, height: h * 0.28, color: "#323136", fog: 0.42 })),
      makeLayer(0.62, frontRes, (c) => paintRidge(c, rand, { base: groundY, height: h * 0.2, color: "#1c1b1f", fog: 0.3 })),
      makeLayer(1, frontRes, (c) => paintTree(c, rand)),
    ];
    // the moon sits between the sky and the far ridge
    layers.splice(1, 0, { moon: true, depth: 0.08 });

    bottomFade = ctx.createLinearGradient(0, h * 0.88, 0, h);
    bottomFade.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottomFade.addColorStop(1, "rgba(0, 0, 0, 0.8)");
  }

  function drawMoon(dx, dy) {
    const r = Math.max(16, Math.min(w, h) * 0.034);
    const x = w * 0.885 + dx;
    const y = h * 0.15 + dy - scrollEase * h * 0.06;
    const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 6);
    halo.addColorStop(0, `rgba(255, 238, 245, ${0.12 + scrollEase * 0.08})`);
    halo.addColorStop(1, "rgba(255, 238, 245, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    ctx.fillStyle = `rgba(242, 236, 240, ${0.5 + scrollEase * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // soft bite of shadow for a waxing moon
    ctx.fillStyle = "rgba(70, 68, 76, 0.55)";
    ctx.beginPath();
    ctx.arc(x - r * 0.42, y - r * 0.12, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- Moving parts ---------- */

  function newPetal(rand, fromTree) {
    const tip = fromTree && canopy.length ? canopy[Math.floor(rand() * canopy.length)] : null;
    return {
      x: tip ? tip.x + (rand() - 0.5) * 40 : rand() * w * 1.2 - w * 0.2,
      y: tip ? tip.y : -20 - rand() * h * 0.2,
      r: 2.4 + rand() * 3.6,
      vy: 16 + rand() * 24,
      vx: -6 - rand() * 18,
      wx: 0, wy: 0,
      sway: rand() * Math.PI * 2,
      swaySpeed: 0.6 + rand() * 1.2,
      rot: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 2,
      flip: rand() * Math.PI * 2,
      alpha: 0.55 + rand() * 0.45,
      light: rand() < 0.45,
    };
  }

  function seed() {
    const rand = Math.random;
    const area = (w * h) / (1280 * 800);
    const count = Math.round(Math.min(110, Math.max(36, 70 * area)));
    petals = Array.from({ length: count }, () => {
      const p = newPetal(rand, rand() < 0.7);
      p.y = p.y + rand() * (groundY - p.y);
      return p;
    });
    sparks = Array.from({ length: Math.round(count * 0.7) }, () => {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * canopyBox.r * 1.5;
      return {
        x: canopyBox.x + Math.cos(a) * d,
        y: canopyBox.y + Math.sin(a) * d * 0.8,
        r: 0.6 + rand() * 1.2,
        phase: rand() * Math.PI * 2,
        speed: 0.8 + rand() * 1.8,
        pink: rand() < 0.6,
      };
    });
  }

  function stepPetal(p, dt) {
    // the cursor stirs the air around it
    const dx = p.x - pointer.x, dy = p.y - pointer.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 120 * 120) {
      const f = 1 - Math.sqrt(d2) / 120;
      p.wx += pointer.vx * f * 0.05;
      p.wy += pointer.vy * f * 0.05;
      p.spin += (pointer.vx > 0 ? 1 : -1) * f * 0.3;
    }
    p.wx = Math.max(-420, Math.min(420, p.wx));
    p.wy = Math.max(-420, Math.min(420, p.wy));
    const drag = Math.exp(-2.2 * dt);
    p.wx *= drag;
    p.wy *= drag;
    p.spin *= Math.exp(-0.4 * dt);

    p.sway += p.swaySpeed * dt;
    p.flip += p.swaySpeed * 1.6 * dt;
    p.rot += p.spin * dt;
    p.y += (p.vy + p.wy) * dt;
    p.x += (p.vx + p.wx + Math.sin(p.sway) * 20) * dt;
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(p.flip)));
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.light ? "#fde8f0" : "#f2b3ca";
    petalPath(ctx, p.r);
    ctx.fill();
    ctx.restore();
  }

  function scrollProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  }

  function draw(dt, time) {
    const still = reduceMotion.matches;
    if (dt) {
      const k = Math.min(1, dt * 4);
      look.x += (look.tx - look.x) * k;
      look.y += (look.ty - look.y) * k;
      scrollEase += (scrollProgress() - scrollEase) * Math.min(1, dt * 5);
      pointer.vx *= Math.exp(-8 * dt);
      pointer.vy *= Math.exp(-8 * dt);
    }

    for (const L of layers) {
      const dx = still ? 0 : -look.x * L.depth * 18;
      const dy = still ? 0 : -look.y * L.depth * 10 - scrollEase * L.depth * 46;
      if (L.moon) { drawMoon(dx, dy); continue; }
      ctx.drawImage(L.canvas, -PAD + dx, -PAD + dy, w + PAD * 2, h + PAD * 2);
    }
    const tdx = still ? 0 : -look.x * 18;
    const tdy = still ? 0 : -look.y * 10 - scrollEase * 46;

    // glitter rides with the tree
    for (const s of sparks) {
      ctx.globalAlpha = still ? 0.4 : 0.1 + 0.6 * Math.max(0, Math.sin(time * s.speed + s.phase));
      ctx.fillStyle = s.pink ? "#f5a9c4" : "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x + tdx, s.y + tdy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // night falls as you read
    if (scrollEase > 0.01) {
      ctx.fillStyle = `rgba(6, 4, 10, ${scrollEase * 0.32})`;
      ctx.fillRect(0, 0, w, h);
    }

    const rand = Math.random;
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      if (dt) {
        stepPetal(p, dt);
        if (p.y > groundY + 10 || p.x < -40 || p.x > w + 60 || p.y < -h) petals[i] = newPetal(rand, rand() < 0.75);
      }
      drawPetal(p);
    }
    for (let i = gusts.length - 1; i >= 0; i--) {
      const p = gusts[i];
      if (dt) {
        stepPetal(p, dt);
        if (p.y > h + 20 || p.x < -40 || p.x > w + 40) { gusts.splice(i, 1); continue; }
      }
      drawPetal(p);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, h * 0.88, w, h * 0.12 + 1);
  }

  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    draw(dt, now / 1000);
    requestAnimationFrame(frame);
  }

  function updateRunning() {
    const should = !document.hidden && !reduceMotion.matches;
    if (should && !running) {
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    } else if (!should) {
      running = false;
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, innerWidth);
    h = Math.max(1, innerHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScene();
    seed();
    scrollEase = scrollProgress();
    draw(0, 0);
  }

  /* A handful of petals bursting from a point, used on click. */
  function burst(x, y, n = 14) {
    if (reduceMotion.matches) return;
    for (let i = 0; i < n && gusts.length < 140; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 170;
      const p = newPetal(Math.random, false);
      p.x = x; p.y = y;
      p.wx = Math.cos(a) * speed;
      p.wy = Math.sin(a) * speed - 70;
      p.spin = (Math.random() - 0.5) * 8;
      gusts.push(p);
    }
  }

  window.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (pointer.t && now - pointer.t < 100) {
      const dts = Math.max(0.008, (now - pointer.t) / 1000);
      pointer.vx = Math.max(-2000, Math.min(2000, (e.clientX - pointer.x) / dts));
      pointer.vy = Math.max(-2000, Math.min(2000, (e.clientY - pointer.y) / dts));
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.t = now;
    if (finePointer.matches) {
      look.tx = (e.clientX / w) * 2 - 1;
      look.ty = (e.clientY / h) * 2 - 1;
    }
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", () => { look.tx = 0; look.ty = 0; pointer.x = pointer.y = -9999; });

  window.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("input, textarea, select, video, dialog, [contenteditable]")) return;
    burst(e.clientX, e.clientY);
  });

  document.addEventListener("visibilitychange", updateRunning);
  reduceMotion.addEventListener?.("change", () => { draw(0, 0); updateRunning(); });
  // keep the still frame in step with scrolling when motion is reduced
  window.addEventListener("scroll", () => {
    if (reduceMotion.matches) { scrollEase = scrollProgress(); draw(0, 0); }
  }, { passive: true });

  let resizeTimer, lastW = innerWidth;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    // phones resize the viewport when the address bar hides; only repaint for real width changes
    resizeTimer = setTimeout(() => {
      if (innerWidth !== lastW || Math.abs(innerHeight - h) > 160) { lastW = innerWidth; resize(); }
    }, 150);
  });

  resize();
  updateRunning();

  window.NQ = window.NQ || {};
  window.NQ.scene = { burst };
})();
