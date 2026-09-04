# Project Spec: Personalized Air & Weather Health Advisor

> **Purpose of this document:** This is a build spec meant to be pasted into an AI coding assistant (e.g. Claude Code, Cursor, GitHub Copilot Workspace) so it can build the working software with minimal back-and-forth. It defines the problem, architecture, data flow, exact APIs to use, screens, edge cases, and a step-by-step build order.

---

## 1. Problem Statement

Weather and air-quality alert systems (news apps, government AQI apps, weather apps) apply **one threshold to everyone**. "AQI 160 — Unhealthy" means the same warning is shown to a healthy 25-year-old office worker, a 70-year-old with asthma, and a construction worker who is outdoors for 8 hours. But their actual health risk from the same conditions is very different.

**Goal:** Build a dashboard that takes (a) live location-based weather/AQI data and (b) a short user health profile, and uses an LLM to generate a **personalized, plain-English health advisory** — not a generic "AQI is high" banner. Also show a 7-day history/trend of alerts so the user can see patterns.

---

## 2. Core Features (MVP scope for hackathon)

1. **Location-based live dashboard** — current weather (temp, humidity, wind) + AQI (PM2.5, PM10, overall AQI) for the user's location (geolocation or manual city search).
2. **User profile form** — age group, health condition(s) (e.g. asthma, COPD, heart condition, pregnancy, none), occupation/exposure type (e.g. outdoor worker, commuter, mostly indoors, athlete/runner). Stored locally (localStorage or simple DB row) — no auth required for hackathon scope.
3. **AI-generated personalized advisory** — send `{weather, AQI, profile}` to a free LLM API with a structured prompt; get back a short plain-English advisory + risk level (Low/Moderate/High/Severe) + 2-3 concrete recommendations.
4. **Alert history / trend view** — store each generated advisory (or at least the raw AQI/weather snapshot + risk level) with a timestamp; show past 7 days as a list or simple chart (risk level per day).

**Explicitly out of scope for hackathon** (mention only if time remains): push notifications, multi-user auth, SMS alerts, multiple saved locations, native mobile app.

---

## 3. Recommended Tech Stack

Chosen for: zero/near-zero cost, fast to scaffold, easy to demo, works within a hackathon timebox.

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React (Vite)** + Tailwind CSS | Fast dev loop, no build config pain |
| Backend | **Node.js + Express** (or Next.js API routes if you prefer one repo) | Simple REST endpoints, easy to keep API keys server-side |
| Weather + AQI data | **Open-Meteo** (`https://open-meteo.com`) — free, **no API key required**, has both weather and air-quality endpoints | Removes signup friction entirely, critical for hackathon speed |
| Geolocation → coordinates | Browser `navigator.geolocation` for current location; **Open-Meteo Geocoding API** for manual city search (also free, no key) | No key needed |
| AI layer | **Groq API** (free tier, very fast inference, OpenAI-compatible SDK) running **Llama 3.1 8B** or **Llama 3.3 70B** — *alternative:* Google **Gemini 1.5 Flash** free tier, or **OpenRouter** free models | Free, fast, good enough for structured short-text generation |
| Storage | SQLite (via `better-sqlite3`) for history, OR just `localStorage` on the frontend if you want zero backend DB setup | SQLite recommended if time allows — needed for a real "trend" view across sessions/devices |
| Charting | `recharts` (React) for the 7-day trend | Lightweight, common in hackathon builds |

If the assistant building this has a preference for a different stack (e.g. Python/FastAPI backend), that's fine — the API contracts below should still be implemented; only the implementation language changes.

---

## 4. Architecture Overview

```
[Browser] 
   |  1. geolocation or city search
   v
[React Frontend] 
   |  2. GET /api/conditions?lat=..&lon=..
   v
[Express Backend] --> Open-Meteo Weather API
                   --> Open-Meteo Air Quality API
   |  3. combine + cache
   v
[Frontend] shows raw dashboard immediately (fast)
   |  4. POST /api/advisory  { weather, aqi, profile }
   v
[Express Backend] --> builds prompt --> Groq/Gemini LLM API
   |  5. parses structured response
   v
[Backend] saves snapshot + advisory to SQLite (history table)
   |  6. returns advisory JSON
   v
[Frontend] renders advisory card + risk badge

Separately:
[Frontend] GET /api/history?days=7  --> renders trend chart/list
```

**Key design decision:** Split the "raw conditions" fetch from the "AI advisory" call. Show the dashboard (temp/AQI numbers) immediately without waiting on the LLM, then stream in the personalized advisory a moment later with a loading state. This makes the app feel fast and is a good demo beat ("see, real data first, then AI reasoning layered on top").

---

## 5. Data Models

