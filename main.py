import os
import uuid
from typing import Optional, List, Any
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

import database
from services.weather_service import fetch_conditions, search_locations
from services.advisory_service import get_or_generate_advisory

load_dotenv()

# Lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite schema
    database.init_db()
    yield

app = FastAPI(
    title="VayuCare AI: Personalized Air & Weather Health Advisor API",
    description="Live atmospheric intelligence personalized to individual health vulnerabilities.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Pydantic Models -----------------

class ProfileModel(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = "Personal Profile"
    age_group: str = Field(..., description="child | teen | adult | senior")
    health_conditions: List[str] = Field(default_factory=lambda: ["none"])
    occupation_exposure: str = Field(..., description="outdoor_worker | commuter | mostly_indoor | athlete")
    created_at: Optional[str] = None

class AdvisoryRequest(BaseModel):
    profile_id: Optional[str] = None
    profile: Optional[ProfileModel] = None
    conditions_snapshot: dict

class CompareRequest(BaseModel):
    profile_a: ProfileModel
    profile_b: ProfileModel
    conditions_snapshot: dict

# ----------------- API Endpoints -----------------

@app.get("/api/health")
async def health_check():
    groq_active = bool(os.environ.get("GROQ_API_KEY", "").strip())
    gemini_active = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    openai_active = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    
    active_engine = "Clinical Heuristic Engine"
    if groq_active:
        active_engine = "Groq Llama 3.3"
    elif gemini_active:
        active_engine = "Google Gemini 1.5"
    elif openai_active:
        active_engine = "OpenAI GPT-4o"
        
    return {
        "status": "online",
        "service": "VayuCare AI - Personalized Air & Weather Health Advisor",
        "ai_engine": active_engine,
        "has_llm_key": groq_active or gemini_active or openai_active
    }


@app.get("/api/conditions")
async def get_conditions(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    label: Optional[str] = Query(None, description="Location label / city name")
):
    try:
        snapshot = await fetch_conditions(lat, lon, label)
        return snapshot
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch live conditions: {str(e)}")

@app.get("/api/geocode")
async def geocode_city(query: str = Query(..., min_length=2, description="City or region name")):
    results = await search_locations(query)
    return {"results": results}

@app.get("/api/profile")
async def get_profiles(profile_id: Optional[str] = None):
    if profile_id:
        p = database.get_profile(profile_id)
        if not p:
            raise HTTPException(status_code=404, detail="Profile not found")
        return p
    profiles = database.list_profiles()
    return {"profiles": profiles}

@app.post("/api/profile")
async def create_or_update_profile(profile: ProfileModel):
    data = profile.model_dump()
    saved = database.save_profile(data)
    return saved

@app.post("/api/advisory")
async def generate_advisory(req: AdvisoryRequest):
    # Resolve profile
    prof_dict = None
    if req.profile:
        prof_dict = req.profile.model_dump()
    elif req.profile_id:
        prof_dict = database.get_profile(req.profile_id)
        
    if not prof_dict:
        # Default fallback profile
        prof_dict = {
            "id": "guest-profile",
            "name": "Default Profile",
            "age_group": "adult",
            "health_conditions": ["none"],
            "occupation_exposure": "mostly_indoor"
        }
        
    # Generate advisory
    advisory = await get_or_generate_advisory(req.conditions_snapshot, prof_dict)
    
    # Save to history alerts table if profile_id exists in db or save with resolved id
    profile_id = prof_dict.get("id") or "guest"
    alert_record = {
        "id": str(uuid.uuid4()),
        "profile_id": profile_id,
        "conditions_snapshot": req.conditions_snapshot,
        "risk_level": advisory["risk_level"],
        "headline": advisory["headline"],
        "advisory_text": advisory["advisory_text"],
        "recommendations": advisory["recommendations"]
    }
    
    try:
        # If profile doesn't exist in DB, ensure a stub is there
        if profile_id != "guest" and not database.get_profile(profile_id):
            database.save_profile(prof_dict)
        if profile_id != "guest":
            saved_alert = database.save_alert(alert_record)
            advisory["id"] = saved_alert["id"]
            advisory["timestamp"] = saved_alert["timestamp"]
    except Exception as db_err:
        print(f"Warning: could not persist alert to DB: {db_err}")
        
    advisory["profile_id"] = profile_id
    advisory["conditions_snapshot"] = req.conditions_snapshot
    return advisory

@app.get("/api/history")
async def get_alert_history(
    profile_id: Optional[str] = Query(None, description="Profile ID"),
    days: int = Query(7, ge=1, le=30, description="History window in days")
):
    history = database.get_history(profile_id, days=days)
    return {"history": history, "count": len(history)}

@app.post("/api/seed-history")
async def seed_demo_history(profile_id: str = Query(...), label: str = Query("Current City")):
    count = database.seed_demo_history_for_profile(profile_id, label)
    return {"status": "success", "seeded_records": count}

@app.post("/api/compare")
async def compare_profiles(req: CompareRequest):
    """
    Generate advisories for two distinct profiles under identical conditions.
    Core 'Judge Demo' feature demonstrating personalized risk contrast.
    """
    prof_a = req.profile_a.model_dump()
    prof_b = req.profile_b.model_dump()
    
    adv_a = await get_or_generate_advisory(req.conditions_snapshot, prof_a)
    adv_b = await get_or_generate_advisory(req.conditions_snapshot, prof_b)
    
    return {
        "conditions_snapshot": req.conditions_snapshot,
        "profile_a": {
            "profile": prof_a,
            "advisory": adv_a
        },
        "profile_b": {
            "profile": prof_b,
            "advisory": adv_b
        }
    }

# ----------------- Static File Mounts -----------------

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def serve_index():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"message": "Frontend static files pending installation"})

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Personalized Air Health Advisor on http://127.0.0.1:{port}")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
