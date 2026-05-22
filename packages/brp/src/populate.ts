// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// BRP SCOPE NOTICE:
// The code in this file (functions, control flow, SQL logic) is AGPL-3.0-only.
// The string literals containing game mechanics, rule descriptions, skill
// definitions, weapon stats, armor data, and other data are Open Game Content
// from the Basic Roleplaying System Reference Document 1.0 (BRPSRD1.0) by
// Greg Stafford, Steve Perrin, Jeff Richard, and Jason Durall, and are governed
// exclusively by the BRP Open Game License v1.0.
//
// This work created using the BRP Open Game License.
// BRP Open Game License v 1.0 (c) copyright 2020 Chaosium Inc.
// Basic Roleplaying (c) copyright 1980-2020 Chaosium Inc.;
// Authors, original rules: Greg Stafford, Steve Henderson, Warren James,
// Steve Perrin, Sandy Petersen, Ray Turney, and Lynn Willis;
// developed by Jason Durall, James Lowder, and Jeff Richard.
// Basic Roleplaying and the BRP logo are trademarks of Chaosium Inc.
// Used with permission.
//
// These strings are AGPL-licensed code *structure* but BRP-licensed *content*.
// The resulting database output in data/brp/ is designated as Open Game Content
// under the BRP Open Game License v1.0.

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { ensureBrpSchema } from "./database.js";

export function populateBrpDatabase(dbPath: string): { success: boolean; message: string } {
  if (existsSync(dbPath)) {
    return { success: true, message: `Database already exists at ${dbPath}. Use --force to re-populate.` };
  }
  const db = ensureBrpSchema(dbPath);
  const tx = db.transaction(() => {
    seedBrpCategories(db);
    seedBrpCoreRules(db);
    seedBrpCharacteristics(db);
    seedBrpDerivedCharacteristics(db);
    seedBrpSkills(db);
    seedBrpProfessions(db);
    seedBrpWeaponsMelee(db);
    seedBrpWeaponsMissile(db);
    seedBrpArmor(db);
    seedBrpShields(db);
    seedBrpSpotRules(db);
    seedBrpSampleFoes(db);
  });
  tx();
  rebuildFts(db);
  db.close();
  return { success: true, message: `BRP database populated at ${dbPath}` };
}

