# Copyright & Multi-License Architecture

Copyright © 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

All code in this repository is copyright Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers and licensed as described below.

This repository contains multiple distinct components governed by different open-source licenses.

---

## The Software Engine (Code)

All executable source code in this repository — including but not limited to TypeScript files
(`.ts`), JavaScript files (`.js`), root-level JSON configuration files (e.g., `package.json`,
`tsconfig.json`), and build scripts — is licensed under the **GNU Affero General Public License
v3.0 (AGPL-3.0-only)**. This license expressly excludes data files located in the `data/ogl/`
and `data/dw/` directories.

Full license text: https://www.gnu.org/licenses/agpl-3.0.en.html

### Covered files include (non-exhaustive):
- `apps/**/*.ts`
- `packages/**/*.ts`
- `package.json`
- `tsconfig.json`
- `tsconfig.base.json`
- `*.js` (build artifacts, scripts)
- `scripts/**/*`

---

## The Game Data (Content)

### OGL Data (`data/ogl/`)

All files under the `data/ogl/` directory — including but not limited to SQLite databases,
JSON files, and Markdown files containing game rules, tables, and reference text — are
governed exclusively by the **Open Game License v1.0a (OGL)**.

Full license text: see `OGL-1.0a.txt` in this repository.

### Dungeon World Data (`data/dw/`)

All files under the `data/dw/` directory — including but not limited to SQLite databases,
license texts, and attribution files — are governed exclusively by the **Creative Commons
Attribution 3.0 Unported License (CC-BY-3.0)**.

Full license text: see `data/dw/CC-BY-3.0.txt` in this repository.

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

## Designation of Dungeon World Content

All text within the `data/dw/` directory is designated as content governed by the
Creative Commons Attribution 3.0 Unported License. This includes the auto-generated
SQLite database (`data/dw/dungeon-world.db`), database schema definitions, and any
structured data derived from Dungeon World by Sage LaTorra and Adam Koebel.

## Dungeon World Product Identity

The following terms are acknowledged as belonging to their respective owners and are
used solely for attribution and license compliance:

- "Dungeon World" (Sage LaTorra and Adam Koebel)
- The name "2d6mcp" and its associated logos (project identity)

No challenge to ownership is intended.

---

## Derivation Statement

### OGL Data

The OGL game data in this repository is derived from:

1. The **Cepheus Engine System Reference Document**, Copyright 2016, Samardan Press;
   Author Jason "Flynn" Kemp
2. The **Cepheus Engine Core SRD**, Copyright 2022, Moon Toad Publishing;
   Authors Jason Kemp, Paul Elliott, Ian Stead
3. Which is in turn derived from the **Traveller System Reference Document**,
   Copyright 2008, Mongoose Publishing

This Product is derived from the Traveller System Reference Document and other Open
Gaming Content made available by the Open Gaming License, and does not contain closed
content from products published by either Mongoose Publishing or Far Future Enterprises.

### Dungeon World Data

The Dungeon World game data in this repository is derived from:

1. **Dungeon World**, Copyright 2012, Sage LaTorra and Adam Koebel
2. **Dungeon World Markdown** (markdown conversion), Copyright agude
3. The original work includes material from the **System Reference Document 5.1** by
   Wizards of the Coast LLC, licensed under CC-BY-4.0

This data is used under the terms of the Creative Commons Attribution 3.0 Unported
License. Appropriate attribution is provided in `data/dw/ATTRIBUTION`.

---

## Non-Affiliation Statement

This Product is **not** affiliated with, endorsed by, or sponsored by:

- Jason "Flynn" Kemp or Samardan Press
- Mongoose Publishing or its successors
- Far Future Enterprises
- Moon Toad Publishing
- Wizards of the Coast, Inc.
- Sage LaTorra or Adam Koebel
- agude (Dungeon World Markdown contributor)

The use of the Traveller System Reference Document, the Cepheus Engine System
Reference Document, and Dungeon World does not convey the endorsement of this Product
by any of the above entities as a product of any of their product lines or systems.

---

## Attribution

### OGL Data

The machine-readable game rules included in this repository are derived from Open
Game Content made available by Jason "Flynn" Kemp through Samardan Press under the
Open Game License v1.0a. The Cepheus Engine System Reference Document is the work of
Jason "Flynn" Kemp, Copyright 2016 Samardan Press.

### Dungeon World Data

The Dungeon World rules data is derived from Dungeon World by Sage LaTorra and Adam
Koebel, Copyright 2012, licensed under the Creative Commons Attribution 3.0 Unported
License. The markdown source was converted by agude from the original XML. Full
attribution details are in `data/dw/ATTRIBUTION`.

---

## Firewall Statement

These licenses apply to their respective components and do not extend to the others.
Incorporating, linking, or distributing the software engine does not subject the
software to the OGL or CC-BY-3.0, and incorporating OGL data does not subject it to
the AGPL-3.0 or CC-BY-3.0, and incorporating CC-BY-3.0 data does not subject it to
the AGPL-3.0 or OGL. This firewall is intentional and designed to prevent license
contamination between the code and the game content.
