// ================================================================
//  notifications.js — Toast Notification Engine, History Drawer & Audio
//  Supports: In-App Toasts, History Drawer, Web Audio Chime, Haptics, Browser Push
// ================================================================

const notificationHistory = [];
let unreadCount = 0;
let soundEnabled = true;
let browserPushEnabled = false;

// Web Audio API Context (instantiated on first user interaction)
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a synthetic, non-intrusive soft sound chime
 * @param {string} type - 'success', 'pump', 'warning', 'danger', 'ml', 'info'
 */
function playChime(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    gain.connect(ctx.destination);
    osc.connect(gain);

    if (type === 'pump' || type === 'success') {
      // Gentle two-tone soft chime (C5 -> E5)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'warning' || type === 'danger') {
      // Soft alert pulse (A4 -> F4)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(349.23, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'ml') {
      // Future tech blip (D5 -> G5)
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.1);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      // Neutral blip (E5)
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    // AudioContext blocked or unsupported
  }
}

/**
 * Trigger subtle mobile haptic feedback
 */
function triggerHaptic(type) {
  if (navigator && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'warning' || type === 'danger') {
        navigator.vibrate([80, 40, 80]);
      } else {
        navigator.vibrate(40);
      }
    } catch (e) {}
  }
}

/**
 * Dispatch an in-app Toast Notification
 * @param {Object} opts - { title, message, type, duration }
 */
function notify(opts) {
  const {
    title = 'System Alert',
    message = '',
    type = 'info',
    duration = 4500
  } = opts;

  const timestamp = new Date();
  const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Add to internal history
  notificationHistory.unshift({ title, message, type, timeStr, timestamp });
  unreadCount++;
  updateBellBadge();

  // Play audio & haptic
  playChime(type);
  triggerHaptic(type);

  // Send Browser Native Notification if allowed
  if (browserPushEnabled && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`Plant Watering: ${title}`, {
        body: message,
        icon: 'assets/icons.svg#icon-leaf'
      });
    } catch (e) {}
  }

  // Create Toast Element
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item type-${type}`;

  // Select SVG icon for disc
  let iconName = 'icon-leaf';
  if (type === 'pump' || type === 'info') iconName = 'icon-water-drop';
  else if (type === 'warning' || type === 'danger') iconName = 'icon-buzzer';
  else if (type === 'ml') iconName = 'icon-chip';

  toast.innerHTML = `
    <div class="toast-icon-disc">
      <svg class="icon"><use href="#${iconName}"></use></svg>
    </div>
    <div class="toast-body">
      <div class="toast-title-row">
        <span class="toast-title">${escapeHTML(title)}</span>
        <span class="toast-time">${timeStr}</span>
      </div>
      <div class="toast-message">${escapeHTML(message)}</div>
    </div>
    <button class="toast-close-btn" aria-label="Close Notification">&times;</button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Limit max visible toasts to 4
  while (container.childNodes.length > 4) {
    dismissToast(container.firstChild);
  }

  // Close button click
  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dismissToast(toast));
  }

  // Auto-dismiss after duration
  let dismissTimeout = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  // Pause on hover
  toast.addEventListener('mouseenter', () => clearTimeout(dismissTimeout));
  toast.addEventListener('mouseleave', () => {
    dismissTimeout = setTimeout(() => dismissToast(toast), 1500);
  });
}

/**
 * Dismiss a toast element with exit animation
 */
function dismissToast(toastEl) {
  if (!toastEl || toastEl.classList.contains('removing')) return;
  toastEl.classList.add('removing');
  setTimeout(() => {
    if (toastEl && toastEl.parentNode) {
      toastEl.parentNode.removeChild(toastEl);
    }
  }, 250);
}

/**
 * Update Header Bell Badge Counter
 */
function updateBellBadge() {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.setAttribute('data-count', unreadCount);
    badge.style.display = 'flex';

    // Highlight red if any unread anomaly
    const hasActiveAnomaly = state && (state.anomaly === 'WATERLOG' || state.anomaly === 'RAPID DRY');
    badge.classList.toggle('has-alert', !!hasActiveAnomaly);
  } else {
    badge.textContent = '';
    badge.removeAttribute('data-count');
    badge.style.display = 'none';
  }
}

/**
 * Toggle the Notification Drawer
 */
function toggleNotificationDrawer(forceOpen) {
  const drawer = document.getElementById('notification-drawer');
  const backdrop = document.getElementById('notification-drawer-backdrop');
  if (!drawer || !backdrop) return;

  const isOpen = forceOpen !== undefined ? forceOpen : !drawer.classList.contains('active');

  drawer.classList.toggle('active', isOpen);
  backdrop.classList.toggle('active', isOpen);

  if (isOpen) {
    // Clear unread count on open
    unreadCount = 0;
    updateBellBadge();
    renderDrawerList();
  }
}

/**
 * Render history items in drawer
 */
function renderDrawerList() {
  const listEl = document.getElementById('drawer-list');
  if (!listEl) return;

  if (notificationHistory.length === 0) {
    listEl.innerHTML = `
      <div class="drawer-empty-state">
        <svg class="icon" style="width:28px;height:28px;opacity:0.4;"><use href="#icon-terminal"></use></svg>
        <div>No notifications yet</div>
        <span style="font-size:10px;opacity:0.6;">System events, pump cycles and anomalies will appear here.</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = notificationHistory.map(item => `
    <div class="drawer-item type-${item.type}">
      <div style="flex:1;">
        <div class="drawer-item-title">${escapeHTML(item.title)}</div>
        <div class="drawer-item-msg">${escapeHTML(item.message)}</div>
        <div class="drawer-item-time">${item.timeStr}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Clear notification history
 */
function clearNotificationHistory() {
  notificationHistory.length = 0;
  unreadCount = 0;
  updateBellBadge();
  renderDrawerList();
}

/**
 * Toggle sound chime on/off
 */
function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('btn-toggle-sound');
  if (btn) {
    btn.textContent = soundEnabled ? 'Sound: ON' : 'Sound: OFF';
    btn.style.color = soundEnabled ? 'var(--lime)' : 'var(--text-muted)';
  }
  if (soundEnabled) {
    playChime('info');
  }
}

/**
 * Request HTML5 Desktop/Mobile Push Notifications
 */
async function requestPushPermission() {
  if (!('Notification' in window)) {
    alert('Browser notifications are not supported in this browser.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    browserPushEnabled = permission === 'granted';
    const btn = document.getElementById('btn-push-perm');
    if (btn) {
      btn.textContent = browserPushEnabled ? 'Alerts: Allowed' : 'Alerts: Blocked';
      btn.style.color = browserPushEnabled ? 'var(--lime)' : 'var(--text-muted)';
    }
    if (browserPushEnabled) {
      notify({
        title: 'Push Alerts Enabled',
        message: 'You will receive notifications for pump cycles and anomalies.',
        type: 'success'
      });
    }
  } catch (e) {}
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Attach to window
window.notify = notify;
window.toggleNotificationDrawer = toggleNotificationDrawer;
window.clearNotificationHistory = clearNotificationHistory;
window.toggleSound = toggleSound;
window.requestPushPermission = requestPushPermission;
