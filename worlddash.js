/* ===============================================================
   WORLDDASH — Application Logic
=============================================================== */
'use strict';

// -- Constants --------------------------------------------------
const LS_KEY        = 'worlddash_v2';
const MAX_LOCATIONS = 4;
const CAROUSEL_IDS  = ['carousel-0','carousel-1','carousel-2','carousel-3'];
const PANEL_LABELS  = ['CLOCK','WEATHER','HOURLY','DAILY','ALERTS'];

// -- Default State ----------------------------------------------
const DEFAULT_LOCATIONS = [
  { name:'Toronto',   country:'CA', lat:43.7001,  lon:-79.4163,  tz:'America/Toronto'   },
  { name:'Vancouver', country:'CA', lat:49.2497,  lon:-123.1193, tz:'America/Vancouver'  },
  { name:'Calgary',   country:'CA', lat:51.0501,  lon:-114.0853, tz:'America/Edmonton'   },
  { name:'Halifax',   country:'CA', lat:44.6488,  lon:-63.5752,  tz:'America/Halifax'    },
];

// -- App State --------------------------------------------------
let state = {
  apiKey:     '',
  units:      'metric',
  theme:      'dark',
  locations:  JSON.parse(JSON.stringify(DEFAULT_LOCATIONS)),
  weather:    {},        // keyed by location index
  fontSize:   'medium',  // 'small' | 'medium' | 'large'
  lastFetch:  null,
  nextFetch:  null,
};

// -- Clock ticker registry --------------------------------------
const clockIntervals = {};

// ==============================================================
// PERSISTENCE
// ==============================================================
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = Object.assign(state, saved);
    }
  } catch(e) {}
}

// ==============================================================
// STATUS BAR
// ==============================================================
function setStatus(msg, type = '') {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = type;
}

function setBusy(on) {
  document.getElementById('status-spinner').style.display = on ? 'inline-block' : 'none';
}

function updateTimestamps() {
  const fmt = (d) => d ? new Date(d).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—';
  document.getElementById('ts-updated').textContent = fmt(state.lastFetch);
  document.getElementById('ts-next').textContent    = fmt(state.nextFetch);
}

// ==============================================================
// WEATHER ICONS (emoji map for OWM icon codes)
// ==============================================================
const ICON_MAP = {
  '01d':'☀️','01n':'🌙','02d':'⛅','02n':'🌥️',
  '03d':'☁️','03n':'☁️','04d':'☁️','04n':'☁️',
  '09d':'🌧️','09n':'🌧️','10d':'🌦️','10n':'🌧️',
  '11d':'⛈️','11n':'⛈️','13d':'❄️','13n':'❄️',
  '50d':'🌫️','50n':'🌫️',
};

function icon(code) { return ICON_MAP[code] || '🌡️'; }

// ==============================================================
// UNIT HELPERS
// ==============================================================
function tempUnit() { return state.units === 'metric' ? '°C' : '°F'; }
function speedUnit() { return state.units === 'metric' ? 'm/s' : 'mph'; }
function fmtTemp(t) { return t != null ? `${Math.round(t)}${tempUnit()}` : '—'; }
function fmtWind(s, deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  const d = dirs[Math.round(deg/45)%8] || '';
  return `${Math.round(s)} ${speedUnit()} ${d}`;
}
function fmtPop(p) { return p != null ? `${Math.round(p*100)}%` : '—'; }

// ==============================================================
// CLOCK
// ==============================================================
function fmtDate(d) {
  return d.toLocaleDateString('en-CA', {weekday:'short',month:'short',day:'numeric',year:'numeric'});
}

