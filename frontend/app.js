// Mboa Weather — live weather across Cameroon (Open-Meteo, no API key needed)

const CITIES = [
  { name: "Yaoundé",    region: "Centre",     lat: 3.848,  lon: 11.502 },
  { name: "Douala",     region: "Littoral",   lat: 4.051,  lon: 9.768 },
  { name: "Bamenda",    region: "North-West", lat: 5.963,  lon: 10.159 },
  { name: "Buea",       region: "South-West", lat: 4.155,  lon: 9.241 },
  { name: "Bafoussam",  region: "West",       lat: 5.478,  lon: 10.418 },
  { name: "Garoua",     region: "North",      lat: 9.301,  lon: 13.397 },
  { name: "Maroua",     region: "Far North",  lat: 10.591, lon: 14.316 },
  { name: "Ngaoundéré", region: "Adamawa",    lat: 7.327,  lon: 13.584 },
  { name: "Bertoua",    region: "East",       lat: 4.577,  lon: 13.684 },
  { name: "Ebolowa",    region: "South",      lat: 2.900,  lon: 11.150 },
];

const TZ = "Africa/Douala";
const API = "https://api.open-meteo.com/v1/forecast";

const state = { city: CITIES[0], unit: "C", forecast: null, overview: null };

// ---------- Weather code → description + icon kind ----------
function describe(code) {
  if (code === 0) return { text: "Clear sky", kind: "clear" };
  if (code === 1) return { text: "Mostly clear", kind: "partly" };
  if (code === 2) return { text: "Partly cloudy", kind: "partly" };
  if (code === 3) return { text: "Overcast", kind: "cloudy" };
  if (code === 45 || code === 48) return { text: "Foggy", kind: "fog" };
  if (code >= 51 && code <= 57) return { text: "Drizzle", kind: "drizzle" };
  if (code >= 61 && code <= 67) return { text: code >= 65 ? "Heavy rain" : "Rain", kind: "rain" };
  if (code >= 71 && code <= 77) return { text: "Snow", kind: "snow" };
  if (code >= 80 && code <= 82) return { text: code === 82 ? "Violent showers" : "Rain showers", kind: "rain" };
  if (code === 85 || code === 86) return { text: "Snow showers", kind: "snow" };
  if (code >= 95) return { text: "Thunderstorm", kind: "storm" };
  return { text: "—", kind: "cloudy" };
}

function feelOf(c) {
  if (c >= 30) return { label: "HOT", cls: "hot", color: "var(--hot)" };
  if (c >= 25) return { label: "WARM", cls: "warm", color: "var(--warm)" };
  if (c >= 19) return { label: "MILD", cls: "mild", color: "var(--mild)" };
  return { label: "COOL", cls: "cool", color: "var(--cool)" };
}

// ---------- Animated SVG icons ----------
const SUN = (cx = 32, cy = 32, r = 11, rays = true) => `
  <g>
    ${rays ? `<g class="i-spin" stroke="#FFC93C" stroke-width="3" stroke-linecap="round">
      ${Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4, r1 = r + 5, r2 = r + 10;
        return `<line x1="${cx + r1 * Math.cos(a)}" y1="${cy + r1 * Math.sin(a)}" x2="${cx + r2 * Math.cos(a)}" y2="${cy + r2 * Math.sin(a)}"/>`;
      }).join("")}</g>` : ""}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sunGrad)"/>
  </g>`;

const MOON = (tx = 0, ty = 0, s = 1) => `
  <g transform="translate(${tx} ${ty}) scale(${s})">
    <path d="M38 14a18 18 0 1 0 14 28A15 15 0 0 1 38 14z" fill="#F4F1C9"/>
    <circle class="i-twinkle" cx="14" cy="14" r="1.6" fill="#fff"/>
    <circle class="i-twinkle" cx="52" cy="10" r="1.2" fill="#fff" style="animation-delay:1s"/>
  </g>`;

const CLOUD = (fill = "#fff", tx = 0, ty = 0, s = 1) => `
  <g class="i-float" transform="translate(${tx} ${ty}) scale(${s})">
    <g fill="${fill}">
      <circle cx="22" cy="38" r="9"/><circle cx="33" cy="31" r="12"/><circle cx="45" cy="38" r="9"/>
      <rect x="13" y="36" width="41" height="11" rx="5.5"/>
    </g>
  </g>`;

