let DATA = null;
let WEIGHTS = {};
let STATE = {
  search: "",
  vertical: "all",
  stage: "all",
  channel: "all",
  activeOnly: false,
  sort: "composite-desc",
};

const PRESETS = [
  { name: "Balanced", weights: { fragmentation: 20, unitEconomics: 20, aiLeverage: 20, moat: 20, exitPath: 20 } },
  { name: "AI-Leverage Max", weights: { fragmentation: 10, unitEconomics: 15, aiLeverage: 45, moat: 15, exitPath: 15 } },
  { name: "Margin First", weights: { fragmentation: 10, unitEconomics: 45, aiLeverage: 15, moat: 15, exitPath: 15 } },
  { name: "Moat & Exit", weights: { fragmentation: 10, unitEconomics: 15, aiLeverage: 15, moat: 30, exitPath: 30 } },
];

async function init() {
  const res = await fetch("data.json");
  if (!res.ok) {
    document.getElementById("app").innerHTML =
      '<p class="fetch-error">Could not load data.json — serve this over http:// (e.g. <code>python3 -m http.server</code>), not file://.</p>';
    return;
  }
  DATA = await res.json();
  DATA.framework.criteria.forEach((c) => (WEIGHTS[c.key] = 20));
  STABILITY = computeStability();

  renderMeta();
  renderThesis();
  renderPresets();
  renderFramework();
  renderControls();
  seedRollup();
  wireRollup();

  // A hash in the URL is an explicit request for a specific view, so it wins
  // over the remembered one. Either overrides the seeded default.
  let saved = null;
  try { saved = localStorage.getItem(STATE_KEY); } catch (e) {}
  applyState(location.hash.slice(1)) || applyState(saved);
  syncControlsToState();
  stateReady = true;

  renderRollup();
  renderPipeline();
  writeState();
}

function compositeScore(deal) {
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) || 1;
  let score = 0;
  for (const c of DATA.framework.criteria) {
    score += (WEIGHTS[c.key] / totalWeight) * deal.scores[c.key];
  }
  return score;
}

function renderMeta() {
  document.getElementById("eyebrow").textContent = "Deal Sourcing · AI-Enabled Roll-Ups";
  document.getElementById("title").textContent = DATA.meta.title;
  document.getElementById("subtitle").textContent = DATA.meta.subtitle;
  document.getElementById("asOf").textContent = "As of " + DATA.meta.asOf;
  document.getElementById("disclaimer").textContent = DATA.meta.disclaimer;
}

function renderThesis() {
  document.getElementById("thesisHeadline").textContent = DATA.thesis.headline;
  document.getElementById("thesisBody").textContent = DATA.thesis.body;
}

function renderPresets() {
  const root = document.getElementById("presetsRoot");
  root.innerHTML = "";
  PRESETS.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "preset-btn" + (i === 0 ? " active" : "");
    btn.textContent = p.name;
    btn.addEventListener("click", () => applyPreset(p, btn));
    root.appendChild(btn);
  });
}

function applyPreset(preset, btn) {
  document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  DATA.framework.criteria.forEach((c) => {
    WEIGHTS[c.key] = preset.weights[c.key];
    document.getElementById(`slider-${c.key}`).value = preset.weights[c.key];
  });
  updateWeightLabels();
  renderPipeline();
}

function clearPresetHighlight() {
  document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
}

function renderFramework() {
  const root = document.getElementById("frameworkRoot");
  root.innerHTML = "";
  DATA.framework.criteria.forEach((c) => {
    const card = document.createElement("div");
    card.className = "crit-card";
    card.innerHTML = `
      <div class="crit-head">
        <span class="crit-label">${c.short}</span>
        <span class="crit-weight" id="weightLabel-${c.key}">20%</span>
      </div>
      <input type="range" min="0" max="100" value="20" class="crit-slider" id="slider-${c.key}" data-key="${c.key}">
      <p class="crit-desc">${c.description}</p>
    `;
    root.appendChild(card);
  });
  DATA.framework.criteria.forEach((c) => {
    document.getElementById(`slider-${c.key}`).addEventListener("input", (e) => {
      WEIGHTS[c.key] = Number(e.target.value);
      clearPresetHighlight();
      updateWeightLabels();
      renderPipeline();
    });
  });
  updateWeightLabels();
}

function updateWeightLabels() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) || 1;
  DATA.framework.criteria.forEach((c) => {
    const pct = Math.round((WEIGHTS[c.key] / total) * 100);
    document.getElementById(`weightLabel-${c.key}`).textContent = pct + "%";
  });
}

function renderControls() {
  const verticalSelect = document.getElementById("verticalFilter");
  verticalSelect.innerHTML =
    '<option value="all">All verticals</option>' +
    DATA.verticals.map((v) => `<option value="${v}">${v}</option>`).join("");

  const stageSelect = document.getElementById("stageFilter");
  stageSelect.innerHTML =
    '<option value="all">All stages</option>' +
    DATA.stages.map((s) => `<option value="${s}">${s}</option>`).join("");

  const channelSelect = document.getElementById("channelFilter");
  channelSelect.innerHTML =
    '<option value="all">All channels</option>' +
    DATA.channels.map((c) => `<option value="${c}">${c}</option>`).join("");

  document.getElementById("searchInput").addEventListener("input", (e) => {
    STATE.search = e.target.value.toLowerCase();
    renderPipeline();
  });
  verticalSelect.addEventListener("change", (e) => {
    STATE.vertical = e.target.value;
    renderPipeline();
  });
  stageSelect.addEventListener("change", (e) => {
    STATE.stage = e.target.value;
    renderPipeline();
  });
  channelSelect.addEventListener("change", (e) => {
    STATE.channel = e.target.value;
    renderPipeline();
  });
  document.getElementById("activeOnly").addEventListener("change", (e) => {
    STATE.activeOnly = e.target.checked;
    renderPipeline();
  });
  document.getElementById("sortSelect").addEventListener("change", (e) => {
    STATE.sort = e.target.value;
    renderPipeline();
  });
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  document.getElementById("drawerOverlay").addEventListener("click", closeDrawer);

  const drawer = document.getElementById("drawer");
  drawer.addEventListener("keydown", (e) => trapTab(drawer, e));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
}

