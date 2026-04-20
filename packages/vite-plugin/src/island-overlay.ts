export function generateIslandOverlayScript(): string {
  return `
<script type="module">
  if (import.meta.env?.DEV !== false) {
    function addOverlays() {
      document.querySelectorAll('[data-island]').forEach(el => {
        if (el.querySelector('[data-regox-overlay]')) return;
        const name = el.dataset.island;
        const badge = document.createElement('span');
        badge.dataset.regoxOverlay = '';
        badge.textContent = name;
        badge.style.cssText = [
          'position:absolute',
          'top:0',
          'left:0',
          'background:#6366f1',
          'color:#fff',
          'font:10px/1.4 monospace',
          'padding:1px 4px',
          'border-radius:0 0 4px 0',
          'z-index:9999',
          'pointer-events:none',
        ].join(';');
        const host = el;
        const prev = getComputedStyle(host).position;
        if (prev === 'static') host.style.position = 'relative';
        host.appendChild(badge);
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addOverlays);
    } else {
      addOverlays();
    }
  }
</script>`
}
