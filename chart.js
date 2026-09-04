/**
 * AeroCare AI - Interactive Trend Chart
 * Renders high-DPI canvas line graphs for AQI and Risk Level over 7 days.
 */

class TrendChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.data = [];
    this.hoverIndex = -1;
    this.initEvents();
  }

  initEvents() {
    if (!this.canvas) return;

    window.addEventListener('resize', () => this.render());

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pointSpacing = rect.width / Math.max(this.data.length - 1, 1);
      const index = Math.round(x / pointSpacing);

      if (index >= 0 && index < this.data.length) {
        if (this.hoverIndex !== index) {
          this.hoverIndex = index;
          this.render();
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hoverIndex !== -1) {
        this.hoverIndex = -1;
        this.render();
      }
    });
  }

  setData(historyItems) {
    // Reverse chronological into forward chronological order (oldest to newest)
    const sorted = [...historyItems].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    this.data = sorted.map((item) => {
      const d = new Date(item.timestamp);
      const dateLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
      const aqi = item.conditions_snapshot?.aqi?.overall_aqi || 50;
      
      const riskMapping = { low: 1, moderate: 2, high: 3, severe: 4 };
      const riskScore = riskMapping[item.risk_level?.toLowerCase()] || 1;

      return {
        dateLabel,
        rawTimestamp: item.timestamp,
        aqi,
        riskScore,
        riskLevel: item.risk_level || 'low',
        headline: item.headline || 'Advisory',
        pm25: item.conditions_snapshot?.aqi?.pm2_5 || '--',
        temp: item.conditions_snapshot?.weather?.temp_c || '--'
      };
    });

    const emptyState = document.getElementById('chartEmptyState');
    if (this.data.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      if (emptyState) emptyState.classList.add('hidden');
      this.render();
    }
  }

  render() {
    if (!this.canvas || !this.ctx || this.data.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // Layout Margins
    const padding = { top: 25, right: 35, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Scales
    const maxAqi = Math.max(200, ...this.data.map(d => d.aqi));
    const aqiY = (val) => padding.top + chartH - (val / maxAqi) * chartH;
    const riskY = (val) => padding.top + chartH - ((val - 1) / 3) * chartH;
    const getX = (idx) => {
      if (this.data.length === 1) return padding.left + chartW / 2;
      return padding.left + (idx / (this.data.length - 1)) * chartW;
    };

    // Draw horizontal grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const aqiLevel = Math.round((maxAqi / gridSteps) * i);
      const y = aqiY(aqiLevel);
      
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillText(aqiLevel.toString(), padding.left - 8, y + 3);
    }

    // Draw X-axis date labels
    ctx.textAlign = 'center';
    this.data.forEach((item, idx) => {
      const x = getX(idx);
      ctx.fillText(item.dateLabel, x, height - 10);
    });

    // 1. Draw AQI Area & Line
    const aqiGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    aqiGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    aqiGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), aqiY(this.data[0].aqi));
    for (let i = 1; i < this.data.length; i++) {
      const prevX = getX(i - 1);
      const prevY = aqiY(this.data[i - 1].aqi);
      const curX = getX(i);
      const curY = aqiY(this.data[i].aqi);
      const cpX = (prevX + curX) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, curY, curX, curY);
    }

    // Fill area
    ctx.lineTo(getX(this.data.length - 1), padding.top + chartH);
    ctx.lineTo(getX(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = aqiGrad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(getX(0), aqiY(this.data[0].aqi));
    for (let i = 1; i < this.data.length; i++) {
      const prevX = getX(i - 1);
      const prevY = aqiY(this.data[i - 1].aqi);
      const curX = getX(i);
      const curY = aqiY(this.data[i].aqi);
      const cpX = (prevX + curX) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, curY, curX, curY);
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2. Draw Risk Level Line (Dashed crimson/amber)
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(getX(0), riskY(this.data[0].riskScore));
    for (let i = 1; i < this.data.length; i++) {
      const curX = getX(i);
      const curY = riskY(this.data[i].riskScore);
      ctx.lineTo(curX, curY);
    }
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 3. Draw Data Points
    this.data.forEach((item, idx) => {
      const x = getX(idx);
      const yAqi = aqiY(item.aqi);
      const yRisk = riskY(item.riskScore);

      // AQI point
      ctx.beginPath();
      ctx.arc(x, yAqi, idx === this.hoverIndex ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0e17';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Risk point
      ctx.beginPath();
      ctx.arc(x, yRisk, idx === this.hoverIndex ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
    });

    // 4. Render Hover Tooltip
    if (this.hoverIndex >= 0 && this.hoverIndex < this.data.length) {
      const item = this.data[this.hoverIndex];
      const hx = getX(this.hoverIndex);
      const hy = aqiY(item.aqi);

      // Vertical guideline
      ctx.beginPath();
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, padding.top + chartH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tooltip Card
      const ttW = 160;
      const ttH = 75;
      let ttX = hx - ttW / 2;
      if (ttX < padding.left) ttX = padding.left;
      if (ttX + ttW > width - padding.right) ttX = width - padding.right - ttW;
      const ttY = Math.max(padding.top, hy - ttH - 12);

      ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(ttX, ttY, ttW, ttH, 8);
      ctx.fill();
      ctx.stroke();

      // Tooltip Texts
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.fillText(item.dateLabel, ttX + 10, ttY + 18);

      ctx.font = '11px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`AQI: ${item.aqi} • Temp: ${item.temp}°C`, ttX + 10, ttY + 36);

      const riskColorMap = { low: '#10b981', moderate: '#f59e0b', high: '#ef4444', severe: '#e11d48' };
      ctx.fillStyle = riskColorMap[item.riskLevel.toLowerCase()] || '#f59e0b';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.fillText(`Risk: ${item.riskLevel.toUpperCase()}`, ttX + 10, ttY + 54);
    }
  }
}

window.TrendChart = TrendChart;
