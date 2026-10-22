// ================================================================
//  serial.js — Serial Monitor Terminal Logger & Auto-Scroll
// ================================================================

const MAX_SERIAL_LINES = 250;
let autoScrollEnabled = true;

/**
 * Append a new log line to the serial monitor terminal
 * @param {string} message - Text to print
 * @param {string} type - 'info', 'pump', 'warn', 'error', 'boot'
 */
function serialLog(message, type = 'info') {
  const container = document.getElementById('serial-viewport');
  if (!container) return;

  const line = document.createElement('div');
  line.className = `serial-entry ${type}`;
  line.textContent = message;

  container.appendChild(line);

  // Trim old lines
  while (container.childNodes.length > MAX_SERIAL_LINES) {
    container.removeChild(container.firstChild);
  }

  // Auto-scroll to bottom
  if (autoScrollEnabled) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Clear all lines in the serial monitor
 */
function clearSerialLog() {
  const container = document.getElementById('serial-viewport');
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Toggle auto-scroll behavior
 */
function toggleAutoScroll() {
  autoScrollEnabled = !autoScrollEnabled;
  const btn = document.getElementById('btn-autoscroll');
  if (btn) {
    btn.textContent = autoScrollEnabled ? 'AUTO-SCROLL: ON' : 'AUTO-SCROLL: OFF';
    btn.style.borderColor = autoScrollEnabled ? 'var(--lime-dim)' : 'var(--border-subtle)';
  }
}

// Attach to window
window.serialLog = serialLog;
window.clearSerialLog = clearSerialLog;
window.toggleAutoScroll = toggleAutoScroll;
