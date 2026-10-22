// ================================================================
//  simulation.js — Core Arduino logic for Plant Watering System
//  Implements: EMA, Phases, Anomaly Detection, Pump Timing, Auto-Sim
// ================================================================

// Arduino pin & algorithm constants
const DRY_THRESHOLD    = 30;
const WET_THRESHOLD    = 80;
const EMA_ALPHA        = 0.25;             // Optimal α=0.25: balanced noise-dampening & seasonal adaptability (N≈7 cycles)
const TIME_SCALE       = 3600;             // 1 real second = 1 sim hour (3600 sim seconds)
const PUMP_DURATION_MS = 2000;             // 2 seconds pump run
const SIM_TICK_MS      = 50;               // 50ms simulation loop

// Phase definitions
const PHASE = Object.freeze({
  EARLY: 0,
  MID: 1,
  LATE: 2,
  OVERDUE: 3
});

const PHASE_NAMES = ['EARLY', 'MID', 'LATE', 'OVERDUE'];
const PHASE_RANGES = ['0-70%', '70-90%', '90-100%', '>100%'];

// Poll interval per phase in real ms (4h, 2h, 1h, 10m in sim time)
// 4h sim = 4000ms, 2h sim = 2000ms, 1h sim = 1000ms, 10m sim = 166ms (clamped to 500ms)
function pollMs(phase) {
  switch (phase) {
    case PHASE.EARLY:   return 4000;
    case PHASE.MID:     return 2000;
    case PHASE.LATE:    return 1000;
    case PHASE.OVERDUE: return 500;
    default:            return 2000;
  }
}

// Shared DOM selector helper
function $(id) {
  return document.getElementById(id);
}
window.$ = $;

// Global System State
const state = {
  moisture: 75,
  waterMs: Date.now(),
  predSeconds: 86400,             // 24 hours initial prediction
  elapsedSeconds: 0,
  elapsedHours: 0,
  predictedHours: 24,
  phase: PHASE.EARLY,

  pumpActive: false,
  pumpStartTime: 0,
  buzzerActive: false,
  buzzerReason: '',
  anomaly: '',

  autoSimulate: true,
  dryRatePerSec: 0.5,             // Moisture drops ~0.5% per real second in auto mode
  cycleCount: 0,
  statusLine: 'OK',

  displayMode: 'oled',            // 'oled' or 'lcd'
  lastLogTime: 0,
  lastTickTime: Date.now(),
  lastMLTime: 0,

  // ML-specific compatibility fields
  mlPrediction: null,
  mlConfidence: 0,
  modelReady: false,
  trainingLoss: 1,
  fineTuneBuffer: []
};

// Calculate simulated elapsed seconds since last watering
function simElapsed() {
  return ((Date.now() - state.waterMs) / 1000) * TIME_SCALE;
}

// Phase calculation based on elapsed / predSeconds ratio
function updatePhase() {
  if (state.predSeconds <= 0) {
    state.phase = PHASE.OVERDUE;
    return;
  }
  const ratio = state.elapsedSeconds / state.predSeconds;
  if (ratio < 0.70) {
    state.phase = PHASE.EARLY;
  } else if (ratio < 0.90) {
    state.phase = PHASE.MID;
  } else if (ratio <= 1.00) {
    state.phase = PHASE.LATE;
  } else {
    state.phase = PHASE.OVERDUE;
  }
}

// Anomaly check: WATERLOG (>80% and >1.5x predicted) or RAPID DRY (<30% and <0.5x predicted)
function checkAnomalies() {
  let anomaly = '';
  let buzzer = false;

  if (
    state.moisture > WET_THRESHOLD &&
    state.predSeconds > 0 &&
    state.elapsedSeconds > 1.5 * state.predSeconds
  ) {
    anomaly = 'WATERLOG';
    buzzer = true;
  }

  if (
    state.moisture < DRY_THRESHOLD &&
    state.predSeconds > 0 &&
    state.elapsedSeconds < 0.5 * state.predSeconds
  ) {
    anomaly = 'RAPID DRY';
    buzzer = true;
  }

  // Trigger alert log on state transition
  if (anomaly && anomaly !== state.anomaly) {
    if (typeof serialLog === 'function') {
      serialLog(
        `[${state.elapsedHours.toFixed(1)}h] ⚠ ANOMALY: ${anomaly} detected! ` +
        `Moisture=${state.moisture.toFixed(0)}% Elapsed=${state.elapsedHours.toFixed(1)}h`,
        'error'
      );
    }
    if (typeof notify === 'function') {
      notify({
        title: `Anomaly Alert: ${anomaly}`,
        message: anomaly === 'WATERLOG'
          ? `Soil moisture >${WET_THRESHOLD}% persisted past 1.5× expected cycle.`
          : `Soil dried to <${DRY_THRESHOLD}% unexpectedly early (<0.5× window).`,
        type: anomaly === 'WATERLOG' ? 'warning' : 'danger',
        duration: 6000
      });
    }
  }

  state.anomaly = anomaly;
  state.buzzerActive = buzzer;
  state.buzzerReason = anomaly;
}

