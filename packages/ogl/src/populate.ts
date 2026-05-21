// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// The code in this file (functions, control flow, SQL logic) is AGPL-3.0-only.
// The string literals containing game mechanics, rule descriptions, equipment
// stats, career data, and table entries are derivative material of Open Game
// Content from the Cepheus Engine System Reference Document and are governed
// exclusively by the Open Game License v1.0a (see OGL-1.0a.txt). These strings
// are AGPL-licensed code *structure* but OGL-licensed *content*. The resulting
// database output in data/ogl/ is designated as Open Game Content.

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { ensureSchema } from "./database.js";

export function populateOglDatabase(dbPath: string): { success: boolean; message: string } {
  if (existsSync(dbPath)) {
    return { success: true, message: `Database already exists at ${dbPath}. Use --force to re-populate.` };
  }
  const db = ensureSchema(dbPath);
  const tx = db.transaction(() => {
    seedCategories(db);
    seedCoreRules(db);
    seedSkills(db);
    seedCareers(db);
    seedTables(db);
    seedEquipment(db);
    seedCombat(db);
    seedShipOps(db);
    seedWorldBuilding(db);
    seedEncounters(db);
    seedPsionics(db);
    seedCommonVessels(db);
  });
  tx();
  rebuildFts(db);
  db.close();
  return { success: true, message: `OGL database populated at ${dbPath}` };
}

