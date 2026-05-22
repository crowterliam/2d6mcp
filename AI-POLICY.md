# AI Usage and Disclaimer

SPDX-License-Identifier: AGPL-3.0-only
Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

## Our Position

Technology and tabletop roleplaying are two deeply held passions. The tools in this project were built to help address the persistent shortage of Game Masters in the hobby, using open source software that anyone can run for free. Our goal is to aid human creativity, not to replace it. We believe AI can serve as an assistant at the table: someone who looks up a rule while the GM keeps the scene moving, or who helps someone work through a dense block of game text without slowing the group down.

The tools we build are intended to be high quality. We are not interested in producing AI-generated filler. If a feature does not meaningfully help people run or play games, it does not belong here. Automation should reduce friction, not diminish craft.

## Conduct

Harassment, attacks, or anti-AI hostility directed at individuals using our tools or contributing to this project are unacceptable. AI is not something we can put back in the bottle. The question is not whether these technologies will exist, but whether they will be built transparently, in the open, with community oversight, or locked inside proprietary platforms. We have chosen the first path.

If you are sceptical of AI in any capacity, we invite you to consider the following.

## Local First, By Default

This project can be used entirely on your own machine, inside a self-contained environment, without any network access beyond what is needed to download or install the tooling. The MCP server runs over stdio. The speech recognition and language model backends use local models via MLX, whisper.cpp, or llama.cpp. No data leaves your machine unless you explicitly configure it to.

The BYOD file ingestion system processes documents entirely on your local filesystem. No file contents are uploaded, transmitted, or shared externally. This also means your reference material is never exposed to external models that might retain or train on submitted data.

When a search result is passed to a local language model for a ruling, only short snippets are included, not full documents. This snippet-based approach uses minimal extracts consistent with fair use and the terms of open content licences, ensuring that the system aids reference without redistributing works in full.

## Hosted Deployment

An optional hosted deployment is available for Discord communities via Cloudflare Workers. This mode uses Cloudflare Workers AI for speech recognition and language model inference. It is separate from the local deployment described above and requires intentional configuration. The hosted mode processes only the open gaming content bundled with the project and does not access your local files or BYOD content.

## What These Tools Actually Do

The primary purpose of this software is retrieval and interpretation, not generation. The rules databases (OGL, Dungeon World, Basic Roleplaying) are generated on first use from bundled seed data. When you ask a question, the system searches for the most relevant rules text, assembles it, and passes it to a language model with instructions to explain what those rules say. It cites its sources. It does not invent mechanics. The language model is acting as a research assistant who has already read the book, not as an author writing new material.

This makes the tools useful as an accessibility aid. Someone who struggles to read or interpret a large reference book in a short time can ask a question and receive a direct, cited answer drawn from the text they already own. For players with cognitive or visual disabilities, this can be the difference between participating at the table and sitting out.

## Real Open Source, Clear Licensing

This project is guided by the principles of free and open source software. All original source code is licensed under AGPL-3.0. We only include game content natively that has been released under substantially open terms:

| System | Content License | Source |
|--------|----------------|--------|
| OGL (Cepheus Engine SRD) | Open Game License v1.0a | Samardan Press, Moon Toad Publishing |
| Dungeon World | Creative Commons Attribution 3.0 | Sage LaTorra and Adam Koebel |
| Basic Roleplaying | BRP Open Game License v1.0 | Chaosium Inc. |

Where identifying marks or trademarks appear, they are used solely for attribution and to indicate the rights granted to us by the content providers. If you hold rights to material included in this project and have a concern about its use, please contact the lead maintainer immediately. We will work with you to address any reasonable request.

## A Brief Word on "Open" in Tabletop Gaming

The tabletop community adopted the vocabulary of free and open source software around the year 2000, though the underlying philosophy and legal framework did not always follow. When people in the hobby say "open source," they are often referring to "Open Gaming," a framework that originated as a business strategy alongside a genuine desire to grow the third-party ecosystem.

