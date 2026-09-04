# AeroCare AI: Personalized Air & Weather Health Advisor

> **ORIGIN Hackathon Project**  
> Translating live atmospheric data into personalized, plain-English health advisories tailored to individual vulnerability and daily exposure.

---

## 1. Problem Statement

Standard weather and air-quality alerts broadcast **one threshold for everyone**. An alert like *"AQI 160 — Unhealthy"* displays the exact same warning to a healthy 25-year-old indoor developer, a 72-year-old with asthma and cardiovascular history, and an outdoor construction worker exposed for 8 hours daily.

In reality, their physiological vulnerability and clinical risk from the exact same air conditions are drastically different. **AeroCare AI** solves this by fusing **real-time hyper-local atmospheric data** with an **individual's health and exposure profile** to synthesize clear, actionable, personalized health advisories.

---

## 2. Key Features

- **Live Zero-Key Meteorology & AQI Dashboard**: Integrates with Open-Meteo's Weather & Air Quality APIs (free, zero API key required) for live temperature, apparent temperature, humidity, wind velocity, US AQI, PM2.5, and PM10 metrics.
- **Personalized Health Vulnerability Profile**: Customizes assessments based on age group (child, teen, adult, senior), medical conditions (asthma, COPD, cardiovascular conditions, pregnancy), and daily exposure patterns (indoor worker, commuter, outdoor laborer, endurance athlete).
- **Multi-Provider AI Advisory Engine**: Seamlessly connects to **Groq (Llama 3.3/3.1)**, **Google Gemini (1.5 Flash)**, or **OpenAI (GPT-4o)** with structured JSON validation.
- **Clinical Heuristic Fallback Engine**: If no API key is provided or if network/rate-limits occur, the built-in clinical rule engine (calibrated against EPA and WHO health advisories) activates automatically, guaranteeing 100% reliability and zero crash risk during judging.
- **7-Day Longitudinal History & Trend Analytics**: Interactive, high-DPI canvas charts tracking US AQI alongside personalized risk levels (1-4 scale) over time, with expandable advisory logs.
- **Side-by-Side "Judge Demo" Comparator**: A dedicated 1-click modal demonstrating the core hackathon thesis: evaluating the exact same live atmospheric conditions for a healthy indoor worker versus a vulnerable senior with asthma side-by-side.
- **Voice Accessibility**: Integrated Text-to-Speech audio read-aloud via Web Speech API.
- **Sleek Glassmorphic Health UI**: Premium dark/light themes, animated AQI circular gauges, shimmer loading skeletons, and pulsing risk badges.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend (Web Client)                       │
│  - Modern Glassmorphic Health Dashboard UI                │
│  - Live Atmospheric Gauges & EPA AQI Visualizer            │
│  - AI Personalized Advisory Card (Loading Skeletons)       │
│  - Profile Management & Onboarding Flow                    │
│  - 7-Day Risk & AQI Trend Chart (Interactive Canvas/Chart) │
│  - Side-by-Side Profile Comparator (Demo Showcase)         │
│  - Text-to-Speech Accessibility Audio Read-Aloud           │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST API
┌──────────────────────────────▼──────────────────────────────┐
│              FastAPI Backend Application                    │
│  - GET  /api/conditions?lat=..&lon=.. (10m TTL cache)       │
│  - GET  /api/geocode?query=.. (Open-Meteo Geocoding)        │
│  - GET  /api/profile & POST /api/profile                    │
│  - POST /api/advisory (LLM + Rule Fallback + DB persist)    │
│  - GET  /api/history?profile_id=..&days=7                   │
│  - POST /api/seed-history (Demo trend seeding)              │
│  - POST /api/compare (Side-by-side evaluation)              │
│  - Static Asset Server for Frontend                         │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
    ┌──────────▼──────────┐        ┌──────────▼──────────┐
    │  Open-Meteo APIs    │        │ SQLite Persistence  │
    │  - Weather Forecast │        │ - data/advisor.db   │
    │  - Air Quality API  │        │ - profiles table    │
    │  - Geocoding API    │        │ - alerts table      │
    └─────────────────────┘        └─────────────────────┘
```

---

## 4. Tech Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn, HTTPX (async client), SQLite3.
- **Frontend**: Modern HTML5, Vanilla CSS3 (Custom Design System with Glassmorphism, HSL color tokens, micro-animations), Vanilla JavaScript (ES6+ modular architecture).
- **APIs**:
  - Open-Meteo Weather Forecast API
  - Open-Meteo Air Quality API
  - Open-Meteo Geocoding API
  - Groq API / Google Gemini API (optional LLM inference)

---

## 5. Quick Start & Setup

### Prerequisites
- Python 3.10+ installed.

### Installation
```bash
# Clone or navigate to the project directory
cd "ORIGIN Hackathon"

# Install required dependencies
python -m pip install -r requirements.txt
```

### Configuration (Optional)
To use a cloud LLM, copy `.env.example` to `.env` and provide an API key:
```ini
PORT=8000
DATABASE_PATH=./data/advisor.db

# Optional: Set Groq or Gemini key for cloud LLM inference
# If left blank, the app runs smoothly using the Clinical Heuristic Engine!
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### Running the Application
```bash
python main.py
```
Open your browser and navigate to:
```
http://127.0.0.1:8000
```

---

## 6. Judge Demo Script (3-Minute Presentation)

1. **State the core problem (15s)**:
   > *"Today's weather apps give one generic air alert to everyone. An AQI of 130 is marked 'Unhealthy for Sensitive Groups', but what does that mean for an asthmatic grandfather versus an indoor software engineer?"*

2. **Show the Live Atmospheric Dashboard (30s)**:
   > Point to the live weather & air quality gauges. Note that data flows from Open-Meteo with zero latency and zero API key requirements. Search for a major city (e.g. *New Delhi*, *Tokyo*, *London*) or use the GPS locate button.

3. **Demonstrate Layered AI Advisory (45s)**:
   > Show how the dashboard numbers load instantly first, followed by the AI advisory card with a subtle loading shimmer skeleton. Emphasize that the advisory translates raw micro-particle numbers into plain English and provides 3 tailored, actionable recommendations.

4. **Showcase the Side-by-Side Comparator (The "Wow" Moment) (60s)**:
   > Click the **"Compare Demo"** button in the top navigation.  
   > Watch the system evaluate the exact same live atmospheric data for:
   > - **Profile A (Healthy Adult Office Worker)**: Result is **LOW or MODERATE RISK** with advice to proceed normally.
   > - **Profile B (Senior with Asthma & Outdoor Labor)**: Result escalates to **HIGH or SEVERE RISK** with urgent recommendations to carry a rescue inhaler, wear an N95 respirator, and avoid strenuous outdoor tasks.

5. **Review 7-Day History & Longitudinal Trends (30s)**:
   > Scroll down to the 7-day trend chart. Click **"Seed 7-Day Demo Trend"** if needed to show how personalized risk dynamically tracks against atmospheric particulate spikes over time.
