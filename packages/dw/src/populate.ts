// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// DW SCOPE NOTICE:
// The code in this file (functions, control flow, SQL logic) is AGPL-3.0-only.
// The string literals containing game mechanics, move descriptions, class data,
// spell descriptions, equipment stats, monster data, and GM tool entries are
// derivative material of Dungeon World by Sage LaTorra and Adam Koebel,
// converted to Markdown by agude, and are governed exclusively by the Creative
// Commons Attribution 3.0 Unported License (see data/dw/CC-BY-3.0.txt). These
// strings are AGPL-licensed code *structure* but CC-BY-3.0-licensed *content*.
// The resulting database output in data/dw/ is designated under CC-BY-3.0.

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DW_SCHEMA_DDL } from "./schema.sql.js";

let dwDb: Database.Database | null = null;

function getDwDatabase(dbPath: string): Database.Database {
  if (dwDb) return dwDb;
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  dwDb = new Database(dbPath);
  dwDb.pragma("journal_mode = WAL");
  dwDb.pragma("foreign_keys = ON");
  return dwDb;
}

function initDwSchema(db: Database.Database): void {
  for (const stmt of DW_SCHEMA_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    db.exec(stmt + ";");
  }
}

export function populateDwDatabase(dbPath: string): { success: boolean; message: string } {
  if (existsSync(dbPath)) {
    return { success: true, message: `DW database already exists at ${dbPath}. Use --force to re-populate.` };
  }
  const db = getDwDatabase(dbPath);
  initDwSchema(db);
  const tx = db.transaction(() => {
    seedMoves(db);
    seedClasses(db);
    seedSpells(db);
    seedEquipment(db);
    seedMonsters(db);
    seedGmTools(db);
  });
  tx();
  db.exec(`INSERT INTO dw_sections_fts(dw_sections_fts) VALUES ('rebuild');`);
  db.close();
  dwDb = null;
  return { success: true, message: `DW database populated at ${dbPath}` };
}

// ─── MOVES ────────────────────────────────────────────────────────────────────

type MT = [string, string, string | null, string, string | null, string | null, string | null, string | null];

function seedMoves(db: Database.Database): void {
  const s = db.prepare(
    `INSERT OR IGNORE INTO dw_moves (name, description, stat, category, on_success, on_partial, on_miss, source_class) VALUES (?,?,?,?,?,?,?,?)`
  );
  const moves: MT[] = [
    ["Hack and Slash", "When you attack an enemy in melee, roll+Str. On a 10+ you deal your damage to the enemy and avoid their attack. At your option, you may choose to do +1d6 damage but expose yourself to the enemy's attack. On a 7-9, you deal your damage to the enemy and the enemy makes an attack against you.", "STR", "Basic Moves", "You deal your damage to the enemy and avoid their attack. At your option, +1d6 damage but expose yourself to the enemy's attack.", "You deal your damage to the enemy and the enemy makes an attack against you.", null, null],
    ["Volley", "When you take aim and shoot at an enemy at range, roll+Dex. On a 10+ you have a clear shot - deal your damage. On a 7-9, choose one: move to get the shot placing you in danger; take what you can get: -1d6 damage; take several shots reducing ammo by one.", "DEX", "Basic Moves", "Clear shot - deal your damage.", "Choose one: move into danger, -1d6 damage, or reduce ammo.", null, null],
    ["Defy Danger", "When you act despite an imminent threat or suffer a calamity, say how you deal with it and roll. +Str by powering through, +Dex by acting fast, +Con by enduring, +Int with quick thinking, +Wis through mental fortitude, +Cha using charm and social grace.", "Varies", "Basic Moves", "You do what you set out to, the threat does not come to bear.", "You stumble, hesitate, or flinch: the GM will offer you a worse outcome, hard bargain, or ugly choice.", null, null],
    ["Defend", "When you stand in defense of a person, item, or location under attack, roll+Con. On a 10+, hold 3. On a 7-9, hold 1. Spend hold to: Redirect an attack to yourself; Halve the attack's effect/damage; Open up the attacker to an ally (+1 forward); Deal damage equal to your level.", "CON", "Basic Moves", "Hold 3.", "Hold 1.", null, null],
    ["Spout Lore", "When you consult your accumulated knowledge about something, roll+Int. On a 10+ the GM will tell you something interesting and useful about the subject. On a 7-9 the GM will only tell you something interesting - it is on you to make it useful.", "INT", "Basic Moves", "GM tells you something interesting and useful.", "GM only tells you something interesting - you make it useful.", null, null],
    ["Discern Realities", "When you closely study a situation or person, roll+Wis. On a 10+ ask the GM 3 questions. On a 7-9 ask 1. Take +1 forward when acting on the answers. Questions: What happened here recently? What is about to happen? What should I be on the lookout for? What here is useful or valuable? Who is really in control? What here is not what it appears to be?", "WIS", "Basic Moves", "Ask the GM 3 questions from the list.", "Ask 1 question from the list.", null, null],
    ["Parley", "When you have leverage on a GM character and manipulate them, roll+Cha. Leverage is something they need or want. On a hit they ask you for something and do it if you make them a promise first. On a 7-9, they need some concrete assurance of your promise, right now.", "CHA", "Basic Moves", "They do what you want if you make them a promise.", "They need some concrete assurance of your promise, right now.", null, null],
    ["Aid or Interfere", "When you help or hinder someone you have a bond with, roll+Bond with them. On a 10+ they take +1 or -2, your choice. On a 7-9 you also expose yourself to danger, retribution, or cost.", "Bond", "Basic Moves", "They take +1 or -2, your choice.", "They take +1 or -2, but you also expose yourself to danger, retribution, or cost.", null, null],
    ["Last Breath", "When you are dying you catch a glimpse of what lies beyond the Black Gates of Death's Kingdom. Then roll (+nothing). On a 10+ you have cheated death - you are in a bad spot but still alive. On a 7-9 Death offers a bargain: take it and stabilize or refuse and pass beyond.", null, "Special Moves", "You have cheated death - still alive but in a bad spot.", "Death offers a bargain. Take it and stabilize or refuse and pass beyond.", "Your fate is sealed. Marked as Death's own.", null],
    ["Encumbrance", "When you make a move while carrying weight up to or equal to load, you are fine. Load+1 or load+2: you take -1. Greater than load+2: drop at least 1 weight and roll at -1, or automatically fail.", null, "Special Moves", null, null, null, null],
    ["Make Camp", "When you settle in to rest consume a ration. If somewhere dangerous decide the watch order. If you have enough XP you may Level Up. When you wake from a few uninterrupted hours of sleep heal damage equal to half your max HP.", null, "Special Moves", null, null, null, null],
    ["Take Watch", "When you are on watch and something approaches the camp roll+Wis. On a 10+ you wake the camp and prepare a response, the camp takes +1 forward. On a 7-9 you react too late; camp is awake but unprepared. On a miss whatever lurks outside has the drop on you.", "WIS", "Special Moves", "You wake the camp and prepare a response, camp takes +1 forward.", "Camp is awake but has not had time to prepare.", null, null],
    ["Undertake a Perilous Journey", "When you travel through hostile territory, choose trailblazer, scout, and quartermaster. Each rolls+Wis. On a 10+ quartermaster reduces rations by 1, trailblazer reduces time, scout spots trouble. On a 7-9 each performs as expected.", "WIS", "Special Moves", null, null, null, null],
    ["Level Up", "When you have downtime and XP >= current level +7, subtract level+7 from XP, increase level by 1, choose a new advanced move. Choose one stat and increase by 1. Ability scores cannot go higher than 18.", null, "Special Moves", null, null, null, null],
    ["End of Session", "When you reach the end of a session, choose one resolved bond - if other player agrees, mark XP and write a new bond. Check alignment - mark XP if fulfilled. Group questions: Did we learn something new? Did we overcome a notable monster? Did we loot a memorable treasure? Each yes = XP for all.", null, "Special Moves", null, null, null, null],
    ["Carouse", "When you return triumphant and throw a big party, spend 100 coin and roll+extra 100s spent. On a 10+ choose 3. On a 7-9 choose 1. On a miss choose one but things get out of hand. Options: Befriend a useful NPC; Hear rumors of an opportunity; Gain useful information; Not entangled/ensorcelled/tricked.", null, "Special Moves", "Choose 3 options.", "Choose 1 option.", "Still choose one but things get really out of hand.", null],
    ["Supply", "When you go to buy something with gold on hand, if readily available buy at market price. If special, roll+Cha. On a 10+ find it at fair price. On a 7-9 pay more or settle for something similar.", "CHA", "Special Moves", "Find it at a fair price.", "Pay more or settle for something similar.", null, null],
    ["Recover", "When you do nothing but rest in comfort and safety, after one day recover all HP. After three days remove one debility. Under a healer: one debility per two days of rest.", null, "Special Moves", null, null, null, null],
    ["Recruit", "When you put out word to hire help, roll. +1 for generous pay, +1 for stating your goal, +1 for offering a share, +1 for reputation. On a 10+ pick of skilled applicants. On a 7-9 settle for someone close or turn away. On a miss someone influential and ill-suited wants to join.", null, "Special Moves", "Pick of skilled applicants.", "Settle for someone close or turn them away.", "Someone influential and ill-suited declares they want to come along.", null],
    ["Outstanding Warrants", "When you return to a civilized place where you caused trouble before, roll+Cha. On a hit, word has spread and everyone recognizes you. On a 7-9, plus a complication: warrant for arrest; price on your head; or someone important put in a bad spot.", "CHA", "Special Moves", "Word has spread, everyone recognizes you.", "Recognized, plus a complication.", null, null],
    ["Bolster", "When you spend leisure time in study, meditation, or hard practice, gain preparation. 1-2 weeks: 1 preparation. 1+ month: 3 preparation. Spend 1 preparation for +1 to any roll. Only one per roll.", null, "Special Moves", null, null, null, null],
  ];
  for (const m of moves) s.run(...m);
}

// ─── CLASSES ──────────────────────────────────────────────────────────────────

type CT = [string, string, number, string, string, string, string, string, string, string, string];