function filteredDeals() {
  return DATA.deals.filter((d) => {
    if (STATE.search) {
      const hay = (d.name + " " + d.vertical + " " + d.location).toLowerCase();
      if (!hay.includes(STATE.search)) return false;
    }
    if (STATE.vertical !== "all" && d.vertical !== STATE.vertical) return false;
    if (STATE.stage !== "all" && d.stage !== STATE.stage) return false;
    if (STATE.channel !== "all" && d.channel !== STATE.channel) return false;
    if (STATE.activeOnly && (d.stage === "Closed" || d.stage === "Passed")) return false;
    return true;
  });
}

function sortedDeals(deals) {
  const withScore = deals.map((d) => ({ d, score: compositeScore(d) }));
  switch (STATE.sort) {
    case "composite-desc":
      withScore.sort((a, b) => b.score - a.score);
      break;
    case "composite-asc":
      withScore.sort((a, b) => a.score - b.score);
      break;
    case "sourced-desc":
      withScore.sort((a, b) => new Date(b.d.sourcedDate) - new Date(a.d.sourcedDate));
      break;
    case "ebitda-desc":
      withScore.sort((a, b) => b.d.ebitdaUsd - a.d.ebitdaUsd);
      break;
  }
  return withScore;
}

/* ---- Formatting. Financials are stored as numbers; display is derived. ---- */
function fmtUsd(n) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + Math.round(n);
}

function marginPct(deal) {
  return (deal.ebitdaUsd / deal.revenueUsd) * 100;
}

function scoreClass(score) {
  if (score >= 4) return "hi";
  if (score < 2.5) return "lo";
  return "";
}

function renderPipeline() {
  const deals = filteredDeals();
  const ranked = sortedDeals(deals);
  renderStats(deals);

  const root = document.getElementById("pipelineRoot");
  root.innerHTML = "";
  if (ranked.length === 0) {
    root.innerHTML = '<tr><td colspan="6" class="empty-state">No deals match these filters.</td></tr>';
    return;
  }
  const inRollup = new Set(rollupSelection().map((x) => x.id));
  ranked.forEach(({ d, score }) => {
    const cls = scoreClass(score);
    const picked = inRollup.has(d.id);
    const row = document.createElement("tr");
    row.dataset.id = d.id;
    row.innerHTML = `
      <td class="col-pick">
        <button type="button" class="pick-btn${picked ? " on" : ""}" data-pick="${d.id}"
          aria-pressed="${picked}" aria-label="${picked ? "Remove" : "Add"} ${d.name} ${picked ? "from" : "to"} roll-up"
          title="${picked ? "Remove from roll-up" : "Add to roll-up"}">${picked ? "&minus;" : "+"}</button>
      </td>
      <td>
        <button type="button" class="deal-name deal-name-btn">${d.name}</button>
        <span class="deal-sub">${d.vertical} · ${d.location}</span>
        <span class="row-note">${d.thesisNote}</span>
      </td>
      <td><span class="deal-badge stage-${slug(d.stage)}">${d.stage}</span></td>
      <td>${d.channel}</td>
      <td class="fin-cell">${fmtUsd(d.revenueUsd)} rev<br>${fmtUsd(d.ebitdaUsd)} EBITDA<br><span class="deal-margin">${marginPct(d).toFixed(1)}% · ${d.entryMultiple.toFixed(1)}x</span></td>
      <td>
        <div class="deal-score-cell">
          <div class="score-bar-track"><div class="score-bar-fill ${cls}" style="width:${(score / 5) * 100}%"></div></div>
          <span class="score-num ${cls}">${score.toFixed(1)}</span>
        </div>
        <span class="stab-mini" title="Share of 2,000 random weightings in which this deal ranks top-5">top-5 in ${STABILITY[d.id].topFivePct.toFixed(0)}% of weightings</span>
      </td>
    `;
    row.querySelector(".pick-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleRollupDeal(d.id);
    });
    // The deal name is the real, focusable control. The whole row stays
    // clickable as a mouse convenience, but keyboard users get one clean
    // tab stop per deal rather than a non-focusable <tr>.
    const nameBtn = row.querySelector(".deal-name-btn");
    nameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDrawer(d, score, nameBtn);
    });
    row.addEventListener("click", () => openDrawer(d, score, nameBtn));
    root.appendChild(row);
  });
  writeState();
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function renderStats(deals) {
  const root = document.getElementById("statsRoot");
  const total = deals.length;
  const active = deals.filter((d) => d.stage !== "Closed" && d.stage !== "Passed").length;
  const closed = deals.filter((d) => d.stage === "Closed").length;
  const avgScore = total ? deals.reduce((sum, d) => sum + compositeScore(d), 0) / total : 0;

  root.innerHTML = `
    <div class="stat-box"><span class="stat-num">${String(total).padStart(2, "0")}</span><span class="stat-label">Deals shown</span></div>
    <div class="stat-box"><span class="stat-num">${String(active).padStart(2, "0")}</span><span class="stat-label">Active pipeline</span></div>
    <div class="stat-box"><span class="stat-num">${String(closed).padStart(2, "0")}</span><span class="stat-label">Closed</span></div>
    <div class="stat-box"><span class="stat-num">${avgScore.toFixed(2)}</span><span class="stat-label">Avg weighted score</span></div>
  `;
  document.getElementById("tickerScore").textContent = avgScore.toFixed(2);
}

