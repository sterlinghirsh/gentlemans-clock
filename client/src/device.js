// What the phone itself does: keep the screen on, the turn sound, vibration, and saved preferences.

const PREFS_KEY = 'gcPrefs';
const DEFAULT_PREFS = { wakeLock: true, sound: true, vibrate: true, seats: {} };

export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { ...DEFAULT_PREFS, ...p, seats: { ...(p && p.seats) } };
  } catch { return { ...DEFAULT_PREFS, seats: {} }; }
}

export function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
}

export const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export const canWakeLock = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

// --- Screen Wake Lock: held while `want()` says so and the page is visible; the browser drops it when the page
// hides, so it's asked for again on every return.
export function wakeLock(want) {
  let lock = null;
  let pending = false;
  async function sync() {
    const should = canWakeLock && want() && document.visibilityState === 'visible';
    if (should && !lock && !pending) {
      pending = true;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch { lock = null; }
      pending = false;
      if (!want() && lock) { lock.release().catch(() => {}); lock = null; }
    } else if (!should && lock) {
      const l = lock; lock = null;
      l.release().catch(() => {});
    }
  }
  // Shown on <html data-wakelock> for checks: "held", "off" (not wanted) or "refused".
  const mark = (v) => { document.documentElement.dataset.wakelock = v; };
  const sync2 = async () => {
    await sync();
    mark(lock ? 'held' : canWakeLock && want() && document.visibilityState === 'visible' ? 'refused' : 'off');
  };
  document.addEventListener('visibilitychange', sync2);
  return { sync: sync2, held: () => lock !== null };
}

// --- Sound: one short two-note chime from an oscillator (no audio file). The context is created on the first
// tap (browsers allow audio only after a gesture) and suspended again after each chime, so the audio hardware
// isn't kept awake while the phone sits on the table.
let ctx = null;
let suspendTimer = 0;

export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { return; }
  if (!ctx) {
    try { ctx = new AC(); } catch { ctx = null; return; }
  }
  if (ctx.state !== 'running') { ctx.resume().then(() => idleAudio(), () => {}); }
}

function idleAudio(ms = 400) {
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => { if (ctx && ctx.state === 'running') { ctx.suspend().catch(() => {}); } }, ms);
}

export async function chime() {
  if (!ctx) { return; }
  try { if (ctx.state !== 'running') { await ctx.resume(); } } catch { return; }
  const t0 = ctx.currentTime + 0.01;
  for (const [f, at] of [[880, 0], [1318.5, 0.11]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + at);
    g.gain.linearRampToValueAtTime(0.35, t0 + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + at);
    o.stop(t0 + at + 0.25);
  }
  idleAudio(600);
}

export function buzz(pattern) {
  if (canVibrate) { try { navigator.vibrate(pattern); } catch { /* ignored */ } }
}
