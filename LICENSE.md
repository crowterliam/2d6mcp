# Dual-License Architecture

This repository contains two distinct components governed by different open-source licenses:

---

## The Software Engine (Code)

All executable source code in this repository — including but not limited to TypeScript files
(`.ts`), JavaScript files (`.js`), JSON configuration files, and build scripts — is licensed
under the **GNU Affero General Public License v3.0 (AGPL-3.0-only)**.

Full license text: https://www.gnu.org/licenses/agpl-3.0.en.html

### Covered files include (non-exhaustive):
- `src/**/*.ts`
- `package.json`
- `tsconfig.json`
- `*.sh`
- `*.js` (build artifacts, scripts)

---

## The Game Data (Content)

All files under the `data/ogl/` directory — including but not limited to SQLite databases,
JSON files, and Markdown files containing game rules, tables, and reference text from the
**Cepheus Engine System Reference Document** — are licensed exclusively under the
**Open Game License v1.0a (OGL)**.

Full license text: see `OGL-1.0a.txt` in this repository.

The OGL content in this repository is designated as **Open Game Content** and is
clearly identified as such.

---

## Firewall Statement

These two licenses apply to their respective components and do not extend to the other.
Incorporating, linking, or distributing the software engine does not subject the
software to the OGL, and incorporating the OGL data does not subject it to the AGPL-3.0.
This firewall is intentional and designed to prevent license contamination between
the code and the game content.

---

## Third-Party Notices

This repository bundles data from the **Cepheus Engine System Reference Document**,
which is available under the Open Game License v1.0a. See `OGL-1.0a.txt` for full
copyright attributions.

No trademark, product identity, or proprietary content from any third-party game
publisher is included in this repository.