function rebuildFts(db: Database.Database): void {
  db.exec(`INSERT INTO rules_fts(rules_fts) VALUES ('rebuild');`);
  db.exec(`INSERT INTO core_rules_fts(core_rules_fts) VALUES ('rebuild');`);
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

function seedCategories(db: Database.Database): void {
  const stmt = db.prepare("INSERT OR IGNORE INTO rules_categories (name, description) VALUES (?, ?)");
  const cats = [
    ["Introduction", "Core task resolution, characteristics, careers, and gameplay overview"],
    ["Characteristics", "The six core characteristics used in character creation"],
    ["Character Creation", "Step-by-step character generation procedures"],
    ["Skills", "Skill definitions, specializations, and associated characteristics"],
    ["Psionics", "Psionic powers, training, and usage rules"],
    ["Careers", "Career paths, qualification rolls, survival, and advancement"],
    ["Equipment", "Personal equipment, weapons, armor, computers, vehicles, drugs, and augmentations"],
    ["Personal Combat", "Combat rules, initiative, damage, actions, and recovery"],
    ["Off-World Travel", "Interstellar travel, jump drives, starship operations, and passage"],
    ["Trade & Commerce", "Speculative trade, cargo, and market rules"],
    ["Ship Design", "Rules for designing and constructing starships and small craft"],
    ["Common Vessels", "Pre-built starship and small craft designs"],
    ["Space Combat", "Starship combat rules, crew positions, damage, and boarding"],
    ["Environments & Hazards", "Environmental hazards, diseases, radiation, and vacuum"],
    ["World Generation", "Star system generation, UWP, trade codes, and world creation"],
    ["Wilderness Encounters", "Animal generation, encounter tables, and planetary exploration"],
    ["Social Encounters", "Patron, random, legal, and rumor encounter systems"],
    ["Starship Encounters", "Space encounter tables and vessel interactions"],
    ["Refereeing", "Game mastering advice, improvisation, and solo play"],
    ["Adventures", "Story structure, campaign design, and adventure creation"],
  ];
  for (const c of cats) stmt.run(...c);
}

// ─── CORE RULES ─────────────────────────────────────────────────────────────

function seedCoreRules(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO core_rules (section, subsection, content, page_hint) VALUES (?, ?, ?, ?)");
  const rules: [string, string, string, string][] = [
    // Introduction
    ["Core Mechanic", "Task Resolution",
      "Roll 2d6, add modifiers (characteristic DM, skill level, difficulty, circumstances). Total of 8+ succeeds. Standard difficulty is Average (+0).",
      "Introduction"],
    ["Core Mechanic", "Difficulty Table",
      "Simple +6, Easy +4, Routine +2, Average +0, Difficult -2, Very Difficult -4, Formidable -6. The difficulty DM is added to the check result.",
      "Introduction"],
    ["Core Mechanic", "Effect Margins",
      "Effect = Check Result - 8. Exceptional Success: Effect 6+. Exceptional Failure: Effect -6 or lower. Effect drives combat damage, task quality, and opposed checks.",
      "Introduction"],
    ["Core Mechanic", "Opposed Checks",
      "Both characters roll 2d6+modifiers. Highest Effect wins. Ties go to higher relevant characteristic; if still tied, reroll.",
      "Introduction"],
    ["Core Mechanic", "Trying Again",
      "Generally allowed unless failure has consequences (e.g., falling). Success is usually final; additional successes are meaningless.",
      "Introduction"],
    ["Core Mechanic", "Circumstance Modifiers",
      "Helpful tools or competent aid: +1 DM. Defective tools, incompetent help, or adverse conditions: -1 DM. Referee may adjust.",
      "Introduction"],
    ["Core Mechanic", "Time and Checks",
      "Rushed task (-2 DM, 1-6 combat rounds). Cautious task (+2 DM, 10-60 min). Standard task (1-6 min). Aiding Another: helper makes check; success grants +1 DM to primary character.",
      "Introduction"],
    ["Core Mechanic", "Skill Checks",
      "2d6 + skill level + characteristic DM. Untrained skills use -3 DM. Skill-0 removes the penalty.",
      "Introduction"],
    ["Core Mechanic", "Attack Rolls",
      "Melee: 2d6 + melee skill + STR or DEX DM. Shooting: 2d6 + gun combat skill + DEX DM. Thrown: 2d6 + Athletics + DEX DM. Difficulty determined by range.",
      "Introduction"],
    ["Core Mechanic", "Characteristic Checks",
      "2d6 + characteristic DM. No skill bonus. For unskilled skill-based tasks, use characteristic check with -3 DM.",
      "Introduction"],
    ["Core Mechanic", "Pseudo-Hex Notation",
      "Values 0-33: 0-9 standard, A=10 through F=15, G=16 through Z=33. Used for characteristic scores, UPP, ship codes, and worlds.",
      "Introduction"],
    ["Core Mechanic", "Glossary",
      "2D6: Two six-sided dice. Check: A 2d6 roll plus modifiers vs 8+. DM: Dice Modifier. Effect: Check result minus 8. NPC: Non-Player Character. PC: Player Character. UPP: Universal Personality Profile. UWP: Universal World Profile.",
      "Introduction"],

    // Characteristics
    ["Characteristics", "Values and DMs",
      "Six core characteristics: Strength (STR), Dexterity (DEX), Endurance (END), Intelligence (INT), Education (EDU), Social Standing (SOC). UPP hex format: STR DEX END INT EDU SOC. DM: 0=>-3, 1-2=>-2, 3-5=>-1, 6-8=>0, 9-11=>+1, 12-14=>+2, 15+=>+3.",
      "Chapter 1"],
    ["Characteristics", "Social Standing and Noble Titles",
      "SOC 11=Knight/Dame, SOC 12=Baron/Baroness, SOC 13=Marquis/Marchioness, SOC 14=Count/Countess, SOC 15=Duke/Duchess. SOC 16+ reserved for royalty.",
      "Chapter 1"],
    ["Characteristics", "Psionic Strength",
      "Seventh characteristic (PSI). Roll 2d6-6 + nobility DM. Minimum 0, maximum 15. Does not count as a regular characteristic. DM: 0=>-3 through 15+=>+3.",
      "Chapter 1"],

    // Character Creation
    ["Character Creation", "Overview",
      "1) Roll six characteristics (2d6 each, assign as desired). 2) Determine background skills from homeworld and education. 3) Enter career. 4) Resolve career terms (4 years each). 5) Gain skills, benefits, aging effects per term. 6) Muster out and purchase equipment.",
      "Chapter 1"],
    ["Character Creation", "Background Skills",
      "Homeworld skills: 3+EDU DM skills from homeworld list. EDU 8+: 3 background skills. EDU 6-7: 2. EDU 4-5: 1. EDU 0-3: 0. Choose from Admin, Advocate, Animals, Art, Athletics, Carouse, Comms, Computer, Drive, Electronics, Engineer, Flyer, Language, Mechanic, Medic, Profession, Science, Seafarer, Streetwise, Survival, Vacc Suit.",
      "Chapter 1"],
    ["Character Creation", "Terms and Aging",
      "Each career term = 4 years. At age 34+: roll 2d6 per term; result < terms served past 34 => -1 to one physical characteristic. Aging Crisis at characteristic 0: roll 2d6; 8+ survive with characteristic 1. Anagathics halve aging rolls but cost Cr12,000/month. Mandatory retirement at age 66.",
      "Chapter 1"],
    ["Character Creation", "Injuries and Medical Debt",
      "Injury table: roll 1d6 when mishap occurs. 1=nearly killed (-1d6 to one physical char), 2=severely injured (-1d6 to one physical, scarred), 3=injured (-1 to one physical), 4-5=lightly injured (no permanent damage), 6=unhurt. Medical debt: Cr500-10,000+ per injury.",
      "Chapter 1"],
    ["Character Creation", "Mustering Out",
      "Benefits: 1 per term served + extra for rank. Material benefits: weapons, armor, ship shares, vehicle, TAS membership, characteristic increases. Cash: roll on career cash table. Ship shares: 25 shares = one ship. Pension: Cr5,000/10,000 per term after 4+ terms.",
      "Chapter 1"],

    // Psionics
    ["Psionics", "Overview",
      "Psionic Strength (PSI) is the seventh characteristic. Training requires a Psionics Institute at a cost of Cr100,000. Training roll: 8+ using PSI DM. Success grants access to one Psionic Talent. Each talent has multiple powers. Using a talent expends PSI points; recover 1 point per hour of rest.",
      "Chapter 3"],
    ["Psionics", "Talents",
      "Awareness (self): Suspended Animation, Enhanced Strength (+4 STR for PSI mins), Enhanced Endurance (+4 END), Regeneration (heal 1d per PSI point). Clairvoyance (distant sensing): Sense (detect at range), Clairvoyance (see distant location), Clairaudience, Clairsentience. Telekinesis: Move objects (Strength = PSI score). Telepathy: Life Detection, Telempathy, Read Surface Thoughts, Send Thoughts, Probe, Assault (mental attack), Shield (mental defense). Teleportation: instant travel (PSI x 10m range).",
      "Chapter 3"],

    // Common Themes
    ["Game Themes", "Overview",
      "Colonial (settle new world), Commerce (trading and freight), Drifter/Sandbox (odd jobs, exploration), Espionage (spy missions), Exploration (survey uncharted space), Mercenary (military contracts), Political (diplomacy and intrigue), Rebellion (civil war).",
      "Introduction"],
  ];
  for (const r of rules) s.run(...r);
}

// ─── SKILLS ──────────────────────────────────────────────────────────────────

function seedSkills(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO skills (name, description, characteristic, specializations) VALUES (?, ?, ?, ?)");
  const skills: [string, string, string, string][] = [
    ["Admin", "Managing bureaucracies, navigating paperwork, and handling logistics.", "EDU", "Organization, Legal, Logistics"],
    ["Advocate", "Knowledge of legal codes and court procedures.", "EDU", "Civil Law, Criminal Law, Corporate Law"],
    ["Aircraft", "Operating winged, rotor, and grav aircraft.", "DEX", "Winged Aircraft, Rotor Aircraft, Grav Vehicle"],
    ["Animals", "Handling, riding, and caring for animals.", "None", "Riding, Veterinary Medicine, Farming"],
    ["Archery", "Using bows and crossbows.", "DEX", "Bow, Crossbow"],
    ["Athletics", "Physical fitness, climbing, and sports.", "Varies", "Dexterity, Endurance, Strength"],
    ["Battle Dress", "Operating powered armor.", "DEX", "Standard, Advanced"],
    ["Bay Weapons", "Operating ship bay weaponry.", "DEX", "Missile Bank, Particle Beam Bay, Meson Gun, Fusion Gun"],
    ["Bludgeoning Weapons", "Using clubs, maces, and blunt instruments.", "STR", "Club, Mace, Staff"],
    ["Bribery", "Offering illegal payments to officials.", "SOC", "Official, Criminal, Corporate"],
    ["Broker", "Trading, commerce, and market analysis.", "EDU", "Trade, Black Market, Futures"],
    ["Carousing", "Socializing, drinking, and fitting in at social events.", "SOC", "Partying, Networking, Drinking"],
    ["Comms", "Operating communication systems.", "EDU", "Radio, Laser, Maser, Meson, Encryption"],
    ["Computer", "Programming and operating computers.", "EDU", "Programming, Hacking, Data Retrieval"],
    ["Demolitions", "Using and disarming explosive devices.", "EDU", "Demolitions, Grenades, Breaching"],
    ["Electronics", "Working with electronic devices and systems.", "EDU", "Comms, Sensors, Computers, Remote Ops"],
    ["Energy Pistol", "Using pistol-sized energy weapons.", "DEX", "Laser Pistol, Stunner"],
    ["Energy Rifle", "Using rifle-sized energy weapons.", "DEX", "Laser Rifle, Advanced Energy"],
    ["Engineering", "Designing, repairing, and maintaining machinery.", "EDU", "M-Drive, J-Drive, Life Support, Power, Gravitics"],
    ["Farming", "Growing crops and raising livestock.", "EDU", "Hydroponics, Animal Husbandry"],
    ["Gambling", "Games of chance and reading opponents.", "INT", "Cards, Dice, Sports Betting"],
    ["Grav Vehicle", "Operating grav-propelled ground vehicles.", "DEX", "Civilian, Military"],
    ["Gravitics", "Understanding gravity manipulation technology.", "EDU", "Artificial Gravity, Inertial Compensators"],
    ["Gun Combat", "Using slug-throwing firearms.", "DEX", "Slug Pistol, Slug Rifle, Shotgun, Submachine Gun"],
    ["Gunnery", "Operating spaceship turret weapons.", "DEX", "Pulse Laser, Beam Laser, Particle Beam, Missile, Sandcaster"],
    ["Heavy Weapons", "Using man-portable support weapons.", "DEX", "Launchers, Man-Portable Artillery, Flamethrowers"],
    ["Jack-of-All-Trades", "General capability for untrained tasks.", "None", ""],
    ["Leadership", "Commanding others and inspiring loyalty.", "SOC", "Military, Civilian, Crisis"],
    ["Linguistics", "Speaking and understanding foreign languages.", "EDU", "Each language is a separate specialization"],
    ["Liaison", "Diplomacy, negotiation, and public relations.", "SOC", "Diplomatic, Corporate, Military"],
    ["Life Sciences", "Biology, genetics, and xenobiology.", "EDU", "Biology, Xenobiology, Genetics, Botany"],
    ["Mechanics", "Repairing and maintaining mechanical equipment.", "EDU", "Vehicles, Robotics, Hydraulics"],
    ["Medicine", "Medical treatment and surgery.", "EDU", "First Aid, Surgery, Pharmacology, Diagnosis"],
    ["Melee Combat", "Close combat with hand weapons.", "STR", "Bludgeoning Weapons, Natural Weapons, Piercing Weapons, Slashing Weapons"],
    ["Mole", "Operating subterranean drilling vehicles.", "DEX", "Civilian, Military"],
    ["Motorboats", "Operating powered watercraft.", "DEX", "Civilian, Military"],
    ["Natural Weapons", "Unarmed combat and natural attacks.", "STR", "Claws, Teeth, Horns, Hooves, Thrasher"],
    ["Navigation", "Land and sea navigation.", "EDU", "Land, Sea, Underwater"],
    ["Ocean Ships", "Operating large ocean-going vessels.", "DEX", "Civilian, Military, Submarine"],
    ["Physical Sciences", "Physics, chemistry, and material sciences.", "EDU", "Physics, Chemistry, Geology"],
    ["Piercing Weapons", "Using spears, rapiers, and pointed weapons.", "STR", "Spear, Rapier, Bayonet"],
    ["Piloting", "Operating spacecraft.", "DEX", "Small Craft, Spacecraft, Capital Ship"],
    ["Recon", "Scouting and gathering intelligence.", "INT", "Stealth, Observation, Tracking"],
    ["Riding", "Riding and controlling animals.", "DEX", "Mount, Draft Animal"],
    ["Rotor Aircraft", "Operating helicopters and rotor-craft.", "DEX", "Civilian, Military"],
    ["Sciences", "General scientific knowledge base.", "EDU", "Life Sciences, Physical Sciences, Social Sciences, Space Sciences"],
    ["Sailing Ships", "Operating wind-powered watercraft.", "DEX", "Civilian, Military"],
    ["Screens", "Operating defensive screen systems on starships.", "EDU", "Meson Screen, Nuclear Damper"],
    ["Shotgun", "Using smooth-bore longarms.", "DEX", "Pump, Auto"],
    ["Slashing Weapons", "Using swords, axes, and edged weapons.", "STR", "Sword, Axe, Knife"],
    ["Slug Pistol", "Using pistol-caliber slug throwers.", "DEX", "Revolver, Auto Pistol, Body Pistol"],
    ["Slug Rifle", "Using rifle-caliber slug throwers.", "DEX", "Assault Rifle, Rifle, Carbine"],
    ["Social Sciences", "Psychology, sociology, and economics.", "EDU", "Psychology, Sociology, Economics, History"],
    ["Space Sciences", "Astronomy, planetology, and astrography.", "EDU", "Astronomy, Planetology, Astrography"],
    ["Spinal Mounts", "Operating spinal-mount weapons.", "DEX", "Particle Accelerator, Meson Spinal"],
    ["Steward", "Cooking, serving, and passenger care aboard starships.", "EDU", "Passenger Line, Luxury, Hostile Environment"],
    ["Streetwise", "Surviving in urban underworld environments.", "INT", "Gangs, Black Market, Rumors"],
    ["Submarine", "Operating underwater vessels.", "DEX", "Civilian, Military"],
    ["Survival", "Living off the land in wilderness environments.", "END", "Arctic, Desert, Jungle, Ocean, Space"],
    ["Tactics", "Military planning and battlefield command.", "INT", "Military, Naval, Ground, Fleet"],
    ["Tracked Vehicle", "Operating vehicles with continuous tracks.", "DEX", "Civilian, Military"],
    ["Turret Weapons", "Operating ground vehicle turret weapons.", "DEX", "Light, Medium, Heavy"],
    ["Vehicle", "General vehicle operation.", "DEX", "Tracked, Wheeled, Grav, Mole"],
    ["Veterinary Medicine", "Medical care for animals.", "EDU", "Farm Animals, Wild Animals"],
    ["Watercraft", "General water vehicle operation.", "DEX", "Motorboats, Ocean Ships, Sailing Ships, Submarine"],
    ["Wheeled Vehicle", "Operating ground vehicles with wheels.", "DEX", "Civilian, Motorcycle, Military"],
    ["Winged Aircraft", "Operating fixed-wing atmospheric craft.", "DEX", "Civilian, Military, High Performance"],
    ["Zero-G", "Operating in microgravity and freefall.", "DEX", "Maneuvering, Combat, Damage Control"],
  ];
  for (const sk of skills) s.run(...sk);
}

// ─── CAREERS ─────────────────────────────────────────────────────────────────

function seedCareers(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO careers (name, description, qualification, survival, advancement, ranks, mustering_out, skills_and_training) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const careers: [string, string, string, string, string, string, string, string][] = [
    ["Navy", "Service in the stellar navy, crewing military starships.", "INT 6+", "INT 5+", "EDU 7+",
      "Crewman, Ensign/Lieutenant, Lt Commander, Commander, Captain, Admiral",
      "Cash: Cr1,000/5,000/10,000/20,000/50,000/100,000. Benefits: +1 EDU, Weapon, Ship Share, +1 SOC, TAS Membership",
      "Pilot, Gunnery, Engineer, Mechanic, Electronics, Vacc Suit, Zero-G, Gun Combat, Melee, Admin, Comms, Computer"],
    ["Marines", "Elite ground assault and boarding troops.", "END 6+", "END 7+", "EDU 5+",
      "Marine, Lance Corporal, Corporal, Sergeant, Gunnery Sergeant, Lieutenant",
      "Cash: Cr2,000/5,000/10,000/20,000/30,000/50,000. Benefits: Weapon, Armor, +1 END, +1 SOC, +2 END",
      "Gun Combat, Heavy Weapons, Melee, Stealth, Tactics, Vacc Suit, Zero-G, Athletics, Explosives, Battle Dress"],
    ["Army", "Planetary ground forces and military operations.", "END 5+", "STR 6+", "EDU 6+",
      "Private, Lance Corporal, Corporal, Sergeant, Lieutenant, Captain",
      "Cash: Cr2,000/5,000/10,000/15,000/25,000/40,000. Benefits: Weapon, Armor, +1 END, Combat Implant",
      "Gun Combat, Heavy Weapons, Melee, Drive, Flyer, Recon, Survival, Stealth, Tactics, Explosives, Comms"],
    ["Scouts", "Exploration, survey, and courier service.", "INT 5+", "END 7+", "EDU 5+",
      "Scout, Courier, Surveyor, Explorer, Senior Scout",
      "Cash: Cr2,500/5,000/10,000/20,000/40,000. Benefits: Ship (Scout/Courier), Weapon, Ship Share",
      "Astrogation, Pilot, Electronics, Gun Combat, Vacc Suit, Zero-G, Recon, Survival, Science, Comms, Engineer"],
    ["Merchants", "Commercial trade and free trading operations.", "EDU 5+", "INT 5+", "INT 7+",
      "Crewman, 4th/3rd Officer, 2nd Officer, 1st Officer, Captain",
      "Cash: Cr5,000/10,000/20,000/30,000/40,000. Benefits: Free Trader, Ship Share, +1 SOC, +1 INT",
      "Broker, Steward, Engineer, Mechanic, Pilot, Electronics, Vacc Suit, Admin, Carouse, Comms, Advocate"],
    ["Agents", "Intelligence, law enforcement, and corporate security.", "INT 6+", "INT 6+", "INT 5+",
      "Agent, Field Agent, Senior Agent, Special Agent",
      "Cash: Cr5,000/10,000/25,000/50,000. Benefits: Weapon, Ship Share, +1 INT, +1 EDU",
      "Investigate, Deception, Stealth, Gun Combat, Streetwise, Persuade, Electronics, Computer, Comms, Carouse"],
    ["Nobility", "Planetary and interstellar aristocracy.", "SOC 10+", "SOC 6+", "INT 7+",
      "Gentleman/Lady, Knight/Dame, Baronet/Baronetess, Baron/Baroness, Marquis/Marchioness, Count/Countess, Duke/Duchess",
      "Cash: Cr10,000/20,000/50,000/100,000/200,000. Benefits: Ship Share, +1 SOC, Weapon, TAS Membership, Yacht",
      "Admin, Advocate, Diplomat, Leadership, Carouse, Persuade, Art, Animals, Melee, Athletics, Computer"],
    ["Scholars", "Academic research and education.", "EDU 7+", "EDU 6+", "INT 8+",
      "Student, Researcher, Professor, Dean",
      "Cash: Cr5,000/10,000/20,000/40,000. Benefits: +1 EDU, +1 INT, Scientific Equipment, Lab Ship",
      "Science, Electronics, Medic, Investigate, Admin, Language, Art, Jack of All Trades, Computer, Engineer"],
    ["Citizens", "General civilian careers and professions.", "EDU 4+", "SOC 5+", "INT 6+",
      "Worker, Technician, Manager, Executive",
      "Cash: Cr2,500/5,000/10,000/20,000/50,000. Benefits: +1 SOC, Equipment, Ship Share, +1 INT",
      "Drive, Flyer, Electronics, Mechanic, Engineer, Profession, Admin, Advocate, Carouse, Comms, Computer"],
    ["Drifters", "Those living on the margins of society.", "END 4+", "INT 5+", "SOC 7+",
      "Vagabond, Wanderer, Survivor, Legend",
      "Cash: Cr1,000/2,500/10,000/20,000. Benefits: Weapon, +1 END, Contact, Ship Share",
      "Survival, Streetwise, Stealth, Melee, Recon, Athletics, Deception, Gambling, Carouse, Jack of All Trades"],
    ["Belter", "Asteroid prospectors and mineral extraction workers.", "END 6+", "DEX 7+", "INT 6+",
      "Prospector, Operator, Foreman, Master Belter",
      "Cash: Cr5,000/10,000/30,000/50,000. Benefits: Prospecting Ship, Ship Share, +1 END",
      "Prospecting, Vacc Suit, Zero-G, Mechanic, Electronics, Pilot, Engineer, Survival, Gambling"],
    ["Entertainer", "Performers, artists, journalists, and holovid personalities.", "SOC 5+", "INT 4+", "EDU 7+",
      "Performer, Artist, Journalist, Star",
      "Cash: Cr5,000/10,000/50,000/100,000. Benefits: +1 SOC, Ship Share, Contact",
      "Art, Carouse, Athletics, Persuade, Steward, Gambling, Streetwise, Deception, Leadership"],
    ["Rogue", "Criminals, thieves, and underworld enforcers.", "DEX 6+", "DEX 4+", "SOC 7+",
      "Thug, Enforcer, Specialist, Boss",
      "Cash: Cr5,000/15,000/30,000/50,000. Benefits: Weapon, Contact, +1 DEX, Ship Share",
      "Stealth, Deception, Streetwise, Gun Combat, Melee, Recon, Athletics, Computers, Gambling"],
    ["Marine Officer", "Commissioned officer track in the star marines.", "INT 6+, SOC 8+", "END 6+", "INT 6+",
      "Lieutenant, Captain, Major, Colonel",
      "Cash: Cr5,000/15,000/30,000/50,000. Benefits: Weapon, Armor, Ship Share, +1 SOC",
      "Leadership, Tactics, Gun Combat, Melee, Admin, Vacc Suit, Zero-G, Athletics, Comms"],
    ["Merchant Prince", "High-level commercial magnates and trade barons.", "INT 6+, EDU 8+", "INT 6+", "INT 5+",
      "Merchant, Factor, Director, Prince",
      "Cash: Cr10,000/30,000/60,000/100,000. Benefits: Free Trader, Yacht, +1 SOC, Ship Share",
      "Broker, Admin, Advocate, Leadership, Carouse, Liaison, Computer, Engineer, Electronics"],
    ["Physician", "Medical professionals, from first responders to surgeons.", "EDU 8+", "EDU 4+", "EDU 6+",
      "Medic, Doctor, Surgeon, Chief Surgeon",
      "Cash: Cr10,000/20,000/40,000/60,000. Benefits: Medical Equipment, Lab Ship, +1 EDU, +1 INT",
      "Medicine, Life Sciences, Admin, Computer, Investigate, Electronics, Liaison, Vacc Suit"],
    ["Politician", "Government officials, diplomats, and civil servants.", "SOC 8+", "INT 5+", "EDU 8+",
      "Clerk, Administrator, Minister, Secretary-General",
      "Cash: Cr5,000/10,000/30,000/50,000. Benefits: +1 SOC, +1 INT, Yacht, TAS Membership",
      "Admin, Advocate, Liaison, Carouse, Leadership, Deception, Persuade, Computer, Broker"],
    ["Sailor", "Crew of waterborne vessels.", "DEX 5+", "DEX 6+", "INT 7+",
      "Seaman, Petty Officer, Chief, Commander",
      "Cash: Cr1,000/5,000/10,000/20,000. Benefits: +1 DEX, Weapon, Ship Share, Contact",
      "Seafarer, Mechanic, Athletics, Survival, Steward, Carouse, Gun Combat, Comms"],
  ];
  for (const c of careers) s.run(...c);
}

// ─── TABLES ──────────────────────────────────────────────────────────────────

function seedTables(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO tables_2d6 (name, description, dice_type, min_roll, max_roll, result) VALUES (?, ?, ?, ?, ?, ?)");

  const tables: [string, string, string, number, number, string][] = [
    ["Reaction Table", "NPC reaction to player characters", "2d6", 2, 2, "Violently hostile - immediate attack"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 3, 3, "Hostile - will attack if provoked"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 4, 4, "Unfriendly - uncooperative, may mislead"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 5, 5, "Cautious - wary but not aggressive"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 6, 6, "Neutral - indifferent"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 7, 7, "Neutral - willing to talk"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 8, 8, "Interested - curious about the characters"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 9, 9, "Friendly - helpful within reason"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 10, 10, "Very friendly - generous and helpful"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 11, 11, "Enthusiastic - will go out of their way to help"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 12, 12, "Devoted - lifelong ally or devoted fan"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 2, 2, "Assassin or hostile agent tracking the party"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 3, 3, "Thief or criminal looking for marks"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 4, 4, "Disgruntled local with a grievance"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 5, 5, "Merchant or trader seeking customers"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 6, 6, "Fellow traveler sharing the road"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 7, 7, "Local official or bureaucrat"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 8, 8, "Interesting stranger with a story"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 9, 9, "Potential patron or ally seeking help"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 10, 10, "Old acquaintance with useful information"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 11, 11, "Unusual alien or outsider"],
    ["Personal Encounter", "Random person encountered during travel", "2d6", 12, 12, "Wealthy noble or celebrity"],
    ["Patron Encounter", "Type of patron making contact", "d66", 11, 11, "Agent - intelligence or corporate operative"],
    ["Patron Encounter", "Type of patron making contact", "d66", 12, 12, "Athlete - professional sports figure"],
    ["Patron Encounter", "Type of patron making contact", "d66", 13, 13, "Barbarian - warrior from a low-tech world"],
    ["Patron Encounter", "Type of patron making contact", "d66", 14, 14, "Belter - asteroid prospector"],
    ["Patron Encounter", "Type of patron making contact", "d66", 15, 15, "Broker - financial or trade intermediary"],
    ["Patron Encounter", "Type of patron making contact", "d66", 16, 16, "Bureaucrat - government functionary"],
    ["Patron Encounter", "Type of patron making contact", "d66", 21, 21, "Celebrity - holovid star or public figure"],
    ["Patron Encounter", "Type of patron making contact", "d66", 22, 22, "Colonist - frontier settler"],
    ["Patron Encounter", "Type of patron making contact", "d66", 23, 23, "Con Artist - professional deceiver"],
    ["Patron Encounter", "Type of patron making contact", "d66", 24, 24, "Corporate Executive - business leader"],
    ["Patron Encounter", "Type of patron making contact", "d66", 25, 25, "Courier - message or package carrier"],
    ["Patron Encounter", "Type of patron making contact", "d66", 26, 26, "Diplomat - interstellar representative"],
    ["Patron Encounter", "Type of patron making contact", "d66", 31, 31, "Drifter - wanderer between worlds"],
    ["Patron Encounter", "Type of patron making contact", "d66", 32, 32, "Educator - teacher or academic"],
    ["Patron Encounter", "Type of patron making contact", "d66", 33, 33, "Entertainer - performer or artist"],
    ["Patron Encounter", "Type of patron making contact", "d66", 34, 34, "Financier - wealthy investor"],
    ["Patron Encounter", "Type of patron making contact", "d66", 35, 35, "Fugitive - person on the run"],
    ["Patron Encounter", "Type of patron making contact", "d66", 36, 36, "Hijacker - cargo or ship thief"],
    ["Patron Encounter", "Type of patron making contact", "d66", 41, 41, "Hunter - big game or bounty hunter"],
    ["Patron Encounter", "Type of patron making contact", "d66", 42, 42, "Marine - military spacer"],
    ["Patron Encounter", "Type of patron making contact", "d66", 43, 43, "Mercenary - soldier for hire"],
    ["Patron Encounter", "Type of patron making contact", "d66", 44, 44, "Merchant - trader and businessperson"],
    ["Patron Encounter", "Type of patron making contact", "d66", 45, 45, "Navy - naval officer"],
    ["Patron Encounter", "Type of patron making contact", "d66", 46, 46, "Noble - member of the aristocracy"],
    ["Patron Encounter", "Type of patron making contact", "d66", 51, 51, "Physician - medical professional"],
    ["Patron Encounter", "Type of patron making contact", "d66", 52, 52, "Pirate - space-going criminal"],
    ["Patron Encounter", "Type of patron making contact", "d66", 53, 53, "Politician - government official"],
    ["Patron Encounter", "Type of patron making contact", "d66", 54, 54, "Rogue - underworld figure"],
    ["Patron Encounter", "Type of patron making contact", "d66", 55, 55, "Scientist - researcher or academic"],
    ["Patron Encounter", "Type of patron making contact", "d66", 56, 56, "Scout - exploration service member"],
    ["Patron Encounter", "Type of patron making contact", "d66", 61, 61, "Smuggler - illicit goods transporter"],
    ["Patron Encounter", "Type of patron making contact", "d66", 62, 62, "System Defense Officer - local patrol"],
    ["Patron Encounter", "Type of patron making contact", "d66", 63, 63, "Technician - skilled technical worker"],
    ["Patron Encounter", "Type of patron making contact", "d66", 64, 64, "Terrorist - political extremist"],
    ["Patron Encounter", "Type of patron making contact", "d66", 65, 65, "Tourist - wealthy sightseer"],
    ["Patron Encounter", "Type of patron making contact", "d66", 66, 66, "Referee's Choice - unique or unusual patron"],
    ["Random Encounter", "Random social encounters", "d66", 11, 11, "Adventurers - another group on a mission"],
    ["Random Encounter", "Random social encounters", "d66", 12, 12, "Alien Starship Crew"],
    ["Random Encounter", "Random social encounters", "d66", 13, 13, "Ambushing Brigands"],
    ["Random Encounter", "Random social encounters", "d66", 14, 14, "Bandits"],
    ["Random Encounter", "Random social encounters", "d66", 15, 15, "Beggars"],
    ["Random Encounter", "Random social encounters", "d66", 16, 16, "Belters"],
    ["Random Encounter", "Random social encounters", "d66", 21, 21, "Drunken Crew"],
    ["Random Encounter", "Random social encounters", "d66", 22, 22, "Fugitives"],
    ["Random Encounter", "Random social encounters", "d66", 23, 23, "Government Officials"],
    ["Random Encounter", "Random social encounters", "d66", 24, 24, "Guards"],
    ["Random Encounter", "Random social encounters", "d66", 25, 25, "Hunters and Guides"],
    ["Random Encounter", "Random social encounters", "d66", 26, 26, "Law Enforcers on Patrol"],
    ["Random Encounter", "Random social encounters", "d66", 31, 31, "Local Performers"],
    ["Random Encounter", "Random social encounters", "d66", 32, 32, "Maintenance Robots"],
    ["Random Encounter", "Random social encounters", "d66", 33, 33, "Merchants"],
    ["Random Encounter", "Random social encounters", "d66", 34, 34, "Military Personnel on Leave"],
    ["Random Encounter", "Random social encounters", "d66", 35, 35, "Noble with Retinue"],
    ["Random Encounter", "Random social encounters", "d66", 36, 36, "Peasants"],
    ["Random Encounter", "Random social encounters", "d66", 41, 41, "Political Dissident"],
    ["Random Encounter", "Random social encounters", "d66", 42, 42, "Potential Patron"],
    ["Random Encounter", "Random social encounters", "d66", 43, 43, "Public Demonstration"],
    ["Random Encounter", "Random social encounters", "d66", 44, 44, "Religious Pilgrims"],
    ["Random Encounter", "Random social encounters", "d66", 45, 45, "Reporters"],
    ["Random Encounter", "Random social encounters", "d66", 46, 46, "Researchers"],
    ["Random Encounter", "Random social encounters", "d66", 51, 51, "Riotous Mob"],
    ["Random Encounter", "Random social encounters", "d66", 52, 52, "Security Troops"],
    ["Random Encounter", "Random social encounters", "d66", 53, 53, "Servant Robots"],
    ["Random Encounter", "Random social encounters", "d66", 54, 54, "Soldiers on Patrol"],
    ["Random Encounter", "Random social encounters", "d66", 55, 55, "Street Vendors"],
    ["Random Encounter", "Random social encounters", "d66", 56, 56, "Technicians"],
    ["Random Encounter", "Random social encounters", "d66", 61, 61, "Thugs"],
    ["Random Encounter", "Random social encounters", "d66", 62, 62, "Tourists"],
    ["Random Encounter", "Random social encounters", "d66", 63, 63, "Traders"],
    ["Random Encounter", "Random social encounters", "d66", 64, 64, "Vigilantes"],
    ["Random Encounter", "Random social encounters", "d66", 65, 65, "Workers"],
    ["Random Encounter", "Random social encounters", "d66", 66, 66, "Referee's Choice"],
  ];
  for (const t of tables) s.run(...t);
}

// ─── EQUIPMENT ───────────────────────────────────────────────────────────────

function seedEquipment(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO equipment (name, category, tech_level, cost, weight, description) VALUES (?, ?, ?, ?, ?, ?)");
  const items: [string, string, number, string, string, string][] = [
    // Melee Weapons
    ["Club", "Melee Weapon", 0, "Cr0", "1.5kg", "Improvised blunt weapon"],
    ["Dagger", "Melee Weapon", 1, "Cr10", "0.25kg", "Small bladed weapon, easily concealed"],
    ["Blade", "Melee Weapon", 2, "Cr50", "0.5kg", "Standard edged weapon, common across known space"],
    ["Sword", "Melee Weapon", 2, "Cr150", "2kg", "Long bladed weapon, military sidearm"],
    ["Cutlass", "Melee Weapon", 2, "Cr100", "1.5kg", "Naval boarding saber"],
    ["Broadsword", "Melee Weapon", 3, "Cr300", "3kg", "Heavy two-handed blade"],
    ["Bayonet", "Melee Weapon", 3, "Cr10", "0.5kg", "Blade that attaches to a rifle barrel"],
    ["Spear", "Melee Weapon", 0, "Cr10", "2kg", "Simple pole weapon for thrusting or throwing"],
    ["Halberd", "Melee Weapon", 2, "Cr150", "4kg", "Polearm combining axe blade and spear point"],
    ["Pike", "Melee Weapon", 1, "Cr40", "6kg", "Long infantry polearm for formation fighting"],
    ["Shield", "Melee Weapon", 1, "Cr150", "3kg", "Defensive item melee attackers suffer -1 DM"],
    // Ranged Weapons
    ["Body Pistol", "Ranged Weapon", 8, "Cr500", "0.1kg", "Concealable, difficult to detect on scans"],
    ["Revolver", "Ranged Weapon", 4, "Cr150", "1kg", "Reliable cylinder-fed sidearm"],
    ["Auto Pistol", "Ranged Weapon", 5, "Cr200", "0.75kg", "Standard semi-automatic sidearm"],
    ["Snub Pistol", "Ranged Weapon", 8, "Cr150", "0.5kg", "Low-velocity pistol for shipboard use"],
    ["Accelerator Pistol", "Ranged Weapon", 9, "Cr900", "1kg", "Gyrojet pistol firing rocket-propelled rounds"],
    ["Shotgun", "Ranged Weapon", 5, "Cr200", "3.75kg", "Close-range weapon, devastating at short distance"],
    ["Submachine Gun", "Ranged Weapon", 5, "Cr500", "3.5kg", "Automatic fire capability, pistol-caliber rounds"],
    ["Assault Rifle", "Ranged Weapon", 7, "Cr500", "4.5kg", "Standard military longarm, capable of automatic fire"],
    ["Carbine", "Ranged Weapon", 6, "Cr300", "3kg", "Shorter, lighter rifle for close quarters"],
    ["Rifle", "Ranged Weapon", 4, "Cr200", "5kg", "Bolt-action or semi-automatic longarm"],
    ["Advanced Combat Rifle", "Ranged Weapon", 10, "Cr1000", "5kg", "High-tech rifle firing hyper-velocity rounds"],
    ["Gauss Rifle", "Ranged Weapon", 12, "Cr1500", "3.5kg", "Coilgun firing needle-like projectiles at extreme velocity"],
    ["Bow", "Ranged Weapon", 0, "Cr60", "1kg", "Traditional ranged weapon, silent and reusable"],
    ["Crossbow", "Ranged Weapon", 2, "Cr150", "3kg", "Mechanical bow, easier to use but slower to reload"],
    ["Laser Pistol", "Ranged Weapon", 8, "Cr2000", "1.5kg", "Energy sidearm with integral power pack"],
    ["Laser Carbine", "Ranged Weapon", 8, "Cr2500", "4kg", "Intermediate energy weapon for medium range"],
    ["Laser Rifle", "Ranged Weapon", 9, "Cr3500", "6kg", "Longer-range energy weapon, backpack power supply"],
    ["Stunner", "Ranged Weapon", 8, "Cr1000", "1kg", "Non-lethal energy weapon, causes unconsciousness on hit"],
    // Heavy Weapons
    ["Grenade Launcher", "Heavy Weapon", 7, "Cr1000", "5kg", "Fires grenade munitions to Medium range"],
    ["RAM Grenade Launcher", "Heavy Weapon", 9, "Cr2500", "5kg", "Automatic grenade launcher with burst fire capability"],
    ["Rocket Launcher", "Heavy Weapon", 6, "Cr2000", "8kg", "Shoulder-fired anti-vehicle weapon"],
    ["PGMP-12", "Heavy Weapon", 12, "Cr100000", "10kg", "Plasma Gun, Man-Portable, devastating energy weapon"],
    ["FGMP-14", "Heavy Weapon", 14, "Cr250000", "25kg", "Fusion Gun, Man-Portable, most powerful personal weapon"],
    ["Flamethrower", "Heavy Weapon", 6, "Cr200", "10kg", "Projects burning fuel, area effect weapon"],
    // Grenades
    ["Fragmentation Grenade", "Grenade", 5, "Cr30", "0.5kg", "2D6 damage to 6m radius, dodge avoids 1D6"],
    ["Smoke Grenade", "Grenade", 5, "Cr15", "0.5kg", "Produces dense smoke, blocks line of sight"],
    ["Stun Grenade", "Grenade", 7, "Cr30", "0.5kg", "Non-lethal, Endurance check vs unconsciousness"],
    // Armor
    ["Jack", "Armor", 1, "Cr50", "1kg", "Leather or synthetic jacket, basic protection"],
    ["Mesh Vest", "Armor", 6, "Cr150", "1kg", "Concealable ballistic vest for torso protection"],
    ["Cloth Armor", "Armor", 7, "Cr500", "5kg", "Flexible ballistic cloth, can be worn under other clothing"],
    ["Flak Jacket", "Armor", 7, "Cr300", "3kg", "Protective vest against shrapnel and small arms fire"],
    ["Reflec", "Armor", 10, "Cr1500", "1kg", "Reflective body suit effective against laser weapons"],
    ["Mesh Armor", "Armor", 10, "Cr2000", "3kg", "Advanced synthetic fiber, protects against blades and bullets"],
    ["Combat Armor", "Armor", 12, "Cr12000", "20kg", "Full-body combat suit with integrated electronics and NBC protection"],
    ["Battle Dress", "Armor", 13, "Cr25000", "60kg", "Powered armor with exoskeleton, integrated sensors and weapons mounts"],
    ["Vacc Suit", "Armor", 7, "Cr10000", "10kg", "Standard spacesuit for vacuum operations, 6-hour life support"],
    ["Combat Vacc Suit", "Armor", 12, "Cr20000", "18kg", "Armored spacesuit for combat operations in vacuum"],
    ["Hostile Environment Vacc Suit", "Armor", 14, "Cr40000", "30kg", "Extreme environment suit for corrosive atmospheres and radiation"],
    // Electronics
    ["Communicator", "Electronics", 6, "Cr250", "0.25kg", "Short-range radio, 50km planetary range"],
    ["Medium-Range Communicator", "Electronics", 6, "Cr500", "2kg", "500km range radio communications"],
    ["Long-Range Communicator", "Electronics", 6, "Cr1000", "20kg", "Worldwide radio communications, satellite relay capable"],
    ["Hand Computer", "Electronics", 9, "Cr500", "0.5kg", "Portable computing with wireless connectivity (Computer/0 equivalent)"],
    ["Personal Computer", "Electronics", 10, "Cr1000", "2kg", "Larger portable computer with enhanced capability (Computer/1)"],
    ["Workstation", "Electronics", 12, "Cr5000", "10kg", "Desktop computing power (Computer/2 equivalent)"],
    ["Binoculars", "Electronics", 6, "Cr500", "1.5kg", "Optical enhancement with low-light amplification"],
    ["IR/LI Goggles", "Electronics", 8, "Cr1250", "1kg", "Infrared and light-intensification head-mounted goggles, negates darkness penalties"],
    ["Bioscanner", "Electronics", 8, "Cr3500", "3.5kg", "Detects airborne pathogens and hazardous chemicals within 500m"],
    ["Densitometer", "Electronics", 12, "Cr5000", "5kg", "Creates 3D density maps of area, sees through walls"],
    ["Neural Activity Sensor", "Electronics", 13, "Cr15000", "10kg", "Detects brain activity, classifies intelligence of subjects"],
    ["Motion Sensor", "Electronics", 8, "Cr500", "1kg", "Detects movement within 50m range"],
    // Medical
    ["Medkit", "Medical", 7, "Cr1000", "3kg", "Field medical kit with diagnostic tools and basic trauma supplies"],
    ["Surgical Kit", "Medical", 10, "Cr5000", "10kg", "Field surgery equipment for emergency procedures"],
    ["Med Scanner", "Medical", 10, "Cr2000", "1kg", "Portable diagnostic device for medical assessment"],
    // Survival
    ["Respirator", "Survival", 6, "Cr200", "0.5kg", "Filters airborne toxins and particulates"],
    ["Filter Mask", "Survival", 7, "Cr500", "1kg", "Full-face mask for toxic atmospheres"],
    ["Cold Weather Clothing", "Survival", 1, "Cr200", "3kg", "Insulated clothing for extreme cold environments"],
    ["Food Concentrate", "Survival", 8, "Cr50", "0.5kg", "One week of compressed rations for one person"],
    ["Water Purifier", "Survival", 5, "Cr200", "3kg", "Filters and purifies water from most non-toxic sources"],
    ["Tent", "Survival", 3, "Cr200", "10kg", "Basic shelter for two, climate controlled at higher TL"],
    ["Pressure Tent", "Survival", 7, "Cr2000", "20kg", "Pressurized tent for hostile atmospheres, seats four"],
    // Tools
    ["Electronics Toolkit", "Tools", 7, "Cr2000", "8kg", "Comprehensive kit for electronics repair and diagnostics"],
    ["Mechanical Toolkit", "Tools", 6, "Cr1000", "12kg", "Comprehensive kit for mechanical repair"],
    ["Metal Detector", "Tools", 5, "Cr100", "1kg", "Detects metallic objects up to 3m depth"],
    ["Geological Scanner", "Tools", 9, "Cr5000", "5kg", "Analyzes mineral composition of rock samples"],
    // Drugs
    ["Anti-Radiation Drug", "Drugs", 8, "Cr1000/dose", "-", "Halves radiation exposure effects if taken before exposure"],
    ["Anagathic", "Drugs", 12, "Cr12000/month", "-", "Slows aging process, halves aging rolls"],
    ["Combat Drug", "Drugs", 10, "Cr150/dose", "-", "+2 STR and END for 1d6 minutes, then fatigue (-2 DM until rest)"],
    ["Medical Drug", "Drugs", 7, "Cr200/dose", "-", "Speeds natural healing, 2x healing rate for 24 hours"],
    ["Stimulant", "Drugs", 7, "Cr100/dose", "-", "Removes fatigue for 1d6 hours, then double fatigue"],
    ["Truth Drug", "Drugs", 8, "Cr1000/dose", "-", "Target must make Difficult END check or truthfully answer questions"],
    ["Slow Drug", "Drugs", 10, "Cr25000/dose", "-", "Slows metabolic rate, each subjective second = 10 real minutes, lasts 2 subjective hours"],
    ["Fast Drug", "Drugs", 11, "Cr30000/dose", "-", "Accelerates metabolic rate, each subjective minute = 10 real minutes, lasts 2 subjective days"],
    // Vehicles
    ["Air/Raft", "Vehicle", 8, "Cr600000", "4 tons", "Open-topped grav vehicle, seats 4, 100km/h cruise speed"],
    ["ATV", "Vehicle", 6, "Cr120000", "10 tons", "All-terrain vehicle with tracks, seats 6"],
    ["Ground Car", "Vehicle", 5, "Cr4000", "1.5 tons", "Wheeled civilian vehicle, seats 4"],
    ["Hovercraft", "Vehicle", 7, "Cr100000", "6 tons", "Hover vehicle for crossing water and soft terrain"],
    ["Grav Bike", "Vehicle", 12, "Cr150000", "0.25 tons", "Single-rider gravitic motorcycle"],
    ["Grav Belt", "Vehicle", 14, "Cr75000", "10kg", "Personal gravitic belt for individual flight, limited endurance"],
    // Robots
    ["Maintenance Robot", "Robot", 10, "Cr50000", "50kg", "Basic repair and cleaning robot, INT 3"],
    ["Combat Drone", "Robot", 12, "Cr150000", "100kg", "Armed autonomous or remote-operated combat drone"],
    ["Probe Drone", "Robot", 9, "Cr20000", "10kg", "Small sensor drone for reconnaissance, 1-5 in a set"],
    ["Servant Robot", "Robot", 11, "Cr75000", "80kg", "Household service robot for cooking, cleaning, and valet duties"],
    ["Mining Drone", "Robot", 7, "Cr25000", "200kg", "Asteroid mining drone for ore extraction and processing"],
  ];
  for (const it of items) s.run(...it);
}

// ─── COMBAT ──────────────────────────────────────────────────────────────────

function seedCombat(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO combat (topic, content, category) VALUES (?, ?, ?)");
  const entries: [string, string, string][] = [
    ["Initiative", "Combatants roll 2d6 + DEX DM. Characters act in descending order. Ties resolved by DEX then simultaneously. Prepared characters (ambush) get automatic 12. Tactics check: Effect added to everyone in unit's Initiative.", "Basic Combat"],
    ["Combat Round", "Each round lasts ~6 seconds. Each character gets one significant action and one minor action. Actions taken in Initiative order. After all act, new round begins. Initiative is dynamic and changes with reactions and hastening.", "Basic Combat"],
    ["Dynamic Initiative", "Reactions reduce Initiative by 2. Hastening (+2 Initiative for round, -1 DM to all actions). Changes affect current round if you haven't acted yet, or next round if you have.", "Basic Combat"],
    ["Minor Actions", "Can take up to 3 minor actions (forgoing significant action). Aiming: +1 DM per minor action aimed, max +6. Aiming for the Kill: +2 damage per aim action, max +6. Changing stance: prone, crouched, or standing.", "Actions"],
    ["Drawing and Reloading", "Most weapons: 1 minor action to draw, 1 minor action to reload. Some weapons are faster or slower. Check weapon description.", "Actions"],
    ["Movement", "6 meters per minor action (4 squares at 1.5m each). Difficult terrain halves movement. Crouching halves movement. Standing gives normal movement.", "Actions"],
    ["Significant Actions", "One per round (or forego for 3 minor actions). Standard attack, skill check, or complex physical action.", "Actions"],
    ["Attack Roll", "Melee: 2d6 + melee skill + STR or DEX DM. Shooting: 2d6 + gun combat skill + DEX DM. Thrown: 2d6 + Athletics + DEX DM. Difficulty based on range and weapon type.", "Attack Resolution"],
    ["Range Bands", "Personal (0-2m, DM+2), Close (2-10m, DM+0), Short (10-50m, DM-1), Medium (50-250m, DM-2), Long (250-500m, DM-4), Very Long (500m+, DM-6). Distant range: additional DM-2, half damage from energy weapons.", "Attack Resolution"],
    ["Burst Fire", "3-round burst: +1 DM to hit OR +1 damage. 4-round burst: +1 DM OR +1D6 damage. 10-round: +2 DM OR +2D6 damage. 20-round: +3 DM OR +3D6. 100-round: +4 DM OR +4D6.", "Attack Resolution"],
    ["Cover", "1/4 cover: -0 DM. 1/2 cover: -1 DM. 3/4 cover: -2 DM. Full cover: -4 DM. Crouching or prone characters count as one step better cover.", "Defense"],
    ["Dodging", "Reaction: gives attacker -1 DM and self -1 DM until next round. With cover/obstruction: -2 DM to attacker. Each reaction costs 2 Initiative.", "Defense"],
    ["Parrying", "Reaction in melee: apply Melee skill as negative DM to attack. Attacker also gets -1 DM until next round.", "Defense"],
    ["Damage", "Weapon damage = base dice + Effect of attack roll. First damage goes to END. At END 0, damage to STR or DEX (player choice). If either hits 0: unconscious. All three at 0: dead. Effect 6+ always deals at least 1 damage regardless of armor.", "Damage"],
    ["Armor", "Armor value subtracted from damage. Effect 6+ always deals at least 1 point.", "Damage"],
    ["Fatigue", "Overexertion, sleep deprivation, or drugs cause fatigue: -2 DM to all checks until rest. Rest needed = 3 - END DM hours. Fatigue + fatigue = unconscious.", "Damage"],
    ["Unconsciousness", "END check every minute to regain consciousness, +1 DM per previous failed check. Once conscious, character is still seriously wounded.", "Recovery"],
    ["Natural Healing", "Full rest: 1d6 + END DM characteristic points per day. Active lifestyle: 1 + END DM per day. Seriously wounded: only END DM per day.", "Recovery"],
    ["First Aid", "Within 5 minutes: Medic check, restores 2x Effect in characteristic points. Within 1 hour: restores Effect points. Self-treatment: Difficult (-2).", "Recovery"],
    ["Surgery", "Requires hospital/sickbay. Restores points like First Aid but failure deals damage equal to Effect. Self-surgery: Very Difficult (-4).", "Recovery"],
    ["Medical Care", "Hospital/sickbay with full bed rest: 2 + END DM + doctor's Medic skill points per day.", "Recovery"],
    ["Vehicles in Combat", "Driver spends minor action to maintain control, significant action to navigate obstacles. Vehicles grant cover (civilian=1/2 soft, military=full hard). +1 DM to hit vehicles due to size.", "Vehicle Combat"],
    ["Collisions", "1d6 damage per 10kph speed. Unsecured passengers take same damage and thrown 3m per 10kph. Secured passengers take 1/4 damage.", "Vehicle Combat"],
    ["Evasive Action", "Significant action. Skill check, Effect = -DM to attacks against vehicle AND from vehicle. Lasts until next action.", "Vehicle Combat"],
    ["Stunts", "Significant action + vehicle control check. Can: put target in extra fire arc, set up task chain, achieve 3 maneuvers in one action, perform impossible feat.", "Vehicle Combat"],
    ["Vehicle Damage", "Damage -> 0-3: Single Hit, 4-6: Two Singles, 7-9: Double Hit, 10-12: Three Singles, 13-15: Two Singles+Double. Hits applied to Hull, Structure, Armor, Drive, Weapon, Sensors, etc.", "Vehicle Combat"],
    ["Stance", "Standing: normal. Crouching: half speed, better cover. Prone: cannot melee attack or dodge, -2 DM to ranged attacks (reversed at Close/Personal range).", "Special"],
    ["Tactics", "Commander makes Tactics check at start of combat, Effect added to unit's Initiative.", "Special"],
    ["Leadership", "Character makes Leadership check (significant action), target's Initiative increases by Effect.", "Special"],
    ["Suppression Fire", "Attack with -2 DM, double ammo. Success: target loses Initiative = Effect, -1 DM penalty this and next round. Cannot suppress twice before target acts.", "Special"],
    ["Shotgun Spread", "Flechette rounds at Medium/Long range: damage reduced to 2d6, DM+1 to hit, also hits anyone in Personal range of target.", "Special"],
    ["Zero-G Combat", "Skill limited to lower of Zero-G and weapon skill. Untrained Zero-G = unskilled. Recoil weapons: -2 DM in zero-G.", "Special"],
    ["Grappling", "Opposed Natural Weapons check at Personal range. Winner may: continue grapple, disarm, drag 3m, escape, inflict 2+Effect damage, knock prone, or throw 3m for 1d6 damage.", "Special"],
    ["Panic Fire", "Slug-throwing small arms only. Uses all remaining rounds as Burst Fire for damage (not accuracy). -2 DM to hit.", "Special"],
    ["Blind Firing", "Treats firer as Skill-0. Roll extra die, remove highest before calculation. Random target from all eligible in firing line.", "Special"],
    ["Extreme Range Firing", "Beyond Distant range. DM-2 additional. Requires at least 3 levels of weapon skill. Must be stationary with rest. Energy weapons deal half damage. Can combine with Aiming for the Kill.", "Special"],
    ["Explosions", "Area effect. Character may dodge (reduces damage by 1d6) or dive for cover (half damage, ends prone, loses next significant action).", "Special"],
    ["Ground vs Starship", "DM+4 to hit starship-scale targets. Damage divided by 50 before comparing to armor. Multiple weapons can combine damage dice before division.", "Special"],
  ];
  for (const e of entries) s.run(...e);
}

// ─── STARSHIP OPERATIONS ─────────────────────────────────────────────────────

function seedShipOps(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO starship_operations (topic, content, category) VALUES (?, ?, ?)");
  const entries: [string, string, string][] = [
    ["Interplanetary Travel", "Ships accelerate halfway, then decelerate. Formula: T = 2 * sqrt(D/A). 1,000km at 1G = 10.5min. 10,000km (surface to orbit) at 1G = 33min. 1,000,000km at 1G = 5.7hrs. 1,000,000,000km (Jupiter distance) at 1G = 7.3 days.", "Travel"],
    ["Interstellar Travel", "Jump drives move ships 1 parsec per Jump number. Jump takes ~1 week (148+6d6 hours). Ship must be >100 diameters from any object. Requires: aligned Jump grid, Jump Plot (navigation), powered Jump drive, proper fuel.", "Travel"],
    ["Jump Plot", "Easy (+4) EDU-based Navigation check taking 1d6 kiloseconds, modified by -Jump distance. Pre-calculated course tapes available at Class-D+ starports for Cr1,000/jump number. Course tapes become less reliable with age (-1 DM per month).", "Travel"],
    ["Jump Success", "Engineer makes Average (+0) EDU-based Engineer check (10-60 seconds) to divert power. Jump Success roll: 2d6 + Effect of Engineer check -1/month tape is old -2/Jump drive hit -2 for unrefined fuel -8 if inside 100-diameter limit. 0 or less: misjump. 8+: accurate. Otherwise: inaccurate.", "Travel"],
    ["Misjump", "Ship ends up 1d6 x 1d6 parsecs in random direction. Ship takes critical hit from discordant transition. All aboard suffer severe headaches and nosebleeds.", "Travel"],
    ["Inaccurate Jump", "Vessel emerges in wrong part of target system, requiring 1d6 days normal space travel.", "Travel"],
    ["Starship Operations", "Standard schedule: 1 week Jump + 1 week in-system. Non-commercial ships can reduce to refueling and immediate Jump. Procedure: emerge -> scan -> navigate to destination -> refuel (1d6 hrs/40 tons fuel from gas giant) or dock at starport.", "Travel"],
    ["Passenger Travel", "High passage: Cr10,000 (first class, 1,000kg baggage, steward service). Middle passage: Cr8,000 (standby, 100kg baggage, lower quality). Low passage: Cr1,000 (cold sleep, 10kg, Endurance check to survive revival). Working passage: labor in exchange for travel (max 3 jumps). Stowaway: illegal, risk imprisonment or spacing.", "Passage"],
    ["Starship Expenses", "Mortgage: 1/240 of purchase price per month (40 years). Crew salaries: Cr1,000-6,000/month per crew member. Fuel: Cr500/ton refined, Cr100/ton unrefined. Life support: Cr2,000/stateroom/month, Cr100/low berth/month. Port fees: Cr2,000-5,000 per visit. Maintenance: 0.1% of purchase price per year.", "Economy"],
    ["Starship Revenue", "Bulk cargo: Cr1,000/ton per jump. High passengers: Cr10,000 each/2 jumps (or per jump for jump-1). Middle passengers: Cr8,000. Low passengers: Cr1,000. Mail: Cr5,000/5 tons. Charter: Cr2,500/ton per month. Speculative trade: variable profits.", "Economy"],
    ["Ship Security", "Physical: manual locks, electronic locks, biometric scanners. Cybersecurity: firewall software (Intrusion/1-5), encrypted communications. Security measures: anti-hijacking programs, self-destruct systems, internal sentries, ship's troops.", "Security"],
    ["Boarding", "Boarding a docked ship requires cutting through airlock (10-60 min), bypassing security (Computer check), or forcing entry (Demolitions). Boarding in space requires grappling and breaching. Defenders get automatic alert unless attackers achieve surprise.", "Security"],
  ];
  for (const e of entries) s.run(...e);
}

// ─── WORLD BUILDING ──────────────────────────────────────────────────────────

function seedWorldBuilding(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO world_building (topic, content, category) VALUES (?, ?, ?)");
  const entries: [string, string, string][] = [
    ["Universal World Profile", "UWP format: Starport Size Atmosphere Hydro Pop Govt Law-TL. Example: C7A7564-9. Allegiance code, bases, travel zone, trade codes. Generalized hex notation for characteristics.", "World Generation"],
    ["Starport Type", "Roll 2d6-7 + Pop. A: Excellent (refined fuel, shipyard, can build starships). B: Good (refined fuel, repairs, non-starships). C: Routine (unrefined fuel, reasonable repairs). D: Poor (unrefined fuel, no repairs). E: Frontier (no facilities). X: No starport.", "World Generation"],
    ["World Size", "0: asteroid (800km-). 1: 1,600km. 2: 3,200km. 3: 4,800km. 4: 6,400km. 5: 8,000km. 6: 9,600km. 7: 11,200km. 8: 12,800km (~1G). 9: 14,400km. A: 16,000km+. Size affects gravity: roughly 0.125G per Size digit.", "World Generation"],
    ["Atmosphere Type", "0: none. 1: trace. 2-3: very thin (respirator required). 4-5: thin (breathable). 6-7: standard (breathable). 8-9: dense (breathable with filter). A: exotic. B-C: corrosive (vacc suit required). D: high density corrosive. E: thin corrosive. F: unusual.", "World Generation"],
    ["Atmosphere DMs", "Size 2- => -2 to atmosphere. Size 0 or 1 => atmosphere 0. Atmosphere 4,7,9 requires minimum TL 5. Atmosphere 3- requires minimum TL 7. Atmosphere A-C => -4 to hydro. Atmosphere E => -2 to hydro.", "World Generation"],
    ["Hydrographics", "0: 0-5% (desert). 1: 6-15% (dry). 3: 26-35%. 5: 46-55%. 7: 66-75% (earth-like). 8: 76-85% (water world). A: 96-100% (almost entirely water). Size 0-1 => hydro 0. Hydro 0 + Pop 6+ => minimum TL 4. Hydro A => minimum TL 7.", "World Generation"],
    ["Population", "0: none. 1: tens. 2: hundreds. 3: thousands. 4: tens of thousands. 5: hundreds of thousands. 6: millions. 7: tens of millions. 8: hundreds of millions. 9: billions. A: tens of billions. Pop 0 => Govt/Law/TL all 0. Atmosphere 6 => +3 pop DM.", "World Generation"],
    ["Government Type", "0: none/anarchy. 1: company/corporate. 2: participating democracy. 3: self-perpetuating oligarchy. 4: representative democracy. 5: feudal technocracy. 6: captive government. 7: balkanized. 8: civil service bureaucracy. 9: impersonal bureaucracy. A: charismatic dictator. B: non-charismatic leader. C: charismatic oligarchy. D: religious dictatorship. E: religious autocracy. F: totalitarian oligarchy.", "World Generation"],
    ["Law Level", "0: no restrictions. 1: WMDs banned. 2: portable energy weapons. 3: heavy weapons. 4: light assault weapons. 5: personal concealable weapons. 6: all firearms except shotguns. 7: shotguns. 8: all bladed weapons, stunners. 9: any weapons outside residence. A+: all weapons banned. Law 0 or 9+ = Amber Zone candidate.", "World Generation"],
    ["Technology Level", "0: stone age. 1: bronze/iron. 3: medieval. 5: industrial. 7: computers/satellites. 8: fusion/early space. 9: jump-1. 10: gravitics. 11: jump-3. 12: jump-4. 13: jump-5. 14: jump-6. 15: matter transport. F: maximum. Tech level minimums ensure consistency (e.g. hydro 0 + pop 6+ => TL 4 min).", "World Generation"],
    ["Trade Codes", "Ag (Agricultural): size 5-8, atmos 4-8, hydro 4-7. As (Asteroid): size 0. Ba (Barren): pop 0. De (Desert): hydro 0. Fl (Fluid Oceans): hydro A+. Ga (Garden): atmos 6, hydro 4-8, size 6-8. Hi (High Pop): pop 9+. Ht (High Tech): TL 12+. Ic (Ice-Capped): atmos 0-1, hydro 1+. In (Industrial): atmos 0-2/4/7/9, pop 9+. Lo (Low Pop): pop 1-3. Lt (Low Tech): TL 5-. Na (Non-Agricultural): atmos 0-3, hydro 0-3, pop 6+. Ni (Non-Industrial): pop 4-6. Po (Poor): atmos 2-5, hydro 0-3. Ri (Rich): atmos 6/8, pop 6-8. Wa (Water World): hydro A. Va (Vacuum): atmos 0.", "World Generation"],
    ["Planetoid Belts", "4+ on 2d6 for belts. Number: 1d6-3 (min 1). If Size 0: automatic belt. Belts are mined for ore, ice, and valuables by belters.", "World Generation"],
    ["Gas Giants", "5+ on 2d6 for gas giants. Number: 1d6-2 (min 1). Gas giants enable fuel skimming (1d6 hours per 40 tons), eliminating fuel costs.", "World Generation"],
    ["Bases", "Naval Base: Class A/B starport, 8+ on 2d6. Scout Base: not Class E/X, 7+ on 2d6 (-1 DM for C, -2 for B, -3 for A). Pirate Base: not Class A/not naval base, 12+ on 2d6. Base Codes: N=Naval, S=Scout, A=Naval+Scout, P=Pirate, G=Scout+Pirate.", "World Generation"],
    ["Travel Zones", "Amber: dangerous worlds. Candidates: atmos 10+, govt 0/7/A, law 0/9+. Red: interdicted (Navy enforces). No travel allowed. Referee assigns at discretion.", "World Generation"],
    ["Polities and Allegiance", "Worlds may be independent or part of larger polities. Draw borders on hex map. Large polities typically have sub-domains. Allegiance code stored in UWP extensions.", "World Generation"],
    ["Trade Routes", "Connect pairs within 4 parsecs via Jump-1 or Jump-2 routes. Industrial/HiTech ↔ Asteroid/Desert/Ice-Capped/Non-Industrial. HiPop/Rich ↔ Agricultural/Garden/Water World. Communication routes link core worlds within each polity.", "World Generation"],
  ];
  for (const e of entries) s.run(...e);
}

// ─── ENCOUNTERS ──────────────────────────────────────────────────────────────

function seedEncounters(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO combat (topic, content, category) VALUES (?, ?, ?)");
  const entries: [string, string, string][] = [
    ["Animal Types", "Herbivore: grazer, intermittent, filter. Omnivore: gatherer, eater, hunter. Carnivore: chaser, pouncer, killer, trapper, siren. Scavenger: carrion-eater, hijacker, intimidator, reducer.", "Wilderness Encounters"],
    ["Animal Generation", "Step 1: Choose terrain. Step 2: Determine type/subtype (2d6 + terrain DM). Step 3: Note modifiers and skills by subtype. Step 4: Size, characteristics, number appearing. Step 5: Weapons, armor, base speed.", "Wilderness Encounters"],
    ["Animal Size", "1-: 1kg, STR 1. 3: 6kg, STR 1d6. 5: 25kg, STR 2d6. 7: 100kg, STR 3d6. 9: 400kg, STR 4d6. 11: 1,600kg, STR 5d6. 13: 5,000kg, STR 6d6. 15: 15,000kg, STR 7d6. 20+: 40,000kg, STR 9d6.", "Wilderness Encounters"],
    ["Animal Weapons", "DM: Carnivore +8, Omnivore +4, Herbivore -6. Teeth, Claws, Hooves, Horns, Thrasher, Stinger, Projectile. Damage by Strength: STR 1-10=>1d6, 11-20=>2d6, 21-30=>3d6, 31-40=>4d6, 41-50=>5d6, etc.", "Wilderness Encounters"],
    ["Animal Armor", "2d6-7 + Size die + Herbivore +4/Carnivore -2/Scavenger +2. Flyers -2. Result 0-3=>armor 0, 4-5=>armor 1, 6-7=>armor 2, 8-9=>armor 3, 10-11=>armor 4, 12-13=>armor 5, 14-15=>armor 6, 16-17+=>armor 7.", "Wilderness Encounters"],
    ["Animal Reactions", "Chaser: attack if outnumber (5- flee). Killer: 6+ attack, 3- flee. Pouncer: attacks if has surprise. Grazer: 8+ attack, 6- flee. Eater: 5+ attack, 4- flee. Hunter: attacks on 6+ if bigger than prey, 10+ otherwise. Hijacker: 7+ attack, 6- flee. Intimidator: 8+ attack, 7- flee.", "Wilderness Encounters"],
    ["Encounter Frequency", "Wilderness: check once while travelling, once while halted per day. 5+ on 1d6 for encounter. Space: check when entering/leaving populated regions. 6 on 1d6 for encounter. Social: Law Level or less (legal), 8+ (random), 9+ (patron), 7+ (rumor).", "Encounter Systems"],
    ["Social Encounters", "Routine: normal NPCs doing normal things. Scenario: plot-driven encounters. Legal: law enforcement checks (daily, Law Level or less on 2d6). Random: D66 table, 8+ daily. Patron: job offers, 9+ weekly. Rumor: information, 7+ weekly.", "Social Encounters"],
    ["Influencing Attitudes", "Difficult (-2) SOC-based check using Liaison or Carousing. Success improves attitude 1 step; exceptional success: 2 steps. Exceptional failure: 1 step more hostile. Once per scene per NPC. Hostile->Unfriendly->Indifferent->Friendly->Helpful.", "Social Encounters"],
    ["Starship Encounters", "2d6: 2=Alien Vessel, 3=Derelict, 4=Space Habitat, 5=Astrogation, 6=Space Junk, 7=Merchant Vessel, 8=Personal Vessel, 9=Hostile Vessel, 10=Military Vessel, 11=Spacecraft, 12=Referee's Choice. Distance: usually Very Long range. Transponders give DM+4 detection if active.", "Starship Encounters"],
    ["Patron Encounter Format", "1) Name and role. 2) Required skills/resources. 3) Suggested reward. 4) Mission as described to characters. 5) What's really going on (multiple variants for reusability). Example: Bruce Ayala, Interplanetary Playboy.", "Social Encounters"],
    ["Rumor Content", "D66 table. 11-16: Background info. 21-24: General location data. 25: Important fact. 26: Info leading to trap. 31-41: Minor facts/library references. 42-46: Misleading info. 51-56: Misleading clues. 61-65: Specific data/veiled clues.", "Social Encounters"],
  ];
  for (const e of entries) s.run(...e);
}

// ─── PSIONICS ────────────────────────────────────────────────────────────────

function seedPsionics(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO combat (topic, content, category) VALUES (?, ?, ?)");
  const entries: [string, string, string][] = [
    ["PSI Characteristic", "Psionic Strength (PSI): 2d6-6 + nobility DM. Minimum 0, max 15. DM table same as other characteristics. PSI does not count as a regular characteristic for injury purposes.", "Psionics"],
    ["Training", "Cost: Cr100,000 at a Psionics Institute. Training check: 8+ using PSI DM. Success grants one Psionic Talent. Each talent contains multiple powers. Training time: typically months to years.", "Psionics"],
    ["Using Talents", "Expend PSI points equal to power cost. Range modifies PSI cost: touch -1, personal +0, close +1, short +2, medium +3, long +4, very long +5, distant +6. Recover 1 PSI point per hour of rest.", "Psionics"],
    ["Awareness", "Self-focused talent. Powers: Suspended Animation (2 PSI, 7 days suspended per PSI), Psionically Enhanced Strength (+4 STR for 1 minute/PSI, cost 3), Psionically Enhanced Endurance (+4 END, cost 3), Regeneration (heal 1d characteristic points per PSI spent, cost varies).", "Psionics"],
    ["Clairvoyance", "Remote sensing talent. Powers: Sense (2 PSI, detect targets at range), Clairvoyance (3 PSI, see distant location as if present), Clairaudience (3 PSI, hear distant location), Clairsentience (4 PSI, full sensory experience of distant location).", "Psionics"],
    ["Telekinesis", "Movement talent. Move objects with PSI score as effective Strength. Range: PSI x 1m. Cost: 1 PSI per kg moved per 10m. Cannot affect objects within living beings.", "Psionics"],
    ["Telepathy", "Mind talent. Powers: Life Detection (1 PSI, sense living minds in range), Telempathy (2 PSI, sense/alter emotions, DM+2 to social checks), Read Surface Thoughts (3 PSI, opposed check vs target's PSI or INT), Send Thoughts (1 PSI, one-way message), Probe (4 PSI, deep mind reading, opposed check), Assault (4 PSI, mental attack dealing 1d6+PSI DM damage to INT), Shield (3 PSI, block telepathic intrusion).", "Psionics"],
    ["Teleportation", "Travel talent. Instant transmission PSI x 10m. Cost: 5 PSI + 1 per additional 10m. Must be familiar with destination or have line of sight. Failed roll: teleport to wrong location or take damage.", "Psionics"],
    ["Psionics in Society", "Psi-hostile: psions persecuted, talents illegal, training underground. Psi-neutral: regulated registration, licensed practice, monitored. Psi-friendly: psions respected, institutes common, psionic technology developed.", "Psionics"],
  ];
  for (const e of entries) s.run(...e);
}

// ─── COMMON VESSELS ──────────────────────────────────────────────────────────

function seedCommonVessels(db: Database.Database): void {
  const s = db.prepare("INSERT OR IGNORE INTO starship_operations (topic, content, category) VALUES (?, ?, ?)");
  const entries: [string, string, string][] = [
    ["TL9 Asteroid Miner", "200-ton hull. Jump-1, 1-G. 44 tons fuel (4 weeks, 2x Jump-1). Computer/2. Basic Civilian sensors. 3 staterooms, 5 low berths. 84 tons cargo. Titanium Steel (2 armor). Mining drone, smelter, 3 escape pods, fuel processors (60 tons/day), fuel scoops. Crew: 3 (pilot/navigator/engineer). MCr33.2.", "Common Vessels"],
    ["TL9 Courier", "100-ton streamlined hull. Jump-2, 4-G. 28 tons fuel. Computer/2. 4 staterooms, 1 low berth. 16 tons cargo. Titanium Steel (2 armor). TL11 Jump Control/2, fuel processors (40 tons/day), fuel scoops. Crew: 3. MCr35.9.", "Common Vessels"],
    ["TL9 Frontier Trader", "300-ton hull. Jump-1, 2-G. 42 tons fuel (4 weeks, 1x Jump-1). Computer/2. 25 staterooms, 12 low berths. 75 tons cargo. 2x triple pulse laser turrets + 1x triple sandcaster turret. Titanium Steel (2 armor). Crew: 8 (pilot/nav/engineer/3 gunners/2 stewards). 21 high or 42 middle passengers. MCr82.3.", "Common Vessels"],
    ["TL9 Merchant Freighter", "400-ton hull. Jump-1, 1-G. 48 tons fuel. Computer/2. 4 staterooms, 2 low berths. 261 tons cargo. Titanium Steel (2 armor). Fuel processors, fuel scoops. Crew: 3. MCr59.8.", "Common Vessels"],
    ["TL9 Merchant Liner", "300-ton hull. Jump-1, 1-G. 38 tons fuel. Computer/2. 35 staterooms, 20 low berths. 46 tons cargo. Titanium Steel (2 armor). Fuel processors, fuel scoops. Crew: 7 (4 stewards). 31 high or 62 middle passengers. MCr70.2.", "Common Vessels"],
    ["TL9 Merchant Trader", "200-ton hull. Jump-1, 1-G. 24 tons fuel. Computer/2. 10 staterooms, 20 low berths. 85 tons cargo. Titanium Steel (2 armor). Fuel processors, fuel scoops. Crew: 3. 8 high/16 middle/20 low passengers. MCr34.9.", "Common Vessels"],
    ["TL9 Yacht", "100-ton streamlined hull. Jump-2, 2-G. 24 tons fuel. Computer/2. 6 staterooms (2 combined into suite), 3 low berths. 12 tons cargo. Titanium Steel (2 armor). TL11 Jump Control/2, 2 tons luxuries, fuel processors, fuel scoops. Crew: 3. MCr26.4.", "Common Vessels"],
    ["TL9 Research Vessel", "200-ton hull. Jump-1, 1-G. 24 tons fuel. Computer/2. 6 staterooms, 3 low berths. 29 tons cargo. 2x life boat/launch hangars. 15 probe drones, 6 laboratories. Titanium Steel (2 armor). Crew: 9 (6 scientists). MCr73.8.", "Common Vessels"],
    ["TL9 System Defense Boat", "400-ton streamlined hull. No Jump, 6-G. 48 tons fuel. Computer/2. 10 staterooms, 5 low berths. 109 tons cargo. 2x triple missile turrets (360 smart missiles) + 2x triple beam laser turrets. Titanium Steel (8 armor). Crew: 18. MCr171.6.", "Common Vessels"],
    ["TL9 System Monitor", "1000-ton hull. No Jump, 6-G. 88 tons fuel. Computer/2. 24 staterooms, 12 low berths. 123.5 tons cargo. 1 particle beam bay + 3x triple missile + 3x triple pulse laser + 3x triple particle beam turrets. 1,080 smart missiles. 8 fighter + 1 ship's boat hangars. Titanium Steel (9 armor). Crew: 45. MCr610.5.", "Common Vessels"],
    ["TL9 Raider", "600-ton hull. Jump-1, 4-G. 108 tons fuel. Computer/2. 12 staterooms. 125 tons cargo. 6x triple beam laser turrets. 2 fighter + 1 ship's boat hangars. Titanium Steel (8 armor). Crew: 24. MCr310.9.", "Common Vessels"],
    ["TL11 Corvette", "300-ton hull. Jump-2, 6-G. 96 tons fuel. Computer/3/fib. Advanced sensors. 9 staterooms. 25 tons cargo. 2x triple missile + 1x triple beam laser turrets. 120 smart missiles. Crystaliron (8 armor), stealth coating. Crew: 18. MCr194.4.", "Common Vessels"],
    ["TL11 Patrol Frigate", "300-ton hull. Jump-2, 4-G. 84 tons fuel. Computer/3/fib. Advanced sensors. 10 staterooms. 23 tons cargo. 2x triple missile + 1x triple beam laser turrets. 120 smart missiles. 2 fighter hangars. Crystaliron (8 armor), stealth coating. Crew: 20. MCr180.7.", "Common Vessels"],
    ["TL11 Light Cruiser", "1000-ton hull. Jump-2, 3-G. 344 tons fuel. Computer/3/fib. Advanced sensors. 23 staterooms. 53 tons cargo. 1 particle beam bay + 3x triple missile + 6x triple beam laser turrets. 540 smart missiles. 4 fighter + 1 ship's boat hangars. Crystaliron (11 armor), stealth. Crew: 43. MCr597.9.", "Common Vessels"],
    ["TL11 Heavy Cruiser", "2000-ton hull. Jump-2, 2-G. 452 tons fuel. Computer/3/fib. Advanced sensors. 42 staterooms. 152.5 tons cargo. 4 missile bays + 16x triple pulse laser turrets. 2160 smart missiles. 12 fighter + 2 cutter hangars. Crystaliron (11 armor), stealth. Crew: 79. MCr1,146.9.", "Common Vessels"],
    ["TL11 Destroyer", "800-ton hull. Jump-2, 4-G. 368 tons fuel. Computer/3/fib. Advanced sensors. 12 staterooms. 50.5 tons cargo. 2x triple missile + 6x triple beam laser turrets. 360 smart missiles. 1 ship's boat hangar. Crystaliron (11 armor), stealth. Crew: 23. MCr422.8.", "Common Vessels"],
    ["TL11 Survey Vessel", "300-ton hull. Jump-1, 2-G. 72 tons fuel. Computer/2. 8 staterooms. 39 tons cargo. 3x triple beam laser turrets. 2 life boat/launch hangars. 20 probe drones, 6 labs. Titanium Steel (2 armor). Crew: 14 (6 scientists). MCr121.0.", "Common Vessels"],
    ["TL14 Dreadnought", "5000-ton hull (2 sections). Jump-2, 2-G. 1096 tons fuel. Computer/6/fib. Very Advanced sensors. 101 staterooms, 60 barracks, 223 low berths. 412 tons cargo. 10 fusion gun bays + 5 missile bays + 35x triple beam laser turrets. 3600 smart missiles. Nuclear damper + meson screen. 20 fighter + 2 cutter hangars. Bonded Superdense (14 armor), stealth. Crew: 223. MCr2,768.1.", "Common Vessels"],
    ["Small Craft: Cutter", "50-ton hull, 4-G. 1.3 tons fuel. Computer/1. Standard sensors. Sealed 30-ton module berth (8 module types: cargo, commuter, fuel, lab, low berth transport, luxury, prison, vehicular). MCr24.3.", "Small Craft"],
    ["Small Craft: Fighter", "10-ton streamlined hull, 6-G. 1.5 tons fuel. Computer/1/fib. Standard sensors. Fixed mount pulse laser. Fuel scoops. 1 crew. MCr10.8.", "Small Craft"],
    ["Small Craft: Launch", "20-ton hull, 1-G. 0.4 tons fuel. Computer/1. Standard sensors. 2-man cabin. 10.9 tons cargo. 1 crew. MCr4.8.", "Small Craft"],
    ["Small Craft: Pinnace", "40-ton hull, 5-G. 1.5 tons fuel. Computer/1. Standard sensors. 1-man cabin. 25 tons cargo. 1 crew. MCr18.6.", "Small Craft"],
    ["Small Craft: Ship's Boat", "30-ton hull, 6-G. 1.2 tons fuel. Computer/1. Standard sensors. 1-man cabin. 16.7 tons cargo. 1 crew. MCr16.7.", "Small Craft"],
    ["Small Craft: Shuttle", "90-ton hull, 3-G. 1.9 tons fuel. Computer/1. Standard sensors. 2-man cabin. 67.4 tons cargo. 2 crew. MCr30+.", "Small Craft"],
    ["Ship Design: Hull", "Price: MCr0.1/ton for standard, MCr0.11 for streamlined. Hull points = tons/50. Structure = tons/50. Configuration: standard, streamlined (MCr+10%), distributed (MCr+50%), sphere, cylinder, planetoid.", "Ship Design"],
    ["Ship Design: Armor", "Titanium Steel (TL7): 2.5% tonnage/point. Crystaliron (TL10): 1.25%. Bonded Superdense (TL14): 0.8%. Options: stealth coating, radiation shielding, heat shielding, reflective coating.", "Ship Design"],
    ["Ship Design: Drives", "Jump drive: Jump-1=A(10t,MCr10), B(15t,MCr15)...Z(135t,MCr135). Maneuver: Thrust-1=A(1t,MCr2)...Z(27t,MCr54). Power plant: rated Pn=A-L(1t/2MCr per rating)...M-Z(2t/3MCr per rating). Fuel: 0.1MJn tons/week + 0.1Jn tons/jump.", "Ship Design"],
    ["Ship Design: Computer", "Model 1 (TL7, Cr30K, rating 5), Model 2 (TL9, Cr160K, rating 10), Model 3 (TL11, Cr2M, rating 15), Model 4 (TL12, Cr5M, rating 20), Model 5 (TL13, Cr10M, rating 25), Model 6 (TL14, Cr20M, rating 30), Model 7 (TL15, Cr40M, rating 35). Fib option (TL9+, double rating, MCr+50%). Bis option (TL12+, triple rating, MCr+100%).", "Ship Design"],
    ["Space Combat: Range", "Close (10km), Short (25,000km), Medium (50,000km), Long (100,000km), Very Long (150,000km), Distant (300,000km+). DM per range band: Close 0, Short -1, Medium -2, Long -3, Very Long -4, Distant -5.", "Space Combat"],
    ["Space Combat: Crew Positions", "Commander (initiative/tactics), Pilot (evasive action), Navigator (jump plot), Engineer (power management), Gunners (weapon fire), Screens Operator (defense). Automated positions possible with appropriate software.", "Space Combat"],
    ["Space Combat: Initiative", "1d6 + Commander's Tactics skill + ship's Thrust rating. Each crew position acts in order during the turn. Commander can use Leadership to increase another position's initiative.", "Space Combat"],
    ["Space Combat: Ship Damage", "Hull hits reduce Hull by 1. Structure hits reduce Structure by 1. At 0 Hull: internal system hits. At 0 Structure: ship destroyed. Armor reduces damage. Critical hits on specific systems (weapons, drives, power plant, sensors, computer, bridge).", "Space Combat"],
    ["Trade: Speculative Trade", "1) Find supplier (Broker check). 2) Determine goods available (roll on trade goods table). 3) Purchase price: 2d6 + Broker + SOC DM, modify by world trade codes. 4) Sell: 2d6 + Broker + SOC DM, modify by destination world. 5) Profit margin determines success.", "Trade & Commerce"],
    ["Environments: Hazards", "Acid: 1d6-4d6 damage per round. Disease: END check vs infection, effects vary. Temperature extremes: exposure damage per hour. Fire: 1d6 per round. Falling: 1d6 per 3m. Poison: DM varies by type. Radiation: rads accumulate, effects from nausea to death. Vacuum: 1d6 damage per round, unconscious in END rounds, death in 2x END rounds.", "Environments"],
  ];
  for (const e of entries) s.run(...e);
}