### User Profile (client-stored or `profiles` table)
```json
{
  "id": "uuid-or-local",
  "age_group": "child | teen | adult | senior",       // <18, 18-40, 41-65, 65+
  "health_conditions": ["asthma", "copd", "heart_condition", "pregnant", "none"],
  "occupation_exposure": "outdoor_worker | commuter | mostly_indoor | athlete",
  "created_at": "ISO timestamp"
}
```

### Conditions Snapshot (from Open-Meteo, normalized)
```json
{
  "location": { "lat": 23.25, "lon": 77.41, "label": "Bhopal, IN" },
  "timestamp": "ISO timestamp",
  "weather": {
    "temp_c": 34.2,
    "feels_like_c": 37.1,
    "humidity_pct": 58,
    "wind_kmh": 12,
    "condition": "clear | cloudy | rain | ..."
  },
  "aqi": {
    "overall_aqi": 162,
    "pm2_5": 78.4,
    "pm10": 110.2,
    "category": "unhealthy"   // derive from standard AQI breakpoints
  }
}
```

### Advisory (LLM output, stored in `alerts` history table)
```json
{
  "id": "uuid",
  "profile_id": "uuid",
  "timestamp": "ISO timestamp",
  "conditions_snapshot": { /* embed the object above */ },
  "risk_level": "low | moderate | high | severe",
  "headline": "short 1-line summary",
  "advisory_text": "2-4 sentence plain-English explanation",
  "recommendations": ["...", "...", "..."]
}
```

---

## 6. API Contracts (backend endpoints to build)

### `GET /api/conditions?lat={lat}&lon={lon}`
Fetch current weather + AQI from Open-Meteo, normalize into the "Conditions Snapshot" shape above, return JSON. Cache per lat/lon (rounded to 2 decimals) for ~10 minutes to avoid hammering the API during demo/dev.

Open-Meteo endpoints to call:
- Weather: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code`
- Air quality: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm10,pm2_5,us_aqi`

### `GET /api/geocode?query={cityName}`
For manual location search. Open-Meteo geocoding: `https://geocoding-api.open-meteo.com/v1/search?name={query}`

### `POST /api/profile`
Save/update the user's profile. Body = Profile object (minus id/created_at). Return saved profile with generated id.

### `POST /api/advisory`
Body: `{ profile_id, conditions_snapshot }` (or full profile + conditions if no DB).
1. Build an LLM prompt (see Section 7).
2. Call the LLM API.
3. Parse the structured JSON response (use JSON mode / function-calling if the LLM provider supports it, to avoid brittle text parsing).
4. Save a row to the `alerts` history table.
5. Return the Advisory object.

### `GET /api/history?profile_id={id}&days=7`
Return the last N days of Advisory rows for that profile, most recent first, for the trend view.

---

## 7. LLM Prompt Design (the core "AI layer")

**This is the most important part of the project — spend real effort here, not just "summarize this data."**

System prompt (send once, or bake into every request):
```
You are a public health advisory assistant. You translate raw weather and 
air quality data into a short, personalized, plain-English health advisory 
for a specific individual, based on their age group, health conditions, and 
occupation/exposure level.

Rules:
- Be specific to THIS person's profile, not generic.
- Do not just restate the numbers — explain what the numbers MEAN for someone 
  with their profile.
- Give 2-3 concrete, actionable recommendations (e.g. "avoid outdoor exercise 
  between 12-4pm", "carry your inhaler", "wear an N95 mask if going outside 
  for extended periods").
- Assign a risk_level: one of "low", "moderate", "high", "severe" — based on 
  how the specific conditions interact with this specific profile (e.g. AQI 
  120 is "moderate" for a healthy adult but "high" for someone with asthma).
- Keep advisory_text to 2-4 sentences. Avoid medical jargon.
- You are not a doctor and must not diagnose; frame advice as general 
  precaution, not medical treatment.
- Respond ONLY with valid JSON matching this schema:
{
  "risk_level": "low" | "moderate" | "high" | "severe",
  "headline": string (max 12 words),
  "advisory_text": string (2-4 sentences),
  "recommendations": [string, string, string]
}
```

User message (constructed per-request from real data):
```
Current conditions:
- Location: {location_label}
- Temperature: {temp_c}°C (feels like {feels_like_c}°C)
- Humidity: {humidity_pct}%
- AQI (US standard): {overall_aqi} ({category})
- PM2.5: {pm2_5} µg/m³, PM10: {pm10} µg/m³

User profile:
- Age group: {age_group}
- Health conditions: {health_conditions joined by comma, or "none reported"}
- Occupation/exposure type: {occupation_exposure}

Generate the personalized advisory JSON now.
```