// Trigger watering cycle (pump relay ON)
function doWater() {
  if (state.pumpActive) return;

  state.pumpActive = true;
  state.pumpStartTime = Date.now();
  state.statusLine = 'PUMP ON';

  if (typeof serialLog === 'function') {
    serialLog(
      `[${state.elapsedHours.toFixed(1)}h] 💧 PUMP ACTIVATED — ` +
      `Moisture ${state.moisture.toFixed(0)}% < ${DRY_THRESHOLD}%`,
      'pump'
    );
  }

  if (typeof notify === 'function') {
    notify({
      title: 'Pump Relay Energized',
      message: `Irrigation active (Moisture: ${state.moisture.toFixed(0)}%). Running 2.0s burst.`,
      type: 'pump',
      duration: 3000
    });
  }
}

// Complete watering cycle (pump relay OFF, EMA update, reset elapsed, moisture jump)
function completePump() {
  state.pumpActive = false;

  const actualElapsedSec = simElapsed();
  const actualElapsedH = actualElapsedSec / 3600;

  // ML data point collection for fineTuneModel
  if (typeof fineTuneModel === 'function' && actualElapsedH > 0.5) {
    const samples = [];
    const startM = 85;
    const rate = (startM - state.moisture) / Math.max(0.1, actualElapsedH);
    for (let t = 0; t < actualElapsedH; t += actualElapsedH / 5) {
      const mAtT = startM - rate * t;
      const ph = getPhaseNumber(t, state.predictedHours);
      const hLeft = Math.max(0, actualElapsedH - t);
      samples.push({
        input: [mAtT / 100, t / 50, state.predictedHours / 50, ph / 3],
        output: [hLeft / 50]
      });
    }
    state.fineTuneBuffer.push(...samples);
    if (state.fineTuneBuffer.length >= 8) {
      fineTuneModel(state.fineTuneBuffer);
      state.fineTuneBuffer = [];
    }
  }

  // EMA update matches Arduino: predSeconds = EMA_ALPHA * elapsed + (1 - EMA_ALPHA) * predSeconds
  // Guard against transient manual test clicks (< 12 sim min / 0.2s) to keep long-term model stable
  if (actualElapsedSec > 720) {
    const oldPredH = state.predictedHours;
    state.predSeconds = EMA_ALPHA * actualElapsedSec + (1 - EMA_ALPHA) * state.predSeconds;
    state.predictedHours = state.predSeconds / 3600;

    if (typeof serialLog === 'function') {
      serialLog(
        `[EMA Update] Previous: ${oldPredH.toFixed(1)}h → New: ${state.predictedHours.toFixed(1)}h (α=${EMA_ALPHA})`,
        'info'
      );
    }
  } else if (actualElapsedSec > 0) {
    if (typeof serialLog === 'function') {
      serialLog(
        `[EMA] Short cycle (<0.2h) — maintained baseline prediction: ${state.predictedHours.toFixed(1)}h`,
        'info'
      );
    }
  }

  // Reset timer
  state.waterMs = Date.now();
  state.elapsedSeconds = 0;
  state.elapsedHours = 0;
  state.cycleCount++;

  // Clear anomaly and buzzer on watering cycle
  state.anomaly = '';
  state.buzzerActive = false;
  state.buzzerReason = '';

  // Soil moisture jumps to random 75–90 on watering
  state.moisture = 75 + Math.random() * 15;

  if (typeof serialLog === 'function') {
    serialLog(
      `[0.0h] Pump OFF. Soil refreshed to ${state.moisture.toFixed(0)}%. Cycle #${state.cycleCount}`,
      'pump'
    );
  }

  if (typeof notify === 'function') {
    notify({
      title: 'Irrigation Completed',
      message: `Soil refreshed to ${state.moisture.toFixed(0)}%. Cycle #${state.cycleCount} recorded.`,
      type: 'success',
      duration: 3500
    });
  }

  // Persist prediction in localStorage
  try {
    localStorage.setItem('pwsPredSeconds', state.predSeconds.toString());
  } catch (e) {}
}

