/**
 * AeroCare AI - Main Application Controller
 * Orchestrates geolocation, atmospheric ingestion, AI advisory synthesis,
 * 7-day trend analytics, and side-by-side profile comparator.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global App State
  const state = {
    profile: null,
    location: {
      lat: 28.6139,
      lon: 77.2090,
      label: 'New Delhi, India',
    },
    conditions: null,
    advisory: null,
    history: [],
    isSpeaking: false,
    chart: null,
  };

  // DOM Elements Cache
  const els = {
    // Header & Theme
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeIconSun: document.getElementById('themeIconSun'),
    themeIconMoon: document.getElementById('themeIconMoon'),
    engineBadgeText: document.getElementById('engineBadgeText'),
    headerProfileAvatar: document.getElementById('headerProfileAvatar'),
    headerProfileName: document.getElementById('headerProfileName'),
    profileBtn: document.getElementById('profileBtn'),
    openCompareBtn: document.getElementById('openCompareBtn'),
    
    // Search & Geolocation
    citySearchInput: document.getElementById('citySearchInput'),
    searchDropdown: document.getElementById('searchDropdown'),
    locateMeBtn: document.getElementById('locateMeBtn'),
    refreshDataBtn: document.getElementById('refreshDataBtn'),
    currentLocationName: document.getElementById('currentLocationName'),
    currentLocationCoords: document.getElementById('currentLocationCoords'),

    // Conditions Card
    weatherConditionPill: document.getElementById('weatherConditionPill'),
    weatherConditionIcon: document.getElementById('weatherConditionIcon'),
    weatherConditionText: document.getElementById('weatherConditionText'),
    tempValue: document.getElementById('tempValue'),
    feelsLikeValue: document.getElementById('feelsLikeValue'),
    conditionsTimestamp: document.getElementById('conditionsTimestamp'),
    aqiValue: document.getElementById('aqiValue'),
    aqiRingProgress: document.getElementById('aqiRingProgress'),
    aqiCategoryBadge: document.getElementById('aqiCategoryBadge'),
    pm25Value: document.getElementById('pm25Value'),
    pm10Value: document.getElementById('pm10Value'),
    humidityValue: document.getElementById('humidityValue'),
    windValue: document.getElementById('windValue'),

    // Advisory Card
    advisoryCard: document.getElementById('advisoryCard'),
    advisoryGlow: document.getElementById('advisoryGlow'),
    advisoryEngineTag: document.getElementById('advisoryEngineTag'),
    riskBadge: document.getElementById('riskBadge'),
    riskLevelText: document.getElementById('riskLevelText'),
    advisorySkeleton: document.getElementById('advisorySkeleton'),
    advisoryContent: document.getElementById('advisoryContent'),
    advisoryProfileTag: document.getElementById('advisoryProfileTag'),
    quickEditProfileBtn: document.getElementById('quickEditProfileBtn'),
    advisoryHeadline: document.getElementById('advisoryHeadline'),
    advisoryText: document.getElementById('advisoryText'),
    recsList: document.getElementById('recsList'),
    speakAdvisoryBtn: document.getElementById('speakAdvisoryBtn'),
    speakBtnText: document.getElementById('speakBtnText'),

    // History & Trends
    seedDemoHistoryBtn: document.getElementById('seedDemoHistoryBtn'),
    historyList: document.getElementById('historyList'),

    // Profile Modal
    profileModal: document.getElementById('profileModal'),
    closeProfileModalBtn: document.getElementById('closeProfileModalBtn'),
    cancelProfileBtn: document.getElementById('cancelProfileBtn'),
    profileForm: document.getElementById('profileForm'),
    profNameInput: document.getElementById('profNameInput'),
    condNoneCheckbox: document.getElementById('condNoneCheckbox'),
    presetHealthyBtn: document.getElementById('presetHealthyBtn'),
    presetAsthmaBtn: document.getElementById('presetAsthmaBtn'),
    presetOutdoorBtn: document.getElementById('presetOutdoorBtn'),

    // Compare Modal
    compareModal: document.getElementById('compareModal'),
    closeCompareModalBtn: document.getElementById('closeCompareModalBtn'),
    compareConditionsSummary: document.getElementById('compareConditionsSummary'),
    compareResultA: document.getElementById('compareResultA'),
    compareResultB: document.getElementById('compareResultB'),
    regenerateCompareBtn: document.getElementById('regenerateCompareBtn'),

    // Toasts
    toastContainer: document.getElementById('toastContainer'),
  };

  // Initialize
  init();

  async function init() {
    initTheme();
    initStateFromStorage();
    initChart();
    bindEvents();

    // Check backend health & AI engine
    checkBackendHealth();

    // Attempt geolocation if no saved location or load default
    if (!localStorage.getItem('aerocare_last_location')) {
      detectGeolocation(false);
    } else {
      loadConditionsAndAdvisory();
    }
  }

  // ----------------- Themes -----------------
  function initTheme() {
    const savedTheme = localStorage.getItem('aerocare_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('aerocare_theme', next);
    updateThemeIcons(next);
    if (state.chart) state.chart.render();
  }

  function updateThemeIcons(theme) {
    if (theme === 'light') {
      els.themeIconSun.classList.add('hidden');
      els.themeIconMoon.classList.remove('hidden');
    } else {
      els.themeIconSun.classList.remove('hidden');
      els.themeIconMoon.classList.add('hidden');
    }
  }

  // ----------------- Local Storage & State -----------------
  function initStateFromStorage() {
    const savedProf = localStorage.getItem('aerocare_profile');
    if (savedProf) {
      try {
        state.profile = JSON.parse(savedProf);
      } catch (e) {
        state.profile = null;
      }
    }

    if (!state.profile) {
      // Default profile: Healthy adult
      state.profile = {
        id: 'prof-' + Math.random().toString(36).substring(2, 9),
        name: 'Alex (Personal)',
        age_group: 'adult',
        health_conditions: ['none'],
        occupation_exposure: 'mostly_indoor',
      };
      localStorage.setItem('aerocare_profile', JSON.stringify(state.profile));
    }

    const savedLoc = localStorage.getItem('aerocare_last_location');
    if (savedLoc) {
      try {
        state.location = JSON.parse(savedLoc);
      } catch (e) {}
    }

    updateProfileHeaderDisplay();
  }

  function updateProfileHeaderDisplay() {
    if (!state.profile) return;
    els.headerProfileName.textContent = state.profile.name || 'My Profile';

    // Emoji icon based on conditions
    let icon = '👤';
    if (state.profile.health_conditions.includes('asthma')) icon = '🫁';
    else if (state.profile.health_conditions.includes('heart_condition')) icon = '❤️';
    else if (state.profile.health_conditions.includes('pregnant')) icon = '🤰';
    else if (state.profile.occupation_exposure === 'outdoor_worker') icon = '👷';
    else if (state.profile.occupation_exposure === 'athlete') icon = '🚴';

    els.headerProfileAvatar.textContent = icon;
  }

  // ----------------- Chart Initialization -----------------
  function initChart() {
    state.chart = new TrendChart('trendChartCanvas');
  }

  // ----------------- API Integration & Data Flow -----------------
  async function checkBackendHealth() {
    try {
      const h = await API.getHealth();
      if (h.ai_engine) {
        els.engineBadgeText.textContent = h.ai_engine;
      }
    } catch (e) {}
  }

  async function loadConditionsAndAdvisory() {
    const { lat, lon, label } = state.location;

    // Update location banner
    els.currentLocationName.textContent = label || 'Atmospheric Station';
    els.currentLocationCoords.textContent = `Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;

    try {
      // Step 1: Fetch and render raw atmospheric conditions immediately (Fast UX beat)
      const snapshot = await API.getConditions(lat, lon, label);
      state.conditions = snapshot;
      renderConditions(snapshot);

      // Step 2: Show loading skeleton for personalized advisory
      showAdvisorySkeleton(true);

      // Step 3: Call AI Advisory generation
      const advisory = await API.generateAdvisory(snapshot, state.profile);
      state.advisory = advisory;
      renderAdvisory(advisory);

      // Step 4: Refresh 7-day history trend
      loadHistory();
    } catch (err) {
      console.error('Data flow error:', err);
      showToast(err.message || 'Failed to fetch atmospheric data', 'error');
      showAdvisorySkeleton(false);
    }
  }

  function renderConditions(snapshot) {
    const { weather, aqi } = snapshot;

    // Weather
    els.tempValue.textContent = Math.round(weather.temp_c);
    els.feelsLikeValue.textContent = `${weather.feels_like_c}°C`;
    els.weatherConditionText.textContent = weather.condition;
    els.weatherConditionIcon.textContent = getWeatherIcon(weather.weather_code);
    els.humidityValue.textContent = weather.humidity_pct;
    els.windValue.textContent = weather.wind_kmh;

    const dt = new Date(snapshot.timestamp);
    els.conditionsTimestamp.textContent = `Live as of ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    // AQI Gauge
    const aqiVal = aqi.overall_aqi;
    els.aqiValue.textContent = aqiVal;
    els.pm25Value.textContent = aqi.pm2_5;
    els.pm10Value.textContent = aqi.pm10;

    // Color & Badge
    const catLabel = aqi.category.replace(/_/g, ' ');
    els.aqiCategoryBadge.textContent = catLabel;
    els.aqiCategoryBadge.style.backgroundColor = `${aqi.color}25`;
    els.aqiCategoryBadge.style.color = aqi.color;

    // Update circular progress ring
    // Circumference = 2 * PI * 50 = 314
    const maxAqiDisplay = 300;
    const progressPct = Math.min(Math.max(aqiVal / maxAqiDisplay, 0), 1);
    const strokeOffset = 314 - (progressPct * 314);
    els.aqiRingProgress.style.strokeDashoffset = strokeOffset;
    els.aqiRingProgress.style.stroke = aqi.color;
  }

  function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '🌤️';
  }

  function showAdvisorySkeleton(show) {
    if (show) {
      els.advisorySkeleton.classList.remove('hidden');
      els.advisoryContent.classList.add('hidden');
    } else {
      els.advisorySkeleton.classList.add('hidden');
      els.advisoryContent.classList.remove('hidden');
    }
  }

  function renderAdvisory(advisory) {
    showAdvisorySkeleton(false);

    // Engine Tag
    if (advisory.engine) {
      els.advisoryEngineTag.textContent = advisory.engine;
    }

    // Risk level badge & styling
    const risk = (advisory.risk_level || 'low').toLowerCase();
    els.riskLevelText.textContent = `${risk.toUpperCase()} RISK`;
    els.riskBadge.className = `risk-level-badge risk-${risk}`;

    // Glow tint
    const glowColors = {
      low: 'rgba(16, 185, 129, 0.35)',
      moderate: 'rgba(245, 158, 11, 0.35)',
      high: 'rgba(239, 68, 68, 0.45)',
      severe: 'rgba(225, 29, 72, 0.55)',
    };
    els.advisoryGlow.style.background = glowColors[risk] || glowColors.low;

    // Profile summary pill inside card
    const conds = state.profile.health_conditions.filter(c => c !== 'none');
    const condText = conds.length > 0 ? conds.map(capitalize).join(', ') : 'Healthy Baseline';
    const exposureText = state.profile.occupation_exposure.replace(/_/g, ' ');
    els.advisoryProfileTag.textContent = `${capitalize(state.profile.age_group)} • ${capitalize(exposureText)} • ${condText}`;

    // Texts
    els.advisoryHeadline.textContent = advisory.headline;
    els.advisoryText.textContent = advisory.advisory_text;

    // Actionable Recommendations
    els.recsList.innerHTML = '';
    const recs = advisory.recommendations || [];
    recs.forEach((rec) => {
      const li = document.createElement('li');
      li.className = 'rec-item';
      li.innerHTML = `
        <div class="rec-check-icon">✓</div>
        <span>${rec}</span>
      `;
      els.recsList.appendChild(li);
    });
  }

  async function loadHistory() {
    if (!state.profile) return;
    try {
      const data = await API.getHistory(state.profile.id, 7);
      state.history = data.history || [];
      
      // Update chart
      if (state.chart) {
        state.chart.setData(state.history);
      }

      // Render expandable history cards
      renderHistoryList(state.history);
    } catch (e) {
      console.warn('History load warning:', e);
    }
  }

  function renderHistoryList(history) {
    els.historyList.innerHTML = '';
    if (history.length === 0) {
      els.historyList.innerHTML = `
        <div class="empty-log-state">
          <p>No historical advisories logged yet for this profile. As you refresh or change locations, your personalized advisories will be archived here.</p>
        </div>
      `;
      return;
    }

    history.forEach((item) => {
      const d = new Date(item.timestamp);
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const risk = (item.risk_level || 'low').toLowerCase();
      const aqi = item.conditions_snapshot?.aqi?.overall_aqi || '--';
      const temp = item.conditions_snapshot?.weather?.temp_c || '--';
      const label = item.conditions_snapshot?.location?.label || 'Recorded Location';

      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-summary-row">
          <div class="history-date-col">
            <span class="history-date">${dateStr} • ${timeStr}</span>
            <span class="history-location">${label} • ${temp}°C</span>
          </div>
          <div class="history-metrics-pill">
            <span class="history-aqi-pill" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">AQI ${aqi}</span>
            <span class="risk-level-badge risk-${risk}" style="padding: 0.2rem 0.6rem; font-size: 0.72rem;">${risk.toUpperCase()}</span>
          </div>
        </div>
        <div class="history-expanded-body">
          <h5 class="history-headline">${item.headline}</h5>
          <p class="history-text">${item.advisory_text}</p>
          <ul class="history-recs-mini">
            ${(item.recommendations || []).map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      `;
      els.historyList.appendChild(div);
    });
  }

  // ----------------- Geolocation & City Search -----------------
  function detectGeolocation(showToastNotice = true) {
    if (!navigator.geolocation) {
      if (showToastNotice) showToast('Geolocation not supported by browser. Search manually.', 'warning');
      return;
    }

    if (showToastNotice) showToast('Detecting location via GPS...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        state.location = {
          lat,
          lon,
          label: 'Local Position',
        };
        localStorage.setItem('aerocare_last_location', JSON.stringify(state.location));
        showToast('Location updated via GPS', 'success');
        loadConditionsAndAdvisory();
      },
      (err) => {
        console.warn('Geolocation denied/failed:', err);
        if (showToastNotice) {
          showToast('Geolocation permission denied. Showing default location.', 'warning');
        }
        loadConditionsAndAdvisory();
      },
      { timeout: 8000 }
    );
  }

  let searchDebounceTimer = null;
  function handleCitySearchInput(e) {
    const query = e.target.value.trim();
    clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
      els.searchDropdown.classList.add('hidden');
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      const results = await API.searchCities(query);
      renderSearchDropdown(results);
    }, 280);
  }

  function renderSearchDropdown(results) {
    if (!results || results.length === 0) {
      els.searchDropdown.innerHTML = `<div class="dropdown-item"><span class="dropdown-item-meta">No matching cities found</span></div>`;
      els.searchDropdown.classList.remove('hidden');
      return;
    }

    els.searchDropdown.innerHTML = '';
    results.forEach((city) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.innerHTML = `
        <div class="dropdown-item-text">
          <span class="dropdown-item-name">${city.name}</span>
          <span class="dropdown-item-meta">${city.label}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        state.location = {
          lat: city.lat,
          lon: city.lon,
          label: city.label,
        };
        localStorage.setItem('aerocare_last_location', JSON.stringify(state.location));
        els.citySearchInput.value = '';
        els.searchDropdown.classList.add('hidden');
        showToast(`Switched to ${city.name}`, 'success');
        loadConditionsAndAdvisory();
      });
      els.searchDropdown.appendChild(item);
    });

    els.searchDropdown.classList.remove('hidden');
  }

  // ----------------- Profile Management Modal -----------------
  function openProfileModal() {
    populateProfileForm(state.profile);
    els.profileModal.classList.remove('hidden');
  }

  function closeProfileModal() {
    els.profileModal.classList.add('hidden');
  }

  function populateProfileForm(profile) {
    if (!profile) return;
    els.profNameInput.value = profile.name || '';

    // Age radio
    const ageRadio = els.profileForm.querySelector(`input[name="age_group"][value="${profile.age_group}"]`);
    if (ageRadio) ageRadio.checked = true;

    // Occupation radio
    const occRadio = els.profileForm.querySelector(`input[name="occupation_exposure"][value="${profile.occupation_exposure}"]`);
    if (occRadio) occRadio.checked = true;

    // Conditions checkboxes
    const condBoxes = els.profileForm.querySelectorAll(`input[name="health_conditions"]`);
    condBoxes.forEach((cb) => {
      cb.checked = (profile.health_conditions || []).includes(cb.value);
    });
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();

    const name = els.profNameInput.value.trim() || 'My Profile';
    const ageGroup = els.profileForm.querySelector('input[name="age_group"]:checked')?.value || 'adult';
    const exposure = els.profileForm.querySelector('input[name="occupation_exposure"]:checked')?.value || 'mostly_indoor';

    const checkedConds = Array.from(
      els.profileForm.querySelectorAll('input[name="health_conditions"]:checked')
    ).map(cb => cb.value);

    const conditions = checkedConds.length > 0 ? checkedConds : ['none'];

    const newProfile = {
      id: state.profile?.id || ('prof-' + Math.random().toString(36).substring(2, 9)),
      name,
      age_group: ageGroup,
      health_conditions: conditions,
      occupation_exposure: exposure,
    };

    try {
      const saved = await API.saveProfile(newProfile);
      state.profile = saved;
      localStorage.setItem('aerocare_profile', JSON.stringify(saved));
      updateProfileHeaderDisplay();
      closeProfileModal();
      showToast('Health profile updated successfully', 'success');

      // Re-generate advisory for current conditions with new profile!
      if (state.conditions) {
        showAdvisorySkeleton(true);
        const advisory = await API.generateAdvisory(state.conditions, state.profile);
        state.advisory = advisory;
        renderAdvisory(advisory);
        loadHistory();
      }
    } catch (err) {
      showToast('Failed to save profile', 'error');
    }
  }

  // Quick Preset Handlers
  function applyPreset(age, conditions, exposure, name) {
    populateProfileForm({
      name,
      age_group: age,
      health_conditions: conditions,
      occupation_exposure: exposure,
    });
    showToast(`Loaded preset: ${name}`, 'info');
  }

  // ----------------- Judge Demo: Side-by-Side Comparator -----------------
  async function openCompareModal() {
    if (!state.conditions) {
      showToast('Please wait for live atmospheric conditions to load', 'warning');
      return;
    }

    const { weather, aqi, location } = state.conditions;
    els.compareConditionsSummary.textContent = 
      `Atmosphere: ${location.label} • AQI ${aqi.overall_aqi} (${aqi.category}) • Temp ${weather.temp_c}°C • PM2.5 ${aqi.pm2_5} µg/m³`;

    els.compareModal.classList.remove('hidden');
    runSideBySideComparison();
  }

  function closeCompareModal() {
    els.compareModal.classList.add('hidden');
  }

  async function runSideBySideComparison() {
    const profileHealthy = {
      name: 'Healthy Adult Office Worker',
      age_group: 'adult',
      health_conditions: ['none'],
      occupation_exposure: 'mostly_indoor',
    };

    const profileVulnerable = {
      name: 'Senior w/ Asthma & Outdoor Labor',
      age_group: 'senior',
      health_conditions: ['asthma', 'heart_condition'],
      occupation_exposure: 'outdoor_worker',
    };

    els.compareResultA.innerHTML = '<div class="skeleton-line shimmer"></div><div class="skeleton-line shimmer"></div>';
    els.compareResultB.innerHTML = '<div class="skeleton-line shimmer"></div><div class="skeleton-line shimmer"></div>';

    try {
      const res = await API.compareProfiles(profileHealthy, profileVulnerable, state.conditions);
      renderCompareColumn(els.compareResultA, res.profile_a.advisory);
      renderCompareColumn(els.compareResultB, res.profile_b.advisory);
    } catch (e) {
      showToast('Failed to execute comparison', 'error');
    }
  }

  function renderCompareColumn(container, advisory) {
    const risk = (advisory.risk_level || 'low').toLowerCase();
    container.innerHTML = `
      <div class="compare-risk-pill risk-${risk}">${risk.toUpperCase()} RISK</div>
      <h5 class="compare-headline">${advisory.headline}</h5>
      <p class="compare-text">${advisory.advisory_text}</p>
      <ul class="compare-recs">
        ${(advisory.recommendations || []).map(r => `<li>${r}</li>`).join('')}
      </ul>
    `;
  }

  // ----------------- Demo Data Seeding -----------------
  async function handleSeedDemoHistory() {
    if (!state.profile) return;
    try {
      showToast('Seeding 7-day realistic atmospheric variation...', 'info');
      const res = await API.seedDemoHistory(state.profile.id, state.location.label);
      showToast(`Seeded ${res.seeded_records} days of trend history!`, 'success');
      loadHistory();
    } catch (e) {
      showToast('Failed to seed history', 'error');
    }
  }

  // ----------------- Speech Synthesis (Read Aloud) -----------------
  function toggleSpeechAdvisory() {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech is not supported in this browser', 'warning');
      return;
    }

    if (state.isSpeaking) {
      window.speechSynthesis.cancel();
      state.isSpeaking = false;
      els.speakBtnText.textContent = 'Read Aloud';
      return;
    }

    if (!state.advisory) return;

    const textToSpeak = `${state.advisory.headline}. ${state.advisory.advisory_text}. Recommended actions: ${state.advisory.recommendations.join('. ')}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      state.isSpeaking = true;
      els.speakBtnText.textContent = 'Stop Audio';
    };

    utterance.onend = () => {
      state.isSpeaking = false;
      els.speakBtnText.textContent = 'Read Aloud';
    };

    utterance.onerror = () => {
      state.isSpeaking = false;
      els.speakBtnText.textContent = 'Read Aloud';
    };

    window.speechSynthesis.speak(utterance);
  }

  // ----------------- Toast Notifications -----------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ----------------- Event Listeners -----------------
  function bindEvents() {
    // Theme
    els.themeToggleBtn.addEventListener('click', toggleTheme);

    // Search & Geolocation
    els.locateMeBtn.addEventListener('click', () => detectGeolocation(true));
    els.refreshDataBtn.addEventListener('click', () => {
      showToast('Refreshing live atmospheric metrics...', 'info');
      loadConditionsAndAdvisory();
    });
    els.citySearchInput.addEventListener('input', handleCitySearchInput);

    // Close search dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!els.citySearchInput.contains(e.target) && !els.searchDropdown.contains(e.target)) {
        els.searchDropdown.classList.add('hidden');
      }
    });

    // Profile Modal
    els.profileBtn.addEventListener('click', openProfileModal);
    els.quickEditProfileBtn.addEventListener('click', openProfileModal);
    els.closeProfileModalBtn.addEventListener('click', closeProfileModal);
    els.cancelProfileBtn.addEventListener('click', closeProfileModal);
    els.profileForm.addEventListener('submit', handleProfileSubmit);

    // Checkbox mutually exclusive helper: If 'none' checked, uncheck others. If others checked, uncheck 'none'.
    els.condNoneCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        const others = els.profileForm.querySelectorAll('input[name="health_conditions"]:not(#condNoneCheckbox)');
        others.forEach(cb => cb.checked = false);
      }
    });

    const otherConds = els.profileForm.querySelectorAll('input[name="health_conditions"]:not(#condNoneCheckbox)');
    otherConds.forEach((cb) => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          els.condNoneCheckbox.checked = false;
        }
      });
    });

    // Quick Presets
    els.presetHealthyBtn.addEventListener('click', () => {
      applyPreset('adult', ['none'], 'mostly_indoor', 'Healthy Adult');
    });
    els.presetAsthmaBtn.addEventListener('click', () => {
      applyPreset('senior', ['asthma', 'heart_condition'], 'outdoor_worker', 'Senior with Asthma');
    });
    els.presetOutdoorBtn.addEventListener('click', () => {
      applyPreset('adult', ['none'], 'outdoor_worker', 'Outdoor Worker');
    });

    // Compare Modal
    els.openCompareBtn.addEventListener('click', openCompareModal);
    els.closeCompareModalBtn.addEventListener('click', closeCompareModal);
    els.regenerateCompareBtn.addEventListener('click', runSideBySideComparison);

    // Seed Demo History
    els.seedDemoHistoryBtn.addEventListener('click', handleSeedDemoHistory);

    // Audio Read Aloud
    els.speakAdvisoryBtn.addEventListener('click', toggleSpeechAdvisory);
  }
});
