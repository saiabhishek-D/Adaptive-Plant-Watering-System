// ================================================================
//  display.js — OLED / LCD Panel Updates, Tab Switching & Boot Screen
// ================================================================

let isDisplayBooting = true;

/**
 * Switch active display mode between 'oled' and 'lcd'
 * @param {string} mode - 'oled' or 'lcd'
 */
function setDisplayMode(mode) {
  state.displayMode = mode;

  const btnOled = document.getElementById('tab-btn-oled');
  const btnLcd = document.getElementById('tab-btn-lcd');
  const frameOled = document.getElementById('oled-bezel-frame');
  const frameLcd = document.getElementById('lcd-bezel-frame');

  if (btnOled) btnOled.classList.toggle('active', mode === 'oled');
  if (btnLcd) btnLcd.classList.toggle('active', mode === 'lcd');

  if (frameOled) frameOled.style.display = mode === 'oled' ? 'block' : 'none';
  if (frameLcd) frameLcd.style.display = mode === 'lcd' ? 'block' : 'none';
}

/**
 * Display the Arduino boot splash screen for 1.5 seconds
 */
function showBootScreen() {
  isDisplayBooting = true;

  const oled0 = document.getElementById('oled-line-0');
  const oled1 = document.getElementById('oled-line-1');
  const oled2 = document.getElementById('oled-line-2');
  const oled3 = document.getElementById('oled-line-3');

  const lcd0 = document.getElementById('lcd-line-0');
  const lcd1 = document.getElementById('lcd-line-1');
  const lcd2 = document.getElementById('lcd-line-2');
  const lcd3 = document.getElementById('lcd-line-3');

  // Arduino boot splash text
  if (oled0) oled0.textContent = 'Plant Watering v1.0';
  if (oled1) oled1.textContent = 'Predictive Engine';
  if (oled2) oled2.textContent = 'Initialising...';
  if (oled3) oled3.textContent = 'SYS: BOOTING';

  if (lcd0) lcd0.textContent = 'Plant Watering v1.0';
  if (lcd1) lcd1.textContent = 'Predictive Engine';
  if (lcd2) lcd2.textContent = 'Initialising...';
  if (lcd3) lcd3.textContent = 'SYS: BOOTING';

  setTimeout(() => {
    isDisplayBooting = false;
    updateDisplayPanel();
  }, 1500);
}

/**
 * Update the 4 lines on both OLED and LCD displays with real-time data
 */
function updateDisplayPanel() {
  if (isDisplayBooting) return;

  const moistureStr = `Moisture: ${state.moisture.toFixed(0)}%`;
  const phaseStr = `${PHASE_NAMES[state.phase]} ${PHASE_RANGES[state.phase]}`;
  const timeStr = `E:${state.elapsedHours.toFixed(0)}h  P:${state.predictedHours.toFixed(0)}h`;
  const statusStr = state.statusLine.startsWith('STATUS:')
    ? state.statusLine
    : `STATUS: ${state.statusLine}`;

  // Update OLED (White pixel text)
  const oled0 = document.getElementById('oled-line-0');
  const oled1 = document.getElementById('oled-line-1');
  const oled2 = document.getElementById('oled-line-2');
  const oled3 = document.getElementById('oled-line-3');

  if (oled0) oled0.textContent = moistureStr;
  if (oled1) oled1.textContent = phaseStr;
  if (oled2) oled2.textContent = timeStr;
  if (oled3) oled3.textContent = statusStr;

  // Update LCD (Luminous green character matrix text)
  const lcd0 = document.getElementById('lcd-line-0');
  const lcd1 = document.getElementById('lcd-line-1');
  const lcd2 = document.getElementById('lcd-line-2');
  const lcd3 = document.getElementById('lcd-line-3');

  if (lcd0) lcd0.textContent = moistureStr;
  if (lcd1) lcd1.textContent = phaseStr;
  if (lcd2) lcd2.textContent = timeStr;
  if (lcd3) lcd3.textContent = statusStr;
}

// Attach to window
window.setDisplayMode = setDisplayMode;
window.showBootScreen = showBootScreen;
window.updateDisplayPanel = updateDisplayPanel;