/* Radar chart: 5 axes starting at 12 o'clock, clockwise. */
function radarSVG(deal) {
  const SIZE = 240;
  const CX = SIZE / 2, CY = SIZE / 2;
  const R = 82;
  const criteria = DATA.framework.criteria;
  const n = criteria.length;

  const point = (i, r) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
  };
  const ring = (r) =>
    Array.from({ length: n }, (_, i) => point(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");

  const rings = [R, R * 0.66, R * 0.33]
    .map((r) => `<polygon points="${ring(r)}" fill="none" stroke="#262b26" stroke-width="1"/>`)
    .join("");

  const axes = Array.from({ length: n }, (_, i) => {
    const [x, y] = point(i, R);
    return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#3a423a" stroke-width="1"/>`;
  }).join("");

  const dataPoints = criteria.map((c, i) => point(i, (deal.scores[c.key] / 5) * R));
  const shape = dataPoints.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  const dots = dataPoints
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#3ddc84"/>`)
    .join("");

  const RADAR_LABELS = { fragmentation: "FRAG", unitEconomics: "ECON", aiLeverage: "AI LEV", moat: "MOAT", exitPath: "EXIT" };
  const labels = criteria.map((c, i) => {
    const [x, y] = point(i, R + 16);
    let anchor = "middle";
    if (x > CX + 8) anchor = "start";
    else if (x < CX - 8) anchor = "end";
    const dy = y > CY + 8 ? 8 : y < CY - 8 ? 0 : 4;
    return `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" fill="#7c877c" font-size="9" font-family="SF Mono, Menlo, Consolas, monospace" text-anchor="${anchor}" letter-spacing="0.05em">${RADAR_LABELS[c.key] || c.short.toUpperCase()}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="Five-box radar for ${deal.name}">
    ${rings}${axes}
    <polygon points="${shape}" fill="#3ddc84" fill-opacity="0.18" stroke="#3ddc84" stroke-width="2"/>
    ${dots}${labels}
  </svg>`;
}

let drawerReturnTo = null;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function trapTab(container, e) {
  if (e.key !== "Tab") return;
  const f = [...container.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  );
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function verticalBasisNote(vertical) {
  const ctx = DATA.verticalContext[vertical];
  const sourced = ctx.basis === "sourced";
  const detail = sourced
    ? `payroll is ${ctx.derivation.payrollShareOfRevenuePct}% of revenue (Census SAS 2022, NAICS ` +
      `${ctx.derivation.naicsProxy.split(" ")[0]} as proxy) and ${ctx.derivation.exposedShareOfPayrollPct}% ` +
      `of that payroll is in LLM-exposed tasks (BLS OEWS May 2025 × Eloundou et al.). Was ${ctx.derivation.priorEstimate}% as an estimate.`
    : `<strong>author's assumption</strong>, not yet sourced. ${ctx.assumptionNote}`;
  return `<div class="drawer-basis basis-${sourced ? "sourced" : "assumption"}">
      <span class="drawer-basis-tag">${sourced ? "Sourced" : "Assumption"}</span>
      Automatable cost for ${vertical}: <b>${ctx.automatableCostShare}%</b> of revenue — ${detail}
      <a class="sources-link" href="${DATA.meta.sourcesUrl}" target="_blank" rel="noopener">Sources</a>
    </div>`;
}

function openDrawer(deal, score, returnTo) {
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  const body = document.getElementById("drawerBody");
  drawerReturnTo = returnTo || null;

  const critRows = DATA.framework.criteria
    .map((c) => {
      const s = deal.scores[c.key];
      return `
        <div class="drawer-crit">
          <div class="drawer-crit-head">
            <span>${c.label}</span>
            <span class="drawer-crit-score">${s}/5</span>
          </div>
          <div class="score-bar-track"><div class="score-bar-fill hi" style="width:${(s / 5) * 100}%"></div></div>
          <p class="drawer-crit-rationale">${deal.rationale[c.key]}</p>
        </div>
      `;
    })
    .join("");

  body.innerHTML = `
    <div class="drawer-badge stage-${slug(deal.stage)}">${deal.stage}</div>
    <h2 class="drawer-title">${deal.name}</h2>
    <p class="drawer-sub">${deal.vertical} · ${deal.location}</p>
    <div class="drawer-radar">${radarSVG(deal)}</div>
    <div class="drawer-financials">
      <div><span class="drawer-fin-label">Revenue</span><span class="drawer-fin-val">${fmtUsd(deal.revenueUsd)}</span></div>
      <div><span class="drawer-fin-label">EBITDA</span><span class="drawer-fin-val">${fmtUsd(deal.ebitdaUsd)}</span></div>
      <div><span class="drawer-fin-label">Margin</span><span class="drawer-fin-val">${marginPct(deal).toFixed(1)}%</span></div>
      <div><span class="drawer-fin-label">Ask / multiple</span><span class="drawer-fin-val">${fmtUsd(deal.askPriceUsd)} · ${deal.entryMultiple.toFixed(2)}x</span></div>
      <div><span class="drawer-fin-label">Headcount</span><span class="drawer-fin-val">${deal.employees}</span></div>
      <div><span class="drawer-fin-label">Recurring revenue</span><span class="drawer-fin-val">${deal.recurringPct}%</span></div>
      <div><span class="drawer-fin-label">Channel</span><span class="drawer-fin-val">${deal.channel}</span></div>
      <div><span class="drawer-fin-label">Sourced</span><span class="drawer-fin-val">${deal.sourcedDate}</span></div>
      <div><span class="drawer-fin-label">Weighted score</span><span class="drawer-fin-val">${score.toFixed(2)} / 5</span></div>
    </div>
    <div class="drawer-note"><strong>Thesis note:</strong> ${deal.thesisNote}</div>
    ${verticalBasisNote(deal.vertical)}

    <h3 class="drawer-section-head">Rank stability</h3>
    <p class="stab-intro">Where this deal lands across <strong>2,000 random weightings</strong> of the five
      criteria — not just the one currently set. A narrow band means the deal is genuinely strong;
      a wide one means its rank is an artefact of how you happen to be weighting today.</p>
    ${stabilityBar(STABILITY[deal.id], DATA.deals.length)}
    <div class="stab-legend">
      <span>Best <b>#${STABILITY[deal.id].best}</b></span>
      <span>Median <b>#${STABILITY[deal.id].median}</b></span>
      <span>Worst <b>#${STABILITY[deal.id].worst}</b></span>
      <span class="stab-top5">Top-5 in <b>${STABILITY[deal.id].topFivePct.toFixed(0)}%</b></span>
    </div>

    <h3 class="drawer-section-head">Five-box breakdown</h3>
    ${critRows}
  `;

  drawer.classList.add("open");
  overlay.classList.add("open");
  drawer.removeAttribute("inert");
  drawer.setAttribute("aria-hidden", "false");
  document.getElementById("drawerClose").focus();
}

function closeDrawer() {
  const drawer = document.getElementById("drawer");
  if (!drawer.classList.contains("open")) return;
  drawer.classList.remove("open");
  document.getElementById("drawerOverlay").classList.remove("open");
  drawer.setAttribute("inert", "");
  drawer.setAttribute("aria-hidden", "true");
  if (drawerReturnTo && document.contains(drawerReturnTo)) drawerReturnTo.focus();
  drawerReturnTo = null;
}

/* ============================================================
   Shareable state
   ============================================================
   Everything the user configures -- weights, filters, sort, and the whole
   roll-up selection with its assumptions -- is encoded into the URL hash,
   so a link reproduces a specific reading rather than the default view.
   The same string is mirrored to localStorage, so returning to the page
   without a hash restores your last calibration instead of resetting.
   ============================================================ */

const STATE_KEY = "dealdocket.state.v2";
let stateReady = false; // suppress writes while we're applying a state

function serializeState() {
  const keys = DATA.framework.criteria.map((c) => c.key);
  const p = new URLSearchParams();
  p.set("w", keys.map((k) => WEIGHTS[k]).join("."));
  if (STATE.vertical !== "all") p.set("v", STATE.vertical);
  if (STATE.stage !== "all") p.set("s", STATE.stage);
  if (STATE.channel !== "all") p.set("c", STATE.channel);
  if (STATE.activeOnly) p.set("a", "1");
  if (STATE.sort !== "composite-desc") p.set("o", STATE.sort);
  if (STATE.search) p.set("q", STATE.search);
  if (ROLLUP.platformId) {
    p.set("p", ROLLUP.platformId);
    if (ROLLUP.addonIds.length) p.set("x", ROLLUP.addonIds.join("."));
  }
  p.set("cap", String(ROLLUP.capturePct));
  p.set("org", String(ROLLUP.organicPct));
  if (ROLLUP.exitMultiple != null) p.set("e", ROLLUP.exitMultiple.toFixed(2));
  return p.toString();
}

function writeState() {
  if (!stateReady) return;
  const s = serializeState();
  history.replaceState(null, "", "#" + s);
  try { localStorage.setItem(STATE_KEY, s); } catch (e) {}
}

function applyState(str) {
  if (!str) return false;
  const p = new URLSearchParams(str);
  const keys = DATA.framework.criteria.map((c) => c.key);

  const w = (p.get("w") || "").split(".").map(Number);
  if (w.length === keys.length && w.every((n) => Number.isFinite(n) && n >= 0)) {
    keys.forEach((k, i) => (WEIGHTS[k] = w[i]));
  }
  const valid = (val, list) => val && list.includes(val);
  if (valid(p.get("v"), DATA.verticals)) STATE.vertical = p.get("v");
  if (valid(p.get("s"), DATA.stages)) STATE.stage = p.get("s");
  if (valid(p.get("c"), DATA.channels)) STATE.channel = p.get("c");
  if (p.has("a")) STATE.activeOnly = p.get("a") === "1";
  if (p.get("o")) STATE.sort = p.get("o");
  if (p.get("q")) STATE.search = p.get("q");

  const known = new Set(DATA.deals.map((d) => d.id));
  if (p.get("p") && known.has(p.get("p"))) {
    ROLLUP.platformId = p.get("p");
    ROLLUP.addonIds = (p.get("x") || "").split(".").filter((id) => known.has(id) && id !== p.get("p"));
  }
  const num = (k, lo, hi) => {
    const n = Number(p.get(k));
    return p.get(k) !== null && Number.isFinite(n) && n >= lo && n <= hi ? n : null;
  };
  const cap = num("cap", 0, 100); if (cap !== null) ROLLUP.capturePct = cap;
  const org = num("org", 0, 60); if (org !== null) ROLLUP.organicPct = org;
  const ex = num("e", 1, 20); if (ex !== null) ROLLUP.exitMultiple = ex;
  return true;
}

/* Push restored state back into the DOM controls that hold it. */
function syncControlsToState() {
  DATA.framework.criteria.forEach((c) => {
    const el = document.getElementById(`slider-${c.key}`);
    if (el) el.value = WEIGHTS[c.key];
  });
  updateWeightLabels();
  document.getElementById("verticalFilter").value = STATE.vertical;
  document.getElementById("stageFilter").value = STATE.stage;
  document.getElementById("channelFilter").value = STATE.channel;
  document.getElementById("activeOnly").checked = STATE.activeOnly;
  document.getElementById("sortSelect").value = STATE.sort;
  document.getElementById("searchInput").value = STATE.search;
  document.getElementById("captureSlider").value = ROLLUP.capturePct;
  document.getElementById("organicSlider").value = ROLLUP.organicPct;
}

/* ============================================================
   Rank stability
   ============================================================
   A weighted score is only as good as the weights, and the weights are a
   judgement call. So the useful question isn't "what ranks first under my
   current weighting" -- it's "which deals rank well under ALMOST ANY
   weighting, and which are artefacts of one particular preset".

   Sample uniformly from the weight simplex, rank every deal in each
   sample, and report the distribution. Deterministic: a fixed seed means
   the same numbers every load, so the figures are quotable.
   ============================================================ */

const STABILITY_SAMPLES = 2000;
const STABILITY_SEED = 20260728;
let STABILITY = null;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Uniform point on the k-simplex: normalise k exponential draws. */
function randomWeights(rand, keys) {
  const raw = keys.map(() => -Math.log(1 - rand()));
  const sum = raw.reduce((a, b) => a + b, 0);
  const w = {};
  keys.forEach((k, i) => (w[k] = raw[i] / sum));
  return w;
}

function computeStability() {
  const keys = DATA.framework.criteria.map((c) => c.key);
  const deals = DATA.deals;
  const rand = mulberry32(STABILITY_SEED);
  const ranks = {};
  deals.forEach((d) => (ranks[d.id] = []));

  const scored = new Array(deals.length);
  for (let s = 0; s < STABILITY_SAMPLES; s++) {
    const w = randomWeights(rand, keys);
    for (let i = 0; i < deals.length; i++) {
      let v = 0;
      for (const k of keys) v += w[k] * deals[i].scores[k];
      scored[i] = { id: deals[i].id, v };
    }
    scored.sort((a, b) => b.v - a.v);
    for (let i = 0; i < scored.length; i++) ranks[scored[i].id].push(i + 1);
  }

  const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];
  const out = {};
  deals.forEach((d) => {
    const r = ranks[d.id].slice().sort((a, b) => a - b);
    out[d.id] = {
      best: r[0],
      worst: r[r.length - 1],
      median: pct(r, 50),
      p10: pct(r, 10),
      p90: pct(r, 90),
      topFivePct: (r.filter((x) => x <= 5).length / r.length) * 100,
    };
  });
  return out;
}

/* Horizontal band: full rank range in the recessive track, p10-p90 solid. */
function stabilityBar(st, total) {
  const pos = (r) => ((r - 1) / Math.max(total - 1, 1)) * 100;
  const left = pos(st.p10);
  const width = Math.max(pos(st.p90) - left, 1.5);
  const med = pos(st.median);
  return `<div class="stab-track" role="img"
      aria-label="Rank ${st.p10} to ${st.p90} across weightings, median ${st.median} of ${total}">
      <div class="stab-band" style="left:${left}%;width:${width}%"></div>
      <div class="stab-median" style="left:${med}%"></div>
    </div>`;
}

/* ============================================================
   Roll-up builder
   ============================================================
   A screen ranks targets; it never shows why the strategy pays.
   This models the two distinct sources of return in a roll-up:

     1. Multiple arbitrage — buy sub-scale assets at the small-company
        multiple, sell the combined entity at the platform multiple.
        Earned on the EBITDA you acquired, with no operating change.

     2. AI margin expansion — the actual thesis. Applied to each deal's
        automatable cost base, scaled by how automatable that vertical
        is and how well the specific asset scores on aiLeverage.

   The bridge is constructed to close exactly:
     entryPrice + arbitrage + aiValue + organicValue === exitValue
   ============================================================ */

const ROLLUP = {
  platformId: null,
  addonIds: [],
  capturePct: 30,
  organicPct: 12,
  exitMultiple: null, // null = use the size-derived default
};

function rollupSelection() {
  if (!ROLLUP.platformId) return [];
  const byId = (id) => DATA.deals.find((d) => d.id === id);
  const platform = byId(ROLLUP.platformId);
  if (!platform) return [];
  return [platform, ...ROLLUP.addonIds.map(byId).filter(Boolean)];
}

function defaultExitMultiple(ebitdaExit) {
  const m = DATA.rollupModel;
  return Math.min(
    m.exitMultipleCap,
    m.exitMultipleBase + (ebitdaExit / 1_000_000) * m.exitMultiplePerMillionEbitda
  );
}

function computeRollup() {
  const sel = rollupSelection();
  if (sel.length === 0) return null;

  const revenue = sel.reduce((s, d) => s + d.revenueUsd, 0);
  const ebitdaEntry = sel.reduce((s, d) => s + d.ebitdaUsd, 0);
  const employees = sel.reduce((s, d) => s + d.employees, 0);
  const entryPrice = sel.reduce((s, d) => s + d.askPriceUsd, 0);
  const blendedEntryMultiple = entryPrice / ebitdaEntry;

  // AI uplift: automatable cost base x how much of it you actually capture
  // x how automatable this specific asset is judged to be.
  const capture = ROLLUP.capturePct / 100;
  const perDeal = sel.map((d) => {
    const share = DATA.verticalContext[d.vertical].automatableCostShare / 100;
    const leverage = d.scores.aiLeverage / 5;
    return { deal: d, uplift: d.revenueUsd * share * capture * leverage };
  });
  const ebitdaAI = perDeal.reduce((s, x) => s + x.uplift, 0);
  const ebitdaOrganic = ebitdaEntry * (ROLLUP.organicPct / 100);
  const ebitdaExit = ebitdaEntry + ebitdaAI + ebitdaOrganic;

  const exitMultiple = ROLLUP.exitMultiple ?? defaultExitMultiple(ebitdaExit);
  const exitValue = ebitdaExit * exitMultiple;

  // Bridge components. Arbitrage is earned only on acquired EBITDA; the
  // uplift components are valued at the exit multiple they help create.
  const arbitrage = ebitdaEntry * (exitMultiple - blendedEntryMultiple);
  const aiValue = ebitdaAI * exitMultiple;
  const organicValue = ebitdaOrganic * exitMultiple;

  return {
    sel, perDeal, revenue, employees,
    ebitdaEntry, ebitdaAI, ebitdaOrganic, ebitdaExit,
    entryPrice, blendedEntryMultiple, exitMultiple, exitValue,
    arbitrage, aiValue, organicValue,
    marginEntry: (ebitdaEntry / revenue) * 100,
    marginExit: (ebitdaExit / revenue) * 100,
    moic: exitValue / entryPrice,
    bridgeCloses: Math.abs(entryPrice + arbitrage + aiValue + organicValue - exitValue) < 1,
  };
}

/* Stacked value bridge. Segments are drawn proportional to exit value so the
   bar always reads as "this is where the money came from". */
function bridgeSVG(r) {
  const W = 520, H = 128, PAD = 4;
  const segs = [
    { label: "Entry price", val: r.entryPrice, cls: "seg-entry" },
    { label: "Multiple arbitrage", val: r.arbitrage, cls: "seg-arb" },
    { label: "AI margin", val: r.aiValue, cls: "seg-ai" },
    { label: "Organic", val: r.organicValue, cls: "seg-org" },
  ].filter((s) => s.val > 0);

  const total = segs.reduce((s, x) => s + x.val, 0) || 1;
  let x = 0;
  const bars = segs.map((s) => {
    const w = (s.val / total) * (W - PAD * 2);
    const rect = `<rect x="${(PAD + x).toFixed(1)}" y="26" width="${Math.max(w - 2, 1).toFixed(1)}" height="34" rx="2" class="${s.cls}"/>`;
    const showLabel = w > 58;
    const cx = PAD + x + w / 2;
    const label = showLabel
      ? `<text x="${cx.toFixed(1)}" y="18" class="bridge-lab" text-anchor="middle">${s.label}</text>
         <text x="${cx.toFixed(1)}" y="76" class="bridge-val" text-anchor="middle">${fmtUsd(s.val)}</text>`
      : "";
    x += w;
    return rect + label;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" class="bridge-svg" role="img"
    aria-label="Value bridge: entry price ${fmtUsd(r.entryPrice)}, multiple arbitrage ${fmtUsd(r.arbitrage)}, AI margin ${fmtUsd(r.aiValue)}, organic ${fmtUsd(r.organicValue)}, total exit value ${fmtUsd(r.exitValue)}">
    ${bars}
    <line x1="${PAD}" y1="90" x2="${W - PAD}" y2="90" class="bridge-axis"/>
    <text x="${PAD}" y="108" class="bridge-end">Entry ${fmtUsd(r.entryPrice)} · ${r.blendedEntryMultiple.toFixed(2)}x</text>
    <text x="${W - PAD}" y="108" class="bridge-end" text-anchor="end">Exit ${fmtUsd(r.exitValue)} · ${r.exitMultiple.toFixed(2)}x</text>
  </svg>`;
}

/* Overlaid radar for the current selection. The per-deal radar in the drawer
   answers "is this asset good"; this answers the question you actually have
   while assembling a roll-up: are these the same shape, or complementary? */
const SERIES_COLORS = ["#3ddc84", "#e8a33d", "#7aa7d8", "#c58ae0", "#e05d5d"];

function multiRadarSVG(deals) {
  const SIZE = 250, CX = SIZE / 2, CY = SIZE / 2, R = 78;
  const criteria = DATA.framework.criteria;
  const n = criteria.length;
  const point = (i, r) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const ring = (r) =>
    Array.from({ length: n }, (_, i) => point(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");

  const rings = [R, R * 0.66, R * 0.33]
    .map((r) => `<polygon points="${ring(r)}" fill="none" stroke="#262b26" stroke-width="1"/>`)
    .join("");
  const axes = Array.from({ length: n }, (_, i) => {
    const [x, y] = point(i, R);
    return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#3a423a" stroke-width="1"/>`;
  }).join("");

  const shapes = deals.map((d, di) => {
    const col = SERIES_COLORS[di % SERIES_COLORS.length];
    const pts = criteria.map((c, i) => point(i, (d.scores[c.key] / 5) * R));
    const poly = pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
    return `<polygon points="${poly}" fill="${col}" fill-opacity="0.10" stroke="${col}" stroke-width="1.75"/>`;
  }).join("");

  const LABELS = { fragmentation: "FRAG", unitEconomics: "ECON", aiLeverage: "AI LEV", moat: "MOAT", exitPath: "EXIT" };
  const labels = criteria.map((c, i) => {
    const [x, y] = point(i, R + 16);
    let anchor = "middle";
    if (x > CX + 8) anchor = "start";
    else if (x < CX - 8) anchor = "end";
    const dy = y > CY + 8 ? 8 : y < CY - 8 ? 0 : 4;
    return `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" fill="#7c877c" font-size="9"
      font-family="SF Mono, Menlo, Consolas, monospace" text-anchor="${anchor}" letter-spacing="0.05em">${LABELS[c.key] || c.short.toUpperCase()}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" class="multi-radar" role="img"
    aria-label="Five-box profiles overlaid for ${deals.map((d) => d.name).join(", ")}">
    ${rings}${axes}${shapes}${labels}
  </svg>`;
}

/* Read the overlay in words: where the selection agrees, and where it doesn't.
   A roll-up of identical shapes concentrates risk; complementary shapes are
   the case for combining them at all. */
function shapeRead(deals) {
  if (deals.length < 2) {
    return "Add a second asset to compare profiles. A roll-up of identical shapes concentrates the same risk; complementary shapes are the argument for combining them.";
  }
  const crit = DATA.framework.criteria.map((c) => {
    const vals = deals.map((d) => d.scores[c.key]);
    return { label: c.short, spread: Math.max(...vals) - Math.min(...vals), min: Math.min(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length };
  });
  const widest = crit.slice().sort((a, b) => b.spread - a.spread)[0];
  const weakest = crit.slice().sort((a, b) => a.avg - b.avg)[0];
  const aligned = crit.filter((c) => c.spread === 0);

  const parts = [];
  if (widest.spread >= 2) {
    parts.push(`Widest divergence is <strong>${widest.label}</strong> — a ${widest.spread}-point spread, so the assets are not interchangeable there.`);
  } else {
    parts.push(`No criterion splits the selection by more than ${widest.spread} point${widest.spread === 1 ? "" : "s"} — these are similar assets, which concentrates rather than diversifies the thesis.`);
  }
  if (aligned.length) {
    parts.push(`They score identically on ${aligned.map((c) => c.label).join(", ")}.`);
  }
  parts.push(`Weakest shared axis is <strong>${weakest.label}</strong> (avg ${weakest.avg.toFixed(1)}/5) — the constraint the combined entity inherits.`);
  return parts.join(" ");
}

function radarLegend(deals) {
  return `<div class="radar-legend">` + deals.map((d, i) =>
    `<span class="rl-item"><span class="rl-swatch" style="background:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>${d.name}</span>`
  ).join("") + `</div>`;
}

function renderRollupChips() {
  const root = document.getElementById("rollupChips");
  const sel = rollupSelection();
  if (sel.length === 0) {
    root.innerHTML = '<span class="rollup-empty">No deals selected.</span>';
    return;
  }
  root.innerHTML = sel
    .map((d, i) => {
      const isPlatform = i === 0;
      return `<button type="button" class="rollup-chip${isPlatform ? " platform" : ""}" data-id="${d.id}"
        aria-label="${isPlatform ? "Platform" : "Add-on"}: ${d.name}. Click to make platform.">
        <span class="rollup-chip-role">${isPlatform ? "PLATFORM" : "ADD-ON"}</span>
        <span class="rollup-chip-name">${d.name}</span>
        <span class="rollup-chip-fin">${fmtUsd(d.ebitdaUsd)}</span>
      </button>`;
    })
    .join("");
  root.querySelectorAll(".rollup-chip").forEach((btn) => {
    btn.addEventListener("click", () => promotePlatform(btn.dataset.id));
  });
}

function promotePlatform(id) {
  if (!rollupSelection().some((d) => d.id === id)) return;
  const others = rollupSelection().filter((d) => d.id !== id).map((d) => d.id);
  ROLLUP.platformId = id;
  ROLLUP.addonIds = others;
  renderRollup();
}

function toggleRollupDeal(id) {
  if (ROLLUP.platformId === id) {
    // removing the platform promotes the next add-on
    ROLLUP.platformId = ROLLUP.addonIds.shift() || null;
  } else if (ROLLUP.addonIds.includes(id)) {
    ROLLUP.addonIds = ROLLUP.addonIds.filter((x) => x !== id);
  } else if (!ROLLUP.platformId) {
    ROLLUP.platformId = id;
  } else {
    ROLLUP.addonIds.push(id);
  }
  renderRollup();
  renderPipeline();
}

function renderRollup() {
  renderRollupChips();
  const out = document.getElementById("rollupOutput");
  const r = computeRollup();

  const capture = DATA.rollupModel;
  document.getElementById("captureVal").textContent = ROLLUP.capturePct + "%";
  document.getElementById("organicVal").textContent = ROLLUP.organicPct + "%";

  if (!r) {
    out.innerHTML = '<p class="rollup-empty-state">Add a deal from the pipeline to model a roll-up.</p>';
    document.getElementById("exitVal").textContent = "—";
    document.getElementById("captureDesc").textContent = "";
    document.getElementById("exitDesc").textContent = "";
    return;
  }

  document.getElementById("exitVal").textContent = r.exitMultiple.toFixed(2) + "x";
  document.getElementById("exitSlider").value = Math.round(r.exitMultiple * 10);
  document.getElementById("exitDesc").textContent =
    "Blended entry " + r.blendedEntryMultiple.toFixed(2) + "x · spread " +
    (r.exitMultiple - r.blendedEntryMultiple).toFixed(2) + "x";

  const shares = r.sel.map((d) => DATA.verticalContext[d.vertical].automatableCostShare);
  const lo = Math.min(...shares), hi = Math.max(...shares);
  const captureDesc = document.getElementById("captureDesc");
  captureDesc.textContent =
    "Automatable cost base " + (lo === hi ? lo + "%" : lo + "–" + hi + "%") +
    " of revenue across the selection, scaled by each asset's AI-leverage score. " +
    basisSummary(r.sel) + " ";
  captureDesc.appendChild(sourcesLink());

  const arbShare = (r.arbitrage / (r.exitValue - r.entryPrice)) * 100;
  const aiShare = (r.aiValue / (r.exitValue - r.entryPrice)) * 100;

  out.innerHTML = `
    <div class="rollup-stats">
      <div class="rollup-stat"><span class="rs-num">${fmtUsd(r.revenue)}</span><span class="rs-lab">Pro-forma revenue</span></div>
      <div class="rollup-stat"><span class="rs-num">${fmtUsd(r.ebitdaExit)}</span><span class="rs-lab">EBITDA at exit</span></div>
      <div class="rollup-stat"><span class="rs-num">${r.marginEntry.toFixed(1)}% → ${r.marginExit.toFixed(1)}%</span><span class="rs-lab">Margin</span></div>
      <div class="rollup-stat hero"><span class="rs-num">${r.moic.toFixed(2)}x</span><span class="rs-lab">Gross MOIC</span></div>
    </div>

    <div class="bridge-wrap">
      <div class="bridge-title">Value bridge — ${r.sel.length} asset${r.sel.length === 1 ? "" : "s"}, ${r.employees} employees</div>
      ${bridgeSVG(r)}
    </div>

    <div class="shape-wrap">
      <div class="shape-chart">
        <div class="bridge-title">Profiles overlaid</div>
        ${multiRadarSVG(r.sel)}
        ${radarLegend(r.sel)}
      </div>
      <p class="shape-read">${shapeRead(r.sel)}</p>
    </div>

    <div class="rollup-read">
      <p><strong>${arbShare.toFixed(0)}%</strong> of the gain is multiple arbitrage — earned by buying at
      ${r.blendedEntryMultiple.toFixed(2)}x and exiting at ${r.exitMultiple.toFixed(2)}x, with no operating change.
      <strong>${aiShare.toFixed(0)}%</strong> comes from the AI margin thesis actually working.</p>
      <p class="rollup-caveat">All-equity, pre-fee, pre-tax. No integration cost, no multiple compression,
      no failed add-on. The arbitrage line is the part that survives if the AI thesis disappoints — which is
      the honest reason this structure is attractive.</p>
    </div>
  `;
}

/* The automatable-cost share is the model's least certain input, so the UI
   says next to it which verticals are sourced and which are still the
   author's assumption -- the data carries `basis` for exactly this. */
function basisSummary(sel) {
  const verticals = [...new Set(sel.map((d) => d.vertical))];
  const sourced = verticals.filter((v) => DATA.verticalContext[v].basis === "sourced");
  const assumed = verticals.filter((v) => DATA.verticalContext[v].basis !== "sourced");
  if (!assumed.length) return "Sourced: Census payroll ÷ revenue × LLM task exposure.";
  if (!sourced.length) {
    return (assumed.length === 1 ? "This share is" : "These shares are") +
      " the author's assumption, not a sourced figure.";
  }
  return "Sourced for " + sourced.join(", ") + "; author's assumption for " + assumed.join(", ") + ".";
}

function sourcesLink() {
  const a = document.createElement("a");
  a.href = DATA.meta.sourcesUrl;
  a.target = "_blank";
  a.rel = "noopener";
  a.className = "sources-link";
  a.textContent = "Sources";
  return a;
}

function wireRollup() {
  document.getElementById("captureSlider").addEventListener("input", (e) => {
    ROLLUP.capturePct = Number(e.target.value);
    renderRollup();
  });
  document.getElementById("organicSlider").addEventListener("input", (e) => {
    ROLLUP.organicPct = Number(e.target.value);
    renderRollup();
  });
  document.getElementById("exitSlider").addEventListener("input", (e) => {
    ROLLUP.exitMultiple = Number(e.target.value) / 10;
    renderRollup();
  });
  document.getElementById("rollupClear").addEventListener("click", () => {
    ROLLUP.platformId = null;
    ROLLUP.addonIds = [];
    ROLLUP.exitMultiple = null;
    renderRollup();
    renderPipeline();
  });
}

/* Seed a coherent default so the feature is populated on first paint:
   the highest-EBITDA asset in the most-represented vertical, plus its
   three strongest same-vertical add-ons. */
function seedRollup() {
  // Count only deals actually available to buy -- counting Passed deals picks
  // verticals that look deep but aren't.
  const eligible = {};
  DATA.deals
    .filter((d) => d.stage !== "Passed")
    .forEach((d) => (eligible[d.vertical] = (eligible[d.vertical] || 0) + 1));

  const maxDepth = Math.max(...Object.values(eligible));
  // Among the deepest verticals, start on the most AI-exposed one so the
  // default view demonstrates the thesis rather than a marginal case.
  const vertical = Object.keys(eligible)
    .filter((v) => eligible[v] === maxDepth)
    .sort(
      (a, b) =>
        DATA.verticalContext[b].automatableCostShare -
        DATA.verticalContext[a].automatableCostShare
    )[0];

  const pool = DATA.deals
    .filter((d) => d.vertical === vertical && d.stage !== "Passed")
    .sort((a, b) => b.ebitdaUsd - a.ebitdaUsd);
  if (!pool.length) return;
  ROLLUP.platformId = pool[0].id;
  ROLLUP.addonIds = pool.slice(1).map((d) => d.id);
}

init();