function fmtTime(d) {
  return d.toLocaleTimeString('en-CA', {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
}

/**
 * Format a UTC offset in seconds as "UTC±HH:MM".
 * Handles half-hour (e.g. India +05:30) and quarter-hour offsets.
 */
function offsetSecsToLabel(secs, prefix = 'UTC') {
  const sign = secs < 0 ? '-' : '+';
  const abs  = Math.abs(secs);
  const h    = Math.floor(abs / 3600);
  const m    = Math.round((abs % 3600) / 60);
  return `${prefix}${sign}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

/**
 * Return a Date whose y/m/d/h/min/s fields reflect local time in the
 * given timezone. Accepts either:
 *   - an IANA name string (e.g. "America/Toronto")
 *   - a UTC offset in seconds (number, e.g. 19800 for India +05:30)
 *
 * For IANA names we use Intl.DateTimeFormat parts (no toLocaleString).
 * For numeric offsets we shift the UTC epoch and read the UTC fields,
 * which sidesteps the lack of fixed half-hour-offset IANA identifiers.
 */
function localDate(tz) {
  const now = new Date();
  if (typeof tz === 'number') {
    // Shift by offset seconds, read UTC fields as if they were local
    const shifted = new Date(now.getTime() + tz * 1000);
    return new Date(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      shifted.getUTCHours(),
      shifted.getUTCMinutes(),
      shifted.getUTCSeconds(),
    );
  }
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map(({type, value}) => [type, value]));
  const h = p.hour === '24' ? 0 : parseInt(p.hour, 10);
  return new Date(
    parseInt(p.year,   10),
    parseInt(p.month,  10) - 1,
    parseInt(p.day,    10),
    h,
    parseInt(p.minute, 10),
    parseInt(p.second, 10),
  );
}

function getTZAbbr(tz) {
  if (typeof tz === 'number') return offsetSecsToLabel(tz, 'GMT');
  try {
    const parts = new Intl.DateTimeFormat('en', {timeZone:tz, timeZoneName:'short'}).formatToParts(new Date());
    return parts.find(p=>p.type==='timeZoneName')?.value || tz;
  } catch { return tz; }
}

function getUTCOffset(tz) {
  if (typeof tz === 'number') return offsetSecsToLabel(tz);
  try {
    const parts = new Intl.DateTimeFormat('en', {timeZone:tz, timeZoneName:'longOffset'}).formatToParts(new Date());
    const raw   = parts.find(p=>p.type==='timeZoneName')?.value || 'GMT+00:00';
    return raw.replace('GMT', 'UTC');
  } catch { return ''; }
}

function tickClock(idx) {
  const loc = state.locations[idx];
  if (!loc) return;
  const el = document.getElementById(`clock-panel-${idx}`);
  if (!el) return;
  const local = localDate(loc.tz);
  el.querySelector('.clock-time').textContent = fmtTime(local);
  el.querySelector('.clock-date').textContent = fmtDate(local);
}

function startClock(idx) {
  if (clockIntervals[idx]) clearInterval(clockIntervals[idx]);
  tickClock(idx);
  clockIntervals[idx] = setInterval(() => tickClock(idx), 1000);
}

// ==============================================================
// PANEL HTML BUILDERS
// ==============================================================

function buildClockPanel(idx) {
  const loc   = state.locations[idx];
  const tz    = loc.tz;
  const local = localDate(tz);
  return `
    <div class="clock-panel" id="clock-panel-${idx}">
      <div class="clock-city">${loc.name}</div>
      <div class="clock-date">${fmtDate(local)}</div>
      <div class="clock-time">${fmtTime(local)}</div>
      <div class="clock-tz">${getTZAbbr(tz)}</div>
      <div class="clock-offset">${getUTCOffset(tz)}</div>
    </div>`;
}

function buildWeatherPanel(idx) {
  const w = state.weather[idx];
  if (!w || !state.apiKey) return buildPlaceholder(idx, 'current weather');
  const c  = w.current;   // normalised from data/2.5/weather
  const tz = state.locations[idx].tz;
  return `
    <div class="weather-panel">
      <div class="weather-main">
        <div class="weather-icon-lg">${icon(c.weather[0].icon)}</div>
        <div class="weather-temp-block">
          <div class="weather-temp">${fmtTemp(c.temp)}</div>
          <div class="weather-feels">Feels like ${fmtTemp(c.feels_like)}</div>
          <div class="weather-desc">${c.weather[0].description}</div>
        </div>
      </div>
      <div class="weather-grid">
        <div class="w-stat"><div class="w-stat-key">Humidity</div><div class="w-stat-val">${c.humidity}%</div></div>
        <div class="w-stat"><div class="w-stat-key">Wind</div><div class="w-stat-val">${fmtWind(c.wind_speed, c.wind_deg)}</div></div>
        <div class="w-stat"><div class="w-stat-key">Visibility</div><div class="w-stat-val">${c.visibility != null ? (c.visibility/1000).toFixed(1)+' km' : '—'}</div></div>
        <div class="w-stat"><div class="w-stat-key">Clouds</div><div class="w-stat-val">${c.clouds ?? '—'}%</div></div>
        <div class="w-stat"><div class="w-stat-key">Pressure</div><div class="w-stat-val">${c.pressure} hPa</div></div>
        <div class="w-stat"><div class="w-stat-key">Humidity</div><div class="w-stat-val">${c.humidity}%</div></div>
        <div class="w-stat"><div class="w-stat-key">Sunrise</div><div class="w-stat-val">${fmtUnixTime(c.sunrise, tz)}</div></div>
        <div class="w-stat"><div class="w-stat-key">Sunset</div><div class="w-stat-val">${fmtUnixTime(c.sunset, tz)}</div></div>
      </div>
    </div>`;
}

function buildHourlyPanel(idx) {
  const w = state.weather[idx];
  if (!w || !state.apiKey) return buildPlaceholder(idx, 'hourly forecast');
  const tz   = state.locations[idx].tz;
  // 2.5/forecast gives 3-hour slots in w.hourly (normalised from list[])
  const rows = (w.hourly || []).slice(0, 16).map(h => {
    const t = fmtUnixTime(h.dt, tz);
    return `<div class="hourly-row">
      <div class="hourly-time">${t}</div>
      <div class="hourly-icon">${icon(h.weather[0].icon)}</div>
      <div class="hourly-desc">${h.weather[0].description}</div>
      <div class="hourly-temp">${fmtTemp(h.temp)}</div>
      <div class="hourly-pop">${fmtPop(h.pop)}</div>
    </div>`;
  }).join('');
  return `<div class="hourly-panel">${rows}</div>`;
}

function buildDailyPanel(idx) {
  const w = state.weather[idx];
  if (!w || !state.apiKey) return buildPlaceholder(idx, 'daily forecast');
  const tz    = state.locations[idx].tz;
  const daily = w.daily || [];   // pre-aggregated in normaliseForecast()
  const rows  = daily.slice(0, 6).map((d, i) => {
    const dt  = typeof tz === 'number'
      ? new Date(d.dt * 1000 + tz * 1000)
      : new Date(d.dt * 1000);
    const dayStr = typeof tz === 'number'
      ? dt.toUTCString().slice(0, 3)   // "Mon", "Tue" etc from UTC shifted date
      : dt.toLocaleDateString('en-CA', {timeZone:tz, weekday:'short'});
    const day = i === 0 ? 'Today'
              : i === 1 ? 'Tomorrow'
              : typeof tz === 'number'
                ? `${dayStr} ${dt.toLocaleString('en-CA', {timeZone:'UTC', month:'short', day:'numeric'})}`
                : dt.toLocaleDateString('en-CA', {timeZone:tz, weekday:'short', month:'short', day:'numeric'});
    return `<div class="daily-row">
      <div class="daily-day${i===0?' today':''}">${day}</div>
      <div class="daily-icon">${icon(d.weather[0].icon)}</div>
      <div class="daily-desc">${d.weather[0].description}</div>
      <div class="daily-hi">${fmtTemp(d.temp.max)}</div>
      <div class="daily-lo">${fmtTemp(d.temp.min)}</div>
    </div>`;
  }).join('');
  return `<div class="daily-panel">${rows}</div>`;
}

function buildAlertsPanel(idx) {
  if (!state.apiKey) return buildPlaceholder(idx, 'weather alerts');
  // Weather alerts are not available in the free 2.5 API tier.
  // Shown here as a placeholder — upgrade to One Call 3.0 for alert support.
  return `<div class="alerts-panel">
    <div class="no-alerts">
      <div class="no-alerts-icon">ℹ️</div>
      <div class="no-alerts-text" style="line-height:2;">
        Alerts not available<br>in API 2.5 free tier.<br>
        <span style="color:var(--text3);font-size:0.55rem;">Requires One Call API 3.0.</span>
      </div>
    </div>
  </div>`;
}

function buildPlaceholder(idx, what) {
  return `<div class="placeholder-panel">
    <div class="placeholder-icon">🌐</div>
    <div class="placeholder-text">No ${what} data<br>Configure your API key<br>then press Fetch</div>
    <div class="placeholder-action" onclick="openSettings()">Open Settings</div>
  </div>`;
}

function fmtUnixTime(unix, tz) {
  if (!unix) return '—';
  if (typeof tz === 'number') {
    // Shift by offset, read UTC hours/minutes as local
    const d = new Date(unix * 1000 + tz * 1000);
    const h = d.getUTCHours();
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const period = h >= 12 ? 'p.m.' : 'a.m.';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${period}`;
  }
  return new Date(unix*1000).toLocaleTimeString('en-CA', {timeZone:tz, hour:'2-digit', minute:'2-digit', hour12:true});
}

// ==============================================================
// CAROUSEL SETUP
// ==============================================================
function buildFigure(titleSuffix, contentHTML) {
  const fig = document.createElement('figure');
  fig.innerHTML = `
    <div class="panther-Carousel-panelTitleBar">
      <span class="panther-Carousel-panelTitle">${titleSuffix}</span>
    </div>
    <div class="panther-Carousel-panelContent">${contentHTML}</div>`;
  return fig;
}

/** Insert panel HTML into DOM. Does NOT init PantherUI. */
function buildPanelHTML() {
  CAROUSEL_IDS.forEach((cid, idx) => {
    const el = document.getElementById(cid);
    el.innerHTML = '';
    const panels = [
      buildClockPanel(idx),
      buildWeatherPanel(idx),
      buildHourlyPanel(idx),
      buildDailyPanel(idx),
      buildAlertsPanel(idx),
    ];
    panels.forEach((html, pi) => {
      const loc   = state.locations[idx];
      const title = `${loc.name.toUpperCase()} · ${PANEL_LABELS[pi]}`;
      el.appendChild(buildFigure(title, html));
    });
  });
}

/** Init or refresh PantherUI on every carousel. Reads offsetWidth — must
 *  be called after layout is complete. */
function initCarousels() {
  CAROUSEL_IDS.forEach((cid, idx) => {
    if (Panther.Carousel.all[cid]) {
      Panther.Carousel.refresh();
    } else {
      Panther.Carousel.init({
        id: cid,
        backgroundColor: 'var(--panel-bg)',
        easing: 'easeInOutCubic',
        callback(c) {
          updateDots(idx, c.sideIndex % c.panelCount);
        },
      });
    }
    buildDots(idx);
    startClock(idx);
  });
}

/** Full rebuild: panel HTML + PantherUI init, deferred to post-layout. */
function buildCarouselsDeferred() {
  buildPanelHTML();
  // Double rAF: first frame lets the browser apply CSS and compute layout,
  // second frame ensures all box sizes are finalised before PantherUI reads
  // offsetWidth in modify().
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initCarousels();
    });
  });
}

