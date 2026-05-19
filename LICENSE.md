# Copyright & Dual-License Architecture

Copyright © 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

All code in this repository is copyright Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers and licensed as described below.

This repository contains two distinct components governed by different open-source licenses.

---

## The Software Engine (Code)

All executable source code in this repository — including but not limited to TypeScript files
(`.ts`), JavaScript files (`.js`), root-level JSON configuration files (e.g., `package.json`,
`tsconfig.json`), and build scripts — is licensed under the **GNU Affero General Public License
v3.0 (AGPL-3.0-only)**. This license expressly excludes data files located in the `data/ogl/`
directory.

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
JSON files, and Markdown files containing game rules, tables, and reference text — are
governed exclusively by the **Open Game License v1.0a (OGL)**.

Full license text: see `OGL-1.0a.txt` in this repository.

---

## Designation of Open Game Content

All text within the `data/ogl/` directory is designated as **Open Game Content**
under the terms of the Open Game License v1.0a. This includes the bundled SQLite
database (`data/ogl/cepheus.db`), database schema definitions, and any structured
data derived from the Cepheus Engine System Reference Document.

## Designation of Product Identity

The following terms are designated as **Product Identity** and are not Open Game Content:

- "Cepheus Engine" (trademark of Jason "Flynn" Kemp)
- "Samardan Press" (trademark of Jason "Flynn" Kemp)
- "Moon Toad Publishing" (trademark of Paul Elliott)
- "Mongoose Publishing" (trademark of Mongoose Publishing Ltd)
- "Traveller" (trademark of Far Future Enterprises)
- Titles of any products published by Samardan Press, Moon Toad Publishing, or Mongoose Publishing
- The name "2d6mcp" and its associated logos (project identity)

These trademarks and Product Identity elements are used here solely for attribution
and license compliance and do not constitute a challenge to ownership.

---

## Derivation Statement

The game data in this repository is derived from:

1. The **Cepheus Engine System Reference Document**, Copyright 2016, Samardan Press;
   Author Jason "Flynn" Kemp
2. The **Cepheus Engine Core SRD**, Copyright 2022, Moon Toad Publishing;
   Authors Jason Kemp, Paul Elliott, Ian Stead
3. Which is in turn derived from the **Traveller System Reference Document**,
   Copyright 2008, Mongoose Publishing

This Product is derived from the Traveller System Reference Document and other Open
Gaming Content made available by the Open Gaming License, and does not contain closed
content from products published by either Mongoose Publishing or Far Future Enterprises.

---

## Non-Affiliation Statement

This Product is **not** affiliated with, endorsed by, or sponsored by:

- Jason "Flynn" Kemp or Samardan Press
- Mongoose Publishing or its successors
- Far Future Enterprises
- Moon Toad Publishing
- Wizards of the Coast, Inc.

The use of the Traveller System Reference Document and the Cepheus Engine System
Reference Document does not convey the endorsement of this Product by any of the
above entities as a product of any of their product lines or systems.

---

## Attribution

The machine-readable game rules included in this repository are derived from Open
Game Content made available by Jason "Flynn" Kemp through Samardan Press under the
Open Game License v1.0a. The Cepheus Engine System Reference Document is the work of
Jason "Flynn" Kemp, Copyright 2016 Samardan Press.

---

## Firewall Statement

These two licenses apply to their respective components and do not extend to the other.
Incorporating, linking, or distributing the software engine does not subject the
software to the OGL, and incorporating the OGL data does not subject it to the AGPL-3.0.
This firewall is intentional and designed to prevent license contamination between
the code and the game content.