function rebuildFts(db: Database.Database): void {
  db.exec(`INSERT INTO brp_core_rules_fts(brp_core_rules_fts) VALUES ('rebuild');`);
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

function seedBrpCategories(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_categories (name, description) VALUES (?, ?)");
  const cats = [
    ["Introduction", "Overview of Basic Roleplaying, materials required, dice, and gamemaster responsibilities"],
    ["Character Creation", "Character sheet, identity, characteristics, characteristic rolls, derived characteristics"],
    ["Skills", "Complete skill list with base chances, specialties, and skill categories"],
    ["Professions", "Character professions and their professional skill lists"],
    ["System", "Skill rolls, difficulty, special successes, opposed rolls, resistance table, experience"],
    ["Time", "Narrative time, turns, combat rounds, and skill time requirements"],
    ["Combat", "Combat rounds, actions, attacking, parrying, dodging, damage, and healing"],
    ["Weapons & Equipment", "Melee weapons, missile weapons, shields, armor, and damage"],
    ["Spot Rules", "Environmental rules, ambushes, cover, darkness, disease, falling, poison, and more"],
    ["Sample Foes", "Example non-player characters, monsters, and creatures"],
    ["License", "BRP Open Game License v1.0 information"],
  ];
  for (const c of cats) stmt.run(...c);
}

// ─── CORE RULES ─────────────────────────────────────────────────────────────

function seedBrpCoreRules(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO brp_core_rules (section, subsection, content, page_hint) VALUES (?, ?, ?, ?)");
  const rules: [string, string, string, string][] = [
    // Introduction
    ["Introduction", "What is Basic Roleplaying",
      "Basic Roleplaying is a roleplaying game where players participate in stories of adventure, horror, or action. One player is the gamemaster (GM) while others play player characters (PCs). Dice rolls determine success or failure.",
      "Introduction"],
    ["Introduction", "Length of Play",
      "Session: 3-5 hours of play. Scenario: A chapter of the story, one or more sessions. Campaign: A series of linked scenarios forming a longer story. One-shot games are standalone scenarios.",
      "Introduction"],
    ["Introduction", "Materials Required",
      "Players need the rules, a pencil, paper, and polyhedral dice: D4, D6, D8, D10, D12, D20. Percentile dice (two D10s or one D10 rolled twice, reading tens then ones). Lower percentile rolls are better.",
      "Introduction"],
    ["Introduction", "Dice and Reading Dice",
      "Percentile (D100): roll two D10s — first is tens, second is ones. Lower is better. Other notation: 3D6 = three six-sided dice. 1D10+1D4 = sum of those dice. D8+1 = D8 plus 1. Rolls never go below 0.",
      "Introduction"],
    ["Introduction", "Responsibilities of the Gamemaster",
      "The GM narrates the game universe, acts as opposition, and must be fair and entertaining. The GM should be familiar with the rules but doesn't need to memorize everything. Scenarios can be published or original.",
      "Introduction"],

    // Character Creation
    ["Character Creation", "The Character Sheet",
      "The character sheet includes: Identity (name, race, gender, handedness, height, weight, description, age, distinctive features, profession). Characteristics & Rolls: STR, CON, SIZ, INT, POW, DEX, APP. Hit Points. Skills (percentage chances). Weapons. Armor. Equipment.",
      "Character Creation"],
    ["Character Creation", "Identity",
      "Identity includes name, race (human default), gender (no mechanical differences), handedness, height/weight (based on SIZ), description (physical appearance, coloration, attitude), age, distinctive features (scars, hairstyles, etc.), and profession.",
      "Character Creation"],
    ["Character Creation", "Characteristics Overview",
      "Seven primary characteristics: STR, CON, SIZ, INT, POW, DEX, APP. Normal humans range from 3 (abysmally low) to 18 (pinnacle), averaging 10-11. Higher means more potent in that ability.",
      "Character Creation"],
    ["Character Creation", "Strength (STR)",
      "STR measures raw physical strength and how effectively the character can exert muscle. Roll 3D6 to determine STR. Characteristic Roll: Effort Roll = STR×5%.",
      "Character Creation"],
    ["Character Creation", "Constitution (CON)",
      "CON measures toughness and resilience. Aids in resisting diseases and determines how much injury a character can suffer before dying. Roll 3D6 to determine CON. Characteristic Roll: Stamina Roll = CON×5%.",
      "Character Creation"],
    ["Character Creation", "Size (SIZ)",
      "SIZ measures physical mass — not necessarily raw height but a general guide to bulk. A high SIZ could be tall/thin, short/thick, or average height/overweight. Roll 2D6+6 to determine SIZ.",
      "Character Creation"],
    ["Character Creation", "Intelligence (INT)",
      "INT measures reasoning power, intellectual acuity, problem-solving ability, and intuition — not necessarily memorized information. Roll 2D6+6 to determine INT. Characteristic Roll: Idea Roll = INT×5%.",
      "Character Creation"],
    ["Character Creation", "Power (POW)",
      "POW measures force of will, personal dynamism, and spiritual energy. High POW = lucky, forceful, beacon of energy. Low POW = often ignored, unlucky. Roll 3D6 to determine POW. Characteristic Roll: Luck Roll = POW×5%. Power Points = POW.",
      "Character Creation"],
    ["Character Creation", "Dexterity (DEX)",
      "DEX measures hand-to-hand coordination, physical speed, and overall agility. Determines how quickly a character acts in combat and provides the basis for Dodge skill. Roll 3D6 to determine DEX. Characteristic Roll: Agility Roll = DEX×5%.",
      "Character Creation"],
    ["Character Creation", "Appearance (APP)",
      "APP measures charisma, grace, beauty, and how appealing the character is to others. Roll 3D6 to determine APP. Characteristic Roll: Charisma Roll = APP×5%. (In some versions, called Charisma or CHA.)",
      "Character Creation"],
    ["Character Creation", "Adjusting Characteristics",
      "If characteristics aren't as desired, the player can move up to 3 points from one characteristic to another. No requirement to move all 3 points. If numbers still don't fit, ask the GM about rerolling.",
      "Character Creation"],

    // Characteristic Rolls
    ["Character Creation", "Characteristic Rolls",
      "Each characteristic roll is made against the characteristic multiplied by 5, expressed as a percentage chance. STR 10 = Effort roll of 50%. Effort Roll (STR×5): forceful manipulation. Stamina Roll (CON×5): prolonged physical exertion. Idea Roll (INT×5): flash of inspiration. Luck Roll (POW×5): fate/random chance. Agility Roll (DEX×5): hand/eye coordination. Charisma Roll (APP×5): raw charisma and personal charm.",
      "Character Creation"],

    // Derived Characteristics
    ["Character Creation", "Move (MOV)",
      "MOV determines how far the character can move in a combat round. All humans have MOV 10. Each point = 1 meter walking, or 3 meters per point if running.",
      "Character Creation"],
    ["Character Creation", "Hit Points (HP)",
      "Hit Points = (CON + SIZ) ÷ 2 (rounding up). Subtracted as the character takes damage. At 1-2 HP, fall unconscious. At 0 HP at end of combat round, the character is dead.",
      "Character Creation"],
    ["Character Creation", "Power Points",
      "Power Points = POW. Spent to use magic or other powers. At 0 power points, fall unconscious. All power points regenerate after one full day with a night's rest.",
      "Character Creation"],
    ["Character Creation", "Damage Bonus",
      "STR + SIZ determines damage bonus. 2-12: –1D6. 13-16: –1D4. 17-24: None. 25-32: +1D4. 33-40: +1D6. 41-56: +2D6. Applied to damage rolled for any melee weapon attack.",
      "Character Creation"],

    // Skills overview
    ["Skills", "Skill Ratings",
      "Skills rated as percentage chance of success (0% to 100%+). Skill points added to base skill chance. Below 05% = hapless novice. 06-25% = neophyte. 26-50% = amateur. 51-75% = competent professional. 76-90% = expert. 91%+ = mastery. Skills above 100% indicate secret knowledge or competence not accessible to others.",
      "Skills"],
    ["Skills", "Skill Success vs Daily Competency",
      "A skill rating of 25% does not mean the character fails 75% of the time in daily activities — only under stressful situations (adventuring, combat) does the character succeed only a quarter of the time. Mundane activities don't require skill rolls.",
      "Skills"],
    ["Skills", "Skill Specialties",
      "Many skills have specialties. Each specialty is a separate skill at that base percentage. Example: Knowledge (Law) 70% does not mean all Knowledge skills are at 70% — only Law. Other specialties remain at base chance unless points are spent.",
      "Skills"],

    // System - Core Mechanics
    ["System", "Success or Failure",
      "The most important question: 'Do I succeed or do I fail?' Characters use D100, rolling against skill chance. Roll equal to or less than the skill chance = success. Roll over = failure. Combat skills are always rolled.",
      "System"],
    ["System", "Difficulty Modifiers",
      "Automatic: don't roll, auto-success. Easy: double the skill chance. Normal: standard chance. Difficult: half the skill chance (round up). Impossible: no roll, just fails. Fighting in near-dark may make all skills Difficult.",
      "System"],
    ["System", "Special Success",
      "A special success equals 1/5 of the skill chance (rounded up). Skill 60% = special on 01-12. In normal use, special success means especially good result. In combat, special success does additional damage: weapon's max damage + normal rolled damage + damage bonus.",
      "System"],
    ["System", "Skill vs Skill (Opposed Rolls)",
      "If all parties fail: stalemate. If only one succeeds: that party wins. If both succeed with same quality (special vs special, success vs success), highest skill rating wins. Comparing levels: Special > Success > Failure. Special vs success: special becomes success, success becomes failure. Special vs failure: special achieves double intended result.",
      "System"],

    // Resistance Table
    ["System", "The Resistance Table",
      "Used when a raw characteristic is pitted against another. Cross-index active characteristic to passive characteristic on the table for percentage chance. Equal forces have 50/50. Player-controlled side rolls. Common uses: STR vs SIZ (lifting), STR vs STR (arm wrestling), CON vs CON (drinking), POW vs POW (psychic battle), DEX vs DEX (race), CON vs poison POT.",
      "System"],

    // Experience
    ["System", "Experience",
      "First successful use of a skill in an adventure: check the box. At adventure end, make experience roll: roll D100 *higher* than current skill. If successful, add 1D6 to the skill. A roll of 100 always improves. Easy-modified skills don't count. Non-threatening situations don't count. Different specialties count separately. A teacher with successful Teach roll may grant an extra experience check.",
      "System"],

    // Time
    ["Time", "Narrative Time",
      "Most roleplaying takes place in narrative time — real-time conversation. Travel or long periods compress greatly. When roleplaying, narrative time resembles real time.",
      "Time"],
    ["Time", "The Turn",
      "A turn equals 5 minutes (25 combat rounds). Used for general movement without conflict, or measuring time for non-combat activities like picking a lock or researching.",
      "Time"],
    ["Time", "The Combat Round",
      "A combat round is 12 seconds of fast-paced activity. A character gets one attack/action and potentially multiple defensive actions. Walk 10 meters or run 30 meters if doing nothing else.",
      "Time"],
    ["Time", "Skill Time",
      "A few seconds: most attacks, parries, Dodge, Drive, First Aid (hasty), Hide, Listen, Spot, Swim. 1-5 minutes: Appraise, Bargain, Climb, Command, Demolition, Fast Talk, First Aid, Insight, Medicine, Repair, Stealth. 5-30 minutes: Craft, Disguise, Etiquette, Knowledge, Language, Navigate, Perform, Science, Status. 30-60 minutes: Art, Craft (complex), Psychotherapy, Research, Teach. 6 hours to days: Art, Craft, Psychotherapy, Repair (major), Research, Strategy, Teach (extended).",
      "Time"],

    // Combat
    ["Combat", "The Combat Round Phases",
      "Four phases repeat each round: 1. Statement of Intent — declare actions in DEX rank order. 2. Movement — move up to 30m with no actions other than defensive, or 6-15m at half DEX rank, or 16-29m at quarter DEX rank. 3. Actions — attacks, resolutions. 4. Resolution — apply damage and results.",
      "Combat"],
    ["Combat", "Statement of Intent",
      "GM and players announce intentions in order of DEX characteristic, highest to lowest. Defensive actions (parries, dodges) not declared now. On tied DEX: missile weapons before melee, then long before medium before short weapons. If still tied, higher skill goes first. If still tied, simultaneous.",
      "Combat"],
    ["Combat", "DEX Rank Order",
      "Characters act on DEX rank. Same DEX rank: missile weapons first, then long weapons (spears, lances), then medium (swords, axes), then short (daggers) and unarmed. Parries and dodges occur within same DEX rank as the original attack.",
      "Combat"],
    ["Combat", "Attacking",
      "Roll D100 ≤ attack chance. Lower is better. Less than 1/5 of attack chance = special success. At GM discretion, related specialty skill may be used as Difficult (1/2 chance). Special success on attack is better than normal success and requires equally successful parry or dodge to avoid.",
      "Combat"],
    ["Combat", "Parrying",
      "After attack roll: roll D100 ≤ parry skill (same as weapon's attack skill). Must be aware of and see the attack. Special success needed to fully counter a special attack. Cannot parry firearms or high-velocity weapons (energy weapons). Generally need shield to parry missile weapons. Weapons and shields can take damage from parrying and break if HP overcome.",
      "Combat"],
    ["Combat", "Dodging",
      "After attack roll: roll D100 ≤ Dodge skill. Must be aware of and see the attack. Special success needed to fully avoid a special attack. Cannot dodge firearms or high-velocity weapons. GM may allow dodging arrows/thrown weapons as Difficult (half normal skill).",
      "Combat"],
    ["Combat", "Attack and Defense Matrix",
      "Special attack vs special parry/dodge: defender blocks, no other result. Special attack vs success parry/dodge: attack partially blocked, achieves normal success, armor subtracted, parrying weapon/shield takes 2 damage. Special attack vs failure/failed: full special damage plus normal damage bonus, armor subtracted. Success attack vs special parry/dodge: attacker's weapon takes 1 damage (melee). Success vs success: defender blocks. Success vs failure: attack strikes, damage normal. Failure: no damage.",
      "Combat"],
    ["Combat", "Damage and Injury",
      "When a weapon hits, damage points (after armor) subtracted from current HP. Example: 12 HP character in hard leather (2 armor) takes 6 damage. 6 - 2 armor = 4 HP damage, reduced to 8 HP. At 2 HP: fall unconscious 1D6 hours. At 0 HP and remains 0 at round end: dead. Characters can have negative HP — First Aid must bring back to positive. Successful First Aid restores 1D3 HP per injury (only once per injury, only up to the wound's total).",
      "Combat"],
    ["Combat", "Healing",
      "Natural healing: 1D3 HP per game week. Hospital/ideal conditions: maximum (3) per week. First Aid: 1D3 HP per injury (once per wound), takes 1 combat round. At 0 HP, First Aid can save from death if brings HP to 1+ by round end. Each injury tracked separately.",
      "Combat"],

    // Spot Rules
    ["Spot Rules", "Ambush",
      "If attacker makes Stealth/Hide roll vs target's Listen/Sense/Spot, attacker gets one combat round where all missile attacks are Easy. Melee ambush: defender can only Dodge or parry (if weapon available) for one round. Next round, combat normal.",
      "Spot Rules"],
    ["Spot Rules", "Backstab",
      "Target unaware of attacker's whereabouts in combat: make Difficult Listen, Sense, or Spot roll. If target remains unaware, attacker behind/side gets Easy attack. Dodging or parrying this attack is Difficult.",
      "Spot Rules"],
    ["Spot Rules", "Cover",
      "Cover up to character's SIZ: missile attacks become Difficult. Attack that would hit but misses hits the cover instead. GM determines if attack passes through cover (brick/metal wall stops completely, thin wood reduces by 4 points, etc.).",
      "Spot Rules"],
    ["Spot Rules", "Darkness",
      "Near-total darkness: all combat skills become Difficult. Pitch black: all combat skills = POW expressed as a percentage or are Difficult, whichever is lower.",
      "Spot Rules"],
    ["Spot Rules", "Disease",
      "Minor disease: Stamina roll (CON×5) to avoid. Failure means contraction. Recovery: CON×2 on day 2, CON×3 on day 3, increasing multiplier until overcome. Moderate to major diseases: may attack CON or HP. Symptoms vary. Only 1-2 HP loss over days for minor. Major: 1D3 HP per hour. CON roll failures tracked toward illness severity (Mild, Acute, Severe, Terminal).",
      "Spot Rules"],
    ["Spot Rules", "Drawing a Weapon",
      "Drawing from sheath/holster: reduces effective DEX rank by 5. Putting away takes the same. Dropping a weapon takes no DEX ranks.",
      "Spot Rules"],
    ["Spot Rules", "Falling",
      "1D6 damage per 3 meters, rounded up. 7m fall = 3D6. Successful Dodge reduces by 1D6 at GM discretion.",
      "Spot Rules"],
    ["Spot Rules", "Firing into Combat",
      "Firing at character engaged in combat: –20% to skill chance. Firing while both attacker and target are engaged in combat: attack is Difficult.",
      "Spot Rules"],
    ["Spot Rules", "Knockout Attacks",
      "Attempt to knock unconscious: Difficult attack, roll damage normally (subtract armor). If damage > half target's normal HP total, target knocked out (no actual damage). If damage ≤ half normal HP, attack does minimum possible damage and target is NOT knocked out.",
      "Spot Rules"],
    ["Spot Rules", "Poison",
      "Poisons have potency (POT) matched against target's CON on resistance table. If poison overcomes CON: full POT as damage to HP or specified characteristic. If not: half POT (round up) as damage. Delay: 3 combat rounds (fast) or 3 turns (slow). Antidotes: subtract antidote POT from poison POT if taken within 6 turns before poisoning.",
      "Spot Rules"],
  ];
  for (const r of rules) s.run(...r);
}

// ─── CHARACTERISTICS ────────────────────────────────────────────────────────

function seedBrpCharacteristics(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_characteristics (name, abbreviation, dice, description, characteristic_roll) VALUES (?, ?, ?, ?, ?)");
  const chars = [
    ["Strength", "STR", "3D6", "Raw physical strength and how effectively the character can exert muscle to accomplish strenuous physical feats.", "Effort Roll (STR×5%) — forceful manipulation of objects or environment"],
    ["Constitution", "CON", "3D6", "Toughness and resilience. Aids in resisting diseases and determines how much injury a character can suffer before dying.", "Stamina Roll (CON×5%) — prolonged physical exertion and tests of fortitude"],
    ["Size", "SIZ", "2D6+6", "A measure of physical mass — general guide to bulk, not necessarily raw height. Affects hit points and damage bonus.", "None — used as passive characteristic on resistance table"],
    ["Intelligence", "INT", "2D6+6", "Reasoning power, intellectual acuity, problem-solving ability, and intuition — not necessarily memorized information.", "Idea Roll (INT×5%) — flash of inspiration, knowing something the player may not"],
    ["Power", "POW", "3D6", "Force of will, personal dynamism, and spiritual energy. High POW = lucky, forceful. Low POW = often ignored, unlucky.", "Luck Roll (POW×5%) — fate/random chance. Also determines Power Points"],
    ["Dexterity", "DEX", "3D6", "Hand-to-hand coordination, physical speed, and overall agility. Determines combat action order and Dodge skill.", "Agility Roll (DEX×5%) — hand/eye coordination and natural agility"],
    ["Appearance", "APP", "3D6", "Charisma, grace, beauty/handsomeness, and how appealing the character is to others. Sometimes called Charisma (CHA).", "Charisma Roll (APP×5%) — raw charisma and personal charm to gain attention or sway others"],
  ];
  for (const c of chars) stmt.run(...c);
}

// ─── DERIVED CHARACTERISTICS ────────────────────────────────────────────────

function seedBrpDerivedCharacteristics(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_derived_characteristics (name, formula, description) VALUES (?, ?, ?)");
  const derived = [
    ["Move (MOV)", "10 (all humans)", "Determines how far the character can move in a combat round. 1 point = 1 meter walking, 3 meters per point running. All humans have MOV 10."],
    ["Hit Points (HP)", "(CON + SIZ) ÷ 2 (round up)", "Measures damage capacity. At 1-2 HP: unconscious. At 0 HP at end of combat round: dead. Natural healing: 1D3 per week."],
    ["Power Points", "POW", "Spent to use magic or powers. At 0: unconscious. Full regeneration after one day with night's rest."],
    ["Damage Bonus", "STR + SIZ (see table)", "Added to melee weapon damage. 2-12: –1D6. 13-16: –1D4. 17-24: None. 25-32: +1D4. 33-40: +1D6. 41-56: +2D6."],
  ];
  for (const d of derived) stmt.run(...d);
}

// ─── SKILLS ─────────────────────────────────────────────────────────────────

function seedBrpSkills(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_skills (name, base_chance, description, specialty_note) VALUES (?, ?, ?, ?)");
  const skills = [
    ["Appraise", "15%", "Judging the value of an item or determining some aspects of its capabilities that are not immediately apparent.", null],
    ["Art", "05%", "Painting, drawing, sculpture, photography, or another form of visual art. Each type is a specialty.", "Specialties: Architecture, Calligraphy, Film, Painting, Photography, Sculpture, etc."],
    ["Artillery", "% by weapon", "Using heavy mounted weaponry such as catapults, cannons, missile launchers. Each type is a specialty.", "Specialties: Cannon, Rocket Launcher, Siege Engine, etc."],
    ["Bargain", "05%", "Negotiating financial matters successfully. Successful use lowers price by one price range.", null],
    ["Brawl", "25%", "Hitting someone in hand-to-hand combat — punch, head butt, kick, or bite. Does 1D3 damage.", null],
    ["Climb", "40%", "Scaling a wall, rope, or other difficult surface.", null],
    ["Command", "05%", "Leading a group of followers in combat or other difficult activity requiring discipline and coordinated actions. If this fails, everyone is on their own.", null],
    ["Craft", "05%", "Creating physical items: woodworking, blacksmithing, sewing, cooking. More practical than Art. Each type is a specialty.", "Specialties: Blacksmithing, Carpentry, Cooking, Sewing, etc."],
    ["Demolition", "01%", "Setting and detonating explosives to achieve maximum effect.", null],
    ["Disguise", "01%", "Concealing identity or appearance, using makeup and costume to appear as someone or something else.", null],
    ["Dodge", "DEX×2%", "Avoiding injury from a physical attack. Base chance calculated as DEX multiplied by 2.", null],
    ["Drive", "20% or 01%", "Piloting a ground vehicle. Modern characters: 20%. Historical: 01%. Each vehicle type is a specialty.", "Specialties: Automobile, Cart, Chariot, Truck, etc."],
    ["Energy Weapon", "% by weapon", "Pointing and shooting an energy weapon at a target. Each type is a specialty.", "Specialties: Energy Pistol, Energy Rifle, etc."],
    ["Etiquette", "05%", "Knowing what to say and how to behave in social situations, understanding niceties of a particular social class.", null],
    ["Fast Talk", "05%", "Talking one's way out of a rough situation or bluffing when there is no time for reasoned argument.", null],
    ["Fine Manipulation", "05%", "Finger dexterity, particularly important for disassembling things in a hurry or completing complex tasks requiring hand coordination. May be used for picking locks.", null],
    ["Firearm", "% by weapon", "Pointing and shooting a firearm at a target. Each type is a specialty.", "Specialties: Machine Gun, Pistol, Revolver, Rifle, Shotgun, Submachine Gun"],
    ["First Aid", "30% or INT×1%", "Treating minor injuries. Modern/future characters: 30%. Historical: INT×1%. Successful use restores 1D3 HP. Special success: 1D3+3 HP.", null],
    ["Fly", "DEX×½% or DEX×4%", "Technological means (jet pack): DEX×½%. Natural ability (wings): DEX×4%. Basic flight doesn't require a roll — the skill is for maneuvers, combat, and complex flying stunts.", null],
    ["Gaming", "INT+POW%", "Knowledge of the rules and odds of various games of chance (cards, dice) and winning.", null],
    ["Grapple", "25%", "Wrestling or other open-handed combat relying on leverage and positioning to maneuver or immobilize an opponent.", null],
    ["Heavy Machine", "01%", "Handling and maintaining a heavy machine, like a factory press, thresher, etc. Each type is a specialty.", "Specialties: various heavy machinery types"],
    ["Heavy Weapon", "% by weapon", "Pointing and shooting a heavy weapon. Each type is a specialty.", "Specialties: Bazooka, Heavy Machinegun, Mini-gun, Rocket Launcher, etc."],
    ["Hide", "10%", "Concealing oneself or an item from view. Often used in conjunction with Stealth.", null],
    ["Insight", "05%", "Evaluating another character's concealed thoughts and/or motives based on subliminal clues.", null],
    ["Jump", "25%", "Leaping over an obstacle or across a span. Success usually equals roughly 3 meters horizontally or 1 meter vertically.", null],
    ["Knowledge", "05% or 01%", "Familiarity with a specific branch of study. Modern/future: 05%. Historical: 01%. Each type is a specialty.", "Specialties: Anthropology, Archaeology, Area (region), Folklore, Group (organization), History, Linguistics, Literature, Mythology, Occult, Politics, Streetwise, etc."],
    ["Language (Own)", "INT×5%", "Speaking and understanding the character's native language. Generally no roll needed for normal conversation with native speakers.", null],
    ["Language (Other)", "00%", "Speaking and understanding another language. Each language is a separate specialty.", "Specialties: each language"],
    ["Listen", "25%", "Hearing a noise or faint sound, such as someone sneaking by or a monster approaching.", null],
    ["Literacy", "equal to Language", "Understanding and comprehension of what the character is reading. In settings where literacy is not universal, may begin at 00%.", null],
    ["Martial Arts", "01%", "Using disciplined fighting techniques to deliver more powerful blows or block without taking damage. If Brawl attack also rolls under Martial Arts: damage die (not bonus) doubled. Parrying melee weapon with Brawl: ignore 3 damage.", null],
    ["Medicine", "05% or 00%", "Treatment of serious medical conditions through pharmaceutical, therapeutic, or surgical means. Modern/future: 05%. Historical: 00%. Time-consuming, does not restore HP immediately.", null],
    ["Melee Weapon", "% by weapon", "Using a hand-to-hand weapon in combat, including striking and parrying. Each type is a specialty.", "Specialties: Axe, Club, Dagger, Flail, Hammer, Mace, Polearm, Spear, Staff, Sword, etc."],
    ["Missile Weapon", "% by weapon", "Aiming and hitting a target with a 'hand-powered' weapon. Each type is a specialty.", "Specialties: Bow, Crossbow, Sling, etc."],
    ["Navigate", "10%", "Charting and following a path through recognizable landmarks, constellations, or using a map to find a course.", null],
    ["Perform", "05%", "Entertaining or performing through music, acting, acrobatics, comedy, etc. Each type is a specialty.", "Specialties: Acting, Acrobatics, Comedy, Dance, Music, Singing, etc."],
    ["Persuade", "15%", "Using logic, reason, and emotional appeal to convince someone to agree to a specific course of action. Unlike Fast Talk, Persuade takes time, supporting arguments, and a willing audience.", null],
    ["Pilot", "01%", "Operating an air, sea, or space vehicle. Each vehicle type is a specialty. Some vehicles may require multiple pilots.", "Specialties: Airplane, Boat, Helicopter, Spaceship, etc."],
    ["Projection", "DEX×2%", "If powers (magic, super, psychic) are used, this is the ability to direct a powered attack at a target.", null],
    ["Psychotherapy", "01%", "Using psychiatry and psychological analysis to determine and treat a patient's psychological issues. First Aid heals the body; Psychotherapy heals the mind. Lengthy process involving multiple sessions.", null],
    ["Repair", "15%", "Fixing something broken, jammed, disassembled, or otherwise inoperable. Each type is a specialty.", "Specialties: Electrical, Electronic, Mechanical, Structural, Quantum, etc."],
    ["Research", "25%", "Using a source of references (library, newspaper archive, computer network, internet, wizard's grimoire) to discover desired pieces of information.", null],
    ["Ride", "05%", "Riding an animal and controlling it in difficult situations. Each type of animal is a specialty.", "Specialties: Horse, Dragon, Giant Owl, etc."],
    ["Science", "01%", "Expertise in a field of study from the 'hard sciences.' Each type is a specialty.", "Specialties: Astronomy, Biology, Botany, Chemistry, Genetics, Geology, Mathematics, Meteorology, Physics, Zoology, etc."],
    ["Sense", "10%", "A combination of scent, taste, and touch — being able to detect subtle or hidden things with these senses.", null],
    ["Shield", "% by shield type", "Parrying a blow with a shield. Each type is a specialty.", "Specialties: Buckler, Energy, Full, Half, Heater, Hoplite, Kite, Round, etc."],
    ["Sleight of Hand", "05%", "Feats of prestidigitation and misdirection, such as picking pockets, palming coins, card tricks, and sleight-of-hand illusions.", null],
    ["Spot", "25%", "Detecting those things difficult to notice or otherwise hidden.", null],
    ["Status", "15%", "Social standing, or the ability to manipulate one's social environment in a favorable manner — borrowing money, gaining favors, impressing others. Each type is a specialty.", "Specialties: City (particular city), Group (organization), High Society, Religion, Species, etc."],
    ["Stealth", "10%", "Sneaking around to avoid detection or making otherwise concealed and furtive movements.", null],
    ["Strategy", "01%", "Tactical assessment of a situation and constructing an optimal response, gaining insight into battlefield conditions or enemy tactics. Often utilized in military or political situations.", null],
    ["Swim", "25%", "Guiding oneself through the water with the intent of movement or prevention of drowning.", null],
    ["Teach", "10%", "Imparting knowledge to others. See Experience section for more information.", null],
    ["Technical Skill", "00%", "Use of a sophisticated piece of equipment or technical process. Base chance varies by setting. Each type is a specialty.", "Specialties: Computer Programming, Computer Use, Electronics, Robotics, Sensor Systems, Siege Engines, Traps, etc."],
    ["Throw", "25%", "Aiming and tossing something (dart, football, baseball, rock, hat) through the air towards a target. Not specifically a weapon skill — a successful roll doesn't necessarily damage an opponent.", null],
    ["Track", "10%", "Following a trail of footprints, spoor, etc. in either direction.", null],
  ];
  for (const sk of skills) stmt.run(...sk);
}

// ─── PROFESSIONS ────────────────────────────────────────────────────────────

function seedBrpProfessions(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_professions (name, description, professional_skills) VALUES (?, ?, ?)");
  const professions = [
    ["Cowboy", "Rancher, wrangler, or frontiersman skilled in outdoor survival and animal handling.",
      "Craft (usually knots), Firearm (Rifle), Knowledge (Natural History), Knowledge (Local Area), Listen, Navigate, Ride, Spot, Throw, Track"],
    ["Detective", "Investigator skilled in uncovering crimes, reading people, and following leads.",
      "Firearm (Handgun), Knowledge (Law), Listen, Persuade, Spot, Research, and four of: Art, Brawl, Disguise, Dodge, Drive, Fast Talk, Firearm (any), Grapple, Hide, Insight, Knowledge (any), Language (Other), Language (Own), Medicine, Ride, Science (any), Technical (Computer Use), Stealth, or Track"],
    ["Doctor", "Medical professional trained in healing and patient care.",
      "First Aid, Language (Own), Medicine, Persuade, Research, Spot, and four of: Insight, Language (Other), Psychotherapy, Science (any), Status"],
    ["Hunter", "Outdoorsman skilled in tracking, trapping, and surviving in the wilderness.",
      "Climb, Hide, Listen, Navigate, Spot, Stealth, Track, and three of: Firearm (Handgun, Rifle, or Shotgun), Knowledge (Natural History or Region), Melee Weapon (usually Spear), Missile Weapon (any), Language (Other), Ride"],
    ["Lawman", "Peace officer, sheriff, or marshal skilled in upholding the law and dealing with criminals.",
      "Brawl, Dodge, Fast Talk, Knowledge (Law), Listen, Spot, and four of: Drive, Firearms (any), First Aid, Grapple, Insight, Knowledge (Region or Group), Language (Other), Martial Arts, Melee Weapon (any), Missile Weapon (any), Pilot (any), Ride, Status, Technical (Computer Use), or Track"],
    ["Noble", "Member of the upper class with status, education, and social connections.",
      "Bargain, Drive, Etiquette, Language (Own), Language (Other), Literacy, Status, plus any other three skills as hobbies or fields of interest"],
    ["Sailor", "Seafarer skilled in ship handling, navigation, and maritime survival.",
      "Climb, Craft (any), Dodge, Grapple, Navigate, Pilot (Boat), Swim, and any three of: Artillery (any, usually shipboard), Command, Language (Other), Listen, Repair (Mechanical), Repair (Structural), Spot"],
    ["Scientist", "Researcher and academic skilled in investigation and technical knowledge.",
      "Craft (any), Persuade, Research, Status, Technical (Computer Use) or Heavy Machine, and any five appropriate Knowledge or Science skills related to field of study"],
    ["Soldier", "Professional military fighter trained in weapons, tactics, and field operations.",
      "Brawl, Climb, Dodge, First Aid, and six of: Artillery, Command, Drive, Firearm (usually Rifle, but any), Grapple, Heavy Weapon (any), Hide, Language (Other), Listen, Jump, Medicine, Melee Weapon (any), Missile Weapon (any), Navigate, Repair (Mechanical), Ride, Spot, Stealth, or Throw"],
    ["Spy", "Covert operator skilled in infiltration, intelligence gathering, and counter-surveillance.",
      "Dodge, Fast Talk, Hide, Listen, Research, Spot, Stealth, and three of: Art (Photography), Brawl, Disguise, Etiquette, Firearm (any), Grapple, Insight, Knowledge (any), Language (Other), Language (Own), Martial Arts, Navigate, Pilot (any), Repair (Electronics), Repair (Mechanical), Ride, Swim, Technical (Computer Use), Throw, or Track"],
    ["Thief", "Criminal skilled in stealth, deception, and acquiring valuables.",
      "Appraise, Dodge, Fast Talk, Hide, Stealth, and five of: Bargain, Brawl, Climb, Disguise, Fine Manipulation, Firearm (Handgun or Shotgun), Grapple, Insight, Listen, Jump, Knowledge (Law), Persuade, Repair (Mechanical), or Spot"],
    ["Warrior", "Fighter trained in many forms of combat, from medieval melee to ranged weapons.",
      "Brawl, Dodge, Grapple, Melee Weapon (any), Missile Weapon (any), and five of: Climb, Firearm (any), Hide, Listen, Jump, Language (Other), Martial Arts, Ride, Spot, Stealth, Swim, Throw, Track"],
  ];
  for (const p of professions) stmt.run(...p);
}

// ─── MELEE WEAPONS ──────────────────────────────────────────────────────────

function seedBrpWeaponsMelee(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_weapons_melee (name, skill, base_chance, damage, hands, hit_points, range) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const weapons = [
    ["Axe, Battle", "Melee Weapon (Axe)", 15, "1D8+2+db", "1H", 15, null],
    ["Axe, Great", "Melee Weapon (Axe)", 15, "2D6+2+db", "2H", 15, null],
    ["Axe, Hand", "Melee Weapon (Axe)", 15, "1D6+1+db", "1H", 12, null],
    ["Brawl (Unarmed)", "Brawl", 25, "1D3+db", "1H", null, null],
    ["Club, Heavy", "Melee Weapon (Club)", 25, "1D8+db", "2H", 22, null],
    ["Club, Light", "Melee Weapon (Club)", 25, "1D6+db", "1H", 15, null],
    ["Dagger", "Melee Weapon (Dagger)", 25, "1D4+db", "1H", 15, null],
    ["Halberd", "Melee Weapon (Polearm)", 15, "3D6+db", "2H", 25, null],
    ["Hammer", "Melee Weapon (Hammer)", 25, "1D6+db", "1H", 15, null],
    ["Hammer, Great", "Melee Weapon (Hammer)", 25, "1D10+3+db", "2H", 15, null],
    ["Knife", "Melee Weapon (Dagger)", 25, "1D3+1+db", "1H", 15, null],
    ["Mace, Heavy", "Melee Weapon (Mace)", 25, "1D8+2+db", "2H", 10, null],
    ["Mace, Light", "Melee Weapon (Mace)", 25, "1D6+2+db", "1H", 6, null],
    ["Pike", "Melee Weapon (Polearm)", 15, "1D10+2+db", "2H", 12, null],
    ["Staff, Quarter", "Melee Weapon (Staff)", 25, "1D8+db", "2H", 8, null],
    ["Spear, Long", "Melee Weapon (Spear)", 15, "1D10+db", "2H", 10, null],
    ["Sword, Broad", "Melee Weapon (Sword)", 15, "1D8+1+db", "1H", 12, null],
    ["Sword, Great", "Melee Weapon (Sword)", 5, "2D8+db", "2H", 12, null],
    ["Sword, Short", "Melee Weapon (Sword)", 15, "1D6+1+db", "1H", 12, null],
  ];
  for (const w of weapons) stmt.run(...w);
}

// ─── MISSILE WEAPONS ────────────────────────────────────────────────────────

function seedBrpWeaponsMissile(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_weapons_missile (name, skill, base_chance, damage, hands, hit_points, range, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const weapons = [
    ["Axe, Hand (thrown)", "Missile Weapon (Throwing Axe)", 10, "1D6+½db", "1H", 12, "20m", null],
    ["Bow, Long", "Missile Weapon (Bow)", 5, "1D8+1+½db", "2H", 10, "90m", null],
    ["Crossbow, Heavy", "Missile Weapon (Crossbow)", 25, "2D6+2", "2H", 18, "55m", "Takes full round to reload; fire every other round"],
    ["Crossbow, Light", "Missile Weapon (Crossbow)", 25, "1D6+2", "2H", 10, "40m", "Takes full round to reload; fire every other round"],
    ["Dagger (thrown)", "Missile Weapon (Throwing Dagger)", 15, "1D4+½db", "1H", 15, "10m", null],
    ["Knife (thrown)", "Missile Weapon (Throwing Dagger)", 15, "1D3+1+½db", "1H", 10, "10m", null],
    ["Pistol", "Firearm (Pistol)", 20, "1D8", "1H", 8, "20m", "Holds 6 shots"],
    ["Pistol, Laser", "Energy Weapon (Laser Pistol)", 20, "1D8", "1H", 14, "20m", "20 shot charges"],
    ["Rifle", "Firearm (Rifle)", 25, "2D6", "2H", 12, "80m", "Holds 6 shots"],
    ["Rifle, Laser", "Energy Weapon (Laser Rifle)", 15, "2D8", "2H", 20, "100m", "20 shot charges"],
    ["Rock (thrown)", "Throw", null, "1D2+½db", "1H", null, "20m", null],
    ["Sling", "Missile Weapon (Sling)", 5, "1D8+½db", "2H", 2, "80m", null],
  ];
  for (const w of weapons) stmt.run(...w);
}

// ─── ARMOR ──────────────────────────────────────────────────────────────────

function seedBrpArmor(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_armor (name, armor_points, skill_modifier) VALUES (?, ?, ?)");
  const armor = [
    ["Bulletproof Vest", 8, "−5% to physical skills"],
    ["Chain", 7, "−20% to physical skills"],
    ["Clothing, Heavy", 1, "None"],
    ["Flak Jacket", 4, "−10% to physical skills"],
    ["Helmet, Heavy", 2, "−50% to perception skills. Adds +2 armor to head."],
    ["Helmet, Light", 1, "−15% to perception skills. Adds +1 armor to head."],
    ["Hoplite Panoply", 6, "−20% to physical skills"],
    ["Leather, Hard", 2, "−10% to physical skills"],
    ["Leather, Soft", 1, "None"],
    ["Plate, Full", 8, "−25% to physical skills"],
    ["Quilted", 2, "−5% to physical skills"],
    ["Riot Gear", 12, "−10% to physical skills. 12 armor vs melee, 6 vs missiles."],
  ];
  for (const a of armor) stmt.run(...a);
}

// ─── SHIELDS ────────────────────────────────────────────────────────────────

function seedBrpShields(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_shields (name, base_chance, skill, hit_points, damage) VALUES (?, ?, ?, ?, ?)");
  const shields = [
    ["Heater", 15, "Shield", 12, "1D3+db"],
    ["Hoplite", 15, "Shield", 16, "1D4+db"],
    ["Kite", 15, "Shield", 16, "1D4+db"],
    ["Riot", 15, "Shield", 16, "1D3+db"],
    ["Round", 15, "Shield", 12, "1D3+db"],
    ["Target", 15, "Shield", 12, "1D2+db"],
  ];
  for (const s of shields) stmt.run(...s);
}

// ─── SPOT RULES ─────────────────────────────────────────────────────────────

function seedBrpSpotRules(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_spot_rules (topic, content, category) VALUES (?, ?, ?)");
  const rules = [
    ["Ambush", "If attacker successfully made Stealth or Hide roll vs Listen, Sense, or Spot and remained undetected, they can ambush. Missile weapons: one full combat round where all attacks are Easy. Melee: defender can only Dodge or parry (if armed) for one round. Next round: combat normal.", "Combat"],
    ["Backstab", "If target is unaware of attacker's specific whereabouts in combat, target must make a Difficult Listen, Sense, or Spot roll. If target remains unaware (fails), attacker behind or to the side gets an Easy attack. Dodging or parrying this attack is Difficult.", "Combat"],
    ["Cover", "Hiding behind something larger, equal to, or up to half the character's SIZ offers a defensive bonus. Missile attacks become Difficult. An attack that would hit but misses hits the cover. GM determines if attack passes through cover, reducing damage appropriately.", "Combat"],
    ["Darkness", "Near-total darkness (without night vision): all combat skills become Difficult. Pitch black darkness: all combat skills equivalent to POW expressed as a percentage or Difficult, whichever is lower.", "Environment"],
    ["Disease", "Minor disease: Stamina roll (CON×5) to avoid. Success = avoided. Failure = contraction. Recovery: CON×2 day 2, CON×3 day 3, increasing multiplier each day until overcome. Character must rest. Less-than-ideal conditions reduce CON roll by one multiple per condition. Medicine skill may increase CON multiple.", "Environment"],
    ["Illness Severity",
      "Track failed CON rolls: 0 = None. 1 = Mild (lose 1 characteristic point/week). 2 = Acute (lose 1 CP/day). 3 = Severe (lose 1 CP/hour). 4+ = Terminal (lose 1 CP/minute). First CP lost when contracting disease. Type of disease dictates what CP are lost. At 0 CP in a characteristic: death. Recovery restores 1 CP/week once free of disease.",
      "Environment"],
    ["Drawing a Weapon", "Drawing a weapon from sheath or holster reduces effective DEX rank by 5. Putting away takes the same amount. Dropping a weapon takes no DEX ranks.", "Combat"],
    ["Falling", "A falling character takes 1D6 points of damage per 3 meters distance, rounded up. Example: 7m fall = 3D6 damage. A successful Dodge roll reduces damage by 1D6 at GM discretion.", "Environment"],
    ["Firing into Combat", "Firing a missile weapon at a character engaged in combat: −20% penalty to skill. Firing while both attacker and target are engaged in combat: attack is Difficult.", "Combat"],
    ["Knockout Attacks", "To knock someone unconscious: make a Difficult attack and roll damage normally, subtracting armor. If damage > half the character's normal HP total: knocked out with no actual damage. If damage ≤ half normal HP: attack does minimum possible damage (lowest dice + minimum bonus) and target is NOT knocked out.", "Combat"],
    ["Poison", "All poisons have a potency value (POT) matched against target's CON on the resistance table. If poison overcomes CON: full POT as damage to HP or characteristic. If not: half POT (round up) as damage. Delay: 3 combat rounds (fast) or 3 turns (slow). Antidotes: subtract antidote POT from poison POT if taken within 6 turns before poisoning.", "Environment"],
    ["Healing", "Natural healing: 1D3 HP per game week. Hospital/ideal conditions: maximum (3) per week. Successful First Aid: 1D3 HP per injury, once per wound. A character reduced to 0 HP may be saved if brought to 1+ HP by round end via First Aid.", "Recovery"],
    ["Experience", "First successful skill use in an adventure: check the box. At adventure end: experience roll for each checked skill — roll D100 higher than current skill. If higher, add 1D6. Roll of 100 always improves. Easy-modified skills don't count. Non-threatening situations don't count. Long downtime: 4 free experience checks, rolled as normal.", "Advancement"],
  ];
  for (const r of rules) stmt.run(...r);
}

// ─── SAMPLE FOES ────────────────────────────────────────────────────────────

function seedBrpSampleFoes(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO brp_sample_foes (name, characteristics, move, hit_points, damage_bonus, armor, skills, attacks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const foes = [
    ["Bear (Black)",
      "STR 3D6+10 (20-21), CON 2D6+6 (13), SIZ 3D6+10 (20-21), INT 5, POW 3D6 (10-11), DEX 3D6 (10-11)",
      14, 17, "+2D6", "3-point fur",
      "Climb 40%, Listen 75%, Sense 75%",
      "Bite 25%, 1D10+½db; Claws 40%, 1D6+db; Slap 25%, 1D3+db (knock prone: damage vs target STR on resistance table). Bear can attack twice per round — either two claw attacks or one claw and one bite."],
  ];
  for (const f of foes) stmt.run(...f);
}
