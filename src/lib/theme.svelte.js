const KEY = 'sm-theme';

/** pref is 'system', 'light' or 'dark'. `version` changes whenever the effective colors change, so charts redraw. */
export const theme = $state({ pref: 'system', version: 0 });

function apply() {
  const root = document.documentElement;
  if (theme.pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme.pref);
  theme.version++;
}

export function initTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') theme.pref = saved;
  } catch {
    // storage unavailable: stay on system
  }
  apply();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => theme.version++);
}

export function setTheme(pref) {
  theme.pref = pref;
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // not persisted
  }
  apply();
}

/** Cycles system -> light -> dark. */
export function cycleTheme() {
  setTheme(theme.pref === 'system' ? 'light' : theme.pref === 'light' ? 'dark' : 'system');
}
