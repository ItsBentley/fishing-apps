# Bentley's Fishing Apps

A single GitHub Pages site for both fishing apps:

- `/` — app landing page
- `/carp-cast/` — Carp Cast weather and session planner
- `/fish-weight-calculator/` — Fish Weight Calculator
- `/catch-log/` — private, on-device catch records with photo and backup support

Each app keeps its own HTML, app-specific CSS, JavaScript, and image assets so it can be updated independently. Catch Log stores catches and photos in the browser's IndexedDB on the current device; it does not upload them. It reads JPEG EXIF capture date/time and GPS locally when present, and GPS is saved as editable coordinates. Enter details manually when photo metadata is missing. Use its backup export/import before clearing browser data or moving to another device. The shared `styles/platform.css` provides the common theme colors, typography, app-title style, and base styles; each page loads it before its own stylesheet. Add that shared stylesheet link when adding another app, then keep its layout and component styles in the app's own folder. The landing page and all app folders are deployed together by the GitHub Actions Pages workflow.

The site is available at <https://itsbentley.github.io/fishing-apps/> after the Pages workflow completes.
GitHub Pages must use **GitHub Actions** as its deployment source in the repository's Pages settings.
After that one-time setup, pushes to `main` deploy automatically.