const DROPS = (color = "#7cc8ff") => `
  <g stroke="${color}" stroke-width="2.6" stroke-linecap="round">
    <line class="i-drop" x1="24" y1="50" x2="22" y2="55"/>
    <line class="i-drop" x1="33" y1="50" x2="31" y2="55"/>
    <line class="i-drop" x1="42" y1="50" x2="40" y2="55"/>
  </g>`;

function icon(code, isDay = 1) {
  const { kind } = describe(code);
  const defs = `<defs><radialGradient id="sunGrad"><stop offset="0" stop-color="#FFE38A"/><stop offset="1" stop-color="#FFB627"/></radialGradient></defs>`;
  const celestialSmall = isDay ? SUN(22, 22, 8) : MOON(2, 2, 0.6);
  let body;
  switch (kind) {
    case "clear":   body = isDay ? SUN() : MOON(4, 4, 1); break;
    case "partly":  body = celestialSmall + CLOUD("#fff", 6, 4, 0.95); break;
    case "cloudy":  body = CLOUD("#cfd8e3", -6, -6, 0.8) + CLOUD("#fff", 4, 2, 0.95); break;
    case "fog":     body = CLOUD("#e3e8ee", 0, -4) + `<g class="i-fog" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"><line x1="14" y1="52" x2="44" y2="52"/><line x1="22" y1="58" x2="52" y2="58"/></g>`; break;
    case "drizzle": body = (isDay ? SUN(20, 20, 7, false) : "") + CLOUD("#e6edf5", 0, -4) + DROPS("#a9dcff"); break;
    case "rain":    body = CLOUD("#b9c6d4", 0, -4) + DROPS(); break;
    case "snow":    body = CLOUD("#e6edf5", 0, -4) + `<g fill="#fff"><circle class="i-drop" cx="24" cy="53" r="2"/><circle class="i-drop" cx="33" cy="53" r="2"/><circle class="i-drop" cx="42" cy="53" r="2"/></g>`; break;
    case "storm":   body = CLOUD("#8c97a8", 0, -6) + `<polygon class="i-bolt" points="35,40 26,53 32,53 28,63 41,48 35,48 39,40" fill="#FFD23F"/>` + `<g stroke="#7cc8ff" stroke-width="2.4" stroke-linecap="round"><line class="i-drop" x1="20" y1="48" x2="18" y2="53"/><line class="i-drop" x1="46" y1="48" x2="44" y2="53"/></g>`; break;
  }
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${defs}${body}</svg>`;
}

const ICONS = {
  thermo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0z"/></svg>`,
  drop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.7s7 7.3 7 12a7 7 0 0 1-14 0c0-4.7 7-12 7-12z"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h9"/></svg>`,
  umbrella: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12a10 10 0 0 0-20 0zM12 12v7a2 2 0 0 0 4 0"/></svg>`,
  uv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  sunrise: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/></svg>`,
};

// ---------- Helpers ----------
const fmtTemp = (c, withUnit = true) => {
  const v = state.unit === "C" ? c : c * 9 / 5 + 32;
  return `${Math.round(v)}°${withUnit ? "" : ""}`;
};
const hourLabel = (iso) => {
  const h = Number(iso.slice(11, 13));
  return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
};
const dayLabel = (iso, i) => i === 0 ? "Today" : new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });
const timeOnly = (iso) => iso.slice(11, 16);
const compass = (deg) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
const uvLevel = (uv) => uv < 3 ? "Low" : uv < 6 ? "Moderate" : uv < 8 ? "High" : uv < 11 ? "Very high" : "Extreme";

function skyTheme(code, isDay, temp) {
  const { kind } = describe(code);
  if (kind === "storm") return "storm";
  if (kind === "fog") return "fog";
  if (kind === "rain" || kind === "drizzle") return isDay ? "rain-day" : "rain-night";
  if (!isDay) return kind === "clear" || kind === "partly" ? "clear-night" : "cloudy-night";
  if (kind === "cloudy") return "cloudy-day";
  if (kind === "partly") return temp >= 31 ? "hot-day" : "partly-day";
  return temp >= 31 ? "hot-day" : "clear-day";
}

// ---------- Data ----------
// With API_BASE set, everything goes through the SAM backend (Lambda → Open-Meteo / DynamoDB).
// Without it, forecasts come straight from Open-Meteo and community reports are disabled.
const API_BASE = (window.MBOA_CONFIG?.API_BASE || "").replace(/\/+$/, "");

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["X-Edit-Token"] = token;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Can't reach the weather API. Is the backend running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

async function fetchForecast(city) {
  if (API_BASE) return api(`/forecast?city=${encodeURIComponent(city.name)}`);
  const params = new URLSearchParams({
    latitude: city.lat, longitude: city.lon, timezone: TZ, forecast_days: 7,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return res.json();
}

async function fetchOverview() {
  if (API_BASE) return api("/forecast");
  const params = new URLSearchParams({
    latitude: CITIES.map(c => c.lat).join(","),
    longitude: CITIES.map(c => c.lon).join(","),
    timezone: TZ, current: "temperature_2m,weather_code,is_day",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return res.json();
}

// ---------- Render ----------
function renderHero() {
  const f = state.forecast, c = f.current, d = f.daily;
  const { text } = describe(c.weather_code);
  const feel = feelOf(c.temperature_2m);
  document.body.dataset.sky = skyTheme(c.weather_code, c.is_day, c.temperature_2m);
  document.getElementById("cityName").textContent = state.city.name;
  document.getElementById("cityRegion").textContent = `${state.city.region} Region`;
  document.getElementById("tempNow").textContent = fmtTemp(c.temperature_2m);
  const badge = document.getElementById("feelBadge");
  badge.textContent = feel.label; badge.className = `feel-badge ${feel.cls}`;
  document.getElementById("conditionText").textContent = text;
  document.getElementById("hiLo").textContent = `H: ${fmtTemp(d.temperature_2m_max[0])}  ·  L: ${fmtTemp(d.temperature_2m_min[0])}  ·  Feels like ${fmtTemp(c.apparent_temperature)}`;
  document.getElementById("heroIcon").innerHTML = icon(c.weather_code, c.is_day);
}

function renderStats() {
  const f = state.forecast, c = f.current, d = f.daily;
  const uv = d.uv_index_max[0] ?? 0;
  const stats = [
    { icon: ICONS.thermo, label: "Feels like", value: fmtTemp(c.apparent_temperature), hint: c.apparent_temperature > c.temperature_2m ? "Humidity makes it feel hotter" : "Close to actual temperature" },
    { icon: ICONS.drop, label: "Humidity", value: `${c.relative_humidity_2m}%`, meter: c.relative_humidity_2m },
    { icon: ICONS.wind, label: "Wind", value: `${Math.round(c.wind_speed_10m)} km/h`, hint: `From the ${compass(c.wind_direction_10m)}` },
    { icon: ICONS.umbrella, label: "Chance of rain", value: `${d.precipitation_probability_max[0] ?? 0}%`, hint: `${c.precipitation} mm right now` },
    { icon: ICONS.uv, label: "UV index", value: uv.toFixed(1), hint: uvLevel(uv), meter: Math.min(uv / 11 * 100, 100) },
    { icon: ICONS.sunrise, label: "Sunrise · Sunset", value: `${timeOnly(d.sunrise[0])} · ${timeOnly(d.sunset[0])}`, hint: `Pressure ${Math.round(c.pressure_msl)} hPa` },
  ];
  document.getElementById("stats").innerHTML = stats.map(s => `
    <div class="glass stat">
      <span class="label">${s.icon}${s.label}</span>
      <span class="value">${s.value}</span>
      ${s.meter != null ? `<div class="meter"><span style="width:${s.meter}%;background-position:${s.meter}% 0"></span></div>` : ""}
      ${s.hint ? `<span class="hint">${s.hint}</span>` : ""}
    </div>`).join("");
}

function renderHourly() {
  const h = state.forecast.hourly;
  const nowKey = state.forecast.current.time.slice(0, 13);
  let start = h.time.findIndex(t => t.startsWith(nowKey));
  if (start < 0) start = 0;
  const idx = Array.from({ length: 24 }, (_, i) => start + i).filter(i => i < h.time.length);
  document.getElementById("hourly").innerHTML = idx.map((i, n) => `
    <div class="hour ${n === 0 ? "now" : ""}">
      <span class="t">${n === 0 ? "Now" : hourLabel(h.time[i])}</span>
      ${icon(h.weather_code[i], h.is_day[i])}
      <span class="deg">${fmtTemp(h.temperature_2m[i])}</span>
      <span class="pop">${h.precipitation_probability[i] >= 20 ? `💧${h.precipitation_probability[i]}%` : ""}</span>
    </div>`).join("");
  const nextRain = idx.find(i => h.precipitation_probability[i] >= 50);
  document.getElementById("rainNote").textContent = nextRain != null
    ? `Rain likely around ${hourLabel(h.time[nextRain])}` : "No heavy rain expected";
}

function renderDaily() {
  const d = state.forecast.daily;
  const min = Math.min(...d.temperature_2m_min), max = Math.max(...d.temperature_2m_max);
  const pct = (v) => ((v - min) / (max - min || 1)) * 100;
  document.getElementById("daily").innerHTML = d.time.map((t, i) => `
    <li class="day">
      <span class="name">${dayLabel(t, i)}</span>
      ${icon(d.weather_code[i], 1)}
      <span class="pop">${d.precipitation_probability_max[i] >= 20 ? d.precipitation_probability_max[i] + "%" : ""}</span>
      <div style="display:grid;grid-template-columns:36px 1fr;gap:8px;align-items:center">
        <span class="lo">${fmtTemp(d.temperature_2m_min[i])}</span>
        <div class="range"><span style="left:${pct(d.temperature_2m_min[i])}%;right:${100 - pct(d.temperature_2m_max[i])}%"></span></div>
      </div>
      <span class="hi">${fmtTemp(d.temperature_2m_max[i])}</span>
    </li>`).join("");
}

function renderCities() {
  const list = Array.isArray(state.overview) ? state.overview : [state.overview];
  document.getElementById("cities").innerHTML = CITIES.map((city, i) => {
    const c = list[i]?.current;
    if (!c) return "";
    const feel = feelOf(c.temperature_2m);
    return `
      <button class="city ${city === state.city ? "active" : ""}" data-i="${i}" title="${describe(c.weather_code).text}">
        <span class="cn">${city.name}</span>
        ${icon(c.weather_code, c.is_day)}
        <span class="ct"><i style="background:${feel.color}"></i>${fmtTemp(c.temperature_2m)}</span>
        <span class="cr">${city.region}</span>
      </button>`;
  }).join("");
}

function renderAll() {
  if (state.forecast) { renderHero(); renderStats(); renderHourly(); renderDaily(); }
  if (state.overview) renderCities();
  renderReports();
}

function tickClock() {
  const now = new Date().toLocaleString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  document.getElementById("localTime").textContent = `${now} · WAT`;
}

function showError(err) {
  document.getElementById("conditionText").innerHTML = `<span class="error">Couldn't load weather: ${err.message}</span>`;
}

