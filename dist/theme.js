(() => {
  const key = 'flowtrack.theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  if (!['light', 'dark'].includes(preference)) preference = null;
  function apply() {
    const dark = (preference || (system.matches ? 'dark' : 'light')) === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const button = document.getElementById('theme-toggle');
    if (button) {
      const label = `Switch to ${dark ? 'light' : 'dark'} mode`;
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0c0f' : '#ffffff');
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-toggle').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      apply();
    });
    apply();
  });
  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = ['light', 'dark'].includes(event.newValue) ? event.newValue : null;
      apply();
    }
  });
})();
