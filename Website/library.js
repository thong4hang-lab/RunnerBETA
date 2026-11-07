/* Video library: list, filter, play, and (for admins) upload and delete. */
(async function () {
  const { data, escapeHtml } = window.NQ;
  const cfg = window.NQ_CONFIG;
  const user = await window.NQ.ready;
  if (!user) return;

  const grid = document.getElementById("video-grid");
  const filters = document.getElementById("filters");
  const toggle = document.getElementById("toggle-upload");
  const panel = document.getElementById("upload-panel");
  const form = document.getElementById("upload-form");
  const status = document.getElementById("upload-status");
  const submit = document.getElementById("upload-submit");
  const player = document.getElementById("player");
  const playerBody = document.getElementById("player-body");

  let videos = [];
  let active = "All";

  const playIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function renderFilters() {
    const cats = ["All", ...cfg.VIDEO_CATEGORIES];
    filters.innerHTML = cats
      .map((c) => `<button type="button" class="chip" aria-pressed="${c === active}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join("");
  }

  function renderGrid() {
    const shown = active === "All" ? videos : videos.filter((v) => v.category === active);
    if (!shown.length) {
      grid.innerHTML = `<div class="empty"><h3>Nothing here yet</h3><p>${
        videos.length ? "No videos in this category yet." : user.isAdmin ? "Upload your first video to start the library." : "New lessons are on the way. Check back soon."
      }</p></div>`;
      return;
    }
    grid.innerHTML = shown
      .map(
        (v) => `
        <article class="video-card spot">
          <button type="button" class="video-thumb" data-play="${escapeHtml(v.id)}" aria-label="Play ${escapeHtml(v.title)}">
            <span class="play">${playIcon}</span>
          </button>
          <div class="video-body">
            <span class="cat">${escapeHtml(v.category || "Lesson")}</span>
            <h3>${escapeHtml(v.title)}</h3>
            ${v.description ? `<p>${escapeHtml(v.description)}</p>` : ""}
            <div class="meta">
              <span>${fmtDate(v.created_at)}</span>
              ${user.isAdmin && !v.sample ? `<button type="button" class="btn btn-danger btn-sm" data-delete="${escapeHtml(v.id)}">Delete</button>` : ""}
            </div>
          </div>
        </article>`
      )
      .join("");
  }

  async function load() {
    grid.innerHTML = '<div class="empty"><p>Loading videos…</p></div>';
    try {
      videos = await data.listVideos();
      renderGrid();
    } catch (err) {
      grid.innerHTML = `<div class="empty"><h3>Videos didn't load</h3><p>${escapeHtml(err.message)}. Refresh the page to try again.</p></div>`;
    }
  }

  filters.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    active = b.dataset.cat;
    renderFilters();
    renderGrid();
  });

  grid.addEventListener("click", async (e) => {
    const playBtn = e.target.closest("[data-play]");
    const delBtn = e.target.closest("[data-delete]");
    if (playBtn) {
      const v = videos.find((x) => x.id === playBtn.dataset.play);
      document.getElementById("player-title").textContent = v.title;
      playerBody.innerHTML = '<p class="status">Loading…</p>';
      player.showModal();
      try {
        const url = await data.videoUrl(v);
        playerBody.innerHTML = url
          ? `<video controls autoplay playsinline src="${escapeHtml(url)}"></video>`
          : `<div class="empty"><h3>Preview mode</h3><p>${v.sample ? "This is a sample card." : `“${escapeHtml(v.file_name || v.title)}” isn't stored in preview mode.`} Once Supabase is connected, the real video plays here.</p></div>`;
      } catch (err) {
        playerBody.innerHTML = `<p class="status is-error">This video couldn't load: ${escapeHtml(err.message)}</p>`;
      }
    }
    if (delBtn) {
      const v = videos.find((x) => x.id === delBtn.dataset.delete);
      if (!confirm(`Delete “${v.title}”? Members will no longer see it.`)) return;
      delBtn.disabled = true;
      try {
        await data.deleteVideo(v);
        await load();
      } catch (err) {
        alert("Couldn't delete the video: " + err.message);
        delBtn.disabled = false;
      }
    }
  });

  const closePlayer = () => {
    playerBody.innerHTML = ""; // stops playback
    player.close();
  };
  document.getElementById("close-player").addEventListener("click", closePlayer);
  player.addEventListener("click", (e) => { if (e.target === player) closePlayer(); });
  player.addEventListener("close", () => { playerBody.innerHTML = ""; });

  /* Admin upload */
  if (user.isAdmin) {
    toggle.hidden = false;
    document.getElementById("v-category").innerHTML = cfg.VIDEO_CATEGORIES.map((c) => `<option>${escapeHtml(c)}</option>`).join("");
    const setPanel = (open) => {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) document.getElementById("v-title").focus();
    };
    toggle.addEventListener("click", () => setPanel(panel.hidden));
    document.getElementById("cancel-upload").addEventListener("click", () => { form.reset(); status.textContent = ""; setPanel(false); toggle.focus(); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.classList.remove("is-error");
      const title = form.elements.title.value.trim();
      const file = form.file.files[0];
      if (!title) { status.textContent = "Add a title for the video."; status.classList.add("is-error"); form.elements.title.focus(); return; }
      if (!file) { status.textContent = "Choose a video file to upload."; status.classList.add("is-error"); form.file.focus(); return; }

      submit.disabled = true;
      submit.textContent = "Uploading…";
      try {
        await data.uploadVideo(
          file,
          { title, description: form.description.value.trim(), category: form.category.value },
          (pct) => (status.textContent = `Uploading… ${pct}%`)
        );
        status.textContent = "Uploaded. It's now in the library.";
        form.reset();
        await load();
      } catch (err) {
        status.textContent = "Upload failed: " + err.message;
        status.classList.add("is-error");
      } finally {
        submit.disabled = false;
        submit.textContent = "Upload video";
      }
    });
  }

  renderFilters();
  load();
})();