async function selectCity(city) {
  state.city = city;
  document.getElementById("citySelect").value = CITIES.indexOf(city);
  document.querySelector("main").classList.add("skeleton");
  loadReports();
  try {
    state.forecast = await fetchForecast(city);
    renderAll();
  } catch (e) { showError(e); }
  finally { document.querySelector("main").classList.remove("skeleton"); }
}

// ---------- Community reports (CRUDL via the SAM API) ----------
const CONDITIONS = {
  sunny:         { label: "Sunny",         code: 0 },
  partly_cloudy: { label: "Partly cloudy", code: 2 },
  cloudy:        { label: "Cloudy",        code: 3 },
  rainy:         { label: "Rainy",         code: 63 },
  stormy:        { label: "Stormy",        code: 95 },
  foggy:         { label: "Foggy",         code: 45 },
  windy:         { label: "Windy",         code: 3 },
};
const TOKENS_KEY = "mboa-edit-tokens";
const NAME_KEY = "mboa-reporter";
const reports = { list: [], scope: "city", editing: null };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tokens = () => { try { return JSON.parse(localStorage.getItem(TOKENS_KEY)) || {}; } catch { return {}; } };
const saveToken = (id, token) => localStorage.setItem(TOKENS_KEY, JSON.stringify({ ...tokens(), [id]: token }));
const dropToken = (id) => { const t = tokens(); delete t[id]; localStorage.setItem(TOKENS_KEY, JSON.stringify(t)); };

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

