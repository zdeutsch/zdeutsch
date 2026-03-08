Manual testing checklist — Lesen page responsive aside

Purpose
- Verify mobile aside (right-panel) hide/show behavior and accessibility attributes.

Quick local preview
1. Start a simple HTTP server from the project root:

```bash
python3 -m http.server 8000
```

2. Open your browser to: http://localhost:8000/site/lesen.html

Checklist
- [ ] On desktop (width >= 768px): right sidebar (`#right-panel`) is visible; no overlay displayed.
  - Inspect: `#right-panel` should NOT have `fixed` class; `#aside-overlay` should be `hidden`.
  - `asideToggle` button may be hidden (it is `md:hidden`), header logo visible.

- [ ] On narrow screens (width < 768px) or using device emulator:
  - `#right-panel` should be hidden by default (has `hidden` class).
  - The header `aside-toggle` button should be visible.

- [ ] Tap/click the header `aside-toggle`:
  - `#right-panel` becomes visible and slides in (check transform/opacity animation).
  - `#right-panel` should have `fixed` and related classes; `#aside-overlay` should be visible (no `hidden`).
  - ARIA: `aside-toggle[aria-expanded] === "true"`, `#right-panel[aria-hidden] === "false"`.
  - Focus: keyboard focus should move into `#right-panel`.

- [ ] Tap/click the overlay or press `Esc`:
  - `#right-panel` should slide out and be hidden if screen is narrow.
  - `aside-toggle[aria-expanded] === "false"`, `#right-panel[aria-hidden] === "true"`.
  - Focus should return to the toggle button.

- [ ] Resize from small → large while aside open:
  - Overlay should hide and `#right-panel` should remain visible as a normal column (no overlay/fixed classes).

Notes & troubleshooting
- If styles don't appear, ensure `theme.css` is loaded and browser cache is cleared.
- If the slide animation doesn't run, verify `#right-panel` transitions exist in `site/theme.css` and that the `hidden`/`fixed` classes toggle correctly.

Optional automated smoke (local):
- Use a small Puppeteer script to programmatically open the page and assert ARIA states and class presence.
