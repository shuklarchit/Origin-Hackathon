import os
import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone

DEFAULT_DB_PATH = os.environ.get("DATABASE_PATH", "./data/advisor.db")

def get_connection(db_path: str = None) -> sqlite3.Connection:
    path = db_path or os.environ.get("DATABASE_PATH", DEFAULT_DB_PATH)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: str = None):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    # Profiles table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT,
            age_group TEXT NOT NULL,
            health_conditions TEXT NOT NULL, -- JSON array
            occupation_exposure TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    
    # Alerts / History table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            conditions_snapshot TEXT NOT NULL, -- JSON object
            risk_level TEXT NOT NULL, -- low | moderate | high | severe
            headline TEXT NOT NULL,
            advisory_text TEXT NOT NULL,
            recommendations TEXT NOT NULL, -- JSON array
            FOREIGN KEY (profile_id) REFERENCES profiles(id)
        )
    """)
    
    # Create indexes for fast lookup
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_profile_time ON alerts(profile_id, timestamp DESC)")
    
    conn.commit()
    conn.close()

def save_profile(profile_data: dict, db_path: str = None) -> dict:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    profile_id = profile_data.get("id") or str(uuid.uuid4())
    name = profile_data.get("name", "Personal Profile")
    age_group = profile_data.get("age_group", "adult")
    conditions = profile_data.get("health_conditions", ["none"])
    if isinstance(conditions, list):
        conditions_str = json.dumps(conditions)
    else:
        conditions_str = json.dumps([conditions])
    
    exposure = profile_data.get("occupation_exposure", "mostly_indoor")
    created_at = profile_data.get("created_at") or datetime.now(timezone.utc).isoformat()
    
    cursor.execute("""
        INSERT INTO profiles (id, name, age_group, health_conditions, occupation_exposure, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            age_group=excluded.age_group,
            health_conditions=excluded.health_conditions,
            occupation_exposure=excluded.occupation_exposure
    """, (profile_id, name, age_group, conditions_str, exposure, created_at))
    
    conn.commit()
    conn.close()
    
    return {
        "id": profile_id,
        "name": name,
        "age_group": age_group,
        "health_conditions": json.loads(conditions_str),
        "occupation_exposure": exposure,
        "created_at": created_at
    }

def get_profile(profile_id: str, db_path: str = None) -> dict | None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "age_group": row["age_group"],
        "health_conditions": json.loads(row["health_conditions"]),
        "occupation_exposure": row["occupation_exposure"],
        "created_at": row["created_at"]
    }

def list_profiles(db_path: str = None) -> list[dict]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM profiles ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row["id"],
            "name": row["name"],
            "age_group": row["age_group"],
            "health_conditions": json.loads(row["health_conditions"]),
            "occupation_exposure": row["occupation_exposure"],
            "created_at": row["created_at"]
        })
    return result

def save_alert(alert_data: dict, db_path: str = None) -> dict:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    alert_id = alert_data.get("id") or str(uuid.uuid4())
    profile_id = alert_data["profile_id"]
    timestamp = alert_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
    
    snapshot = alert_data["conditions_snapshot"]
    snapshot_str = json.dumps(snapshot) if isinstance(snapshot, dict) else snapshot
    
    recs = alert_data.get("recommendations", [])
    recs_str = json.dumps(recs) if isinstance(recs, list) else recs
    
    risk_level = alert_data.get("risk_level", "low").lower()
    headline = alert_data.get("headline", "")
    advisory_text = alert_data.get("advisory_text", "")
    
    cursor.execute("""
        INSERT INTO alerts (id, profile_id, timestamp, conditions_snapshot, risk_level, headline, advisory_text, recommendations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (alert_id, profile_id, timestamp, snapshot_str, risk_level, headline, advisory_text, recs_str))
    
    conn.commit()
    conn.close()
    
    return {
        "id": alert_id,
        "profile_id": profile_id,
        "timestamp": timestamp,
        "conditions_snapshot": json.loads(snapshot_str) if isinstance(snapshot_str, str) else snapshot_str,
        "risk_level": risk_level,
        "headline": headline,
        "advisory_text": advisory_text,
        "recommendations": json.loads(recs_str) if isinstance(recs_str, str) else recs_str
    }

def get_history(profile_id: str = None, days: int = 7, limit: int = 30, db_path: str = None) -> list[dict]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    if profile_id:
        cursor.execute("""
            SELECT * FROM alerts 
            WHERE profile_id = ? AND timestamp >= ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        """, (profile_id, since_date, limit))
    else:
        cursor.execute("""
            SELECT * FROM alerts 
            WHERE timestamp >= ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        """, (since_date, limit))
        
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row["id"],
            "profile_id": row["profile_id"],
            "timestamp": row["timestamp"],
            "conditions_snapshot": json.loads(row["conditions_snapshot"]),
            "risk_level": row["risk_level"],
            "headline": row["headline"],
            "advisory_text": row["advisory_text"],
            "recommendations": json.loads(row["recommendations"])
        })
    return result

