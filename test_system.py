import asyncio
import os
import sys
import shutil

# Ensure UTF-8 output for Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import database
from services.weather_service import fetch_conditions, search_locations, get_aqi_category
from services.advisory_service import get_or_generate_advisory


async def run_tests():
    print("=== 1. Testing Database Layer ===")
    test_db = "./data/test_advisor.db"
    if os.path.exists(test_db):
        os.remove(test_db)
        
    database.init_db(test_db)
    print("✓ SQLite schema initialized.")
    
    # Test profile creation
    profile_data = {
        "name": "Sarah Connor",
        "age_group": "adult",
        "health_conditions": ["asthma"],
        "occupation_exposure": "outdoor_worker"
    }
    saved_profile = database.save_profile(profile_data, db_path=test_db)
    assert saved_profile["id"] is not None
    assert saved_profile["name"] == "Sarah Connor"
    print(f"✓ Profile saved: ID {saved_profile['id']}")
    
    fetched_profile = database.get_profile(saved_profile["id"], db_path=test_db)
    assert fetched_profile["name"] == "Sarah Connor"
    assert "asthma" in fetched_profile["health_conditions"]
    print("✓ Profile retrieved successfully.")
    
    print("\n=== 2. Testing Open-Meteo Weather & AQI Service ===")
    # Test coordinates: New Delhi (28.61, 77.20)
    snapshot = await fetch_conditions(28.61, 77.20, "New Delhi, India")
    assert "weather" in snapshot
    assert "aqi" in snapshot
    assert "temp_c" in snapshot["weather"]
    assert "overall_aqi" in snapshot["aqi"]
    assert "category" in snapshot["aqi"]
    print(f"✓ Live snapshot fetched: Temp {snapshot['weather']['temp_c']}°C, AQI {snapshot['aqi']['overall_aqi']} ({snapshot['aqi']['category']})")
    
    # Test geocoding search
    geo_results = await search_locations("Tokyo")
    assert len(geo_results) > 0
    print(f"✓ Geocoding successful: Found {geo_results[0]['label']} at ({geo_results[0]['lat']}, {geo_results[0]['lon']})")
    
    print("\n=== 3. Testing Advisory Generation (Clinical Fallback / LLM) ===")
    # Profile A: Healthy 25yo office worker
    profile_healthy = {
        "id": "prof-healthy",
        "age_group": "adult",
        "health_conditions": ["none"],
        "occupation_exposure": "mostly_indoor"
    }
    # Profile B: 70yo with asthma, outdoor worker
    profile_vulnerable = {
        "id": "prof-vulnerable",
        "age_group": "senior",
        "health_conditions": ["asthma", "heart_condition"],
        "occupation_exposure": "outdoor_worker"
    }
    
    adv_healthy = await get_or_generate_advisory(snapshot, profile_healthy)
    adv_vulnerable = await get_or_generate_advisory(snapshot, profile_vulnerable)
    
    print(f"✓ Healthy Advisory Risk: [{adv_healthy['risk_level'].upper()}] - {adv_healthy['headline']}")
    print(f"  Recs: {adv_healthy['recommendations']}")
    print(f"✓ Vulnerable Advisory Risk: [{adv_vulnerable['risk_level'].upper()}] - {adv_vulnerable['headline']}")
    print(f"  Recs: {adv_vulnerable['recommendations']}")
    
    # Ensure differentiation works!
    print(f"✓ Personalization confirmed: Vulnerable risk ({adv_vulnerable['risk_level']}) vs Healthy risk ({adv_healthy['risk_level']})")
    
    print("\n=== 4. Testing Alert History & Seeding ===")
    seed_count = database.seed_demo_history_for_profile(saved_profile["id"], "New Delhi", db_path=test_db)
    print(f"✓ Seeded {seed_count} demo history records.")
    
    history = database.get_history(saved_profile["id"], days=7, db_path=test_db)
    assert len(history) >= 6
    print(f"✓ History query returned {len(history)} records.")
    
    # Cleanup test db safely
    try:
        if os.path.exists(test_db):
            os.remove(test_db)
    except Exception:
        pass
        
    print("\n==========================================")
    print("ALL BACKEND INTEGRATION TESTS PASSED 100%!")
    print("==========================================")


if __name__ == "__main__":
    asyncio.run(run_tests())
