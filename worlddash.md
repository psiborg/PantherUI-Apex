# WorldDash

A responsive Progressive Web App for displaying world clocks and weather information across multiple cities simultaneously. Built on [PantherUI Apex](../README.md) — each city is a 3D rotating carousel with five information panels.

---

## Screenshot layout

```
┌─────────────────────────────────────────────────┐
│  🐾 WorldDash   [⟳ FETCH] [1][2][3][4][5] [⚙]  │  ← Header
├──────────────────┬──────────────────────────────┤
│                  │                              │
│    Toronto       │        Vancouver             │  ← 2 × 2 in landscape
│    carousel      │        carousel              │
│                  │                              │
├──────────────────┼──────────────────────────────┤
│                  │                              │
│    Calgary       │        Halifax               │
│    carousel      │        carousel              │
│                  │                              │
├──────────────────┴──────────────────────────────┤
│  ● Ready                          Updated 6:15  │  ← Footer
└─────────────────────────────────────────────────┘
```

In portrait mode the four carousels stack in a single column (1 × 4).

---

## Files

| File | Description |
|---|---|
| `worlddash.html` | Complete application — single self-contained file |
| `PantherUI.js` | PantherUI Apex library (required) |
| `PantherUI.css` | PantherUI Apex styles (required) |

---

## Getting Started

1. Place `worlddash.html`, `PantherUI.js`, and `PantherUI.css` in the same folder.
2. Open `worlddash.html` in a browser (or serve over HTTP/HTTPS for PWA features).
3. Click **⚙ Settings**, paste your OpenWeatherMap API key, and click **Save**.
4. Click **⟳ Fetch** to load weather data.

### Getting a free API key

1. Sign up at [openweathermap.org](https://openweathermap.org/api)
2. Go to **API keys** in your account dashboard
3. Copy your default key (or generate a new one)
4. New keys activate within a few minutes

WorldDash uses the **Current Weather** (`data/2.5/weather`) and **5 Day Forecast** (`data/2.5/forecast`) endpoints — both included in the free tier. Each fetch makes **2 requests per location** (8 total for 4 cities).

---

## Panels

Each carousel has five panels, navigated by dragging, flicking, or using the toolbar number buttons.

| Panel | Content |
|---|---|
| **1 — Clock** | City name, live date, real-time ticking clock, timezone abbreviation (e.g. EST), UTC offset |
| **2 — Weather** | Current conditions: icon, temperature, feels like, description, humidity, wind speed & direction, visibility, cloud cover, pressure, sunrise, sunset |
| **3 — Hourly** | 3-hour forecast slots for the next 48 hours: time, icon, description, temperature, precipitation probability |
| **4 — Daily** | 6-day forecast aggregated from 3-hour slots: day, icon, description, high, low |
| **5 — Alerts** | Not available in API 2.5 free tier (requires One Call API 3.0) |

---

## Toolbar

| Button | Action |
|---|---|
| **⟳ Fetch** | Fetch fresh weather data for all locations |
| **1 – 5** | Jump all four carousels to the same panel simultaneously |
| **⚙ Settings** | Open the settings dialog |

---

## Settings

### Display
- **Theme** — Dark or Light
- **Units** — Metric (°C, m/s) or Imperial (°F, mph)

### API
- **API Key** — Your OpenWeatherMap key, stored in `localStorage`

### Locations
- **Search** — Find cities by name using the OWM Geocoding API; up to 4 locations
- **Reorder** — Drag and drop locations to rearrange the carousel grid
- **Remove** — Delete a location (minimum 1 required)

> Changing units clears cached weather data so the next fetch returns values in the correct unit.

### Data
- **Export** — Download all state (locations, weather cache, settings) as a JSON file
- **Import** — Restore state from a previously exported JSON file

---

## Auto-fetch

On load, if an API key is configured and the last fetch was more than **10 minutes** ago, WorldDash automatically fetches fresh data after a 1.2 second delay (to allow the carousels to finish rendering).

---

## Default Locations

| # | City | Timezone |
|---|---|---|
| 1 | Toronto, CA | America/Toronto |
| 2 | Vancouver, CA | America/Vancouver |
| 3 | Calgary, CA | America/Edmonton |
| 4 | Halifax, CA | America/Halifax |

---

## Keyboard & Gesture Interaction

Each carousel inherits PantherUI's full input system:

- **Drag / flick** left or right to rotate panels — tracks pointer 1:1
- **Momentum snapping** — fast flicks carry rotation one extra panel
- **Arrow keys** (`←` `→`) rotate the carousel under focus
- **Touch** — full Pointer Events API support (mouse, touch, stylus unified)

---

## Responsive Layout

Layout switches automatically based on device orientation:

- **Portrait** — single column, 4 rows (1 × 4)
- **Landscape** — two columns, 2 rows (2 × 2)

Carousel geometry recalculates automatically on resize and orientation change (debounced 300 ms).

---

## Data & Privacy

All data is stored exclusively in the browser's `localStorage` under the key `worlddash_v2`. Nothing is sent to any server other than OpenWeatherMap's API. Your API key never leaves the browser.

---

## Technical Notes

**Timezone handling** — City clocks use `Intl.DateTimeFormat` with `formatToParts()` to extract local time values, avoiding the cross-browser `Invalid Date` error that occurs when passing locale-formatted strings back into `new Date()`. UTC offsets are read directly from `timeZoneName: 'longOffset'` (e.g. `GMT-05:00`).

**Forecast aggregation** — The 2.5 `/forecast` endpoint returns 3-hour slots. WorldDash groups these by local calendar date (in the city's timezone) and picks the noon-nearest slot for the representative weather icon and description, tracking per-day min/max temperatures across all slots.

**Timezone guessing** — When adding a city via search, WorldDash maps the country + state/province from the geocoding result to an IANA timezone string. This covers Canada, the US, UK, and Australia; other regions fall back to a rough `Etc/GMT±N` estimate from longitude.
