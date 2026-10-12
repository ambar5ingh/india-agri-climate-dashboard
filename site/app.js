// India Agri-Climate Results — renders site/data/*.json produced by pipeline/fetch.py
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = (n) => n == null ? "–" : Math.abs(n) >= 1000
  ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
  : n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function load(name) {
  try {
    const r = await fetch(`data/${name}.json`, { cache: "no-cache" });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const charts = [];
function baseOptions(unit) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y ?? c.parsed.x)} ${unit}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: css("--ink-3"), maxTicksLimit: 7, font: { size: 11 } }, border: { color: css("--rule") } },
      y: { grid: { color: css("--grid") }, ticks: { color: css("--ink-3"), font: { size: 11 }, callback: fmt }, border: { display: false } },
    },
  };
}

function card({ title, unit, source, sourceUrl, wide, legend }) {
  const el = document.createElement("article");
  el.className = "card" + (wide ? " wide" : "");
  el.innerHTML = `
    <h3>${esc(title)}</h3><p class="unit">${esc(unit)}</p>
    ${legend ? `<div class="legend">${legend.map((l) => `<span><i style="background:${l.color}"></i>${esc(l.label)}</span>`).join("")}</div>` : ""}
    <div class="chart-box"><canvas role="img" aria-label="${esc(title)}"></canvas></div>
    <div class="table-box" hidden></div>
    <div class="card-foot"><span>Source: <a href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(source)}</a></span>
      <button type="button">Table</button></div>`;
  const btn = el.querySelector("button");
  btn.addEventListener("click", () => {
    const tb = el.querySelector(".table-box"), cb = el.querySelector(".chart-box");
    const showTable = tb.hidden;
    tb.hidden = !showTable; cb.hidden = showTable; btn.textContent = showTable ? "Chart" : "Table";
  });
  return el;
}

