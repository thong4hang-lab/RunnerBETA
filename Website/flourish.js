/*
  The small things: opening sequence, cursor ring, the sword that fills as
  you scroll, a live New York clock, the Code section's changing glyph,
  a glow that follows the pointer around cards, and optional ambient sound.
  Everything here is decoration on top of a page that works without it.
*/
(function () {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const store = {
    get(k) { try { return localStorage.getItem("nq:" + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem("nq:" + k, v); } catch { /* blocked */ } },
  };

  const flowerSvg =
    '<svg viewBox="-20 -20 40 40" aria-hidden="true"><g fill="currentColor">' +
    [0, 72, 144, 216, 288].map((r) => `<path transform="rotate(${r})" d="M0 0 C -6 -5 -8 -13 -3.6 -18 L 0 -15 L 3.6 -18 C 8 -13 6 -5 0 0 Z"/>`).join("") +
    '</g><circle r="3" fill="#000" opacity=".55"/></svg>';

  /* ---------- Opening sequence (homepage, once per visit) ---------- */
  function intro(done) {
    const el = document.getElementById("intro");
    if (!el) return done();
    let seen = false;
    try { seen = sessionStorage.getItem("nq:intro") === "1"; } catch { /* blocked */ }
    if (seen || reduceMotion) { el.remove(); return done(); }
    try { sessionStorage.setItem("nq:intro", "1"); } catch { /* blocked */ }

    document.documentElement.classList.add("is-intro");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.classList.add("is-leaving");
      document.documentElement.classList.remove("is-intro");
      done();
      window.NQ?.scene?.burst(innerWidth * 0.5, innerHeight * 0.45, 26);
      setTimeout(() => el.remove(), 1000);
    };
    el.classList.add("is-playing");
    const timer = setTimeout(finish, 2900);
    const skip = () => { clearTimeout(timer); finish(); };
    el.addEventListener("click", skip);
    addEventListener("keydown", skip, { once: true });
  }

  /* ---------- Headline: words settle in one after another ---------- */
  function revealHeadline() {
    const h1 = document.querySelector("[data-reveal-words]");
    if (!h1 || reduceMotion) return;
    if (!h1.dataset.split) {
      const text = h1.textContent.trim();
      h1.setAttribute("aria-label", text);
      h1.innerHTML = text
        .split(" ")
        .map((word, i) => `<span class="word" aria-hidden="true" style="--i:${i}"><span>${word}</span></span>`)
        .join(" ");
      h1.dataset.split = "1";
    }
    void h1.offsetWidth; // let the hidden starting position apply first
    h1.classList.add("is-revealed");
  }

  /* ---------- Cursor ring ---------- */
  function cursor() {
    if (!finePointer || reduceMotion) return;
    const ring = document.createElement("div");
    ring.className = "cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);
    let x = -100, y = -100, rx = -100, ry = -100, shown = false;
    addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY;
      if (!shown) { rx = x; ry = y; shown = true; ring.classList.add("is-on"); }
      const hot = e.target.closest("a, button, summary, label, select, [role='button'], .video-thumb");
      ring.classList.toggle("is-hot", Boolean(hot));
      ring.classList.toggle("is-text", Boolean(e.target.closest("input, textarea")));
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { ring.classList.remove("is-on"); shown = false; });
    addEventListener("pointerdown", () => ring.classList.add("is-down"));
    addEventListener("pointerup", () => ring.classList.remove("is-down"));
    (function loop() {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- The sword on the right edge fills as you scroll ---------- */
  function bladeProgress() {
    const el = document.createElement("div");
    el.className = "blade-progress";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <span class="blade-pommel"></span>
      <span class="blade-grip"></span>
      <span class="blade-guard">${flowerSvg}</span>
      <span class="blade-track"><span class="blade-fill"></span></span>
      <span class="blade-label">Scroll</span>`;
    document.body.appendChild(el);
    let queued = false;
    const update = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, scrollY / max) : 0;
      el.style.setProperty("--progress", p.toFixed(4));
      el.classList.toggle("is-end", p > 0.985);
    };
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
  }

  /* ---------- New York clock with the cash-session countdown ---------- */
  function nyClock() {
    const els = document.querySelectorAll("[data-ny-clock]");
    if (!els.length) return;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    });
    const dayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const span = (mins) => {
      const d = Math.floor(mins / 1440), hh = Math.floor((mins % 1440) / 60), mm = mins % 60;
      return d ? `${d}d ${hh}h` : hh ? `${hh}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
    };
    function tick() {
      const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
      const day = dayIndex[parts.weekday];
      const now = Number(parts.hour) * 60 + Number(parts.minute);
      const OPEN = 9 * 60 + 30, CLOSE = 16 * 60;
      const weekday = day >= 1 && day <= 5;
      let status;
      if (weekday && now >= OPEN && now < CLOSE) {
        status = `Cash session open, closes in ${span(CLOSE - now)}`;
      } else {
        let daysAhead = 0;
        if (!weekday || now >= OPEN) {
          daysAhead = 1;
          let next = (day + 1) % 7;
          while (next === 0 || next === 6) { daysAhead++; next = (next + 1) % 7; }
        }
        status = `Cash open in ${span(daysAhead * 1440 + OPEN - now)}`;
      }
      els.forEach((el) => {
        el.querySelector("[data-ny-time]").textContent = `${parts.hour}:${parts.minute}`;
        el.querySelector("[data-ny-status]").textContent = status;
      });
    }
    tick();
    setInterval(tick, 15000);
  }

  /* ---------- The Code: the big glyph follows the principle you're reading ---------- */
  function codex() {
    const items = [...document.querySelectorAll(".codex-item")];
    const glyphs = [...document.querySelectorAll(".codex-glyph span")];
    const counter = document.querySelector("[data-codex-count]");
    if (!items.length) return;
    const setActive = (i) => {
      items.forEach((el, j) => el.classList.toggle("is-active", i === j));
      glyphs.forEach((el, j) => el.classList.toggle("is-active", i === j));
      if (counter) counter.textContent = `${i + 1} / ${items.length}`;
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(items.indexOf(e.target));
    }, { rootMargin: "-45% 0px -45% 0px" });
    items.forEach((el) => io.observe(el));
    setActive(0);
  }

  /* ---------- A pink edge-light that follows the pointer around cards ---------- */
  function spotlight() {
    if (!finePointer) return;
    addEventListener("pointermove", (e) => {
      const card = e.target.closest(".spot");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* ---------- Ambient sound: wind through the valley and a distant chime ---------- */
  function sound() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sound-toggle";
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = '<span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sound-label">Sound off</span>';
    document.body.appendChild(btn);

    let audio = null;
    function build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ac = new AC();
      const master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);

      // wind: filtered noise whose pitch and loudness drift slowly
      const len = ac.sampleRate * 4;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) { b = 0.985 * b + 0.015 * (Math.random() * 2 - 1); data[i] = b * 6; }
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const band = ac.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 420;
      band.Q.value = 0.7;
      const windGain = ac.createGain();
      windGain.gain.value = 0.32;
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoAmt = ac.createGain();
      lfoAmt.gain.value = 180;
      lfo.connect(lfoAmt).connect(band.frequency);
      const lfo2 = ac.createOscillator();
      lfo2.frequency.value = 0.11;
      const lfo2Amt = ac.createGain();
      lfo2Amt.gain.value = 0.14;
      lfo2.connect(lfo2Amt).connect(windGain.gain);
      noise.connect(band).connect(windGain).connect(master);
      noise.start(); lfo.start(); lfo2.start();

      // chimes on a Japanese in-scale, with a soft echo
      const echo = ac.createDelay(2);
      echo.delayTime.value = 0.42;
      const feedback = ac.createGain();
      feedback.gain.value = 0.38;
      const wet = ac.createGain();
      wet.gain.value = 0.35;
      echo.connect(feedback).connect(echo);
      echo.connect(wet).connect(master);
      const notes = [587.33, 622.25, 783.99, 880, 932.33, 1174.66, 1244.5];
      let chimeTimer = null;
      function chime() {
        const t = ac.currentTime;
        const f = notes[Math.floor(Math.random() * notes.length)];
        [1, 2.76].forEach((mult, k) => {
          const o = ac.createOscillator();
          o.type = "sine";
          o.frequency.value = f * mult;
          const g = ac.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(k ? 0.012 : 0.05, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + (k ? 1.2 : 3.6));
          o.connect(g);
          g.connect(master);
          g.connect(echo);
          o.start(t);
          o.stop(t + 3.8);
        });
        chimeTimer = setTimeout(chime, 3500 + Math.random() * 6000);
      }
      return {
        ac, master,
        start() { chime(); },
        stop() { clearTimeout(chimeTimer); },
      };
    }

    function set(on) {
      btn.setAttribute("aria-pressed", String(on));
      btn.querySelector(".sound-label").textContent = on ? "Sound on" : "Sound off";
      store.set("sound", on ? "1" : "0");
      if (on) {
        audio = audio || build();
        if (!audio) return;
        audio.ac.resume();
        audio.master.gain.cancelScheduledValues(audio.ac.currentTime);
        audio.master.gain.linearRampToValueAtTime(0.5, audio.ac.currentTime + 1.5);
        audio.start();
      } else if (audio) {
        audio.stop();
        audio.master.gain.cancelScheduledValues(audio.ac.currentTime);
        audio.master.gain.linearRampToValueAtTime(0, audio.ac.currentTime + 0.6);
      }
    }
    btn.addEventListener("click", () => set(btn.getAttribute("aria-pressed") !== "true"));

    // Browsers only allow sound after a click, so carry the choice across pages
    // by resuming on the first interaction.
    if (store.get("sound") === "1") {
      btn.querySelector(".sound-label").textContent = "Sound on";
      btn.setAttribute("aria-pressed", "true");
      const resume = (e) => {
        if (e.target.closest(".sound-toggle")) return;
        set(true);
      };
      addEventListener("pointerdown", resume, { once: true });
      addEventListener("keydown", resume, { once: true });
    }
  }

  /* ---------- Designer signature: click to copy the Discord username ---------- */
  function signature() {
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      const hint = btn.querySelector("[data-copy-hint]");
      const original = hint ? hint.textContent : "";
      let timer;
      btn.addEventListener("click", async () => {
        let ok = false;
        try { await navigator.clipboard.writeText(btn.dataset.copy); ok = true; } catch { /* clipboard blocked */ }
        if (!hint) return;
        hint.textContent = ok ? "Username copied. Paste it in Discord." : `Discord username: ${btn.dataset.copy}`;
        btn.classList.add("is-copied");
        clearTimeout(timer);
        timer = setTimeout(() => { hint.textContent = original; btn.classList.remove("is-copied"); }, 2800);
      });
    });
  }

  intro(revealHeadline);
  signature();
  cursor();
  bladeProgress();
  nyClock();
  codex();
  spotlight();
  sound();
})();
