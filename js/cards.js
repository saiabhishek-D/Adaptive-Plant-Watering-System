// ================================================================
//  cards.js — Updates for Phase, Pump, Buzzer, & Prediction Cards
// ================================================================

/**
 * Updates all right-hand cards and status indicators
 */
function updateCards() {
  updatePhaseCard();
  updatePumpCard();
  updateBuzzerCard();
  updatePredictionCard();
}

/**
 * Update Phase Progress Bar & Sliding Glowing Dot
 */
function updatePhaseCard() {
  const phaseBadge = document.getElementById('phase-name-badge');
  const phasePctBadge = document.getElementById('phase-pct-badge');
  const dotEl = document.getElementById('phase-indicator-dot');
  const elapsedStat = document.getElementById('stat-elapsed-val');
  const predStat = document.getElementById('stat-pred-val');

  const currentPhaseName = PHASE_NAMES[state.phase];
  const phaseClass = currentPhaseName.toLowerCase();

  if (phaseBadge) {
    phaseBadge.textContent = currentPhaseName;
    phaseBadge.className = `phase-name-badge ${phaseClass}`;
  }

  // Calculate percentage of cycle elapsed (0% to 100%+)
  const pct = state.predSeconds > 0
    ? (state.elapsedSeconds / state.predSeconds) * 100
    : 0;

  if (phasePctBadge) {
    phasePctBadge.textContent = `${pct.toFixed(0)}% elapsed`;
  }

  // Sliding dot position (clamped 0% to 100% on the bar)
  if (dotEl) {
    const clampedPct = Math.min(100, Math.max(0, pct));
    dotEl.style.left = `${clampedPct}%`;
    dotEl.className = `phase-indicator-dot ${phaseClass}`;
  }

  if (elapsedStat) {
    elapsedStat.textContent = `${state.elapsedHours.toFixed(1)}h`;
  }
  if (predStat) {
    predStat.textContent = `${state.predictedHours.toFixed(1)}h`;
  }
}

/**
 * Update Pump Status Card (Water drop ripple & pulse)
 */
function updatePumpCard() {
  const card = document.getElementById('card-pump');
  const statusLabel = document.getElementById('pump-status-label');
  const subtext = document.getElementById('pump-subtext');
  if (!card || !statusLabel) return;

  if (state.pumpActive) {
    card.classList.add('active');
    statusLabel.textContent = 'PUMP ACTIVE';
    if (subtext) subtext.textContent = 'Submerged DC Relay Energized (2.0s)';
  } else {
    card.classList.remove('active');
    statusLabel.textContent = 'PUMP OFF';
    if (subtext) subtext.textContent = 'Standby mode — monitoring thresholds';
  }
}

/**
 * Update Buzzer / Anomaly Card (WATERLOG or RAPID DRY)
 */
function updateBuzzerCard() {
  const card = document.getElementById('card-buzzer');
  const statusLabel = document.getElementById('buzzer-status-label');
  const subtext = document.getElementById('buzzer-subtext');
  if (!card || !statusLabel) return;

  card.classList.remove('state-amber', 'state-red');

  if (state.anomaly === 'WATERLOG') {
    card.classList.add('state-amber');
    statusLabel.textContent = 'WATERLOG DETECTED';
    if (subtext) subtext.textContent = 'Moisture >80% exceeds 1.5× predicted window';
  } else if (state.anomaly === 'RAPID DRY') {
    card.classList.add('state-red');
    statusLabel.textContent = 'RAPID DRY DETECTED';
    if (subtext) subtext.textContent = 'Moisture <30% reached in <0.5× predicted window';
  } else {
    statusLabel.textContent = 'ALL CLEAR';
    if (subtext) subtext.textContent = 'Hydration patterns within normal bounds';
  }
}

/**
 * Update Prediction Card (Next water countdown, EMA, and ML model comparison)
 */
function updatePredictionCard() {
  const nextWaterEl = document.getElementById('pred-highlight-text');
  const subLabelEl = document.getElementById('pred-sub-label');
  const emaTileVal = document.getElementById('pred-ema-val');
  const mlTileVal = document.getElementById('pred-ml-val');

  const hoursRemaining = getHoursUntilWater();

  if (nextWaterEl) {
    nextWaterEl.textContent = `NEXT WATER IN: ${hoursRemaining.toFixed(1)}h`;
  }

  if (subLabelEl) {
    subLabelEl.textContent = `EMA α=${EMA_ALPHA} | Cycle #${state.cycleCount}`;
  }

  if (emaTileVal) {
    emaTileVal.textContent = `${state.predictedHours.toFixed(1)}h`;
  }

  if (mlTileVal) {
    mlTileVal.textContent = state.mlPrediction !== null
      ? `${state.mlPrediction.toFixed(1)}h`
      : `${state.predictedHours.toFixed(1)}h`;
  }

  const mlConfTag = document.getElementById('ml-conf-tag');
  if (mlConfTag && state.modelReady) {
    mlConfTag.textContent = `Conf: ${state.mlConfidence.toFixed(0)}%`;
  }
}

// Attach to window
window.updateCards = updateCards;
window.updatePhaseCard = updatePhaseCard;
window.updatePumpCard = updatePumpCard;
window.updateBuzzerCard = updateBuzzerCard;
window.updatePredictionCard = updatePredictionCard;
