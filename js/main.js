// ================================================================
//  main.js — System Initialization, Event Listeners & Master Loop
// ================================================================

// Shared DOM helper
if (typeof $ !== 'function') {
  window.$ = function(id) { return document.getElementById(id); };
}

/**
 * Unified UI Refresh coordinating all modules
 */
function updateAllUI() {
  // Update circular arc gauge
  if (typeof updateGauge === 'function') {
    updateGauge(state.moisture);
  }

  // Update slider position if in auto-simulate mode
  const slider = $('moisture-slider');
  const sliderReadout = $('slider-val-readout');
  if (slider && state.autoSimulate) {
    slider.value = state.moisture.toFixed(0);
  }
  if (sliderReadout) {
    sliderReadout.textContent = `${state.moisture.toFixed(0)}%`;
  }

  // Update OLED/LCD 4-line panel
  if (typeof updateDisplayPanel === 'function') {
    updateDisplayPanel();
  }

  // Update all right-hand cards
  if (typeof updateCards === 'function') {
    updateCards();
  }
}
window.updateAllUI = updateAllUI;

/**
 * Simulate Arduino boot sequence with authentic serial delays
 */
async function runBootSequence() {
  // Show splash on display hardware
  if (typeof showBootScreen === 'function') {
    showBootScreen();
  }

  // Authentic serial print delays matching Arduino setup()
  await new Promise(r => setTimeout(r, 200));
  serialLog('OLED OK', 'boot');

  await new Promise(r => setTimeout(r, 400));
  serialLog('=== System Ready ===', 'boot');

  await new Promise(r => setTimeout(r, 350));
  serialLog('1s real = 1h sim | pot LEFT = dry', 'info');

  await new Promise(r => setTimeout(r, 200));
  serialLog(`[CONFIG] DRY_THRESHOLD=${DRY_THRESHOLD}%  WET_THRESHOLD=${WET_THRESHOLD}%  EMA_ALPHA=${EMA_ALPHA}`, 'info');

  // Restore previous prediction from localStorage if present
  try {
    const saved = localStorage.getItem('pwsPredSeconds');
    if (saved) {
      state.predSeconds = parseFloat(saved);
      state.predictedHours = state.predSeconds / 3600;
      serialLog(`[EEPROM] Restored cycle prediction: ${state.predictedHours.toFixed(1)}h`, 'info');
    }
  } catch (e) {}

  // Train ML Model asynchronously if ml-model.js is loaded
  if (typeof buildAndTrainModel === 'function') {
    buildAndTrainModel().then(() => {
      if (state.modelReady && typeof predictML === 'function') {
        state.mlPrediction = predictML();
        serialLog(`[ML] Live inference ready — prediction: ${state.mlPrediction.toFixed(1)}h`, 'info');
        if (typeof notify === 'function') {
          notify({
            title: 'Neural Network Ready',
            message: `TF.js model trained (50 epochs) — confidence: ${state.mlConfidence.toFixed(0)}%`,
            type: 'ml'
          });
        }
      }
    }).catch(err => {
      serialLog(`[ML] Model note: ${err.message}`, 'warn');
    });
  }
}

/**
 * Attach UI event listeners
 */
function setupEventListeners() {
  // Moisture slider input
  const slider = $('moisture-slider');
  if (slider) {
    slider.addEventListener('input', e => {
      state.moisture = parseFloat(e.target.value);
      const sliderReadout = $('slider-val-readout');
      if (sliderReadout) {
        sliderReadout.textContent = `${state.moisture.toFixed(0)}%`;
      }
      updateAllUI();
    });
  }

  // Auto-simulate switch toggle
  const autoSwitch = $('auto-simulate-toggle');
  if (autoSwitch) {
    autoSwitch.addEventListener('change', e => {
      state.autoSimulate = e.target.checked;
      if (state.autoSimulate) {
        state.waterMs = Date.now();
        state.lastTickTime = Date.now();
        state.lastLogTime = Date.now();
        serialLog('[AUTO] Simulation enabled: moisture actively drifting ~0.5%/sec', 'info');
        if (typeof notify === 'function') {
          notify({
            title: 'Auto Simulate Enabled',
            message: 'Moisture depleting passively (~0.5%/s) with automated pump trigger.',
            type: 'info'
          });
        }
      } else {
        serialLog('[AUTO] Simulation paused: manual control active', 'info');
        if (typeof notify === 'function') {
          notify({
            title: 'Auto Simulate Paused',
            message: 'Manual potentiometer slider control active.',
            type: 'info'
          });
        }
      }
    });
  }

  // Manual pump trigger button
  const pumpBtn = $('btn-manual-pump');
  if (pumpBtn) {
    pumpBtn.addEventListener('click', () => {
      if (state.pumpActive) return;

      pumpBtn.disabled = true;
      serialLog(`[Manual] User triggered pump pulse (moisture: ${state.moisture.toFixed(0)}%)`, 'pump');
      doWater();

      setTimeout(() => {
        pumpBtn.disabled = false;
      }, PUMP_DURATION_MS + 200);
    });
  }

  // Display mode tabs
  const tabOled = $('tab-btn-oled');
  const tabLcd = $('tab-btn-lcd');
  if (tabOled) {
    tabOled.addEventListener('click', () => setDisplayMode('oled'));
  }
  if (tabLcd) {
    tabLcd.addEventListener('click', () => setDisplayMode('lcd'));
  }

  // Serial monitor controls
  const btnClear = $('btn-clear-serial');
  if (btnClear) {
    btnClear.addEventListener('click', clearSerialLog);
  }

  const btnAutoScroll = $('btn-autoscroll');
  if (btnAutoScroll) {
    btnAutoScroll.addEventListener('click', toggleAutoScroll);
  }

  // Notification Drawer & Controls
  const btnBell = $('btn-notification-bell');
  if (btnBell) {
    btnBell.addEventListener('click', () => toggleNotificationDrawer());
  }

  const btnCloseDrawer = $('btn-close-drawer');
  if (btnCloseDrawer) {
    btnCloseDrawer.addEventListener('click', () => toggleNotificationDrawer(false));
  }

  const drawerBackdrop = $('notification-drawer-backdrop');
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', () => toggleNotificationDrawer(false));
  }

  const btnClearNotifs = $('btn-clear-notifications');
  if (btnClearNotifs) {
    btnClearNotifs.addEventListener('click', clearNotificationHistory);
  }

  const btnToggleSound = $('btn-toggle-sound');
  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', toggleSound);
  }

  const btnPushPerm = $('btn-push-perm');
  if (btnPushPerm) {
    btnPushPerm.addEventListener('click', requestPushPermission);
  }

  // Mobile View Switcher Tabs (Ergonomic tabbed navigation on <= 768px screens)
  const mobileNavPills = document.querySelectorAll('.mobile-nav-pill');
  if (mobileNavPills.length > 0) {
    mobileNavPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const view = pill.dataset.view || 'all';
        mobileNavPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        // Toggle state class on document body
        document.body.classList.remove('view-all', 'view-telemetry', 'view-displays', 'view-serial');
        document.body.classList.add(`view-${view}`);
      });
    });
  }
}

/**
 * App Entrypoint on DOMContentLoaded
 */
function initApp() {
  setupEventListeners();
  updateAllUI();
  runBootSequence();

  // Start continuous 50ms simulation loop
  setInterval(simulationTick, SIM_TICK_MS);
}

document.addEventListener('DOMContentLoaded', initApp);