def seed_demo_history_for_profile(profile_id: str, location_label: str = "Central Metro", db_path: str = None) -> int:
    """Seed realistic 7-day trend data for demonstration purposes."""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM alerts WHERE profile_id = ?", (profile_id,))
    count = cursor.fetchone()[0]
    if count > 0:
        conn.close()
        return 0 # Already has history
    
    # 7 historical days with varying AQI to demonstrate dynamic sensitivity
    demo_days = [
        {"days_ago": 6, "aqi": 45, "pm25": 11.2, "pm10": 25.0, "temp": 24.5, "cat": "good", "risk": "low", "headline": "Clean air conditions today", "text": "Atmospheric conditions are pristine. Ideal opportunity for outdoor activities with minimal respiratory stress.", "recs": ["Enjoy open outdoor exercise", "Ventilate indoor living spaces"]},
        {"days_ago": 5, "aqi": 78, "pm25": 24.8, "pm10": 52.1, "temp": 26.2, "cat": "moderate", "risk": "low", "headline": "Moderate air quality index", "text": "Acceptable air quality for most individuals. Sensitive persons may note mild sensitivity during prolonged physical exertion.", "recs": ["Standard outdoor routines fine", "Stay hydrated"]},
        {"days_ago": 4, "aqi": 115, "pm25": 41.5, "pm10": 78.4, "temp": 28.0, "cat": "unhealthy_for_sensitive_groups", "risk": "moderate", "headline": "Ozone & fine particulate elevation", "text": "Particles are concentrated enough to trigger respiratory irritation in vulnerable demographics.", "recs": ["Sensitive groups reduce prolonged exertion", "Keep rescue medication available"]},
        {"days_ago": 3, "aqi": 172, "pm25": 96.4, "pm10": 138.2, "temp": 31.5, "cat": "unhealthy", "risk": "high", "headline": "Spike in particulate pollution", "text": "Regional stagnant air caused an acute spike in PM2.5. Elevated health risk for outdoor exposure.", "recs": ["Avoid strenuous outdoor workouts", "Wear certified N95 masks when outside", "Run indoor HEPA air filtration"]},
        {"days_ago": 2, "aqi": 158, "pm25": 68.9, "pm10": 114.0, "temp": 29.8, "cat": "unhealthy", "risk": "high", "headline": "Sustained particulate burden", "text": "Air pollution remains elevated. Prolonged outdoor exertion could exacerbate bronchial or cardiac symptoms.", "recs": ["Reschedule outdoor tasks to early morning", "Keep windows sealed", "Monitor symptom changes"]},
        {"days_ago": 1, "aqi": 95, "pm25": 33.1, "pm10": 64.3, "temp": 27.1, "cat": "moderate", "risk": "moderate", "headline": "Gradual air clearing", "text": "Wind dispersion has lowered pollutant density. Conditions are trending safer.", "recs": ["Gradual resumption of light activities", "Maintain moderate precautions"]},
    ]
    
    inserted = 0
    now = datetime.now(timezone.utc)
    for item in demo_days:
        dt = now - timedelta(days=item["days_ago"], hours=2, minutes=15)
        snapshot = {
            "location": {"lat": 28.61, "lon": 77.20, "label": location_label},
            "timestamp": dt.isoformat(),
            "weather": {
                "temp_c": item["temp"],
                "feels_like_c": round(item["temp"] + 2.1, 1),
                "humidity_pct": 52,
                "wind_kmh": 14,
                "condition": "Partly Cloudy"
            },
            "aqi": {
                "overall_aqi": item["aqi"],
                "pm2_5": item["pm25"],
                "pm10": item["pm10"],
                "category": item["cat"]
            }
        }
        alert_obj = {
            "id": str(uuid.uuid4()),
            "profile_id": profile_id,
            "timestamp": dt.isoformat(),
            "conditions_snapshot": snapshot,
            "risk_level": item["risk"],
            "headline": item["headline"],
            "advisory_text": item["text"],
            "recommendations": item["recs"]
        }
        save_alert(alert_obj, db_path)
        inserted += 1
        
    return inserted