// Main Simulation Tick (called every 50ms)
function simulationTick() {
  const now = Date.now();
  const realDeltaMs = Math.min(now - state.lastTickTime, 500);
  state.lastTickTime = now;

  // Calculate elapsed
  state.elapsedSeconds = simElapsed();
  state.elapsedHours = state.elapsedSeconds / 3600;

  // Auto-simulate moisture drift (~0.5% per real second)
  if (state.autoSimulate && !state.pumpActive) {
    const deltaSeconds = realDeltaMs / 1000;
    const noise = (Math.random() - 0.5) * 0.1;
    state.moisture -= (state.dryRatePerSec + noise) * deltaSeconds;
    state.moisture = Math.max(0, Math.min(100, state.moisture));
  }

  // Handle pump duration
  if (state.pumpActive && (now - state.pumpStartTime >= PUMP_DURATION_MS)) {
    completePump();
  }

  // Arduino core loop sequence: updatePhase -> threshold pump trigger -> checkAnomalies
  updatePhase();
  if (!state.pumpActive && state.moisture < DRY_THRESHOLD) {
    doWater();
  }
  checkAnomalies();

  // Status line
  if (state.pumpActive) {
    state.statusLine = 'PUMP ON';
  } else if (state.anomaly) {
    state.statusLine = state.anomaly;
  } else {
    state.statusLine = 'STATUS: OK';
  }

  // Periodic serial log (throttled by phase interval)
  if (state.autoSimulate && (now - state.lastLogTime > pollMs(state.phase))) {
    state.lastLogTime = now;
    if (typeof serialLog === 'function') {
      serialLog(
        `[${state.elapsedHours.toFixed(1)}h] ` +
        `Moisture: ${state.moisture.toFixed(0)}% | ` +
        `${PHASE_NAMES[state.phase]} (${PHASE_RANGES[state.phase]}) | ` +
        `E:${state.elapsedHours.toFixed(1)}h P:${state.predictedHours.toFixed(1)}h | ` +
        state.statusLine
      );
    }
  }

  // Predict ML if model ready (run every ~500ms)
  if (typeof predictML === 'function' && state.modelReady && (now - state.lastMLTime >= 500)) {
    state.lastMLTime = now;
    state.mlPrediction = predictML();
  }

  // Trigger UI Updates
  if (typeof updateAllUI === 'function') {
    updateAllUI();
  }
}

// Helper to determine phase number from elapsed & predicted (used by ml-model.js)
function getPhaseNumber(elapsed, predicted) {
  if (predicted <= 0) return PHASE.OVERDUE;
  const pct = (elapsed / predicted) * 100;
  if (pct < 70) return PHASE.EARLY;
  if (pct < 90) return PHASE.MID;
  if (pct <= 100) return PHASE.LATE;
  return PHASE.OVERDUE;
}

// Helper to calculate hours until next watering
function getHoursUntilWater() {
  if (state.moisture <= DRY_THRESHOLD) return 0;
  // Estimated based on remaining cycle time or moisture depletion
  const remainingInCycle = Math.max(0, state.predictedHours - state.elapsedHours);
  return remainingInCycle;
}

// Attach to window for global access
window.DRY_THRESHOLD = DRY_THRESHOLD;
window.WET_THRESHOLD = WET_THRESHOLD;
window.EMA_ALPHA = EMA_ALPHA;
window.TIME_SCALE = TIME_SCALE;
window.PUMP_DURATION_MS = PUMP_DURATION_MS;
window.SIM_TICK_MS = SIM_TICK_MS;
window.PHASE = PHASE;
window.PHASE_NAMES = PHASE_NAMES;
window.PHASE_RANGES = PHASE_RANGES;
window.state = state;
window.simElapsed = simElapsed;
window.updatePhase = updatePhase;
window.checkAnomalies = checkAnomalies;
window.doWater = doWater;
window.completePump = completePump;
window.simulationTick = simulationTick;
window.getPhaseNumber = getPhaseNumber;
window.getHoursUntilWater = getHoursUntilWater;
window.pollMs = pollMs;
