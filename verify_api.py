import sys
import httpx

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def main():
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=15.0) as client:
        # 1. Test Conditions
        c_resp = client.get("/api/conditions?lat=28.61&lon=77.20&label=New+Delhi")
        assert c_resp.status_code == 200, f"Conditions failed: {c_resp.status_code}"
        snap = c_resp.json()
        print(f"[PASS] Conditions: {snap['location']['label']} (Temp: {snap['weather']['temp_c']}°C, AQI: {snap['aqi']['overall_aqi']})")

        # 2. Test Geocoding
        g_resp = client.get("/api/geocode?query=London")
        assert g_resp.status_code == 200
        print(f"[PASS] Geocoding results: {len(g_resp.json()['results'])} cities found")

        # 3. Test Profile Creation
        p_resp = client.post("/api/profile", json={
            "name": "Hackathon Demo User",
            "age_group": "senior",
            "health_conditions": ["asthma", "heart_condition"],
            "occupation_exposure": "outdoor_worker"
        })
        assert p_resp.status_code == 200
        prof = p_resp.json()
        print(f"[PASS] Profile Created: {prof['id']} - {prof['name']}")

        # 4. Test Advisory Generation
        adv_resp = client.post("/api/advisory", json={
            "profile_id": prof["id"],
            "conditions_snapshot": snap
        })
        assert adv_resp.status_code == 200
        adv = adv_resp.json()
        print(f"[PASS] Advisory Generated: Risk [{adv['risk_level'].upper()}] - {adv['headline']}")
        print(f"       Recs: {adv['recommendations']}")

        # 5. Test Profile Comparator (Judge Demo)
        cmp_resp = client.post("/api/compare", json={
            "profile_a": {
                "name": "Healthy Adult",
                "age_group": "adult",
                "health_conditions": ["none"],
                "occupation_exposure": "mostly_indoor"
            },
            "profile_b": {
                "name": "Vulnerable Senior",
                "age_group": "senior",
                "health_conditions": ["asthma"],
                "occupation_exposure": "outdoor_worker"
            },
            "conditions_snapshot": snap
        })
        assert cmp_resp.status_code == 200
        cmp_data = cmp_resp.json()
        print(f"[PASS] Compare Demo: Profile A Risk [{cmp_data['profile_a']['advisory']['risk_level'].upper()}] vs Profile B Risk [{cmp_data['profile_b']['advisory']['risk_level'].upper()}]")

        # 6. Test Seed History
        seed_resp = client.post(f"/api/seed-history?profile_id={prof['id']}&label=New+Delhi")
        assert seed_resp.status_code == 200
        print(f"[PASS] Seed History: {seed_resp.json()}")

        # 7. Test Get History
        hist_resp = client.get(f"/api/history?profile_id={prof['id']}&days=7")
        assert hist_resp.status_code == 200
        print(f"[PASS] History Records Count: {len(hist_resp.json()['history'])}")

    print("\nALL HTTP REST ENDPOINTS VERIFIED END-TO-END SUCCESSFULLY!")

if __name__ == "__main__":
    main()