A key difference lies in how copyright law treats software versus tabletop games. Software code is protected by copyright: you cannot legally copy or modify it without a licence. FOSS licences like the GPL exist to grant rights you would not otherwise have. Game mechanics, by contrast, are not copyrightable in the same way. The concept of "roll a die, add a modifier, compare against a target number" cannot be owned. Copyright protects only the specific expression of those rules: the wording and artwork.

When the Open Game Licence was introduced in 2000, it created a framework where designers could share mechanics while keeping their creative IP distinct. Over time, the community came to treat the OGL as roughly equivalent to a FOSS licence, even though the two serve different purposes. The OGL introduced the concept of Product Identity, a legal boundary that separates open game content (the mechanics) from protected creative material (the lore, characters, and settings). This distinction serves an important role for creators who want their rules to be widely used while retaining ownership of their worlds, but it differs from the all-in approach common in software.

The motivations behind the two movements also followed different paths. FOSS grew from a belief that software should be free to study, change, and distribute. The TTRPG "open" movement developed from the practical reality that adventures and campaign settings have tighter margins than core rulebooks. By letting third-party publishers write those supplements, open gaming licences helped create a shared platform for the industry. Because the framework used terms like "open source," many players understandably assumed the intent was purely community-driven.

Most of these distinctions went unexamined until the community was confronted with the possibility that a widely used open gaming licence might be altered or withdrawn. That moment prompted a wide conversation about what "open" actually means in a tabletop context. The industry has since embraced more genuinely open approaches: Creative Commons licences, the ORC Licence, and a clearer understanding that sharing mechanics is a different proposition than releasing source code.

This project sits within that broader conversation. The code is AGPL-3.0. The bundled game data is under its respective open content licences. Nothing is locked behind a proprietary gate, and we are committed to transparency in how the tools are built and what they include.

## The GM Shortage

If you browse any "looking for group" forum, you will find a flood of players searching for a single Game Master. The hobby has grown enormously over the last decade, but the structure of traditional tabletop gaming is inherently bottlenecked: a standard group requires exactly one GM for four to six players. Pop culture and actual-play broadcasts primarily showcase the player experience, so the vast majority of newcomers want to play. Demand for seats grew exponentially; the supply of people willing to run games grew linearly.

Compounding this is an intimidation problem. Before the internet, you learned to play by watching a friend stumble through a module in their basement. Today, most people's first exposure to a GM is a professional performer with a production team, custom terrain, and decades of improv training. This creates an artificial barrier: potential new GMs think that if they cannot do seven distinct character voices and memorise every rule, they are not good enough to run a game. The fear of failing to meet professional standards keeps thousands of people from ever sitting behind the screen.

The distribution of labour is also significantly unbalanced. A player might spend ten minutes updating their character sheet between sessions. A GM often spends hours writing hooks, balancing encounters, and setting up maps. The GM is typically the one buying the rulebooks, the modules, the miniatures, and the virtual tabletop subscription. On top of the creative work, the GM usually ends up as the de facto organizer: scheduling sessions, hosting, mediating disputes, and managing the group chat. Many GMs do not burn out from worldbuilding. They burn out from the exhausting social overhead of getting five adults in the same room on a consistent basis.

Fixing the void means normalising low-prep, low-stakes gaming. It means tools that reduce the administrative burden on the person running the game. It means making it easier for someone to say yes to GMing without feeling they need to become a professional entertainer first.

## Contact

For licensing concerns, inquiries, or to report an issue, open an issue at github.com/crowterliam/2d6mcp or contact the lead maintainer directly.

---

This work created using the BRP Open Game License.
BRP Open Game License v 1.0 (c) copyright 2020 Chaosium Inc.
Basic Roleplaying (c) copyright 1980-2020 Chaosium Inc.
Basic Roleplaying and the BRP logo are trademarks of Chaosium Inc. Used with permission.
