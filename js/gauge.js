// ================================================================
//  gauge.js — SVG Arc Gauge Rendering & Real-Time Updates
// ================================================================

// Arc Geometry Constants (270° gauge sweep)
const GAUGE_RADIUS = 85;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS; // ≈ 534.07
const GAUGE_SWEEP_DEG = 270;
const GAUGE_TOTAL_LENGTH = (GAUGE_SWEEP_DEG / 360) * GAUGE_CIRCUMFERENCE; // ≈ 400.55

/**
 * Update the SVG arc path stroke, color, and central readout
 * @param {number} moisture - Value between 0 and 100
 */
function updateGauge(moisture) {
  const valueArc = document.getElementById('gauge-value-arc');
  const valEl = document.getElementById('gauge-pct-num');
  const pillEl = document.getElementById('gauge-status-pill');
  if (!valueArc || !valEl) return;

  const clamped = Math.max(0, Math.min(100, moisture));
  
  // Calculate stroke-dashoffset (401 is empty, 0 is 100% full)
  const offset = GAUGE_TOTAL_LENGTH - (clamped / 100) * GAUGE_TOTAL_LENGTH;
  valueArc.style.strokeDashoffset = offset.toFixed(1);

  // Set number display
  valEl.textContent = clamped.toFixed(0);

  // Color shifting: Red (dry) -> Amber (30-70) -> Green (optimal/wet >70)
  valueArc.classList.remove('gauge-dry', 'gauge-warn', 'gauge-optimal', 'gauge-wet');
  if (pillEl) {
    pillEl.classList.remove('badge-danger', 'badge-warning', 'badge-success', 'badge-info');
  }

  if (clamped < DRY_THRESHOLD) {
    valueArc.classList.add('gauge-dry');
    valEl.style.color = 'var(--red)';
    valEl.style.textShadow = '0 0 16px var(--red-glow)';
    if (pillEl) {
      pillEl.textContent = 'CRITICAL DRY (<30%)';
      pillEl.classList.add('badge-danger');
    }
  } else if (clamped < 65) {
    valueArc.classList.add('gauge-warn');
    valEl.style.color = 'var(--amber)';
    valEl.style.textShadow = '0 0 16px var(--amber-glow)';
    if (pillEl) {
      pillEl.textContent = 'MODERATE MOISTURE';
      pillEl.classList.add('badge-warning');
    }
  } else if (clamped <= WET_THRESHOLD) {
    valueArc.classList.add('gauge-optimal');
    valEl.style.color = 'var(--lime)';
    valEl.style.textShadow = '0 0 16px var(--lime-glow)';
    if (pillEl) {
      pillEl.textContent = 'OPTIMAL MOISTURE';
      pillEl.classList.add('badge-success');
    }
  } else {
    valueArc.classList.add('gauge-wet');
    valEl.style.color = 'var(--cyan)';
    valEl.style.textShadow = '0 0 16px var(--cyan-glow)';
    if (pillEl) {
      pillEl.textContent = 'SATURATED / WET (>80%)';
      pillEl.classList.add('badge-info');
    }
  }
}

// Attach to window
window.updateGauge = updateGauge;
window.GAUGE_TOTAL_LENGTH = GAUGE_TOTAL_LENGTH;