/** Synchronous rebuild used when we know layout is already stable
 *  (e.g. after settings save or weather fetch). */
function buildCarousels() {
  buildPanelHTML();
  initCarousels();
}

function refreshPanel(idx, side) {
  // side: 0-based
  const cid = CAROUSEL_IDS[idx];
  const c   = Panther.Carousel.all[cid];
  if (!c) return;
  const fig     = c.element.children[side];
  if (!fig) return;
  const content = fig.querySelector('.panther-Carousel-panelContent');
  if (!content) return;

  let html = '';
  if (side === 0) { html = buildClockPanel(idx);    startClock(idx); }
  if (side === 1) { html = buildWeatherPanel(idx);  }
  if (side === 2) { html = buildHourlyPanel(idx);   }
  if (side === 3) { html = buildDailyPanel(idx);    }
  if (side === 4) { html = buildAlertsPanel(idx);   }

  content.innerHTML = html;
  // Update title
  const loc   = state.locations[idx];
  const title = fig.querySelector('.panther-Carousel-panelTitle');
  if (title) title.textContent = `${loc.name.toUpperCase()} · ${PANEL_LABELS[side]}`;
}

// ==============================================================
// DOT INDICATORS
// ==============================================================
function buildDots(idx) {
  const box = document.getElementById(`indicator-${idx}`);
  if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i===0?' active':'');
    box.appendChild(d);
  }
}