**Important implementation notes:**
- Use the LLM provider's JSON mode / structured output feature if available (Groq and Gemini both support this) so you don't have to regex-parse free text.
- Always validate the parsed JSON against the expected schema server-side before saving/returning it; if parsing fails, retry once, then fall back to a rule-based (non-AI) message so the app never crashes on a bad LLM response.
- Cache advisory results for the same (profile, rounded conditions) pair for a few minutes so repeated dashboard refreshes don't burn API quota during the demo.

---

## 8. Frontend Screens

### Screen 1 — Onboarding / Profile Setup (first visit only)
- Simple form: age group (select), health conditions (multi-select checkboxes), occupation/exposure (select).
- "Save & Continue" → stores profile → redirects to Dashboard.
- Allow editing later via a "My Profile" button/icon.

### Screen 2 — Dashboard (main screen)
- Location bar: auto-detect via geolocation on load; allow manual search/override.
- Conditions card: temperature, feels-like, humidity, wind, AQI number + category, PM2.5/PM10, with a color-coded badge (green/yellow/orange/red/maroon matching standard AQI colors).
- Personalized Advisory card: risk level badge, headline, advisory text, bullet list of recommendations. Show a loading skeleton while the AI call is in flight (this should visibly load *after* the raw conditions appear).
- "Refresh" button to re-fetch conditions + regenerate advisory.

### Screen 3 — History / Trends
- List or simple line/bar chart of risk_level (mapped to a 1-4 numeric scale) over the past 7 days.
- Each entry expandable to show that day's full advisory text and conditions.
- Good demo moment: show a day where AQI spiked and the advisory changed tone accordingly.

---

## 9. Edge Cases & Error Handling to Implement

- **Geolocation denied/unavailable** → fall back to manual city search; don't block the app.
- **Open-Meteo API failure/timeout** → show a clear error state on the dashboard, don't crash; retry button.
- **LLM API failure or rate limit hit** → fall back to a simple rule-based advisory generator (e.g. if AQI > 150 and profile includes asthma → "high risk" canned message) so the demo never shows a blank/broken advisory card. This fallback is also a good talking point ("graceful degradation").
- **No profile set yet** → dashboard should prompt profile creation before generating an advisory (raw conditions can still show).
- **Empty history** (first-time user) → show a friendly empty state, not a blank chart.
- **Multiple health conditions selected** → prompt should still produce one coherent advisory, not one per condition.

---

## 10. Step-by-Step Build Order (suggested for the coding assistant)

1. Scaffold repo: React (Vite) frontend + Express backend in one monorepo (or Next.js full-stack if simpler for the assistant).
2. Backend: implement `/api/conditions` and `/api/geocode` against Open-Meteo (no key needed) — get raw data flowing end-to-end first.
3. Frontend: build Dashboard screen showing raw weather + AQI (geolocation + manual search). Confirm this works before touching AI.
4. Backend: set up SQLite with `profiles` and `alerts` tables (or in-memory/localStorage if time-constrained).
5. Frontend: build Profile onboarding form; wire to `/api/profile`.
6. Backend: implement `/api/advisory` — LLM prompt construction, call to Groq/Gemini, JSON parsing + validation, fallback rule-based generator, save to `alerts` table.
7. Frontend: build Advisory card on Dashboard, wired to `/api/advisory`, with loading state.
8. Backend: implement `/api/history`.
9. Frontend: build History/Trends screen with `recharts`.
10. Polish pass: AQI color coding, empty/error states, responsive layout, README with setup instructions (including how to get a free Groq/Gemini API key).
11. Prepare demo script: (a) show generic-alert problem in words, (b) create two different profiles (e.g. "healthy adult" vs "asthma + outdoor worker") in the same location, (c) show the two very different AI advisories side by side for identical conditions — this is the core "wow" moment of the demo.

---

## 11. Environment Variables Needed

```
GROQ_API_KEY=...        # or GEMINI_API_KEY=... depending on chosen provider
PORT=5000
DATABASE_PATH=./data/app.db   # if using SQLite
```
No key is needed for Open-Meteo (weather/AQI/geocoding) — this is intentional to minimize hackathon setup friction.

---

## 12. Demo Script (for judges)

1. State the problem in one sentence: "Everyone gets the same AQI alert regardless of their actual health risk."
2. Show the dashboard with live local weather/AQI.
3. Create Profile A: healthy adult, no conditions, mostly indoors. Show its advisory.
4. Switch to Profile B: senior, asthma, outdoor worker — same location/conditions. Show its advisory is meaningfully different (higher risk level, different recommendations) even though the raw data is identical.
5. Show the 7-day history/trend view.
6. Mention the fallback mechanism (graceful degradation if the LLM call fails) as a reliability point.