let toastTimer;
function toast(msg, bad = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast show ${bad ? "bad" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

async function loadReports() {
  if (!API_BASE) return renderReports();
  const q = reports.scope === "city" ? `?town=${encodeURIComponent(state.city.name)}` : "";
  const seq = (reports.seq = (reports.seq || 0) + 1);
  let list, error = null;
  try { list = await api(`/weathers${q}`); } catch (e) { error = e.message; }
  if (seq !== reports.seq) return; // a newer request (city/scope change) superseded this one
  if (list) reports.list = list;
  reports.error = error;
  renderReports();
}

function renderSummary() {
  const el = document.getElementById("reportsSummary");
  const where = reports.scope === "city" ? state.city.name : "Cameroon";
  const recent = reports.list.filter(r => Date.now() - new Date(r.created_at).getTime() < 6 * 3600e3);
  if (!recent.length) { el.textContent = `No reports from ${where} in the last 6 hours`; return; }
  const counts = recent.reduce((acc, r) => ({ ...acc, [r.weather]: (acc[r.weather] || 0) + 1 }), {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  el.textContent = `${recent.length} report${recent.length > 1 ? "s" : ""} from ${where} in the last 6 h · mostly ${CONDITIONS[top]?.label.toLowerCase() ?? top}`;
}

function renderReports() {
  const box = document.getElementById("reports");
  const btn = document.getElementById("newReportBtn");
  btn.disabled = !API_BASE;
  if (!API_BASE) {
    box.innerHTML = `<div class="empty"><strong>Community reports are offline</strong>Set API_BASE in config.js to connect the SAM backend.</div>`;
    return;
  }
  if (reports.error) {
    box.innerHTML = `<div class="empty"><strong>Couldn't load reports</strong>${esc(reports.error)}</div>`;
    document.getElementById("reportsSummary").textContent = "Community weather reports";
    return;
  }
  renderSummary();
  if (!reports.list.length) {
    box.innerHTML = `<div class="empty"><strong>No reports yet${reports.scope === "city" ? ` for ${esc(state.city.name)}` : ""}</strong>Be the first to tell everyone what the sky looks like.</div>`;
    return;
  }
  const mine = tokens();
  box.innerHTML = reports.list.map(r => {
    const cond = CONDITIONS[r.weather] || { label: r.weather, code: 3 };
    const own = Boolean(mine[r.id]);
    const edited = r.updated_at && r.created_at && r.updated_at !== r.created_at;
    return `
      <article class="report ${own ? "mine" : ""}">
        <div class="report-top">
          ${icon(cond.code, 1)}
          <div class="what"><strong>${esc(cond.label)}</strong><small>${esc(r.town)}</small></div>
          ${r.temperature != null ? `<span class="rtemp">${fmtTemp(Number(r.temperature))}</span>` : ""}
        </div>
        ${r.note ? `<p>${esc(r.note)}</p>` : ""}
        <div class="report-foot">
          <span class="who">${own ? `<span class="mine-tag">You</span>` : esc(r.reporter || "Anonymous")} · ${timeAgo(r.created_at)}${edited ? " · edited" : ""}</span>
          ${own ? `<span class="report-tools">
            <button data-edit="${esc(r.id)}">Edit</button>
            <button class="danger" data-delete="${esc(r.id)}">Delete</button>
          </span>` : ""}
        </div>
      </article>`;
  }).join("");
}

function openReportForm(report = null) {
  reports.editing = report;
  const form = document.getElementById("reportForm");
  form.reset();
  document.getElementById("formError").textContent = "";
  document.getElementById("dialogTitle").textContent = report ? "Edit your report" : "Report the weather";
  document.getElementById("submitReport").textContent = report ? "Save changes" : "Post report";
  form.town.value = report ? report.town : state.city.name;
  form.weather.value = report ? report.weather : "";
  form.temperature.value = report?.temperature ?? "";
  form.note.value = report?.note ?? "";
  form.reporter.value = report ? (report.reporter === "Anonymous" ? "" : report.reporter) : (localStorage.getItem(NAME_KEY) || "");
  updateCounter();
  document.getElementById("reportDialog").showModal();
}

function updateCounter() {
  const note = document.getElementById("reportForm").note;
  document.getElementById("noteCounter").textContent = `${note.value.length} / 280`;
}

async function submitReport(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById("formError");
  if (!form.weather.value) { errorEl.textContent = "Pick what the sky is doing."; return; }
  const tempRaw = form.temperature.value.trim();
  if (tempRaw && (Number(tempRaw) < -10 || Number(tempRaw) > 60)) { errorEl.textContent = "Temperature must be between -10 and 60 °C."; return; }

  const body = {
    town: form.town.value,
    weather: form.weather.value,
    temperature: tempRaw === "" ? null : Number(tempRaw),
    note: form.note.value.trim(),
    reporter: form.reporter.value.trim(),
  };
  const btn = document.getElementById("submitReport");
  btn.disabled = true;
  try {
    if (reports.editing) {
      const id = reports.editing.id;
      await api(`/weather/${encodeURIComponent(id)}`, { method: "PUT", body, token: tokens()[id] });
      toast("Report updated");
    } else {
      const created = await api("/create-weather", { method: "POST", body });
      saveToken(created.id, created.edit_token);
      toast("Thanks! Your report is live");
    }
    if (body.reporter) localStorage.setItem(NAME_KEY, body.reporter);
    document.getElementById("reportDialog").close();
    await loadReports();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function deleteReport(id) {
  if (!confirm("Delete this report?")) return;
  try {
    await api(`/weather/${encodeURIComponent(id)}`, { method: "DELETE", token: tokens()[id] });
    dropToken(id);
    toast("Report deleted");
    await loadReports();
  } catch (err) {
    toast(err.message, true);
  }
}

async function editReport(id) {
  try {
    openReportForm(await api(`/weather/${encodeURIComponent(id)}`));
  } catch (err) {
    toast(err.message, true);
  }
}

function initReports() {
  const form = document.getElementById("reportForm");
  form.town.innerHTML = CITIES.map(c => `<option>${c.name}</option>`).join("");
  document.getElementById("conditionChips").innerHTML = Object.entries(CONDITIONS).map(([key, c]) => `
    <label class="chip"><input type="radio" name="weather" value="${key}" /><span>${icon(c.code, 1)}${c.label}</span></label>`).join("");

  document.getElementById("newReportBtn").addEventListener("click", () => openReportForm());
  document.getElementById("closeDialog").addEventListener("click", () => document.getElementById("reportDialog").close());
  document.getElementById("cancelDialog").addEventListener("click", () => document.getElementById("reportDialog").close());
  form.addEventListener("submit", submitReport);
  form.note.addEventListener("input", updateCounter);

  document.getElementById("reports").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");
    if (edit) editReport(edit.dataset.edit);
    if (del) deleteReport(del.dataset.delete);
  });

  document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
    reports.scope = b.dataset.scope;
    document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("active", x === b));
    loadReports();
  }));
}

// ---------- Init ----------
function init() {
  initReports();
  const sel = document.getElementById("citySelect");
  sel.innerHTML = CITIES.map((c, i) => `<option value="${i}">${c.name} — ${c.region}</option>`).join("");
  sel.addEventListener("change", () => selectCity(CITIES[sel.value]));

  document.getElementById("cities").addEventListener("click", (e) => {
    const btn = e.target.closest(".city");
    if (btn) { selectCity(CITIES[btn.dataset.i]); window.scrollTo({ top: 0, behavior: "smooth" }); }
  });

  document.querySelectorAll(".unit-toggle button").forEach(b => b.addEventListener("click", () => {
    state.unit = b.dataset.unit;
    document.querySelectorAll(".unit-toggle button").forEach(x => x.classList.toggle("active", x === b));
    renderAll();
  }));

  tickClock(); setInterval(tickClock, 30_000);
  selectCity(state.city);
  fetchOverview().then(o => { state.overview = o; renderCities(); }).catch(() => {});
  // refresh every 15 minutes
  setInterval(() => { selectCity(state.city); fetchOverview().then(o => { state.overview = o; renderCities(); }); }, 15 * 60_000);
}

init();