function updateDots(idx, active) {
  const dots = document.querySelectorAll(`#indicator-${idx} .dot`);
  const ai   = Math.round(active) % dots.length;
  dots.forEach((d, i) => d.classList.toggle('active', i === ai));
}

// ==============================================================
// WEATHER API — data/2.5 (free tier)
// 2 requests per location:
//   1. /weather  → current conditions
//   2. /forecast → 3-hour slots for next 5 days (hourly + daily)
// Total: 8 requests for 4 locations.
// ==============================================================

/**
 * Aggregate 3-hour forecast slots into per-day summaries.
 * Groups by local calendar date, picks the modal weather icon,
 * and tracks min/max temps across the day's slots.
 */
function normaliseForecast(list, tz) {
  const byDay = {};
  for (const slot of list) {
    // When tz is a numeric offset (seconds), compute local date via shift.
    // When it's an IANA string, use Intl normally.
    const slotDate = typeof tz === 'number'
      ? new Date(slot.dt * 1000 + tz * 1000)
      : new Date(slot.dt * 1000);
    const dateKey = typeof tz === 'number'
      ? `${slotDate.getUTCFullYear()}-${String(slotDate.getUTCMonth()+1).padStart(2,'0')}-${String(slotDate.getUTCDate()).padStart(2,'0')}`
      : new Date(slot.dt * 1000).toLocaleDateString('en-CA', {timeZone: tz});
    if (!byDay[dateKey]) {
      byDay[dateKey] = { dt: slot.dt, slots: [], weather: slot.weather };
    }
    byDay[dateKey].slots.push(slot);
  }

  return Object.values(byDay).map(day => {
    const temps = day.slots.map(s => s.main.temp);
    // Pick the weather from the noon-ish slot if available, else first
    const noon  = day.slots.find(s => {
      const h = new Date(s.dt * 1000).getHours();
      return h >= 11 && h <= 14;
    }) || day.slots[0];
    return {
      dt:      day.dt,
      weather: noon.weather,
      temp: {
        min: Math.min(...temps),
        max: Math.max(...temps),
      },
    };
  });
}

