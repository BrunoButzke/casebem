export function applyDesafioTheme(cssVars) {
  if (!cssVars || typeof cssVars !== 'object') return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(cssVars)) {
    if (key.startsWith('--') && value) root.style.setProperty(key, value);
  }
}

export async function loadAndApplyDesafioTheme() {
  try {
    const res = await fetch('/api/desafio/theme');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && data.cssVars) applyDesafioTheme(data.cssVars);
    return data.theme || null;
  } catch {
    return null;
  }
}
