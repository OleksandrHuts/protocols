(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const svg = $("#droneSvg");
  const sidebar = $("#sidebar");

  const state = {
    selected: null,
    filter: "all",
  };

  const linksById = new Map(LINKS.map((l) => [l.id, l]));
  const componentsById = new Map(COMPONENTS.map((c) => [c.id, c]));

  function esc(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function colorOf(cat) {
    return CATEGORIES[cat]?.color || "#38d6e6";
  }

  /* ============================================================
     SVG
     ============================================================ */

  function renderSvg() {
    const frame = `
      <g class="frame" aria-hidden="true">
        <path class="frame-line" d="M 550 372 L 250 170 M 550 372 L 850 170 M 550 372 L 250 580 M 550 372 L 850 580"/>
        <path class="frame-line thin" d="M 250 170 L 850 580 M 850 170 L 250 580"/>
        <ellipse class="frame-body" cx="550" cy="372" rx="178" ry="100"/>
        <circle class="frame-motor" cx="250" cy="170" r="28"/>
        <circle class="frame-motor" cx="850" cy="170" r="28"/>
        <circle class="frame-motor" cx="250" cy="580" r="28"/>
        <circle class="frame-motor" cx="850" cy="580" r="28"/>
        <circle class="frame-prop" cx="250" cy="170" r="48"/>
        <circle class="frame-prop" cx="850" cy="170" r="48"/>
        <circle class="frame-prop" cx="250" cy="580" r="48"/>
        <circle class="frame-prop" cx="850" cy="580" r="48"/>
        <text class="frame-label" x="215" y="220">M1</text>
        <text class="frame-label" x="860" y="220">M2</text>
        <text class="frame-label" x="215" y="620">M3</text>
        <text class="frame-label" x="860" y="620">M4</text>
        <text class="frame-label" x="500" y="492">FRAME</text>
      </g>`;

    const linkMarkup = LINKS.map((l) => {
      const c = colorOf(l.cat);
      return `
        <g class="link" data-id="${l.id}" data-cat="${l.cat}" style="--c:${c}">
          <title>${esc(l.title)}</title>
          <path class="hit" d="${l.d}"></path>
          <path class="line" d="${l.d}"${l.wireless ? ' stroke-dasharray="4 6"' : ""}></path>
          <text class="link-label">${esc(l.title)}</text>
        </g>`;
    }).join("");

    const nodeMarkup = COMPONENTS.map((c) => {
      const color = colorOf(c.cat);
      return `
        <g class="node" data-id="${c.id}" style="--c:${color}" transform="translate(${c.x} ${c.y})">
          <title>${esc(c.label)}</title>
          <rect class="node-box" width="${c.w}" height="${c.h}" rx="6"></rect>
          <text class="node-code" x="9" y="15">${c.code}</text>
          <text class="node-label" x="9" y="31">${esc(c.label)}</text>
          <text class="node-sub" x="9" y="${c.h - 9}">${esc(c.sub)}</text>
          <circle class="node-port" cx="${c.w - 9}" cy="10" r="2.5"></circle>
        </g>`;
    }).join("");

    svg.innerHTML = frame + `<g class="links">${linkMarkup}</g>` + `<g class="nodes">${nodeMarkup}</g>`;

    requestAnimationFrame(() => {
      $$(".link", svg).forEach((g) => {
        const path = $(".line", g);
        const label = $(".link-label", g);
        if (!path || !label) return;
        const len = path.getTotalLength();
        const p = path.getPointAtLength(len * 0.52);
        label.setAttribute("x", String(Math.round(p.x + 4)));
        label.setAttribute("y", String(Math.round(p.y - 4)));
      });
    });
  }

  /* ============================================================
     CLASSES / SELECTION
     ============================================================ */

  function updateClasses() {
    const sel = state.selected;
    $$(".link", svg).forEach((g) => {
      const id = g.dataset.id;
      const l = linksById.get(id);
      const related = sel?.type === "part" && l && (l.from === sel.id || l.to === sel.id);
      g.classList.toggle("is-active", sel?.type === "link" && sel.id === id);
      g.classList.toggle("is-related", !!related);
      g.classList.toggle("is-dim", state.filter !== "all" && l?.cat !== state.filter);
    });
    $$(".node", svg).forEach((g) => {
      const id = g.dataset.id;
      g.classList.toggle("is-active", sel?.type === "part" && sel.id === id);
      g.classList.toggle("is-dim", state.filter !== "all" && componentsById.get(id)?.cat !== state.filter);
    });
  }

  function selectLink(id) {
    if (!linksById.has(id)) return;
    state.selected = { type: "link", id };
    updateClasses();
    renderSidebar();
    try { history.replaceState(null, "", `#link=${encodeURIComponent(id)}`); } catch (e) { /* ignore */ }
  }

  function selectPart(id) {
    if (!componentsById.has(id)) return;
    state.selected = { type: "part", id };
    updateClasses();
    renderSidebar();
    try { history.replaceState(null, "", `#part=${encodeURIComponent(id)}`); } catch (e) { /* ignore */ }
  }

  function clearSelection() {
    state.selected = null;
    updateClasses();
    renderSidebar();
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* ignore */ }
  }

  function applyHash() {
    const hash = location.hash.replace(/^#/, "");
    if (hash.startsWith("link=")) {
      const id = decodeURIComponent(hash.slice(5));
      if (linksById.has(id)) { state.selected = { type: "link", id }; updateClasses(); renderSidebar(); return; }
    }
    if (hash.startsWith("part=")) {
      const id = decodeURIComponent(hash.slice(5));
      if (componentsById.has(id)) { state.selected = { type: "part", id }; updateClasses(); renderSidebar(); return; }
    }
    state.selected = null;
    updateClasses();
    renderSidebar();
  }

  /* ============================================================
     SIDEBAR
     ============================================================ */

  function rows(items) {
    const hidden = new Set(["Рівень", "Рівні", "Швидкість", "Кабель"]);
    const visible = items.filter(([k]) => !hidden.has(k));
    return `<table class="table-mini">${visible.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`;
  }

  function bullets(items) {
    return `<ul class="tradeoff-list">${(items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  }

  function renderSidebar() {
    if (!state.selected) {
      sidebar.style.setProperty("--c", "#38d6e6");
      sidebar.innerHTML = `
        <p class="eyebrow">Як читати схему</p>
        <h2>Один дріт - ще не один протокол</h2>
        <p class="lead">Лінія на схемі показує фізичне з'єднання. Усередині нього можуть працювати різні рівні: електрика, транспорт, кадри, повідомлення.</p>
        <div class="intro-layers">
          <div class="intro-layer"><b>1. Фізичний рівень</b><span>Роз'єм, дроти, напруга, диференційність, швидкість, термінація.</span><em>UART, I2C, SPI, CAN, USB, RF</em></div>
          <div class="intro-layer"><b>2. Транспорт / канал</b><span>Як біти передаються й адресуються між вузлами.</span><em>UART, I2C, SPI, CAN, USB</em></div>
          <div class="intro-layer"><b>3. Логічний протокол</b><span>Кадри, поля, CRC, адреси, канали, час.</span><em>SBUS, CRSF, DShot, UBX, DroneCAN</em></div>
          <div class="intro-layer"><b>4. Застосування</b><span>Що саме означають дані для польоту.</span><em>MAVLink, NMEA, RTCM, Remote ID</em></div>
        </div>
        <h3>Як користуватися</h3>
        <p>Натисніть на кольорову лінію, щоб побачити фізику й логіку конкретного з'єднання. Натисніть на компонент, щоб підсвітити всі його зв'язки.</p>
        <p class="empty-note">У схемі ${LINKS.length} з'єднань і ${PROTOCOLS.length} протоколів. Частина - транспорт, частина - прикладний рівень.</p>`;
      return;
    }

    if (state.selected.type === "part") {
      const c = componentsById.get(state.selected.id);
      if (!c) return;
      const color = colorOf(c.cat);
      const connected = LINKS.filter((l) => l.from === c.id || l.to === c.id);
      sidebar.style.setProperty("--c", color);
      sidebar.innerHTML = `
        <span class="cat" style="--c:${color}"><i></i>${CATEGORIES[c.cat]?.label || "Компонент"}</span>
        <h2>${esc(c.label)}</h2>
        <p class="lead">${esc(c.role)}</p>
        <h3>З'єднання</h3>
        <div class="component-links">
          ${connected.map((l) => `<button class="component-link" data-link="${l.id}" style="--c:${colorOf(l.cat)}"><span>${esc(l.title)}</span><span>${CATEGORIES[l.cat]?.short || ""}</span></button>`).join("")}
        </div>
        <p class="empty-note">Клік по з'єднанню відкриє фізичний і логічний рівень.</p>`;
      $$(".component-link", sidebar).forEach((b) => b.addEventListener("click", () => selectLink(b.dataset.link)));
      return;
    }

    const l = linksById.get(state.selected.id);
    if (!l) return;
    const color = colorOf(l.cat);
    sidebar.style.setProperty("--c", color);
    sidebar.innerHTML = `
      <span class="cat" style="--c:${color}"><i></i>${CATEGORIES[l.cat]?.label || l.cat}</span>
      <h2>${esc(l.title)}</h2>
      <p class="lead">${esc(l.summary)}</p>

      <div class="verdict-grid">
        <section class="verdict pros"><h4>Переваги</h4>${bullets(l.pros)}</section>
        <section class="verdict cons"><h4>Недоліки</h4>${bullets(l.cons)}</section>
        <section class="verdict use"><h4>Коли доречно</h4>${bullets(l.useCases)}</section>
        <section class="verdict robust"><h4>Стійкість / завади</h4>${bullets(l.robustness)}</section>
      </div>

      <h3>Фізичний рівень</h3>
      ${rows(l.physical)}

      <h3>Логічний рівень</h3>
      ${rows(l.logical)}

      <h3>Популярні варіанти</h3>
      <div class="variants">
        ${l.variants.map((v) => `
          <div class="variant" style="--c:${color}">
            <div class="variant-head"><b>${esc(v.name)}</b><span class="badge">${esc(v.badge)}</span></div>
            <p><b>Фізика:</b> ${esc(v.physical)}</p>
            <p><b>Логіка:</b> ${esc(v.logical)}</p>
            <p><b>Де:</b> ${esc(v.use)}</p>
            <p class="tradeoff"><b>Нюанс:</b> ${esc(v.tradeoff)}</p>
          </div>`).join("")}
      </div>

      <h3>Типові помилки</h3>
      <ul class="errors">${l.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>

      <h3>Джерела</h3>
      <div class="standards">
        ${l.standards.map(([name, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`).join("")}
      </div>`;
  }

  /* ============================================================
     LEGEND / COUNTS / FILTERS
     ============================================================ */

  function renderLegend() {
    const legend = $("#legend");
    legend.innerHTML = Object.entries(CATEGORIES)
      .map(([id, c]) => `<span style="--c:${c.color}"><i></i>${c.label}</span>`)
      .join("");
  }

  function renderCounts() {
    $("#linkCount").textContent = String(LINKS.length);
    $("#protocolCount").textContent = String(PROTOCOLS.length);
  }

  function wireFilters() {
    $$(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.filter = chip.dataset.cat;
        $$(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
        updateClasses();
        renderSidebar();
      });
    });
  }

  /* ============================================================
     MATRIX
     ============================================================ */

  function openMatrix() {
    $("#matrixModal").hidden = false;
    $("#matrixSearch").value = "";
    renderMatrix("");
    setTimeout(() => $("#matrixSearch").focus(), 30);
  }

  function closeMatrix() {
    $("#matrixModal").hidden = true;
  }

  function renderMatrix(query) {
    const q = query.trim().toLowerCase();
    const list = PROTOCOLS.filter((p) => !q ||
      [p.name, p.layer, p.physical, p.use, p.speed].join(" ").toLowerCase().includes(q));
    $("#matrixCount").textContent = `${list.length} / ${PROTOCOLS.length}`;
    $("#matrixBody").innerHTML = list.map((p) => `
      <tr data-link="${p.link}">
        <td>${esc(p.name)}</td>
        <td>${esc(p.layer)}</td>
        <td>${esc(p.physical)}</td>
        <td>${esc(p.speed)}</td>
        <td>${esc(p.duplex)}</td>
        <td>${esc(p.use)}</td>
      </tr>`).join("");
    $$("#matrixBody tr").forEach((row) => {
      row.addEventListener("click", () => {
        closeMatrix();
        selectLink(row.dataset.link);
      });
    });
  }

  /* ============================================================
     INIT
     ============================================================ */

  function boot() {
    renderSvg();
    renderLegend();
    renderCounts();
    wireFilters();

    svg.addEventListener("click", (e) => {
      const link = e.target.closest(".link");
      if (link) { selectLink(link.dataset.id); return; }
      const node = e.target.closest(".node");
      if (node) { selectPart(node.dataset.id); }
    });

    $("#matrixBtn").addEventListener("click", openMatrix);
    $("#closeMatrix").addEventListener("click", closeMatrix);
    $("#matrixModal").addEventListener("click", (e) => { if (e.target === $("#matrixModal")) closeMatrix(); });
    $("#matrixSearch").addEventListener("input", (e) => renderMatrix(e.target.value));
    $("#resetBtn").addEventListener("click", () => {
      state.filter = "all";
      $$(".chip").forEach((c) => c.classList.toggle("is-active", c.dataset.cat === "all"));
      closeMatrix();
      clearSelection();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMatrix();
    });

    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  boot();
})();