async function fetchWeather() {
  if (!state.apiKey) { setStatus('No API key — open Settings to add one.', 'err'); return; }
  setBusy(true);
  setStatus('Fetching weather data…');
  let ok = 0, fail = 0;

  for (let idx = 0; idx < state.locations.length; idx++) {
    const loc    = state.locations[idx];
    const base   = `https://api.openweathermap.org/data/2.5`;
    const params = `lat=${loc.lat}&lon=${loc.lon}&units=${state.units}&appid=${state.apiKey}`;

    try {
      setStatus(`Fetching ${loc.name}… (${idx+1}/${state.locations.length})`);

      // Both requests fire in parallel for this location
      const [wRes, fRes] = await Promise.all([
        fetch(`${base}/weather?${params}`),
        fetch(`${base}/forecast?${params}`),
      ]);

      if (!wRes.ok) throw new Error(`weather: ${await wRes.text()}`);
      if (!fRes.ok) throw new Error(`forecast: ${await fRes.text()}`);

      const wData = await wRes.json();
      const fData = await fRes.json();

      // Update the location's timezone from the API response.
      // wData.timezone is the UTC offset in seconds (e.g. 19800 = +05:30).
      // We store the raw seconds on loc.tz so localDate(), getTZAbbr(),
      // and getUTCOffset() all produce correct results for cities with
      // half-hour or quarter-hour offsets that Etc/GMT can't represent.
      state.locations[idx].tz = wData.timezone;

      // Normalise into the shape our panel builders expect
      state.weather[idx] = {
        // current — map 2.5/weather fields to internal shape
        current: {
          temp:       wData.main.temp,
          feels_like: wData.main.feels_like,
          humidity:   wData.main.humidity,
          pressure:   wData.main.pressure,
          visibility: wData.visibility,
          clouds:     wData.clouds?.all,
          wind_speed: wData.wind?.speed,
          wind_deg:   wData.wind?.deg,
          sunrise:    wData.sys?.sunrise,
          sunset:     wData.sys?.sunset,
          weather:    wData.weather,
        },
        // hourly — 3-hour slots, normalise temp from main.temp
        hourly: fData.list.map(s => ({
          dt:      s.dt,
          temp:    s.main.temp,
          pop:     s.pop,
          weather: s.weather,
        })),
        // daily — aggregated from the 3-hour slots
        daily: normaliseForecast(fData.list, loc.tz),
      };

      // Refresh panels 1–4 (weather, hourly, daily, alerts)
      for (let s = 1; s <= 4; s++) refreshPanel(idx, s);
      ok++;
    } catch(e) {
      console.error('Fetch failed for', loc.name, e);
      fail++;
    }
  }

  state.lastFetch = Date.now();
  state.nextFetch = Date.now() + 10 * 60 * 1000;
  saveState();
  updateTimestamps();
  setBusy(false);

  if (fail === 0) setStatus(`Data updated for ${ok} location${ok>1?'s':''}.`, 'ok');
  else setStatus(`Updated ${ok}, failed ${fail}. Check API key or quota.`, 'err');
}

