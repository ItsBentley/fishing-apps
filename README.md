# Bentley's Fishing Apps

A single GitHub Pages site for both fishing apps:

- `/` — app landing page
- `/carp-cast/` — Carp Cast weather and session planner
- `/fish-weight-calculator/` — Fish Weight Calculator

Each app keeps its own HTML, CSS, JavaScript, and image assets so it can be updated independently. The landing page and both app folders are deployed together by the GitHub Actions Pages workflow.

The site is available at <https://itsbentley.github.io/fishing-apps/> after the Pages workflow completes.
GitHub Pages must use **GitHub Actions** as its deployment source in the repository's Pages settings.
After that one-time setup, pushes to `main` deploy automatically.