function seedClasses(db: Database.Database): void {
  const s = db.prepare(
    `INSERT OR IGNORE INTO dw_classes (name, description, base_hp, base_damage, names, look, stats, alignment, bonds, starting_moves, advanced_moves) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  const classes: CT[] = [
    ["Bard", "Smooth tongue and quick wit. Teller of tales and singer of songs. Someone has to fight shoulder-to-shoulder with the goons and write the tale of their own heroism.", 6, "d6",
      "Elf: Astrafel, Daelwyn, Feliana, Damarra, Pendrell, Dagoliir. Human: Baldric, Leena, Dunwick, Willem, Florian, Seraphine, Charlotte, Cassandra",
      "Knowing/Fiery/Joyous Eyes; Fancy/Wild/Stylish Cap; Finery/Traveling/Poor Clothes; Fit/Well-fed/Thin Body",
      "Max HP 6+Con, base damage d6",
      "Good: Perform art to aid another. Neutral: Defuse a tense situation. Chaotic: Spur others to decisive action",
      "Not my first adventure with _____. Sang stories of _____ before meeting. _____ is the butt of my jokes. Writing a ballad about _____. _____ trusted me with a secret. _____ does not trust me",
      "Arcane Art (weave spell: heal 1d8/+1d4 dmg/clear enchantment/+2 aid, roll+Cha). Bardic Lore (choose expertise, ask one question on encounter). Charming and Open (speak frankly, exchange truthful questions). A Port in the Storm (return to visited settlement)",
      "Healing Song, Vicious Cacophony, It Goes To Eleven, Metal Hurlant, Eldritch Tones, Duelist's Parry, Bamboozle, Multiclass Dabbler"],
    ["Cleric", "The lands are lousy with walking dead, beasts, and vast unnatural spaces between safe civilizations. You carry the light of your deity into the darkness.", 8, "d6",
      "Dwarf: Doric, Sigun, Milena, Helga, Grindal, Dalla. Human: Wesley, Brinton, Jon, Amos, Saul, Bernadette, Wynn",
      "Kind/Wild/Wary Eyes; Clean/Tangled/Thin Hair; Worn/Practical/Ceremonial Robes; Plump/Thin/Meaty Body",
      "Max HP 8+Con, base damage d6",
      "Good: Endanger yourself to heal another. Lawful: Endanger yourself following precepts. Evil: Harm to prove superiority of faith",
      "_____ insulted my deity. _____ is good and faithful, I trust them. _____ is in constant danger, I will keep them safe. Converting _____ to my faith",
      "Deity (choose deity/domain/precept). Divine Guidance (petition deity, roll+WIS). Turn Undead (holy symbol, roll+CHA). Commune (spend time, gain spells). Cast a Spell (release granted spell, roll+WIS)",
      "Words of the Unspeaking, Serenity, First Aid, Divine Protection, Organized Religion"],
    ["Druid", "You know what the beasts know. The call of the wild is strong. Cast off the shackles of civilization and embrace the natural world.", 6, "d6",
      "Elf: Solace, Onatha, Ada, Nala, Elan, Nalon. Human: Elana, Kezi, Bina, Tabor, Duna, Drea, Nix",
      "Quick/Fiery/Sharp Eyes; Mohawk/Braided/Wild Hair; Worn/Practical/Ostentatious Clothes; Lean/Rounded/Muscled Body",
      "Max HP 6+Con, base damage d6",
      "Chaotic: Destroy a symbol of civilization. Good: Help something grow. Neutral: Eliminate an unnatural menace",
      "_____ smells like prey. Spirits spoke of danger following _____. Showed _____ a secret rite. _____ tasted my blood and I theirs",
      "Born of the Soil (choose land for shapeshifting). By Nature Sustained (no food/water). Spirit Tongue (understand animals). Shapeshifter (call spirits to change, roll+WIS). Studied Essence (contemplate spirit to gain form)",
      "Blood and Thunder, Formcrafter, Nature's Bond, Weather Weaver, World-Talker"],
    ["Fighter", "It is a thankless job living day to day by your armor and the skill of your arm. To dive heedlessly into danger. But someone has to do it.", 10, "d10",
      "Dwarf: Ozruk, Surtur, Brunhilda, Freya, Mor IDD, Tordek. Human: Hawke, Rudiger, Gregor, Brianne, Walton, Shanna, Ajax, Hobbes, Garrett, Murdock",
      "Hard/Wild/Sly Eyes; Shorn/Tied/Bald Hair; Worn/Plain/Scale Mail Armor; Plump/Thin/Rippled Body",
      "Max HP 10+Con, base damage d10",
      "Good: Defend those weaker than you. Neutral: Defeat a worthy opponent. Evil: Kill a defenseless or surrendered enemy",
      "_____ owes me their life. Sworn to protect _____. Worry about _____ surviving. _____ is soft, I will make them hard",
      "Bend Bars Lift Gates (pure strength, roll+STR). Armored (ignore clumsy tag). Signature Weapon (choose base/range/enhancements)",
      "Merciless, Heirloom, Armor Mastery, Improved Weapon, Seeing Red, Scent of Blood, Multiple Moves"],
    ["Paladin", "Hell awaits. An eternity of torment for the damned. You are the holy sword that stands between the darkness and the innocent.", 10, "d10",
      "Human: Augustus, Cyrus, Donatello, Friedrich, Lancelot, Percival, Galahad, Roderick",
      "Hard/Stern/Kind Eyes; Trim/Shorn/Long Hair; Worn/Practical/Plate Armor; Plump/Thin/Muscled Body",
      "Max HP 10+Con, base damage d10",
      "Lawful: Deny mercy to a criminal or unbeliever. Good: Endanger yourself to protect someone weaker",
      "_____ misguided behavior endangers their soul. _____ stood by me in battle, trusted completely. Respect beliefs of _____ but hope they see the true way. _____ is brave, I have much to learn",
      "Lay on Hands (touch and pray, roll+CHA). Armored (ignore clumsy tag). I Am the Law (give order based on divine authority, roll+CHA). Quest (dedicate to mission through prayer)",
      "Divine Favor, First to Fight, Hospitaler, Inspired, Holy Protection, Voice of Authority"],
    ["Ranger", "City-born folk have not heard the call of the wolf or felt the winds howl. You know the wild places and the beasts that dwell there.", 8, "d8",
      "Elf: Strider, Arannis, Bilago, Sael, Soral, Tanin. Human: Jonah, Artemis, Clara, Shenna, Dana, WOLF, Siegfried, Sinn",
      "Keen/Sharp/Wild Eyes; Hooded/Hat/Shorn Hair; Cloak/Practical/Leather Armor; Lean/Rugged/Tanned Body",
      "Max HP 8+Con, base damage d8",
      "Chaotic: Free someone from bonds. Good: Combat an unnatural threat. Neutral: Help an animal or spirit of the wild",
      "Guided _____ before, they owe me. _____ is a friend of nature. _____ has no respect for nature. _____ does not understand the wild, I will teach them",
      "Hunt and Track (follow trail, roll+WIS). Called Shot (attack defenseless/surprised at range, roll+DEX). Animal Companion (supernatural connection). Command (work with companion, roll+CHA/WIS/INT)",
      "Wild Empathy, Man's Best Friend, Blot Out the Sun, Follow Me, A Safe Place"],
    ["Thief", "You count your coins and smile. This is the thrill above all others - the quiet step, the turn of a lock, the shadows that hide your work.", 6, "d8",
      "Halfling: Felix, Omar, Cassandra, readily, Bryn, Wade. Human: Sparrow, Blackbird, Mouse, Whisper, Leech, Pinch, Trip, Trick, Switch",
      "Sharp/Weasel/Sly Eyes; Hooded/Hat/Masked; Dark Clothes/Loud Clothes/Skintight; Plump/Thin/Wiry Body",
      "Max HP 6+Con, base damage d8",
      "Chaotic: Leap into danger without a plan. Neutral: Avoid detection or infiltrate. Evil: Shift danger or blame to someone else",
      "Stole something from _____. _____ has my back when things go wrong. _____ knows incriminating details about me. _____ and I have a con running",
      "Trap Expert (survey dangerous area, roll+WIS). Tricks of the Trade (pick locks/pockets/disable, roll+DEX). Backstab (attack surprised/defenseless, roll+DEX). Flexible Morals (choose any alignment when detected). Poisoner (choose poison, start with 3 uses)",
      "Cheap Shot, Shoot First, Eyes Open, Venomous, Divination, Underworld Contacts"],
    ["Wizard", "Dungeon World has rules. Bigger, better rules. The laws of magic are among them. You have devoted yourself to the understanding of those laws.", 4, "d4",
      "Elf: Aldate, Dunadir, Iaja, Lenn, Solan, Tarn, Venn, Zith. Human: Avon, Balthazar, Cassius, Domitian, Evram, Faran, Janus, Malachi",
      "Haunted/Sharp/Eyes Without Mercy; Wild/Tied/Shorn Hair; Strange/Practical/Impressive Robes; Plump/Thin/Ravaged Body",
      "Max HP 4+Con, base damage d4",
      "Good: Use magic to directly aid another. Neutral: Discover something about a magical mystery. Evil: Use magic to cause terror and fear",
      "_____ will play an important role in events to come. _____ is keeping an important secret from me. _____ is woefully misinformed, I will teach them",
      "Spellbook (start with cantrips + three 1st-level spells). Prepare Spells (contemplate spellbook to prepare). Cast a Spell (release prepared spell, roll+INT). Spell Defense (end spell to deflect attack). Ritual (draw on place of power for magical effect)",
      "Arcane Ward, Corporate Forces, Enchantment Mastery, Know-It-All, Logical Draw, Self-Powered"],
  ];
  for (const c of classes) s.run(...c);
}

// ─── SPELLS ───────────────────────────────────────────────────────────────────

type ST = [string, string, string, string, string];

function seedSpells(db: Database.Database): void {
  const s = db.prepare(
    `INSERT OR IGNORE INTO dw_spells (name, level, spell_class, tags, description) VALUES (?,?,?,?,?)`
  );
  const spells: ST[] = [
    // Cleric Spells
    ["Light", "Rote", "Cleric", "", "An item you touch glows with divine light, about as bright as a torch. No heat or sound, no fuel. You control the color. Lasts as long as it is in your presence."],
    ["Sanctify", "Rote", "Cleric", "", "Food or water you hold is consecrated by your deity. Now holy or unholy, and purified of any mundane spoilage."],
    ["Guidance", "Rote", "Cleric", "", "The symbol of your deity appears and gestures towards the direction or course of action your deity would have you take, then disappears. Gesture only."],
    ["Bless", "Level 1", "Cleric", "Ongoing", "Your deity smiles upon a combatant of your choice. They take +1 ongoing so long as battle continues and they stand and fight. While ongoing you take -1 to cast a spell."],
    ["Cure Light Wounds", "Level 1", "Cleric", "", "At your touch wounds scab and bones cease to ache. Heal an ally you touch of 1d8 damage."],
    ["Detect Alignment", "Level 1", "Cleric", "", "Choose an alignment: Good, Evil, Lawful, or Chaotic. One sense briefly detects that alignment. GM tells you what here is of that alignment."],
    ["Cause Fear", "Level 1", "Cleric", "Ongoing", "Choose a target and nearby object. Target is afraid of the object so long as you maintain the spell. While ongoing you take -1 to cast. Cannot target entities below animal intelligence."],
    ["Magic Weapon", "Level 1", "Cleric", "Ongoing", "The weapon you hold does +1d4 damage until dismissed. While ongoing you take -1 to cast."],
    ["Sanctuary", "Level 1", "Cleric", "", "Walk the perimeter of an area, consecrating it. You are alerted when someone acts with malice within. Healing within a sanctuary heals +1d4 HP."],
    ["Speak With Dead", "Level 1", "Cleric", "", "A corpse converses with you briefly. It will answer any three questions to the best of its knowledge from life and death."],
    ["Animate Dead", "Level 3", "Cleric", "Ongoing", "Invoke a hungry spirit to possess a recently-dead body. Creates a zombie following orders. +1 all stats, 1 HP, plus 1d4 traits. While ongoing -1 to cast."],
    ["Cure Moderate Wounds", "Level 3", "Cleric", "", "Staunch bleeding and set bones through magic. Heal an ally of 2d8 damage."],
    ["Darkness", "Level 3", "Cleric", "Ongoing", "Choose an area you can see: filled with supernatural darkness. While ongoing -1 to cast."],
    ["Resurrection", "Level 3", "Cleric", "", "Resurrect a corpse whose soul has not fully departed. GM gives conditions: time, help, money, sacrifice."],
    ["Hold Person", "Level 3", "Cleric", "", "Choose a person you can see. Until you cast a spell or leave they cannot act except to speak. Ends immediately if target takes damage."],
    ["Revelation", "Level 5", "Cleric", "", "Your deity answers prayers with perfect understanding. GM sheds light on current situation. +1 forward when acting on the information."],
    ["Cure Critical Wounds", "Level 5", "Cleric", "", "Heal an ally of 3d8 damage."],
    ["Divination", "Level 5", "Cleric", "", "Name a person, place, or thing. Your deity grants visions, as clear as if you were there."],
    ["Contagion", "Level 5", "Cleric", "Ongoing", "Choose a creature. Until ended, target suffers from a disease of your choice. While ongoing -1 to cast."],
    ["Words of the Unspeaking", "Level 5", "Cleric", "", "Touch a non-living object. It answers three questions you pose, as best it can."],
    ["True Seeing", "Level 5", "Cleric", "Ongoing", "Vision opened to the true nature of everything. Pierce illusions and see hidden things. While ongoing -1 to cast."],
    ["Trap Soul", "Level 5", "Cleric", "", "Trap a dying creature's soul within a gem. Aware of imprisonment, can be manipulated. All moves vs trapped creature at +1."],
    ["Word of Recall", "Level 7", "Cleric", "", "Choose a word. First time you speak it after casting, you and allies who were touching you return to where you cast the spell."],
    ["Heal", "Level 7", "Cleric", "", "Touch an ally and heal damage up to your maximum HP."],
    ["Harm", "Level 7", "Cleric", "", "Touch an enemy with divine wrath: deal 2d8 damage to them and 1d6 to yourself. Ignores armor."],
    ["Sever", "Level 7", "Cleric", "Ongoing", "Choose an appendage on the target. It is magically severed - no damage but considerable pain. May prevent actions. While ongoing -1 to cast."],
    ["Mark of Death", "Level 7", "Cleric", "", "Choose a creature whose true name you know. Creates permanent runes on a surface that kill that creature should they read them."],
    ["Control Weather", "Level 7", "Cleric", "", "Pray for rain, sun, wind, or snow. Within a day, your god answers. Weather changes per your will, lasts a handful of days."],
    ["Storm of Vengeance", "Level 9", "Cleric", "", "Your deity brings unnatural weather: rain of blood or acid, clouds of souls, wind carrying away buildings."],
    ["Repair", "Level 9", "Cleric", "", "Choose one event in the target's past. All effects ended and repaired: HP healed, poisons neutralized, magical effects ended."],
    ["Divine Presence", "Level 9", "Cleric", "Ongoing", "Every creature must ask leave to enter your presence. Without permission: extra 1d10 damage when taking damage in your presence. While ongoing -1 to cast."],
    ["Consume Unlife", "Level 9", "Cleric", "", "Mindless undead you touch is destroyed. Steal its death energy to heal yourself or next ally. Heal amount = creature's remaining HP."],
    ["Plague", "Level 9", "Cleric", "Ongoing", "Name a place where people live. That place is beset by a plague per your deity's domains. While ongoing -1 to cast."],
    // Wizard Spells
    ["Light", "Cantrip", "Wizard", "", "An item you touch glows with arcane light, about as bright as a torch. No heat, sound, or fuel. Control the color. Lasts while in your presence."],
    ["Unseen Servant", "Cantrip", "Wizard", "Ongoing", "Conjure invisible construct with load 3. Carries items you hand to it. Cannot pick up on its own. Takes damage or leaves presence = dispelled."],
    ["Prestidigitation", "Cantrip", "Wizard", "", "Minor tricks: touch item for cosmetic changes (clean, soil, cool, warm, flavor, color). Without touching: minor illusions no bigger than yourself, crude and clearly illusions."],
    ["Contact Spirits", "Level 1", "Wizard", "Summoning", "Name spirit (or leave to GM). Pull through planes to speak to you. Bound to answer one question to best of ability."],
    ["Detect Magic", "Level 1", "Wizard", "Divination", "One sense briefly attuned to magic. GM tells you what here is magical."],
    ["Telepathy", "Level 1", "Wizard", "Divination, Ongoing", "Form telepathic bond with a person you touch. Converse through thoughts. Only one bond at a time."],
    ["Charm Person", "Level 1", "Wizard", "Enchantment, Ongoing", "Person (not beast/monster) you touch counts you as a friend until they take damage or you prove otherwise."],
    ["Invisibility", "Level 1", "Wizard", "Illusion, Ongoing", "Touch an ally: nobody can see them. Persists until target attacks or you dismiss. While ongoing cannot cast a spell."],
    ["Magic Missile", "Level 1", "Wizard", "Evocation", "Projectiles of pure magic. Deal 2d4 damage to one target."],
    ["Alarm", "Level 1", "Wizard", "", "Walk a wide circle. Until you prepare spells again, magic alerts you if a creature crosses that circle, even if asleep."],
    ["Dispel Magic", "Level 3", "Wizard", "", "Choose a spell or magic effect in your presence: rip it apart. Lesser spells ended, powerful magic reduced or dampened."],
    ["Visions Through Time", "Level 3", "Wizard", "Divination", "Gaze into reflective surface to see into time. GM reveals grim portent and something useful about interfering with it."],
    ["Fireball", "Level 3", "Wizard", "Evocation", "Evoke mighty ball of flame enveloping target and everyone nearby. 2d6 damage, ignores armor."],
    ["Mimic", "Level 3", "Wizard", "Ongoing", "Take form of someone you touch. Physical characteristics match exactly, behavior may not. Persists until damage or return. While ongoing lose wizard moves."],
    ["Mirror Image", "Level 3", "Wizard", "Illusion", "Create illusory image of yourself. When attacked, roll d6: 4+ the attack hits illusion instead, image dissipates."],
    ["Sleep", "Level 3", "Wizard", "Enchantment", "1d4 enemies of GM's choice fall asleep. Only creatures capable of sleeping affected. Awaken normally."],
    ["Cage", "Level 5", "Wizard", "Evocation, Ongoing", "Target held in cage of magical force. Nothing in or out. Remains until you cast another spell or dismiss. Caged creature hears your thoughts."],
    ["Contact Other Plane", "Level 5", "Wizard", "Divination", "Send request to another plane. Specify by location, type, name, or title. Open two-way communication. Either side can cut off."],
    ["Polymorph", "Level 5", "Wizard", "Enchantment", "Touch reshapes a creature entirely. Stays in new form until you cast a spell. GM tells you: form unstable, mind altered, or unintended benefit/weakness."],
    ["Summon Monster", "Level 5", "Wizard", "Summoning, Ongoing", "Monster appears and aids you. +1 all stats, 1 HP, uses your damage. Plus 1d6 traits from list. While ongoing -1 to cast."],
    ["Dominate", "Level 7", "Wizard", "Enchantment, Ongoing", "Push mind into target. Gain 1d4 hold. Spend to: make them speak, give item, attack target, or answer truthfully. Target takes damage = lose 1 hold. While ongoing cannot cast."],
    ["True Seeing", "Level 7", "Wizard", "Divination, Ongoing", "See all things as they truly are. Persists until you tell a lie or dismiss. While ongoing -1 to cast."],
    ["Shadow Walk", "Level 7", "Wizard", "Illusion", "Target shadows become portal. Name location (words up to your level). You and allies step through to that location. Portal used once per ally."],
    ["Contingency", "Level 7", "Wizard", "Evocation", "Choose a 5th level or lower spell. Describe trigger (words = your level). Spell held until unleashed or triggered. No roll needed for held spell."],
    ["Cloudkill", "Level 7", "Wizard", "Summoning, Ongoing", "Cloud of fog from beyond the Black Gates. Creatures in area take extra 1d6 damage (ignores armor) whenever they take damage. Persists while you can see area."],
    ["Antipathy", "Level 9", "Wizard", "Enchantment, Ongoing", "Choose target and describe creature type/alignment. Specified creatures cannot come within sight of target. If they do, they flee. While ongoing -1 to cast."],
    ["Alert", "Level 9", "Wizard", "Divination", "Describe an event. GM tells you when it occurs, no matter where. Optionally view the location. One Alert active at a time."],
    ["Soul Gem", "Level 9", "Wizard", "", "Trap dying creature's soul in a gem. Aware, can be manipulated. All moves vs trapped at +1. Free at any time, never recaptured."],
    ["Shelter", "Level 9", "Wizard", "Evocation, Ongoing", "Create structure of pure magical power. Large as castle or small as hut. Impervious to non-magical damage. Endures until you leave or end spell."],
    ["Perfect Summons", "Level 9", "Wizard", "Summoning", "Teleport a creature to your presence. Name or describe a type. Named creature appears, or a creature of that type appears."],
  ];
  for (const sp of spells) s.run(...sp);
}

// ─── EQUIPMENT ────────────────────────────────────────────────────────────────

type ET = [string, string, string | null, string | null, string | null, string | null, number | null, string | null];

function seedEquipment(db: Database.Database): void {
  const s = db.prepare(
    `INSERT OR IGNORE INTO dw_equipment (name, category, tags, cost, weight, damage, armor, description) VALUES (?,?,?,?,?,?,?,?)`
  );
  const items: ET[] = [
    ["Ragged Bow", "Weapon", "near", "15 coins", "2 weight", null, null, null],
    ["Fine Bow", "Weapon", "near, far", "60 coins", "2 weight", null, null, null],
    ["Hunter's Bow", "Weapon", "near, far", "100 coins", "1 weight", null, null, null],
    ["Crossbow", "Weapon", "near, +1 damage, reload", "35 coins", "3 weight", null, null, null],
    ["Bundle of Arrows", "Ammunition", "3 ammo", "1 coin", "1 weight", null, null, null],
    ["Elven Arrows", "Ammunition", "4 ammo", "20 coins", "1 weight", null, null, null],
    ["Club", "Weapon", "close", "1 coin", "2 weight", null, null, null],
    ["Shillelagh", "Weapon", "close", "1 coin", "2 weight", null, null, null],
    ["Staff", "Weapon", "close, two-handed", "1 coin", "1 weight", null, null, null],
    ["Dagger", "Weapon", "hand", "2 coins", "1 weight", null, null, null],
    ["Shiv", "Weapon", "hand", "2 coins", "1 weight", null, null, null],
    ["Knife", "Weapon", "hand", "2 coins", "1 weight", null, null, null],
    ["Throwing Dagger", "Weapon", "thrown, near", "1 coin", "0 weight", null, null, null],
    ["Short Sword", "Weapon", "close", "8 coins", "1 weight", null, null, null],
    ["Axe", "Weapon", "close", "8 coins", "1 weight", null, null, null],
    ["Warhammer", "Weapon", "close", "8 coins", "1 weight", null, null, null],
    ["Mace", "Weapon", "close", "8 coins", "1 weight", null, null, null],
    ["Spear", "Weapon", "reach, thrown, near", "5 coins", "1 weight", null, null, null],
    ["Long Sword", "Weapon", "close, +1 damage", "15 coins", "2 weight", null, null, null],
    ["Battle Axe", "Weapon", "close, +1 damage", "15 coins", "2 weight", null, null, null],
    ["Flail", "Weapon", "close, +1 damage", "15 coins", "2 weight", null, null, null],
    ["Halberd", "Weapon", "reach, +1 damage, two-handed", "9 coins", "2 weight", null, null, null],
    ["Rapier", "Weapon", "close, precise", "25 coins", "1 weight", null, null, null],
    ["Dueling Rapier", "Weapon", "close, 1 piercing, precise", "50 coins", "2 weight", null, null, null],
    ["Leather Armor", "Armor", "1 armor, worn", "10 coins", "1 weight", null, 1, null],
    ["Chainmail", "Armor", "1 armor, worn", "10 coins", "1 weight", null, 1, null],
    ["Scale Mail", "Armor", "2 armor, worn, clumsy", "50 coins", "3 weight", null, 2, null],
    ["Plate", "Armor", "3 armor, worn, clumsy", "350 coins", "4 weight", null, 3, null],
    ["Shield", "Armor", "+1 armor", "15 coins", "2 weight", null, null, null],
    ["Adventuring Gear", "Dungeon Gear", "5 uses", "20 coins", "1 weight", null, null, "Useful mundane items: chalk, poles, spikes, ropes"],
    ["Bandages", "Dungeon Gear", "3 uses, slow", "5 coins", "0 weight", null, null, "Heal 4 damage with a few minutes of bandaging"],
    ["Poultices and Herbs", "Dungeon Gear", "2 uses, slow", "10 coins", "1 weight", null, null, "Heal 7 damage when carefully treating wounds"],
    ["Healing Potion", "Dungeon Gear", "", "50 coins", "0 weight", null, null, "Heal 10 damage or remove one debility"],
    ["Keg of Dwarven Stout", "Food/Drink", "", "10 coins", "4 weight", null, null, "Take +1 to Carouse when everyone drinks freely"],
    ["Bag of Books", "Dungeon Gear", "5 uses", "10 coins", "2 weight", null, null, "Contains just the right book for spouting lore"],
    ["Antitoxin", "Dungeon Gear", "", "10 coins", "0 weight", null, null, "Cures one poison affecting you"],
    ["Dungeon Rations", "Food/Drink", "ration, 5 uses", "3 coins", "1 weight", null, null, "Not tasty, but not bad either"],
    ["Personal Feast", "Food/Drink", "ration, 1 use", "10 coins", "1 weight", null, null, "Ostentatious to say the least"],
    ["Dwarven Hardtack", "Food/Drink", "requires Dwarf, ration, 7 uses", "3 coins", "1 weight", null, null, "Dwarves say it tastes like home"],
    ["Elven Bread", "Food/Drink", "ration, 7 uses", "10 coins", "1 weight", null, null, "Only the greatest of elf-friends are treated to this"],
    ["Halfling Pipeleaf", "Dungeon Gear", "6 uses", "5 coins", "0 weight", null, null, "Share with someone for +1 forward to parley"],
    ["Oil of Tagit", "Poison", "dangerous, applied", "15 coins", "0 weight", null, null, "Target falls into a light sleep"],
    ["Bloodweed", "Poison", "dangerous, touch", "12 coins", "0 weight", null, null, "Target subtracts an additional d4 from their damage"],
    ["Goldenroot", "Poison", "dangerous, applied", "20 coins", "0 weight", null, null, "Target treats next creature they see as a trusted ally"],
    ["Serpent's Tears", "Poison", "dangerous, touch", "10 coins", "0 weight", null, null, "Dealers of damage against target roll twice, take better"],
    ["Cart and Donkey", "General", "load 20", "50 coins", null, null, null, null],
    ["Horse", "General", "load 10", "75 coins", null, null, null, null],
    ["Warhorse", "General", "load 12", "400 coins", null, null, null, null],
    ["Wagon", "General", "load 40", "150 coins", null, null, null, null],
    ["Barge", "General", "load 15", "50 coins", null, null, null, null],
    ["River Boat", "General", "load 20", "150 coins", null, null, null, null],
    ["Merchant Ship", "General", "load 200", "5000 coins", null, null, null, null],
    ["War Ship", "General", "load 100", "20000 coins", null, null, null, null],
    ["Argo-Thaan, Holy Avenger", "Weapon", "close", null, "2 weight", null, null, "Paladin damage d12; grants all paladin moves; harms Evil creatures"],
    ["Axe of the Conqueror-King", "Weapon", "close", null, "1 weight", null, null, "Hirelings in your employ have +1 Loyalty"],
    ["Bag of Holding", "Gear", "", null, "0 weight", null, null, "Larger on the inside; infinite items at 0 weight"],
    ["Cloak of Silent Stars", "Armor", "", null, "1 weight", null, null, "Defy danger with any stat; once per stat before magic fades"],
    ["Coin of Remembering", "Gear", "1 use", null, "0 weight", null, null, "Redeem to know one forgotten fact; vanishes after use"],
    ["Common Scroll", "Gear", "1 use", null, "0 weight", null, null, "Spell inscribed; castable if on your class spell list"],
    ["The Echo", "Gear", "", null, "0 weight", null, null, "Learn one great danger; once opened, ignore any single die roll"],
    ["Farsight Stone", "Gear", "", null, "1 weight", null, null, "Gaze and name a location to see it; may draw other watchers"],
    ["Flask of Breath", "Gear", "", null, "0 weight", null, null, "Eternally full of air; breathe underwater or through smoke"],
    ["Immovable Rod", "Gear", "", null, "0 weight", null, null, "Press button to freeze in place; cannot be moved until pressed again"],
    ["Infinite Book", "Gear", "", null, "1 weight", null, null, "Infinite pages; spout lore 12+ gives a solution to a problem"],
    ["Lodestone Shield", "Armor", "+1 armor", null, "1 weight", null, null, "Pulls metal weapons; spend hold to disarm metal-weapon users"],
    ["Nightsider's Key", "Gear", "", null, "0 weight", null, null, "Unlocks any door if you don't belong where you intend to go"],
    ["Sacred Herbs", "Gear", "2 uses", null, "0 weight", null, null, "When smoked, visions of faraway places; roll+WIS"],
    ["Teleportation Room", "Gear", "slow", null, null, null, null, "Enter and name location; roll+INT to teleport"],
    ["Timunn's Armor", "Armor", "1 armor", null, "1 weight", null, 1, "Stealthy armor; always appears fashionable"],
    ["Tricksy Rope", "Gear", "", null, "1 weight", null, null, "Listens and follows commands: coil, slack, come here"],
    ["Vorpal Sword", "Weapon", "close, 3 piercing", null, "2 weight", null, null, "Enemy must permanently lose something on damage"],
  ];
  for (const e of items) s.run(...e);
}

// ─── MONSTERS ─────────────────────────────────────────────────────────────────

type MOT = [string, string | null, string | null, number, number, string | null, string | null, string | null, string | null, string | null, string];

function seedMonsters(db: Database.Database): void {
  const s = db.prepare(
    `INSERT OR IGNORE INTO dw_monsters (name, tags, damage, hp, armor, attack_tags, special_qualities, description, instinct, moves, source_setting) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  const monsters: MOT[] = [
    ["Ankheg", "Group, Large", "d8+1", 10, 3, "Close, Reach", "Burrowing", null, "To undermine", "Undermine the ground, Burst from the earth, Spray forth acid eating away at metal and flesh", "Caverns"],
    ["Cave Rat", "Horde, Small", "d6", 7, 1, "Close, Messy, 1 piercing", null, null, "To devour", "Swarm, Rip something (or someone) apart", "Caverns"],
    ["Choker", "Solitary, Stealthy, Intelligent", "d10", 15, 2, "Close, Reach", "Flexible", null, "To deny light", "Hold someone wringing the breath from them, Fling a held creature", "Caverns"],
    ["Cloaker", "Solitary, Stealthy", "d10", 12, 1, "Close, ignores armor", "Looks like a cloak", null, "To engulf", "Engulf the unsuspecting", "Caverns"],
    ["Dwarven Warrior", "Horde, Organized", "d6", 7, 2, "Close", null, null, "To defend", "Drive them back, Call up reinforcements", "Caverns"],
    ["Earth Elemental", "Solitary, Huge", "d10+5", 27, 4, "Reach, Forceful", "Made of stone", null, "To show the strength of earth", "Turn the ground into a weapon, Meld into stone", "Caverns"],
    ["Fire Beetle", "Horde, Small", "d6", 3, 3, "Near, ignores armor", "Full of flames", null, "To enflame", "Undermine the ground, Burst from the earth, Spray forth flames", "Caverns"],
    ["Gargoyle", "Horde, Stealthy, Hoarder", "d6", 3, 2, "Close", "Wings", null, "To guard", "Attack with the element of surprise, Take to the air, Blend into stonework", "Caverns"],
    ["Gelatinous Cube", "Solitary, Large, Stealthy, Amorphous", "d10+1", 20, 1, "Hand, ignores armor", "Transparent", null, "To clean", "Fill an apparently empty space, Dissolve", "Caverns"],
    ["Goblin", "Horde, Small, Intelligent, Organized", "d6", 3, 1, "Close, Reach", null, null, "To multiply", "Charge!, Call more goblins, Retreat and return with (many) more", "Caverns"],
    ["Goblin Orkaster", "Solitary, Small, Magical, Intelligent, Organized", "d10+1", 12, 0, "Near, Far, ignores armor", null, null, "To tap power beyond their stature", "Unleash a poorly understood spell, Pour forth magical chaos, Use other goblins for shields", "Caverns"],
    ["Goliath", "Group, Huge, Organized, Intelligent", "d8+7", 14, 1, "Reach, Forceful", null, null, "To retake", "Shake the earth, Retreat only to come back stronger", "Caverns"],
    ["Otyugh", "Solitary, Large", "d10+3", 20, 1, "Close, Reach, Forceful", "Filth Fever", null, "To befoul", "Infect someone with filth fever, Fling someone or something", "Caverns"],
    ["Maggot-Squid", "Horde, Small", "d6", 3, 1, "Close", "Amphibious, Paralyzing Tentacles", null, "To eat", "Paralyze with a touch", "Caverns"],
    ["Purple Worm", "Solitary, Huge", "d10+5", 20, 2, "Reach, Forceful", "Burrowing", null, "To consume", "Swallow whole, Tunnel through stone and earth", "Caverns"],
    ["Roper", "Solitary, Large, Stealthy, Intelligent", "d10+1", 16, 1, "Close, Reach", "Rock-like Flesh", null, "To ambush", "Ensnare the unsuspecting, Disarm a foe, Chew on someone", "Caverns"],
    ["Rot Grub", "Horde, Tiny", "d6-2", 3, 0, "Hand", "Burrow into flesh", null, "To infect", "Burrow under flesh, Lay eggs, Burst forth from an infected creature", "Caverns"],
    ["Spiderlord", "Solitary, Large, Devious, Intelligent", "d8+4", 16, 3, "Close, Reach", "Burrowing", null, "To weave webs (literal and metaphorical)", "Enmesh in webbing, Put a plot into motion", "Caverns"],
    ["Troglodyte", "Group, Organized", "d8", 10, 1, "Close", null, null, "To prey on civilization", "Raid and retreat, Use scavenged weapons or magic", "Caverns"],
    ["Aboleth", "Group, Huge, Intelligent", "d10+3", 18, 0, "Reach", "Telepathy", null, "To command", "Invade a mind, Turn minions on them, Put a plan in motion", "Depths"],
    ["Apocalypse Dragon", "Solitary, Huge, Magical, Divine", "b[2d12]+9", 26, 5, "Reach, Forceful, Messy, 4 piercing", "Inch-thick metal hide, Supernatural knowledge, Wings", null, "To end the world", "Set a disaster in motion, Breathe forth the elements, Act with perfect foresight", "Depths"],
    ["Chaos Spawn", "Solitary, Amorphous", "d10", 19, 1, "Close, Reach", "Chaos form", null, "To undermine the established order", "Rewrite reality, Unleash chaos from containment", "Depths"],
    ["Chuul", "Group, Large, Cautious", "d8+1", 10, 4, "Close, Reach, Messy, 3 piercing", "Amphibious", null, "To split", "Split something in two with mighty claws, Retreat into water", "Depths"],
    ["Deep Elf Assassin", "Group, Intelligent, Organized", "d8", 6, 1, "Close, 1 piercing", null, null, "To spite the surface races", "Poison them, Unleash an ancient spell, Call reinforcements", "Depths"],
    ["Deep Elf Swordmaster", "Group, Intelligent, Organized", "b[2d8]+2", 6, 2, "Close, 1 piercing", null, null, "To punish unbelievers", "Inflict pain beyond measure, Use the dark to advantage", "Depths"],
    ["Deep Elf Priest", "Solitary, Divine, Intelligent, Organized", "d10+2", 14, 0, "Close, Reach", "Divine connection", null, "To pass on divine vengeance", "Weave spells of hatred and malice, Rally the deep elves, Pass on divine knowledge", "Depths"],
    ["Dragon", "Solitary, Huge, Terrifying, Cautious, Hoarder", "b[2d12]+5", 16, 5, "Reach, Messy, 4 piercing", "Elemental blood, Wings", null, "To rule", "Bend an element to its will, Demand tribute, Act with disdain", "Depths"],
    ["Gray Render", "Solitary, Large", "d10+3", 16, 1, "Close, Reach, Forceful, 3 piercing", null, null, "To serve", "Tear something apart", "Depths"],
    ["Magmin", "Horde, Intelligent, Organized, Hoarder", "d6+2", 7, 4, "Close, Reach", "Fiery blood", null, "To craft", "Offer a trade or deal, Strike with fire or magic, Provide just the right item at a price", "Depths"],
    ["Minotaur", "Solitary, Large", "d10+1", 16, 1, "Close, Reach", "Unerring sense of direction", null, "To contain", "Confuse them, Make them lost", "Depths"],
    ["Naga", "Solitary, Intelligent, Organized, Hoarder, Magical", "d10", 12, 2, "Close, Reach", null, null, "To lead", "Send a follower to their death, Use old magic, Offer a deal or bargain", "Depths"],
    ["Salamander", "Horde, Large, Intelligent, Organized, Planar", "b[2d6]+3", 7, 3, "Close, Reach, Near", "Burrowing", null, "To consume in flame", "Summon elemental fire, Melt away deception", "Depths"],
    ["Bulette", "Solitary, Huge, Construct", "d10+5", 20, 3, "Close, Forceful, 3 piercing", "Burrowing", null, "To devour", "Drag prey into rough tunnels, Burst from the earth, Swallow whole", "Experiments"],
    ["Chimera", "Solitary, Large, Construct", "d10+1", 16, 1, "Reach", null, null, "To do as commanded", "Belch forth flame, Run them over, Poison them", "Experiments"],
    ["Derro", "Horde, Devious, Intelligent, Organized", "d6", 3, 2, "Close", "Telepathy", null, "To replace dwarves", "Fill a mind with foreign thoughts, Take control of a beast's mind", "Experiments"],
    ["Digester", "Solitary, Large, Construct", "d10+1", 16, 1, "Close, Reach, ignores armor", "Digest acid secretion", null, "To digest", "Eat away at something, Draw sustenance", "Experiments"],
    ["Ethereal Filcher", "Solitary, Devious, Planar", "w[2d8]", 12, 1, "Close, Reach", "Burrowing", null, "To steal", "Take something important to its planar lair, Retreat to the Ethereal plane, Use an item from its lair", "Experiments"],
    ["Ettin", "Solitary, Large, Construct", "d10+3", 16, 1, "Close, Reach, Forceful", "Two heads", null, "To smash", "Attack two enemies at once, Defend its creator", "Experiments"],
    ["Girallon", "Solitary, Huge", "d10+5", 20, 1, "Reach, Forceful", "Many arms", null, "To rule", "Answer the call of sacrifice, Drive them from the jungle, Throw someone", "Experiments"],
    ["Iron Golem", "Group, Large, Construct", "d8+5", 10, 3, "Close, Reach, Forceful", "Metal", null, "To serve", "Follow orders implacably, Use a special tool or adaptation built-in", "Experiments"],
    ["Flesh Golem", "Horde", "d6+2", 3, 0, "Close, Forceful", "Many body parts", null, "To live", "Follow orders, Detach a body part", "Experiments"],
    ["Kraken", "Solitary, Huge", "d10+5", 20, 2, "Reach, Forceful", "Aquatic", null, "To rule the ocean", "Drag a person or ship to a watery grave, Wrap them in tentacles", "Experiments"],
    ["Manticore", "Solitary, Large, Construct", "d10+1", 16, 3, "Close, Reach, Messy, 1 piercing", "Wings", null, "To kill", "Poison them, Rip something apart", "Experiments"],
    ["Owlbear", "Solitary, Construct", "d10", 12, 2, "Close", null, null, "To hunt", "Strike from darkness", "Experiments"],
    ["Pegasus", "Group, Construct", "d8", 10, 1, "Close", "Wings", null, "To carry aloft", "Carry a rider into the air, Give their rider an advantage", "Experiments"],
    ["Rust Monster", "Group, Construct", "d8", 6, 3, "Close, ignores armor", "Corrosive touch", null, "To decay", "Turn metal to rust, Gain strength from consuming metal", "Experiments"],
    ["Xorn", "Solitary, Large, Construct", "d10", 12, 2, "Close, Reach", "Burrowing", null, "To eat", "Consume stone, Give off a burst of light and heat", "Experiments"],
    ["Acolyte", null, null, 0, 0, null, null, null, "To serve dutifully", "Follow dogma, Offer eternal reward for mortal deeds", "Folk"],
    ["Adventurer", "Horde, Intelligent", "d6", 3, 1, "Close", "Endless enthusiasm", null, "To adventure or die trying", "Go on a fool's errand, Act impulsively, Share tales of past exploits", "Folk"],
    ["Bandit", "Horde, Intelligent, Organized", "d6", 3, 1, "Close", null, null, "To rob", "Steal something, Demand tribute", "Folk"],
    ["Bandit King", "Solitary, Intelligent, Organized", "b[2d10]", 12, 1, "Close", null, null, "To lead", "Make a demand, Extort, Topple power", "Folk"],
    ["Fool", null, null, 0, 0, null, null, null, "To mock", "Expose injustice, Play a trick", "Folk"],
    ["Guardsman", "Group, Intelligent, Organized", "d8", 6, 1, "Close, Reach", null, null, "To do as ordered", "Uphold the law, Make a profit", "Folk"],
    ["Halfling Thief", "Solitary, Small, Intelligent, Stealthy, Devious", "w[2d8]", 12, 1, "Close", null, null, "To live a life of stolen luxury", "Steal, Put on the appearance of friendship", "Folk"],
    ["Hedge Wizard", "Magical", null, 0, 0, null, null, null, "To learn", "Cast almost the right spell (for a price), Make deals beyond their ken", "Folk"],
    ["High Priest", null, null, 0, 0, null, null, null, "To lead", "Set down divine law, Reveal divine secrets, Commission divine undertakings", "Folk"],
    ["Hunter", "Group, Intelligent", "d6", 6, 1, "Near, Far", null, null, "To survive", "Bring back news from the wilds, Slay a beast", "Folk"],
    ["Knight", "Solitary, Intelligent, Organized, Cautious", "b[2d10]", 12, 4, "Close", null, null, "To live by a code", "Make a moral stand, Lead soldiers into battle", "Folk"],
    ["Merchant", null, null, 0, 0, null, null, null, "To profit", "Propose a business venture, Offer a deal", "Folk"],
    ["Noble", null, null, 0, 0, null, null, null, "To rule", "Issue an order, Offer a reward", "Folk"],
    ["Peasant", null, null, 0, 0, null, null, null, "To get by", "Plead for help, Offer a simple reward and gratitude", "Folk"],
    ["Rebel", "Horde, Intelligent, Organized", "d6", 3, 1, "Close", null, null, "To upset order", "Die for a cause, Inspire others", "Folk"],
    ["Soldier", "Horde, Intelligent, Organized", "d6", 3, 1, "Close, Reach", null, null, "To fight", "March into battle, Fight as one", "Folk"],
    ["Spy", null, null, 0, 0, null, null, null, "To infiltrate", "Report the truth, Double cross", "Folk"],
    ["Tinkerer", null, null, 0, 0, null, null, null, "To create", "Offer an oddity at a price, Spin tales of great danger and reward in far-off lands", "Folk"],
    ["Formian Drone", "Horde, Organized, Cautious", "d6", 7, 4, "Close", "Hive connection, Insectoid", null, "To follow orders", "Raise the alarm, Create value for the hive, Assimilate", "Hordes"],
    ["Formian Taskmaster", "Group, Organized, Intelligent", "d8", 6, 3, "Close, Reach", "Hive connection, Insectoid", null, "To command", "Order drones into battle, Set great numbers in motion", "Hordes"],
    ["Formian Centurion", "Horde, Intelligent, Organized", "b[2d6]+2", 7, 3, "Close, Reach", "Hive connection, Insectoid, Wings", null, "To fight as ordered", "Advance as one, Summon reinforcements, Give a life for the hive", "Hordes"],
    ["Formian Queen", "Solitary, Huge, Organized, Intelligent, Hoarder", "d10+5", 24, 3, "Reach, Forceful", "Hive connection, Insectoid", null, "To spread formians", "Call every formian it spawned, Release a half-formed larval mutation, Organize and issue orders", "Hordes"],
    ["Gnoll Tracker", "Group, Organized, Intelligent", "d8", 6, 1, "Near, Far", "Scent-tracker", null, "To prey on weakness", "Doggedly track prey, Strike at a moment of weakness", "Hordes"],
    ["Gnoll Emissary", "Solitary, Divine, Intelligent, Organized", "d10+2", 18, 1, "Close, Reach", "Scent", null, "To share divine insight", "Pass on demonic influence, Drive the pack into a fervor", "Hordes"],
    ["Gnoll Alpha", "Solitary, Intelligent, Organized", "b[2d10]", 12, 2, "Close, 1 piercing", "Scent", null, "To drive the pack", "Demand obedience, Send the pack to hunt", "Hordes"],
    ["Orc Bloodwarrior", "Horde, Intelligent, Organized", "d6+2", 3, 0, "Close, Messy, 1 piercing", null, null, "To fight", "Fight with abandon, Revel in destruction", "Hordes"],
    ["Orc Berserker", "Solitary, Large, Divine, Intelligent, Organized", "d10+5", 20, 0, "Close, Reach", "Mutations", null, "To rage", "Fly into a frenzy, Unleash chaos", "Hordes"],
    ["Orc Breaker", "Solitary, Large", "d10+3", 16, 0, "Close, Reach, Forceful, ignores armor", null, null, "To smash", "Destroy armor or protection, Lay low the mighty", "Hordes"],
    ["Orc One-Eye", "Group, Divine, Magical, Intelligent, Organized", "d8+2", 6, 0, "Close, Reach, Near, Far, ignores armor", "One eye", null, "To hate", "Rend flesh with divine magic, Take an eye, Make a sacrifice and grow in power", "Hordes"],
    ["Orc Shaman", "Solitary, Intelligent, Organized", "d10", 12, 0, "Close, Reach, Near, Far, ignores armor", "Elemental power", null, "To strengthen orc-kind", "Give protection of earth, Give power of fire, Give swiftness of water, Give clarity of air", "Hordes"],
    ["Orc Slaver", "Horde, Stealthy, Intelligent, Organized", "d6", 3, 0, "Close, Reach", null, null, "To take", "Take a captive, Pin someone under a net, Drug them", "Hordes"],
    ["Orc Shadowhunter", "Solitary, Stealthy, Magical, Intelligent", "d10", 10, 0, "Close, Reach, 1 piercing", "Shadow cloak", null, "To kill in darkness", "Poison them, Melt into the shadows, Cloak them in darkness", "Hordes"],
    ["Orc Warchief", "Solitary, Intelligent, Organized", "b[2d10]+2", 16, 0, "Close, Reach", "One-Eye blessings, Shaman blessings, Divine protection from mortal harm", null, "To lead", "Start a war, Make a show of power, Enrage the tribes", "Hordes"],
    ["Triton Spy", "Solitary, Stealthy, Intelligent, Organized", "w[2d10]", 12, 2, "Close, Near", "Aquatic", null, "To spy on the surface world", "Reveal their secrets, Strike at weakness", "Hordes"],
    ["Triton Tidecaller", "Group, Divine, Magical, Intelligent", "d8+2", 6, 2, "Near, Far, ignores armor", "Aquatic, Mutations", null, "To bring on The Flood", "Cast a spell of water and destruction, Command beasts of the sea, Reveal divine proclamation", "Hordes"],
    ["Triton Sub-Mariner", "Group, Organized, Intelligent", "b[2d8]", 6, 3, "Close, Near, Far", "Aquatic", null, "To wage war", "Lead tritons to battle, Pull them beneath the waves", "Hordes"],
    ["Triton Noble", "Group, Organized, Intelligent", "d8", 6, 2, "Close, Near, Far", "Aquatic", null, "To lead", "Stir tritons to war, Call reinforcements", "Hordes"],
    ["Angel", "Solitary, Terrifying, Divine, Intelligent, Organized", "b[2d10]+4", 18, 4, "Close, Forceful, ignores armor", "Wings", null, "To share divine will", "Deliver visions and prophecy, Stir mortals to action, Expose sin and injustice", "Planes"],
    ["Barbed Devil", "Solitary, Large, Planar, Terrifying", "d10+3", 16, 3, "Close, Reach, Messy, 3 piercing", "Spines", null, "To rend flesh and spill blood", "Impale someone, Kill indiscriminately", "Planes"],
    ["Chain Devil", "Solitary, Planar", "d10", 12, 3, "Close, Reach, ignores armor", null, null, "To capture", "Take a captive, Return to whence it came, Torture with glee", "Planes"],
    ["Concept Elemental", "Solitary, Devious, Planar, Amorphous", null, 0, 0, null, "Ideal form", null, "To perfect its concept", "Demonstrate its concept in its purest form", "Planes"],
    ["Corrupter", "Solitary, Devious, Planar, Hoarder", "w[2d8]", 12, 0, "Close", null, null, "To bargain", "Offer a deal with horrible consequences, Plumb the vaults of hell for a bargaining chip, Make a show of power", "Planes"],
    ["Djinn", "Group, Large, Magical", "d8+1", 14, 4, "Close, Reach, ignores armor", "Made of flame", null, "To burn eternally", "Grant power for a price, Summon the forces of the City of Brass", "Planes"],
    ["Hell Hound", "Group, Planar, Organized", "d8", 10, 1, "Close", "Hide of shadow", null, "To pursue", "Follow despite all obstacles, Spew fire, Summon the forces of hell on their target", "Planes"],
    ["Imp", "Horde, Planar, Intelligent, Organized", "d6", 7, 1, "Close, Near, Far, ignores armor", null, null, "To harass", "Send information back to hell, Cause mischief", "Planes"],
    ["Inevitable", "Group, Large, Magical, Cautious, Amorphous, Planar", "d10+1", 21, 5, "Close, Reach", "Made of Order", null, "To preserve order", "End a spell or effect, Enforce a law of nature or man, Give a glimpse of destiny", "Planes"],
    ["Larvae", "Horde, Devious, Planar, Intelligent", "w[2d4]", 10, 0, "Close", null, null, "To suffer", "Fill them with despair, Beg for mercy, Draw evil attention", "Planes"],
    ["Nightmare", "Horde, Large, Magical, Terrifying, Planar", "d6+1", 7, 4, "Close, Reach", "Flame and shadow", null, "To ride rampant", "Sheath a rider in hellish flame, Drive them away", "Planes"],
    ["Quasit", "Horde, Planar", "d6", 7, 2, "Close", "Adaptable form", null, "To serve", "Attack with abandon, Inflict pain", "Planes"],
    ["The Tarrasque", "Solitary, Huge, Planar", null, 0, 0, null, "Impervious", null, "To consume", "Swallow a person group or place whole, Release a remnant of a long-eaten place from its gullet", "Planes"],
    ["Word Demon", "Solitary, Planar, Magical", null, 0, 0, null, null, null, "To further their word", "Cast a spell related to their word, Bring their word into abundance", "Planes"],
    ["Bakunawa", "Solitary, Large, Intelligent", "d10+3", 16, 2, "Close, Reach, 1 piercing", "Amphibious", null, "To devour", "Lure prey with lies and illusions, Lash out at light, Devour", "Swamp"],
    ["Basilisk", "Solitary, Hoarder", "d10", 12, 2, "Close", null, null, "To create new statuary", "Turn flesh to stone with a gaze, Retreat into a maze of stone", "Swamp"],
    ["Black Pudding", "Solitary, Amorphous", "d10", 15, 1, "Close, ignores armor", "Amorphous", null, "To dissolve", "Eat away metal flesh or wood, Ooze into a troubling place", "Swamp"],
    ["Coutal", "Solitary, Intelligent, Devious", "d8", 12, 2, "Close, ignores armor", "Wings, Halo", null, "To cleanse", "Pass judgment on a person or place, Summon divine forces to cleanse, Offer information in exchange for service", "Swamp"],
    ["Crocodilian", "Group, Large", "d8+3", 10, 2, "Close, Reach", "Amphibious, Camouflage", null, "To eat", "Attack an unsuspecting victim, Escape into the water, Hold something tight in its jaws", "Swamp"],
    ["Doppelg\u00e4nger", "Solitary, Devious, Intelligent", "d6", 12, 0, "Close", "Shapeshifting", null, "To infiltrate", "Assume the shape of a person whose flesh it has tasted, Use another's identity to advantage, Leave someone's reputation shattered", "Swamp"],
    ["Dragon Turtle", "Solitary, Huge, Cautious", "d10+3", 20, 4, "Reach", "Shell, Amphibious", null, "To resist change", "Move forward implacably, Bring its full bulk to bear, Destroy structures and buildings", "Swamp"],
    ["Dragon Whelp", "Solitary, Small, Intelligent, Cautious, Hoarder", "d10+2", 16, 3, "Close, Near", "Wings, Elemental Blood", null, "To grow in power", "Start a lair form a base of power, Call on family ties, Demand oaths of servitude", "Swamp"],
    ["Ekek", "Horde", "d6", 3, 1, "Close", "Wing-arms", null, "To lash out", "Attack from the air, Carry out the bidding of a more powerful creature", "Swamp"],
    ["Fire Eels", "Horde, Tiny", "d6-2", 3, 0, "Hand, ignores armor", "Flammable oil, Aquatic", null, "To ignite", "Catch someone or something on fire (even underwater), Consume burning prey", "Swamp"],
    ["Frogman", "Horde, Small, Intelligent", "d6", 7, 1, "Close", "Amphibious", null, "To wage war", "Launch an amphibious assault, Heal at a prodigious rate", "Swamp"],
    ["Hydra", "Solitary, Large", "d10+3", 16, 2, "Close, Reach", "Many heads, Only killed by a blow to the heart", null, "To grow", "Attack many enemies at once, Regenerate a body part (especially a head)", "Swamp"],
    ["Kobold", "Horde, Small, Stealthy, Intelligent, Organized", "d6", 3, 1, "Close, Reach", "Dragon connection", null, "To serve dragons", "Lay a trap, Call on dragons or draconic allies, Retreat and regroup", "Swamp"],
    ["Lizardman", "Group, Stealthy, Intelligent, Organized", "d8", 6, 2, "Close, Reach", "Amphibious", null, "To destroy civilization", "Ambush the unsuspecting, Launch an amphibious assault", "Swamp"],
    ["Medusa", "Solitary, Devious, Intelligent, Hoarder", "d6", 12, 0, "Close", "Look turns you to stone", null, "To collect", "Turn a body part to stone with a look, Draw someone's gaze, Show hidden terrible beauty", "Swamp"],
    ["Sahuagin", "Horde, Intelligent", "d6+4", 3, 2, "Close, Forceful, Messy, 1 piercing", "Amphibious", null, "To spill blood", "Bite off a limb, Hurl a poisoned spear, Frenzy at the sight of blood", "Swamp"],
    ["Sauropod", "Group, Huge, Cautious", "d10+5", 18, 4, "Reach", "Armor plated body", null, "To endure", "Stampede, Knock something down, Unleash a deafening bellow", "Swamp"],
    ["Swamp Shambler", "Solitary, Large, Magical", "d10+1", 23, 1, "Close, Reach, Forceful", "Swamp form", null, "To preserve and create swamps", "Call on the swamp itself for aid, Meld into the swamp, Reassemble into a new form", "Swamp"],
    ["Troll", "Solitary, Large", "d10+3", 20, 1, "Close, Reach, Forceful", "Regeneration", null, "To smash", "Undo the effects of an attack (unless caused by a weakness), Hurl something or someone", "Swamp"],
    ["Will-o-wisp", "Solitary, Tiny, Magical", "w[2d8-2]", 12, 0, "Near", "Body of light", null, "To misguide", "Lead someone astray, Clear a path to the worst place possible", "Swamp"],
    ["Abomination", "Solitary, Large, Construct, Terrifying", "d10+3", 20, 1, "Close, Reach, Forceful", "Many limbs heads and so on", null, "To end life", "Tear flesh apart, Spill forth putrid guts", "Undead"],
    ["Banshee", "Solitary, Magical, Intelligent", "d10", 16, 0, "Near", "Insubstantial", null, "To get revenge", "Drown out all other sound with a ceaseless scream, Unleash a skull-splitting noise, Disappear into the mists", "Undead"],
    ["Devourer", "Solitary, Large, Intelligent, Hoarder", "d10+3", 16, 1, "Close, Reach, Forceful", null, null, "To feast on souls", "Devour or trap dying soul, Bargain for a soul's return", "Undead"],
    ["Dragonbone", "Solitary, Huge", "d10+3", 20, 2, "Reach, Messy, 3 piercing", null, null, "To serve", "Attack unrelentingly", "Undead"],
    ["Draugr", "Horde, Organized", "d6+1", 7, 2, "Close, Reach", "Icy touch", null, "To take from the living", "Freeze flesh, Call on the unworthy dead", "Undead"],
    ["Ghost", "Solitary, Devious, Terrifying", "d6", 16, 0, "Close, Reach", "Insubstantial", null, "To haunt", "Reveal the terrifying nature of death, Haunt a place of importance, Offer information from the other side at a price", "Undead"],
    ["Ghoul", "Group", "d8", 10, 1, "Close, Messy, 1 piercing", null, null, "To eat", "Gnaw off a body part, Gain the memories of their meal", "Undead"],
    ["Lich", "Solitary, Magical, Intelligent, Cautious, Hoarder, Construct", "d10+3", 16, 5, "Near, Far, ignores armor", null, null, "To un-live", "Cast a perfected spell of death or destruction, Set a ritual or great working into motion, Reveal a preparation or plan already completed", "Undead"],
    ["Mohrg", "Group", "d8", 10, 0, "Close", null, null, "To wreak havoc", "Rage, Add to their collection of guts", "Undead"],
    ["Mummy", "Solitary, Divine, Hoarder", "d10+2", 16, 1, "Close", null, null, "To enjoy eternal rest", "Curse them, Wrap them up, Rise again", "Undead"],
    ["Nightwing", "Horde, Stealthy", "d6", 7, 1, "Close", "Wings", null, "To hunt", "Attack from the night sky, Fly away with prey", "Undead"],
    ["Shadow", "Horde, Large, Magical, Construct", "d6+1", 11, 4, "Close, Reach", "Shadow Form", null, "To darken", "Snuff out light, Spawn another shadow from the dead", "Undead"],
    ["Sigben", "Horde, Large, Construct", "d6+1", 11, 2, "Close, Reach", "Vampire spawn", null, "To disturb", "Poison them, Do a vampire's bidding", "Undead"],
    ["Skeleton", "Horde", "d6", 7, 1, "Close", null, null, "To take the semblance of life", "Act out what it did in life, Snuff out the warmth of life, Reconstruct from miscellaneous bones", "Undead"],
    ["Spectre", "Solitary, Hoarder", "d10", 12, 0, "Close", "Insubstantial", null, "To drive life from a place", "Turn their haunt against a creature, Bring the environment to life", "Undead"],
    ["Vampire", "Group, Stealthy, Organized, Intelligent", "d8+5", 10, 2, "Close, Forceful, 1 piercing", "Changing form, Ancient mind", null, "To manipulate", "Charm someone, Feed on their blood, Retreat to plan again", "Undead"],
    ["Wight-Wolf", "Horde, Organized, Intelligent", "d6+1", 7, 1, "Close, 1 piercing", "Shadow form", null, "To hunt", "Encircle prey, Summon the pack", "Undead"],
    ["Zombie", "Horde", "d6", 11, 1, "Close", null, null, "Braaaaaains", "Attack with overwhelming numbers, Corner them, Gain strength from the dead spawn more zombies", "Undead"],
    ["Assassin Vine", "Solitary, Stealthy, Amorphous", "d10", 15, 1, "Close, Reach, Messy, 1 piercing", "Plant", null, "To grow", "Shoot forth new growth, Attack the unwary", "Woods"],
    ["Blink Dog", "Group, Small, Magical, Organized", "d8", 6, 4, "Close", "Illusion", null, "To hunt", "Give the appearance of being somewhere they are not, Summon the pack, Move with amazing speed", "Woods"],
    ["Centaur", "Horde, Large, Organized, Intelligent", "d6+2", 11, 1, "Close, Reach, Near, 1 piercing", "Half-horse, Half-man", null, "To rage", "Overrun them, Fire a perfect bullseye, Move with unrelenting speed", "Woods"],
    ["Chaos Ooze", "Solitary, Planar, Terrifying, Amorphous", "d10", 23, 1, "Close, ignores armor", "Ooze, Fragments of other planes embedded in it", null, "To change", "Cause a change in appearance or substance, Briefly bridge the planes", "Woods"],
    ["Cockatrice", "Group, Small, Hoarder", "d8", 6, 1, "Close", "Stone touch", null, "To defend the nest", "Start a slow transformation to stone", "Woods"],
    ["Dryad", "Solitary, Magical, Intelligent, Devious", "w[2d8]", 12, 2, "Close", "Plant", null, "To love nature passionately", "Entice a mortal, Merge into a tree, Turn nature against them", "Woods"],
    ["Eagle Lord", "Group, Large, Organized, Intelligent", "b[2d8]+1", 10, 1, "Close, Reach, 1 piercing", "Mighty wings", null, "To rule the heights", "Attack from the sky, Pull someone into the air, Call on ancient oaths", "Woods"],
    ["Elvish Warrior", "Horde, Intelligent, Organized", "b[2d6]", 3, 2, "Close", "Sharp sense", null, "To seek perfection", "Strike at a weak point, Set ancient plans in motion, Use the woods to advantage", "Woods"],
    ["Elvish High Arcanist", "Solitary, Magical, Intelligent, Organized", "d10", 12, 0, "Near, Far, ignores armor", "Sharp senses", null, "To unleash power", "Work the magic that nature demands, Cast forth the elements", "Woods"],
    ["Griffin", "Group, Large, Organized", "d8+3", 10, 1, "Close, Reach, Forceful", "Wings", null, "To serve allies", "Judge someone's worthiness, Carry an ally aloft, Strike from above", "Woods"],
    ["Hill Giant", "Group, Huge, Intelligent, Organized", "d8+3", 10, 1, "Reach, Near, Far, Forceful", null, null, "Ruin everything", "Throw something, Do something stupid, Shake the earth", "Woods"],
    ["Ogre", "Group, Large, Intelligent", "d8+5", 10, 1, "Close, Reach, Forceful", null, null, "To return the world to darker days", "Destroy something, Fly into a rage, Take something by force", "Woods"],
    ["Razor Boar", "Solitary", "d10", 16, 1, "Close, Messy, 3 piercing", null, null, "To shred", "Rip them apart, Rend armor and weapons", "Woods"],
    ["Satyr", "Group, Devious, Magical, Hoarder", "w[2d8]", 10, 1, "Close", "Enchantment", null, "To enjoy", "Pull others into revelry through magic, Force gifts upon them, Play jokes with illusions and tricks", "Woods"],
    ["Sprite", "Horde, Tiny, Stealthy, Magical, Devious, Intelligent", "w[2d4]", 3, 0, "Hand", "Wings, Fey Magic", null, "To play tricks", "Play a trick to expose someone's true nature, Confuse their senses, Craft an illusion", "Woods"],
    ["Treant", "Group, Huge, Intelligent, Amorphous", "d10+5", 21, 4, "Reach, Forceful", "Wooden", null, "To protect nature", "Move with implacable strength, Set down roots, Spread old magic", "Woods"],
    ["Werewolf", "Solitary, Intelligent", "d10+2", 12, 1, "Close, Messy, 1 piercing", "Weak to silver", null, "To shed the appearance of civilization", "Transform to pass unnoticed as beast or man, Strike from within, Hunt like man and beast", "Woods"],
    ["Worg", "Horde, Organized", "d6", 3, 1, "Close", null, null, "To serve", "Carry a rider into battle, Give its rider an advantage", "Woods"],
  ];
  for (const m of monsters) s.run(...m);
}

// ─── GM TOOLS ─────────────────────────────────────────────────────────────────

type GT = [string, string, string];

function seedGmTools(db: Database.Database): void {
  const s = db.prepare(
    `INSERT OR IGNORE INTO dw_gm_tools (topic, content, category) VALUES (?,?,?)`
  );
  const tools: GT[] = [
    ["Portray a fantastic world", "Your first agenda is to portray a fantastic world. Show the players the wonders of the world they're in and encourage them to react to it. Characters have taken up a life of adventure in the hopes of some glorious reward. It's your job to show them a world where that adventure can be found.", "Agenda"],
    ["Fill the characters' lives with adventure", "Work with the players to create a world that's engaging and dynamic. Adventurers are always caught up in some world-threatening danger or another. Encourage and foster that kind of action in the game.", "Agenda"],
    ["Play to find out what happens", "Dungeon World adventures never presume player actions. Portray a setting in motion with creatures pursuing their own goals. As players come into conflict, action is inevitable. Don't plan too hard—the rules will fight you. It's fun to see how things unfold.", "Agenda"],
    ["Draw maps, leave blanks", "Maps help everyone stay on the same page. When you draw a map don't try to make it complete. Leave room for the unknown. Let maps expand and change as you play.", "Principle"],
    ["Address the characters, not the players", "Don't say 'Tony, is Dunwick doing something?' Say 'Dunwick, what are you doing?' Speaking this way keeps the game focused on the fiction.", "Principle"],
    ["Embrace the fantastic", "Magic, strange vistas, gods, demons, and abominations fill the world. Think about the fantastic on various scales: floating cities, village wise-men with spirit familiars, bandits touching lucky statues. The world should be just as engaging as the characters.", "Principle"],
    ["Make a move that follows", "When you make a move, take an element of the fiction and bring it to bear against the characters. Your move should always follow from the fiction. What's going on? What move makes sense here?", "Principle"],
    ["Never speak the name of your move", "Never tell the players what move you're making. Your moves are prompts to you, not things you say directly. Show the outcome as a natural result of the fiction.", "Principle"],
    ["Give every monster life", "Monsters are fantastic creatures with their own motivations. Give each monster details that bring it to life: smells, sights, sounds. Give each one enough to make it real.", "Principle"],
    ["Name every person", "Anyone the players speak with has a name. They probably have a personality and goals too. Start with a name and let the rest flow from there.", "Principle"],
    ["Ask questions and use the answers", "Part of playing to find out what happens is being curious. If you don't know something, ask the players and use what they say. The easiest question is 'What do you do?' End every move with it.", "Principle"],
    ["Be a fan of the characters", "Think of the characters as protagonists in a story. Cheer for their victories and lament their defeats. You're not here to push them in any direction, merely to participate in fiction that features them.", "Principle"],
    ["Think dangerous", "Everything in the world is a target. No single life is worth anything and nothing is sacrosanct. Everything can be put in danger or destroyed. Without the characters' intervention, the world changes for the worse.", "Principle"],
    ["Begin and end with the fiction", "Everything in Dungeon World comes from and leads to fictional events. When players make a move, they take a fictional action and get a fictional effect. When you make a move, it always comes from the fiction.", "Principle"],
    ["Think offscreen too", "Just because you're a fan of the characters doesn't mean everything happens in front of them. Sometimes your best move is in the next room or another part of the dungeon. Show effects when they come into the spotlight.", "Principle"],
    ["Use a monster, danger, or location move", "Every monster has moves. If a player move says a monster gets to attack, make an aggressive move with that monster. Dangers also have moves—use them to bring danger into play.", "GM Move"],
    ["Reveal an unwelcome truth", "Reveal a fact the players wish wasn't true: the room's trapped, the helpful goblin is a spy. Show them just how much trouble they're in.", "GM Move"],
    ["Show signs of an approaching threat", "Show the players that something's going to happen unless they do something about it. Threat means anything bad that's on the way.", "GM Move"],
    ["Deal damage", "Choose one source of damage that's fictionally threatening a character and apply it. The amount of damage is decided by the source. Tell the player what to roll; you never need to touch the dice.", "GM Move"],
    ["Use up their resources", "Something happens to use up supplies: weapons, armor, healing, ongoing spells. You don't always have to use it up permanently—a sword might be flung across the room, not shattered.", "GM Move"],
    ["Turn their move back on them", "Think about the benefits a move might grant and turn them around negatively. Or grant the same advantage to someone who has it out for the characters.", "GM Move"],
    ["Separate them", "Being separated in battle with no one at your back is one of the worst situations. Separating can mean being pushed apart or teleported to the far end of the dungeon.", "GM Move"],
    ["Give an opportunity that fits a class' abilities", "Every class shines at something. Present an opportunity that plays to what one class is good at. It doesn't have to be a class currently in play.", "GM Move"],
    ["Show a downside to their class, race, or equipment", "Every class has weaknesses. Do orcs have a thirst for elven blood? Does the cleric's magic disturb dangerous forces? The torch that lights the way also draws attention.", "GM Move"],
    ["Offer an opportunity, with or without cost", "Show them something they want: riches, power, glory. You can associate some cost with it. Lead with the fiction, not the mechanics.", "GM Move"],
    ["Put someone in a spot", "A spot is someplace where a character needs to make tough choices. Put them or something they care about in the path of destruction. The harder the choice, the tougher the spot.", "GM Move"],
    ["Tell them the requirements or consequences and ask", "They can do it, but they'll pay the price. Make the consequences clear to the characters, not just the players.", "GM Move"],
    ["Change the environment", "The environment is the feel of the area. Use this move to vary the types of areas and creatures the players will face.", "GM Move"],
    ["Point to a looming threat", "Show signs and clues of something lurking and waiting. Dragon footprints in the mud, slimy trails of a gelatinous cube.", "GM Move"],
    ["Introduce a new faction or type of creature", "Give clear sensory evidence of a new group. A hard application snowballs into combat or ambush.", "GM Move"],
    ["Use a threat from an existing faction or type", "Once introduced, use monsters of that type broadly. Orcs come with worgs; cults have undead servants.", "GM Move"],
    ["Make them backtrack", "Look back at the map. Is there anything useful yet undiscovered? A locked door whose key lies in an earlier room? Show the effect time has had on areas left behind.", "GM Move"],
    ["Present riches at a price", "Put desirable items just out of reach. Find something they're short on and make what they want available if they give up what they have.", "GM Move"],
    ["Present a challenge to one of the characters", "Give the thief a lock, the cleric enemy servants, the wizard magical mysteries, the fighter skulls to crack. Or challenge them at what they're bad at.", "GM Move"],
    ["Fronts overview", "Fronts are collections of linked dangers—threats to the characters and what they care about. They include impending dooms that will happen without intervention. Built outside play to organize your thoughts on what opposes the players.", "Front"],
    ["Campaign front", "The campaign front spans all sessions. It contains broader, slower-burning threats with bigger scope and deeper impact on the world.", "Front"],
    ["Adventure front", "Adventure fronts are tied to one problem and dealt with or cast aside as the characters explore. Think episodic content, used for a few sessions each.", "Front"],
    ["Creating a front", "Choose campaign or adventure front. Create 2-3 dangers. Choose an impending doom for each. Add grim portents (1-3 adventure, 3-5 campaign). Write 1-3 stakes questions. List the general cast.", "Front"],
    ["Grim portents", "Dark designs for what could happen if a danger goes unchecked. Think what would happen if the danger existed without the PCs. When unsure what to do next, push toward resolving a grim portent.", "Front"],
    ["Impending doom", "Choose one: Tyranny, Pestilence, Destruction, Usurpation, Impoverishment, or Rampant Chaos. When all grim portents come to pass, the doom sets in.", "Front"],
    ["Stakes questions", "1-3 concrete questions about people, places, or groups. When resolved, things will never be the same. Once written as a stake, it's out of your hands—you play to find out.", "Front"],
    ["Ambitious Organizations danger", "Types: Misguided Good, Thieves Guild, Cult, Religious Organization, Corrupt Government, Cabal. Moves: Attack by stealth or directly, absorb someone important, influence institutions, establish rules, claim territory, negotiate, observe foes.", "Danger"],
    ["Planar Forces danger", "Types: God, Demon Prince, Elemental Lord, Force of Chaos, Choir of Angels, Construct of Law. Moves: Turn organizations, give prophetic dreams, lay curses, extract promises, attack through intermediaries, foster rivalries.", "Danger"],
    ["Arcane Enemies danger", "Types: Lord of the Undead, Power-mad Wizard, Sentient Artifact, Ancient Curse, Chosen One, Dragon. Moves: Learn forbidden knowledge, cast spells over time and space, attack with magic, spy via scrying, recruit followers, tempt with promises.", "Danger"],
    ["Hordes danger", "Types: Wandering Barbarians, Humanoid Vermin, Underground Dwellers, Plague of the Undead. Moves: Assault civilization, embrace chaos, change direction, overwhelm weaker forces, show dominance, grow by breeding or conquest.", "Danger"],
    ["Cursed Places danger", "Types: Abandoned Tower, Unholy Ground, Elemental Vortex, Dark Portal, Shadowland, Place of Power. Moves: Vomit forth monsters, spread to adjacent places, lure someone in, grow in intensity, hide things, offer power, dampen magic.", "Danger"],
    ["Soft moves and hard moves", "Soft moves lack immediate, irrevocable consequences. Hard moves have immediate consequences. A soft move ignored becomes a golden opportunity for a hard move. When in doubt, you can opt for soft over hard.", "Rule"],
    ["When to make a GM move", "Make a move when: everyone looks to you to find out what happens, players give you a golden opportunity, or they roll a 6-. Generally soft moves when they look to you, hard moves otherwise.", "Rule"],
    ["Ability scores and modifiers", "Abilities: STR, CON, DEX, INT, WIS, CHA. Range 3-18. Modifier range -3 to +3 derived from current score. 1-3: -3, 4-5: -2, 6-8: -1, 9-12: 0, 13-15: +1, 16-17: +2, 18: +3.", "Stat Rule"],
    ["HP", "HP measures stamina, endurance, and health. Maximum HP = class base HP + Constitution score. Starts at maximum. If Constitution changes permanently, adjust HP accordingly.", "Stat Rule"],
    ["Damage", "Subtract damage dealt from current HP. Armor mitigates damage. Damage can never reduce HP below 0. GM damage guidelines: d4 bruises, d6 blood, d8 broken bones, d10 could kill a common person.", "Damage Rule"],
    ["Stun damage", "Non-lethal. PC taking stun damage is defying danger to do anything. GM characters don't count it against HP but act accordingly—staggering, fumbling.", "Damage Rule"],
    ["Damage from multiple creatures", "Roll the highest damage among them and add +1 for each monster beyond the first.", "Damage Rule"],
    ["Death and Last Breath", "At 0 HP, take Last Breath. Roll +nothing. 10+: cheated death, alive but in a bad spot. 7-9: Death offers a bargain—take it and stabilize or refuse and pass on. 6-: fate sealed, marked as Death's own.", "Rule"],
    ["Weak debility (STR)", "Can't exert much force. -1 to STR modifier.", "Debility"],
    ["Shaky debility (DEX)", "Unsteady on feet, shake in hands. -1 to DEX modifier.", "Debility"],
    ["Sick debility (CON)", "Something not right inside. -1 to CON modifier.", "Debility"],
    ["Stunned debility (INT)", "Knock to the head shook something loose. -1 to INT modifier.", "Debility"],
    ["Confused debility (WIS)", "Ears ringing, vision blurred. -1 to WIS modifier.", "Debility"],
    ["Scarred debility (CHA)", "Don't look so good. -1 to CHA modifier.", "Debility"],
    ["Alignment overview", "Alignments: Good, Lawful, Neutral, Chaotic, Evil. Good puts others first. Evil puts self first at others' expense. Lawful imposes order. Chaotic embraces change and freedom. Neutral looks out for itself without jeopardizing others.", "Alignment"],
    ["Character creation steps", "1. Choose Class. 2. Choose Race. 3. Choose Name. 4. Choose Look. 5. Assign Stats (16, 15, 13, 12, 9, 8). 6. Figure Modifiers. 7. Set Max HP. 8. Choose Starting Moves. 9. Choose Alignment. 10. Choose Gear. 11. Introduce Character. 12. Choose Bonds.", "Character Creation"],
    ["Assigning stats", "Assign 16, 15, 13, 12, 9, 8. Put 16 in the stat for your most interesting move. Put 15 in the next most important. Continue with remaining scores.", "Character Creation"],
    ["First session prep", "Print basic moves, class sheets, spell sheets, GM sheet. Read the book, especially GMing and basic moves. The one thing you can't bring is a planned storyline or plot.", "First Session"],
    ["First session goals", "Establish details and describe. Use what they give you. Ask questions. Leave blanks. Look for interesting facts. Help players understand moves. Give each character a chance to shine. Introduce NPCs.", "First Session"],
    ["Starting the first adventure", "Start in a tense situation. Use anything that demands action. Ask questions right away. Keep your eye out for unresolved threats and dangerous things mentioned but not dealt with.", "First Session"],
    ["Village steading", "Smallest steadings, usually out of the way. Default: Poor, Steady, Militia, Resource, Oath to another steading.", "World Building"],
    ["Town steading", "About 100 inhabitants. Springs up around a mill, trading post, or inn. Default: Moderate, Steady, Watch, Trade.", "World Building"],
    ["Keep steading", "Built for defense at frontier edges. Default: Poor, Shrinking, Guard, Need (Supplies), Trade, Oath.", "World Building"],
    ["City steading", "Largest steading. Many races and kinds at trade route confluences or spiritual sites. Default: Moderate, Steady, Guard, Market, Guild.", "World Building"],
    ["Bonds", "Bonds tie the party together. Each bond relates your character to another PC. At end of session, resolve one bond for XP and write a new one.", "Rule"],
    ["Hirelings", "Defined by Skill, Cost, and Loyalty. Not heroes. When in danger from your orders, roll+loyalty. 10+: stand firm. 7-9: do it for now, serious demands later.", "Rule"],
    ["Creating custom moves", "Start with trigger (fictional action), effect, or rarely mechanics. Since moves start and end with fiction, mechanical ideas are least important.", "Advanced Rule"],
    ["Compendium classes", "Classes available only to higher-level characters meeting specific requirements. Structure: starting move requiring certain experience, plus 2-3 moves requiring the starting move.", "Advanced Rule"],
    ["New class design", "Base HP: 4, 6, 8, or 10. Damage: d4, d6, d8, or d10. Most classes have Neutral as alignment option. Write four bonds. Equipment should include at least one weapon and one armor option.", "Advanced Rule"],
    ["End of Session", "Choose one resolved bond—if other player agrees, mark XP and write new bond. Answer: Did we learn something new? Overcome a notable monster? Loot memorable treasure? Each yes = XP for all.", "Rule"],
    ["Encumbrance", "Carrying weight up to load: fine. Load+1 or +2: -1 to moves. Greater than load+2: drop 1 weight and roll at -1, or automatically fail.", "Rule"],
  ];
  for (const t of tools) s.run(...t);
}