// ==============================================================
// TOOLBAR HANDLERS
// ==============================================================
document.getElementById('btn-fetch').addEventListener('click', fetchWeather);

[1,2,3,4,5].forEach(n => {
  document.getElementById(`btn-s${n}`).addEventListener('click', () => {
    CAROUSEL_IDS.forEach(cid => Panther.Carousel.turnTo(cid, n));
  });
});

// ==============================================================
// SETTINGS DIALOG
// ==============================================================
function openSettings() {
  // Populate fields
  document.getElementById('s-apikey').value    = state.apiKey;
  document.getElementById('s-units').value     = state.units;
  document.getElementById('s-theme').value     = state.theme;
  document.getElementById('s-fontsize').value  = state.fontSize || 'medium';
  renderLocationList();
  document.getElementById('settings-overlay').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
}

document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('s-cancel').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-overlay')) closeSettings();
});

document.getElementById('s-save').addEventListener('click', () => {
  const newKey      = document.getElementById('s-apikey').value.trim();
  const newUnits    = document.getElementById('s-units').value;
  const newTheme    = document.getElementById('s-theme').value;
  const newFontSize = document.getElementById('s-fontsize').value;

  const unitsChanged = newUnits !== state.units;
  state.apiKey   = newKey;
  state.units    = newUnits;
  state.theme    = newTheme;
  state.fontSize = newFontSize;

  // If units changed, clear cached data so it re-fetches in correct units
  if (unitsChanged) state.weather = {};

  applyTheme();
  saveState();
  closeSettings();
  buildCarousels();
  setStatus('Settings saved.', 'ok');
});