function lineChart(container, { title, unit, source, sourceUrl, series, wide }) {
  const colors = ["--series-1", "--series-2", "--series-3"].map(css);
  const years = [...new Set(series.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  const el = card({ title, unit, source, sourceUrl, wide,
    legend: series.length > 1 ? series.map((s, i) => ({ label: s.label, color: colors[i] })) : null });
  container.append(el);
  const lookup = series.map((s) => new Map(s.points.map((p) => [p.year, p.value])));
  el.querySelector(".table-box").innerHTML = `<table class="data"><thead><tr><th>Year</th>${series.map((s) => `<th>${esc(s.label)}</th>`).join("")}</tr></thead><tbody>${
    [...years].reverse().map((y) => `<tr><td>${y}</td>${lookup.map((m) => `<td class="n">${fmt(m.get(y))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  charts.push(new Chart(el.querySelector("canvas"), {
    type: "line",
    data: { labels: years, datasets: series.map((s, i) => ({
      label: s.label, data: years.map((y) => lookup[i].get(y) ?? null),
      borderColor: colors[i], backgroundColor: colors[i], borderWidth: 2,
      pointRadius: 0, pointHoverRadius: 5, spanGaps: true, tension: 0.15 })) },
    options: baseOptions(unit),
  }));
}

function barChart(container, ds) {
  const top = ds.rows.slice(0, 15);
  const el = card({ title: ds.label, unit: `${ds.unit} · top ${top.length} of ${ds.rows.length} states/UTs`, source: ds.source, sourceUrl: ds.source_url, wide: true });
  container.append(el);
  el.querySelector(".chart-box").style.height = `${Math.max(220, top.length * 24)}px`;
  el.querySelector(".table-box").innerHTML = `<table class="data"><thead><tr><th>State / UT</th><th>${esc(ds.unit)}</th></tr></thead><tbody>${
    ds.rows.map((r) => `<tr><td>${esc(r.state)}</td><td class="n">${fmt(r.value)}</td></tr>`).join("")}</tbody></table>`;
  const opts = baseOptions(ds.unit);
  opts.indexAxis = "y";
  opts.interaction = { mode: "nearest", axis: "y", intersect: false };
  [opts.scales.x, opts.scales.y] = [
    { ...opts.scales.y, ticks: { ...opts.scales.y.ticks } },
    { grid: { display: false }, ticks: { color: css("--ink-2"), font: { size: 11.5 }, autoSkip: false }, border: { color: css("--rule") } },
  ];
  charts.push(new Chart(el.querySelector("canvas"), {
    type: "bar",
    data: { labels: top.map((r) => r.state), datasets: [{ label: ds.label, data: top.map((r) => r.value),
      backgroundColor: css("--series-1"), borderRadius: 4, borderSkipped: "start", barPercentage: 0.7 }] },
    options: opts,
  }));
}

function tiles(national, emissions) {
  const pick = (arr, label) => (arr || []).find((s) => s.label === label);
  const items = [
    pick(emissions, "Total GHG emissions (excl. land use)"),
    pick(emissions, "Methane (all sectors)"),
    pick(national, "Irrigated land"),
    pick(national, "Employment in agriculture"),
    pick(national, "Renewable energy consumption"),
  ].filter((s) => s && s.points.length);
  document.getElementById("tiles").innerHTML = items.map((s) => {
    const last = s.points.at(-1);
    const back = s.points.find((p) => p.year === last.year - 10);
    const delta = back ? ((last.value - back.value) / back.value) * 100 : null;
    const unitShort = s.unit.startsWith("%") ? "%" : s.unit;
    return `<div class="tile"><div class="k">${esc(s.label)}</div>
      <div class="v">${fmt(last.value)}<small>${esc(unitShort)}</small></div>
      <div class="d">${last.year}${delta != null ? ` · ${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))}% vs ${back.year}` : ""}</div></div>`;
  }).join("") || `<p class="empty">No data yet — run the GitHub Action once to populate.</p>`;
}

function trends(national) {
  const grid = document.getElementById("trends-grid");
  const filter = document.getElementById("theme-filter");
  if (!national?.length) { grid.innerHTML = `<p class="empty">World Bank data not fetched yet. It fills in on the first GitHub Actions run.</p>`; return; }
  const themes = ["All", ...new Set(national.map((s) => s.theme))];
  let active = "All";
  const draw = () => {
    charts.splice(0).forEach((c) => c.canvas.closest("#trends-grid") ? c.destroy() : charts.push(c));
    grid.innerHTML = "";
    national.filter((s) => active === "All" || s.theme === active).forEach((s) =>
      lineChart(grid, { title: s.label, unit: s.unit, source: s.source, sourceUrl: s.source_url, series: [s] }));
  };
  filter.innerHTML = themes.map((t) => `<button type="button" class="chip" aria-pressed="${t === active}">${esc(t)}</button>`).join("");
  filter.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    active = b.textContent;
    filter.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === b));
    draw();
  });
  draw();
}

function emissionsSection(emissions) {
  const grid = document.getElementById("emissions-grid");
  if (!emissions?.length) { grid.innerHTML = `<p class="empty">Emissions data not fetched yet.</p>`; return; }
  const total = emissions.find((s) => s.column === "total_ghg_excluding_lucf");
  const gases = emissions.filter((s) => s.column !== "total_ghg_excluding_lucf");
  const src = emissions[0];
  if (total) lineChart(grid, { title: total.label, unit: total.unit, source: src.source, sourceUrl: src.source_url, series: [total], wide: true });
  if (gases.length) lineChart(grid, { title: "Methane and nitrous oxide (all sectors)", unit: gases[0].unit, source: src.source, sourceUrl: src.source_url, series: gases, wide: true });
}

function statesSection(states) {
  const body = document.getElementById("states-body");
  if (!states?.length) {
    body.innerHTML = `<div class="empty"><strong>State-level datasets aren't connected yet.</strong>
      <ol><li>Get a free API key at data.gov.in and save it as the repository secret <code>DATA_GOV_IN_API_KEY</code>.</li>
      <li>Find a state-wise dataset (PM-KUSUM progress, CGWB groundwater extraction, net irrigated area), open its API tab and copy the resource ID.</li>
      <li>Paste it with its state and value column names into <code>pipeline/sources.yml</code> and run the workflow.</li></ol></div>`;
    return;
  }
  const grid = document.createElement("div"); grid.className = "grid"; body.append(grid);
  states.forEach((ds) => barChart(grid, ds));
}

function registerSection(rows) {
  rows = rows || [];
  const fType = document.getElementById("f-type"), fState = document.getElementById("f-state"), fQ = document.getElementById("f-q");
  const opts = (k) => [...new Set(rows.map((r) => r[k]))].sort().map((v) => `<option>${esc(v)}</option>`).join("");
  fType.insertAdjacentHTML("beforeend", opts("type"));
  fState.insertAdjacentHTML("beforeend", opts("state"));
  const render = () => {
    const q = fQ.value.trim().toLowerCase();
    const shown = rows.filter((r) => (!fType.value || r.type === fType.value) && (!fState.value || r.state === fState.value)
      && (!q || `${r.title} ${r.detail} ${r.organisation}`.toLowerCase().includes(q)));
    document.getElementById("reg-count").textContent = `${shown.length} of ${rows.length} entries`;
    document.getElementById("reg-list").innerHTML = shown.map((r) => `<li>
      <div class="when">${new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
      <div><span class="tag">${esc(r.type)}</span><span class="tag">${esc(r.state)}</span>
        <h4>${esc(r.title)}</h4><p>${esc(r.detail)}</p>
        <div class="meta">${esc(r.organisation)} · <a href="${esc(r.source_url)}" target="_blank" rel="noopener">source</a></div></div></li>`).join("");
  };
  [fType, fState, fQ].forEach((el) => el.addEventListener("input", render));
  render();
}

(async () => {
  const [meta, national, emissions, states, register] = await Promise.all(
    ["meta", "national", "emissions", "states", "register"].map(load));
  document.getElementById("updated").textContent = meta?.updated
    ? `Data last refreshed ${new Date(meta.updated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
    : "Data not refreshed yet";
  tiles(national, emissions);
  emissionsSection(emissions);
  trends(national);
  statesSection(states);
  registerSection(register);
})();
