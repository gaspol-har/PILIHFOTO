(() => {
  const CFG = window.VOTE_CONFIG;
  const IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
  const $ = (id) => document.getElementById(id);
  const remote = !!CFG.firebaseUrl;
  const base = CFG.firebaseUrl.replace(/\/$/, "");

  let photos = [];          // [{file, src, key}]
  let votes = {};           // key -> number
  let mine = load("myVotes", {});
  let order = [];           // photos sorted by votes
  let current = -1;         // lightbox index in `order`

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  const keyOf = (f) => f.replace(/[.#$\[\]\/]/g, "_");
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pretty = (f) => f.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");

  /* ---------- Ambil daftar foto ---------- */
  async function listPhotos() {
    // 1) Otomatis lewat GitHub API (saat dihosting di GitHub Pages)
    const host = location.hostname;
    if (host.endsWith(".github.io")) {
      const owner = host.split(".")[0];
      const parts = location.pathname.split("/").filter(Boolean);
      const repo = parts[0] && !parts[0].includes(".") ? parts[0] : `${owner}.github.io`;
      const sub = parts[0] && !parts[0].includes(".") ? "" : "";
      try {
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${CFG.photoFolder}`);
        if (r.ok) {
          const files = (await r.json()).filter((x) => x.type === "file" && IMG_RE.test(x.name)).map((x) => x.name);
          if (files.length) return files;
        }
      } catch {}
    }
    // 2) Cadangan: photos.json (untuk tes lokal / jika API gagal)
    const r = await fetch("photos.json", { cache: "no-store" });
    if (!r.ok) throw new Error("photos.json tidak ditemukan");
    return (await r.json()).filter((f) => IMG_RE.test(f));
  }

  /* ---------- Vote storage ---------- */
  async function fetchVotes() {
    if (remote) {
      try {
        const r = await fetch(`${base}/votes.json`);
        votes = (await r.json()) || {};
      } catch {}
    } else {
      votes = load("localVotes", {});
    }
  }

  async function changeVote(p, delta) {
    votes[p.key] = Math.max(0, (votes[p.key] || 0) + delta);
    if (delta > 0) mine[p.key] = true; else delete mine[p.key];
    save("myVotes", mine);
    render();
    if (remote) {
      try {
        await fetch(`${base}/votes.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [p.key]: { ".sv": { increment: delta } } })
        });
      } catch {}
    } else {
      save("localVotes", votes);
    }
  }

  const toggle = (p) => changeVote(p, mine[p.key] ? -1 : 1);

  /* ---------- Render ---------- */
  function render() {
    order = [...photos].sort((a, b) => (votes[b.key] || 0) - (votes[a.key] || 0) || a.file.localeCompare(b.file));
    const top = order[0];

    if (top && (votes[top.key] || 0) > 0) {
      $("winner").hidden = false;
      $("winnerImg").src = top.src;
      $("winnerName").textContent = pretty(top.file);
      $("winnerVotes").textContent = votes[top.key];
      $("winnerImg").onclick = () => openLb(0);
    } else {
      $("winner").hidden = true;
    }

    $("grid").innerHTML = order.map((p, i) => `
      <article class="card">
        <span class="rank">#${i + 1}</span>
        <div class="imgwrap"><img src="${esc(p.src)}" alt="${esc(pretty(p.file))}" loading="lazy" data-i="${i}"></div>
        <div class="meta">
          <span class="name">${esc(pretty(p.file))}</span>
          <button class="vote-btn ${mine[p.key] ? "voted" : ""}" data-v="${i}">♥ ${votes[p.key] || 0}</button>
        </div>
      </article>`).join("");

    if (current >= 0) updateLb();
  }

  $("grid").addEventListener("click", (e) => {
    const img = e.target.closest("img[data-i]");
    const btn = e.target.closest("button[data-v]");
    if (img) openLb(+img.dataset.i);
    if (btn) toggle(order[+btn.dataset.v]);
  });

  /* ---------- Lightbox ---------- */
  function openLb(i) { current = i; $("lightbox").hidden = false; updateLb(); }
  function closeLb() { current = -1; $("lightbox").hidden = true; }
  function updateLb() {
    const p = order[current];
    $("lbImg").src = p.src;
    $("lbName").textContent = pretty(p.file);
    const b = $("lbVote");
    b.textContent = `♥ ${votes[p.key] || 0}`;
    b.classList.toggle("voted", !!mine[p.key]);
  }
  const step = (d) => { current = (current + d + order.length) % order.length; updateLb(); };

  document.querySelector(".lb-close").onclick = closeLb;
  document.querySelector(".prev").onclick = () => step(-1);
  document.querySelector(".next").onclick = () => step(1);
  $("lbVote").onclick = () => toggle(order[current]);
  $("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLb(); });
  document.addEventListener("keydown", (e) => {
    if (current < 0) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  /* ---------- Init ---------- */
  (async () => {
    try {
      const files = await listPhotos();
      photos = files.map((f) => ({ file: f, key: keyOf(f), src: `${CFG.photoFolder}/${encodeURIComponent(f)}` }));
      if (!photos.length) throw new Error("kosong");
      await fetchVotes();
      $("status").hidden = true;
      render();
      if (remote) setInterval(async () => { if (current < 0) { await fetchVotes(); render(); } }, CFG.pollMs);
    } catch (err) {
      $("status").textContent = "Belum ada foto. Taruh foto di folder “" + CFG.photoFolder + "” lalu upload ke GitHub.";
    }
  })();
})();