const FONT_SIZES = { small: '14px', medium: '16px', large: '18px' };

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.style.fontSize = FONT_SIZES[state.fontSize || 'medium'];
}

// -- Location Search --------------------------------------------
document.getElementById('s-search-btn').addEventListener('click', searchLocations);
document.getElementById('s-search').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchLocations();
});

async function searchLocations() {
  const q = document.getElementById('s-search').value.trim();
  if (!q) return;
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<div class="search-result-item">Searching…</div>';
  resultsEl.classList.add('open');

  // OWM Geocoding API — free tier, no key needed for basic geo
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${state.apiKey||'demo'}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.length) {
      resultsEl.innerHTML = '<div class="search-result-item">No results found.</div>';
      return;
    }
    resultsEl.innerHTML = data.map((r,i) => {
      const label = [r.name, r.state, r.country].filter(Boolean).join(', ');
      const tz    = guessTimezone(r.country, r.state, r.name, r.lon);
      return `<div class="search-result-item" data-idx="${i}"
        data-name="${r.name}" data-country="${r.country||''}"
        data-lat="${r.lat}" data-lon="${r.lon}" data-tz="${tz}"
        onclick="addLocation(this)">
        ${label}
      </div>`;
    }).join('');
  } catch(e) {
    resultsEl.innerHTML = '<div class="search-result-item">Search failed. Check API key.</div>';
  }
}

function guessTimezone(country, state_, city, lon) {
  // Best-effort TZ from country/state; can be overridden in future
  const map = {
    'CA': {
      'British Columbia':'America/Vancouver', 'Alberta':'America/Edmonton',
      'Saskatchewan':'America/Regina', 'Manitoba':'America/Winnipeg',
      'Ontario':'America/Toronto', 'Quebec':'America/Montreal',
      'New Brunswick':'America/Moncton', 'Nova Scotia':'America/Halifax',
      'Prince Edward Island':'America/Halifax', 'Newfoundland':'America/St_Johns',
      'Yukon':'America/Whitehorse', 'Northwest Territories':'America/Yellowknife',
      'Nunavut':'America/Iqaluit',
    },
    'US': {
      'California':'America/Los_Angeles', 'Oregon':'America/Los_Angeles',
      'Washington':'America/Los_Angeles', 'Nevada':'America/Los_Angeles',
      'Arizona':'America/Phoenix', 'Colorado':'America/Denver',
      'Utah':'America/Denver', 'New Mexico':'America/Denver',
      'Texas':'America/Chicago', 'Illinois':'America/Chicago',
      'Florida':'America/New_York', 'New York':'America/New_York',
      'Massachusetts':'America/New_York',
    },
    'GB': { _default:'Europe/London' },
    'AU': {
      'New South Wales':'Australia/Sydney','Victoria':'Australia/Melbourne',
      'Queensland':'Australia/Brisbane','Western Australia':'Australia/Perth',
      'South Australia':'Australia/Adelaide',
    },
  };
  const regions = map[country];
  if (regions) {
    if (regions[state_]) return regions[state_];
    if (regions._default) return regions._default;
  }
  // Rough offset from longitude
  const offset = Math.round(lon / 15);
  if (offset >= -12 && offset <= 14) {
    return `Etc/GMT${offset <= 0 ? '+'+Math.abs(offset) : '-'+offset}`;
  }
  return 'UTC';
}

function addLocation(el) {
  if (state.locations.length >= MAX_LOCATIONS) {
    alert(`Maximum ${MAX_LOCATIONS} locations allowed.`); return;
  }
  const loc = {
    name:    el.dataset.name,
    country: el.dataset.country,
    lat:     parseFloat(el.dataset.lat),
    lon:     parseFloat(el.dataset.lon),
    tz:      el.dataset.tz,
  };
  state.locations.push(loc);
  document.getElementById('search-results').classList.remove('open');
  document.getElementById('s-search').value = '';
  renderLocationList();
}

