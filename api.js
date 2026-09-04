/**
 * AeroCare AI - Frontend API Client
 * Clean HTTP communication with the FastAPI backend.
 */

const API = {
  async getHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      return await res.json();
    } catch (e) {
      console.warn('API Health Warning:', e);
      return { status: 'offline', ai_engine: 'Clinical Heuristic Fallback' };
    }
  },

  async getConditions(lat, lon, label = null) {
    let url = `/api/conditions?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    if (label) {
      url += `&label=${encodeURIComponent(label)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Network error' }));
      throw new Error(err.detail || 'Failed to fetch conditions');
    }
    return await res.json();
  },

  async searchCities(query) {
    if (!query || query.trim().length < 2) return [];
    const url = `/api/geocode?query=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  },

  async saveProfile(profile) {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to save profile' }));
      throw new Error(err.detail || 'Failed to save profile');
    }
    return await res.json();
  },

  async getProfile(profileId) {
    const url = profileId ? `/api/profile?profile_id=${encodeURIComponent(profileId)}` : '/api/profile';
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  },

  async generateAdvisory(conditionsSnapshot, profile) {
    const payload = {
      conditions_snapshot: conditionsSnapshot,
      profile: profile,
      profile_id: profile ? profile.id : null,
    };
    const res = await fetch('/api/advisory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate advisory' }));
      throw new Error(err.detail || 'Failed to generate advisory');
    }
    return await res.json();
  },

  async getHistory(profileId, days = 7) {
    let url = `/api/history?days=${days}`;
    if (profileId) {
      url += `&profile_id=${encodeURIComponent(profileId)}`;
    }
    const res = await fetch(url);
    if (!res.ok) return { history: [], count: 0 };
    return await res.json();
  },

  async seedDemoHistory(profileId, label = 'Current Location') {
    const url = `/api/seed-history?profile_id=${encodeURIComponent(profileId)}&label=${encodeURIComponent(label)}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to seed demo history');
    return await res.json();
  },

  async compareProfiles(profileA, profileB, conditionsSnapshot) {
    const payload = {
      profile_a: profileA,
      profile_b: profileB,
      conditions_snapshot: conditionsSnapshot,
    };
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Comparison failed');
    return await res.json();
  },
};

window.API = API;