// -- Location List ----------------------------------------------
function renderLocationList() {
  const list = document.getElementById('location-list');
  list.innerHTML = state.locations.map((loc, i) => `
    <div class="loc-item" draggable="true" data-idx="${i}"
         ondragstart="dragStart(event,${i})" ondragover="dragOver(event,${i})"
         ondrop="dragDrop(event,${i})" ondragleave="dragLeave(event)">
      <span class="loc-handle">⠿</span>
      <div style="flex:1">
        <div class="loc-name">${loc.name}</div>
        <div class="loc-country">${[loc.country, loc.tz].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="loc-actions">
        <button class="loc-btn del" onclick="removeLocation(${i})">✕</button>
      </div>
    </div>`).join('');
}

function removeLocation(idx) {
  if (state.locations.length <= 1) { alert('At least 1 location required.'); return; }
  state.locations.splice(idx, 1);
  renderLocationList();
}

// -- Drag & drop reorder ----------------------------------------
let dragSrc = null;

function dragStart(e, idx) { dragSrc = idx; e.dataTransfer.effectAllowed = 'move'; }

function dragOver(e, idx) {
  e.preventDefault();
  document.querySelectorAll('.loc-item').forEach(el => el.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}

function dragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

function dragDrop(e, idx) {
  e.preventDefault();
  document.querySelectorAll('.loc-item').forEach(el => el.classList.remove('drag-over'));
  if (dragSrc === null || dragSrc === idx) return;
  const moved = state.locations.splice(dragSrc, 1)[0];
  state.locations.splice(idx, 0, moved);
  dragSrc = null;
  renderLocationList();
}

// -- Export / Import --------------------------------------------
document.getElementById('s-export').addEventListener('click', () => {
  const data = JSON.stringify({
    exported: new Date().toISOString(),
    state: state,
  }, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `worlddash-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Data exported.', 'ok');
});

document.getElementById('s-import').addEventListener('click', () => {
  document.getElementById('s-import-file').click();
});

document.getElementById('s-import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      const imported = parsed.state || parsed;
      if (imported.locations) state.locations = imported.locations.slice(0, MAX_LOCATIONS);
      if (imported.apiKey    !== undefined) state.apiKey    = imported.apiKey;
      if (imported.units     !== undefined) state.units     = imported.units;
      if (imported.theme     !== undefined) state.theme     = imported.theme;
      if (imported.fontSize  !== undefined) state.fontSize  = imported.fontSize;
      if (imported.weather   !== undefined) state.weather   = imported.weather;
      applyTheme();
      saveState();
      renderLocationList();
      document.getElementById('s-apikey').value = state.apiKey;
      document.getElementById('s-units').value  = state.units;
      document.getElementById('s-theme').value  = state.theme;
      setStatus('Data imported successfully.', 'ok');
    } catch(err) {
      setStatus('Import failed: invalid JSON.', 'err');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

// ==============================================================
// RESIZE — rebuild carousel geometry
// ==============================================================
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    Panther.Carousel.refresh();
    // Rebuild dots in case orientation changed
    CAROUSEL_IDS.forEach((_, idx) => buildDots(idx));
  }, 300);
});

// ==============================================================
// PWA SERVICE WORKER
// ==============================================================
if ('serviceWorker' in navigator) {
  // Inline SW registration — SW is minimal, just serves cache
  // Users can add a sw.js manually for full offline support
}

// ==============================================================
// INIT
// ==============================================================
loadState();
applyTheme();

// Build panel HTML and insert into DOM, but defer PantherUI.init()
// until after the browser has completed its first layout pass.
// This ensures offsetWidth is non-zero when modify() is called.
buildCarouselsDeferred();
updateTimestamps();
setStatus('WorldDash ready' + (state.apiKey ? '' : ' — add API key in Settings'), state.apiKey ? 'ok' : '');

// Auto-fetch if we have a key and no recent data
if (state.apiKey && (!state.lastFetch || Date.now() - state.lastFetch > 10 * 60 * 1000)) {
  setTimeout(fetchWeather, 1200);
}
