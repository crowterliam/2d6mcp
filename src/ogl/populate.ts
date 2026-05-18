import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { ensureSchema } from "./database.js";

export function populateOglDatabase(dbPath: string): { success: boolean; message: string } {
  if (existsSync(dbPath)) {
    return { success: true, message: `Database already exists at ${dbPath}. Use --force to re-populate.` };
  }

  const db = ensureSchema(dbPath);

  const insert = db.transaction(() => {
    seedCategories(db);
    seedCoreRules(db);
    seedSkills(db);
    seedCareers(db);
    seedTables(db);
    seedEquipment(db);
    seedCombat(db);
    seedShipOps(db);
    seedWorldBuilding(db);
  });

  insert();

  rebuildFts(db);

  db.close();

  return { success: true, message: `OGL database populated at ${dbPath}` };
}

function seedCategories(db: Database.Database): void {
  const cats = [
    ["Characteristics", "The six core characteristics used in character creation"],
    ["Skills", "Skill definitions, specializations, and associated characteristics"],
    ["Careers", "Career paths, qualification rolls, survival, and advancement"],
    ["Combat", "Combat rules, initiative, damage, and recovery"],
    ["Starship Operations", "Starship construction, travel, and space combat"],
    ["World Building", "Star system generation, world creation, and trade codes"],
    ["Equipment", "Personal equipment, weapons, armor, and augmentations"],
    ["Character Creation", "Step-by-step character generation procedures"],
    ["Task Resolution", "Core 2d6 task resolution mechanics"],
    ["Psionics", "Psionic powers, training, and usage rules"],
  ];

  const stmt = db.prepare("INSERT OR IGNORE INTO rules_categories (name, description) VALUES (?, ?)");
  for (const cat of cats) {
    stmt.run(...cat);
  }
}

function seedCoreRules(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO core_rules (section, subsection, content, page_hint) VALUES (?, ?, ?, ?)"
  );

  const rules: [string, string, string, string][] = [
    ["Task Resolution", "Basic Roll",
      "Most actions are resolved by rolling 2d6, adding any relevant modifiers (characteristic DM, skill level, situational modifiers), and comparing the total against a target number (usually 8+). If the total equals or exceeds the target number, the task succeeds. The difference between the total and the target number is the Effect margin.",
      "Core Rules"],
    ["Task Resolution", "Difficulty Levels",
      "Simple tasks require 2+, Routine tasks require 4+, Average tasks require 6+, Difficult tasks require 8+, Very Difficult tasks require 10+, Formidable tasks require 12+, and Impossible tasks require 14+. The referee may apply situational modifiers ranging from -3 (extremely adverse) to +3 (extremely favorable).",
      "Core Rules"],
    ["Task Resolution", "Effect Margin",
      "The Effect margin equals the roll total minus the target number. An exceptional success (Effect 6+) may provide additional benefits, while a failure (Effect negative) may impose complications. Effect is used in combat for damage resolution, and in opposed tasks to determine degree of success.",
      "Core Rules"],
    ["Task Resolution", "Characteristic Checks",
      "An unskilled characteristic check uses the characteristic DM (derived from the characteristic value) with a -3 penalty for lacking the relevant skill. Characteristic DMs range from -3 (characteristic value 0) to +3 (characteristic value 15+).",
      "Core Rules"],
    ["Task Resolution", "Opposed Tasks",
      "When two characters oppose each other, both roll 2d6 with their modifiers. The character with the higher total succeeds. The Effect is the difference between the two totals.",
      "Core Rules"],
    ["Task Resolution", "Time and Haste",
      "A standard task takes 1-6 minutes, a rushed task takes 1-6 combat rounds but imposes a -2 DM, a cautious task takes 10-60 minutes and may grant a +2 DM. The referee determines the base time and effect of altering pace.",
      "Core Rules"],
    ["Characteristics", "Values and DMs",
      "The six core characteristics are Strength (STR), Dexterity (DEX), Endurance (END), Intelligence (INT), Education (EDU), and Social Standing (SOC). Each is rated on a hexadecimal scale from 0 to 15 (0-F). Characteristic DMs are: 0 => -3, 1-2 => -2, 3-5 => -1, 6-8 => 0, 9-11 => +1, 12-14 => +2, 15+ => +3.",
      "Core Rules"],
    ["Characteristics", "UPP Format",
      "The Universal Personality Profile (UPP) is a six-character hexadecimal string representing the six characteristics in order: STR, DEX, END, INT, EDU, SOC. For example, a UPP of 7A95B3 represents STR 7, DEX 10, END 9, INT 5, EDU 11, SOC 3.",
      "Core Rules"],
    ["Characteristics", "Characteristic Damage",
      "Temporary characteristic damage may occur from injury, disease, or environmental effects. The first characteristic to reach 0 incapacitates the character. Multiple characteristics at 0 may result in unconsciousness or death.",
      "Core Rules"],
    ["Character Creation", "Overview",
      "Character creation involves: 1) Roll characteristics (2d6 six times, assign to STR DEX END INT EDU SOC), 2) Determine background skills based on education, 3) Enter a career and resolve terms (4 years each), 4) Gain skills, benefits, and aging effects per term, 5) Purchase starting equipment.",
      "Core Rules"],
    ["Character Creation", "Background Skills",
      "Before starting a career, a character gains background skills based on their Education DM. EDU 8+ grants 3 background skills, EDU 6-7 grants 2, EDU 4-5 grants 1, and EDU 0-3 grants 0. These are chosen from a list of common skills.",
      "Core Rules"],
    ["Character Creation", "Terms and Aging",
      "Each career term lasts 4 years. After age 34, the character rolls 2d6 per term; on a result lower than the number of terms served past age 34, the character suffers -1 to one physical characteristic. At age 66, mandatory retirement occurs.",
      "Core Rules"],
    ["Character Creation", "Mustering Out",
      "When a character leaves a career, they receive mustering-out benefits: 1 benefit per term served, plus additional benefits for high rank. Benefits include cash payments, equipment, ship shares, and characteristic increases.",
      "Core Rules"],
    ["Character Creation", "Connections Rule",
      "During character creation, each character may form one connection with another player character per term. Each connection grants +1 to one skill the connected character possesses. This represents shared backstory events.",
      "Core Rules"],
    ["Character Creation", "Skills and Training",
      "Skills are rated at levels 0-4+. A character with Skill-0 has basic competence and receives no DM penalty. Each skill level above 0 adds +1 to skill checks using that skill. Skill-0 is always listed; higher levels replace it.",
      "Core Rules"],
  ];

  for (const rule of rules) {
    stmt.run(...rule);
  }
}

function seedSkills(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO skills (name, description, characteristic, specializations) VALUES (?, ?, ?, ?)"
  );

  const skills: [string, string, string, string][] = [
    ["Admin", "Managing bureaucracies, navigating paperwork, and handling logistics.", "EDU", "Organization, Legal, Logistics"],
    ["Advocate", "Knowledge of legal codes and court procedures.", "EDU", "Civil Law, Criminal Law, Corporate Law"],
    ["Animals", "Handling, riding, and caring for animals.", "None", "Riding, Veterinary, Training"],
    ["Athletics", "Physical fitness and sports ability. Three sub-skills.", "Varies", "Dexterity, Endurance, Strength"],
    ["Art", "Creative expression in any medium.", "EDU", "Performer, Instrument, Holography, Writing"],
    ["Astrogation", "Plotting courses and navigating in space.", "EDU", "Basic, Jump, Advanced"],
    ["Broker", "Trading, commerce, and market analysis.", "EDU", "Trade, Black Market, Futures"],
    ["Carouse", "Socializing, drinking, and fitting in at social events.", "SOC", "Partying, Networking, Drinking"],
    ["Deception", "Lying, bluffing, and disguising.", "INT", "Fast Talk, Disguise, Forgery"],
    ["Diplomat", "Formal negotiation and statecraft.", "SOC", "Treaty, Protocol, Embassy"],
    ["Drive", "Operating ground vehicles.", "DEX", "Wheeled, Tracked, Hover"],
    ["Electronics", "Working with electronic devices and systems.", "EDU", "Comms, Sensors, Computers, Remote Ops"],
    ["Engineer", "Designing, repairing, and maintaining machinery.", "EDU", "M-drive, J-drive, Life Support, Power"],
    ["Explosives", "Using and disarming explosive devices.", "EDU", "Demolitions, Grenades, Breaching"],
    ["Flyer", "Operating atmospheric flying vehicles.", "DEX", "Grav, Rotor, Wing"],
    ["Gambler", "Games of chance and reading opponents.", "INT", "Cards, Dice, Sports Betting"],
    ["Gunner", "Operating ship-mounted and vehicle-mounted weapons.", "DEX", "Turret, Screen, Capital"],
    ["Gun Combat", "Using personal ranged weapons.", "DEX", "Energy, Slug, Projectile"],
    ["Heavy Weapons", "Using man-portable support weapons.", "DEX", "Launchers, Man-Portable Artillery, Flamethrowers"],
    ["Investigate", "Gathering evidence and solving mysteries.", "INT", "Forensics, Surveillance, Research"],
    ["Jack of All Trades", "General capability for untrained tasks.", "None", ""],
    ["Language", "Speaking and understanding foreign languages.", "EDU", "Each language is a separate specialization"],
    ["Leadership", "Commanding others and inspiring loyalty.", "SOC", "Military, Civilian, Crisis"],
    ["Mechanic", "Repairing and maintaining mechanical equipment.", "EDU", "Vehicles, Robotics, Hydraulics"],
    ["Medic", "Medical treatment and surgery.", "EDU", "First Aid, Surgery, Pharmacology"],
    ["Melee", "Close combat with hand weapons.", "STR", "Blade, Bludgeon, Unarmed, Natural"],
    ["Navigation", "Land and sea navigation.", "EDU", "Land, Sea, Underwater"],
    ["Persuade", "Convincing others through argument.", "SOC", "Negotiation, Oratory, Charm"],
    ["Pilot", "Operating spacecraft.", "DEX", "Small Craft, Spacecraft, Capital Ship"],
    ["Profession", "Working in a non-adventuring trade.", "EDU", "Belter, Biologicals, Construction, Hydroponics"],
    ["Recon", "Scouting and gathering intelligence.", "INT", "Stealth, Observation, Tracking"],
    ["Science", "Scientific knowledge and research.", "EDU", "Physics, Chemistry, Biology, Archaeology, Psychology"],
    ["Seafarer", "Operating watercraft.", "DEX", "Sail, Submarine, Motor"],
    ["Stealth", "Moving unseen and avoiding detection.", "DEX", "Sneaking, Hiding, Shadowing"],
    ["Steward", "Cooking, serving, and passenger care.", "EDU", "Passenger Line, Luxury, Hostile Environment"],
    ["Streetwise", "Surviving in urban underworld environments.", "INT", "Gangs, Black Market, Rumors"],
    ["Survival", "Living off the land in wilderness environments.", "END", "Arctic, Desert, Jungle, Space"],
    ["Tactics", "Military planning and battlefield command.", "INT", "Military, Naval, Ground"],
    ["Vacc Suit", "Using space suits and environmental protection gear.", "DEX", "Standard, Combat, Hostile Environment"],
    ["Zero-G", "Operating in microgravity and freefall.", "DEX", "Maneuvering, Combat, Damage Control"],
  ];

  for (const skill of skills) {
    stmt.run(...skill);
  }
}

function seedCareers(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO careers (name, description, qualification, survival, advancement, ranks, mustering_out, skills_and_training) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const careers: [string, string, string, string, string, string, string, string][] = [
    ["Navy", "Service in the stellar navy, crewing military starships.", "INT 6+", "INT 5+", "EDU 7+",
      "Crewman, Ensign, Lieutenant, Commander, Captain, Admiral",
      "Cash: Cr1000/5000/10000/20000/50000/100000. Other: +1 EDU, Weapon, Ship Share",
      "Pilot, Gunner, Engineer, Mechanic, Electronics, Vacc Suit, Zero-G, Gun Combat, Melee, Admin"],
    ["Marines", "Elite ground assault and boarding troops.", "END 6+", "END 7+", "EDU 5+",
      "Marine, Lance Corporal, Corporal, Sergeant, Gunnery Sergeant, Lieutenant",
      "Cash: Cr2000/5000/10000/20000/30000/50000. Other: Weapon, Armor, +1 END, +1 SOC",
      "Gun Combat, Heavy Weapons, Melee, Stealth, Tactics, Vacc Suit, Zero-G, Athletics, Explosives"],
    ["Army", "Planetary ground forces and military operations.", "END 5+", "STR 6+", "EDU 6+",
      "Private, Lance Corporal, Corporal, Sergeant, Lieutenant, Captain",
      "Cash: Cr2000/5000/10000/15000/25000/40000. Other: Weapon, Armor, +1 END",
      "Gun Combat, Heavy Weapons, Melee, Drive, Flyer, Recon, Survival, Stealth, Tactics"],
    ["Scouts", "Exploration, survey, and courier service.", "INT 5+", "END 7+", "EDU 5+",
      "Scout, Courier, Surveyor, Explorer, Senior Scout",
      "Cash: Cr2500/5000/10000/20000/40000. Other: Ship (Scout/Courier), Weapon",
      "Astrogation, Pilot, Electronics, Gun Combat, Vacc Suit, Zero-G, Recon, Survival, Science"],
    ["Merchants", "Commercial trade and free trading operations.", "EDU 5+", "INT 5+", "INT 7+",
      "Crewman, 3rd Officer, 2nd Officer, 1st Officer, Captain",
      "Cash: Cr5000/10000/20000/30000/40000. Other: Free Trader, Ship Share, +1 SOC",
      "Broker, Steward, Engineer, Mechanic, Pilot, Electronics, Vacc Suit, Admin, Carouse"],
    ["Agents", "Intelligence, law enforcement, and corporate security.", "INT 6+", "INT 6+", "INT 5+",
      "Agent, Field Agent, Senior Agent, Special Agent",
      "Cash: Cr5000/10000/25000/50000. Other: Weapon, Ship Share, +1 INT",
      "Investigate, Deception, Stealth, Gun Combat, Streetwise, Persuade, Electronics, Computers"],
    ["Nobility", "Planetary and interstellar aristocracy.", "SOC 10+", "SOC 6+", "INT 7+",
      "Gentleman, Knight, Baronet, Baron, Marquis, Count, Duke",
      "Cash: Cr10000/20000/50000/100000/200000. Other: Ship Share, +1 SOC, Weapon",
      "Admin, Advocate, Diplomat, Leadership, Carouse, Persuade, Art, Animals, Melee"],
    ["Scholars", "Academic research and education.", "EDU 7+", "EDU 6+", "INT 8+",
      "Student, Researcher, Professor, Dean",
      "Cash: Cr5000/10000/20000/40000. Other: +1 EDU, +1 INT, Scientific Equipment",
      "Science, Electronics, Medic, Investigate, Admin, Language, Art, Jack of All Trades"],
    ["Citizens", "General civilian careers and professions.", "EDU 4+", "SOC 5+", "INT 6+",
      "Worker, Technician, Manager, Executive",
      "Cash: Cr2500/5000/10000/20000/50000. Other: +1 SOC, Equipment, Ship Share",
      "Drive, Flyer, Electronics, Mechanic, Engineer, Profession, Admin, Advocate, Carouse"],
    ["Drifters", "Those living on the margins of society.", "END 4+", "INT 5+", "SOC 7+",
      "Vagabond, Wanderer, Survivor, Legend",
      "Cash: Cr1000/2500/10000/20000. Other: Weapon, +1 END, Contact",
      "Survival, Streetwise, Stealth, Melee, Recon, Athletics, Deception, Gambler, Carouse"],
  ];

  for (const career of careers) {
    stmt.run(...career);
  }
}

function seedTables(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO tables_2d6 (name, description, dice_type, min_roll, max_roll, result) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const tables: [string, string, string, number, number, string][] = [
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 2, 2, "Assassin or hostile agent"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 3, 3, "Thief or criminal"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 4, 4, "Disgruntled local"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 5, 5, "Merchant or trader"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 6, 6, "Fellow traveler"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 7, 7, "Local official"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 8, 8, "Interesting stranger"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 9, 9, "Potential patron or ally"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 10, 10, "Old acquaintance"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 11, 11, "Unusual alien or outsider"],
    ["Personal Encounter", "Random personal encounter during travel", "2d6", 12, 12, "Wealthy noble or celebrity"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 2, 2, "Violently hostile - immediate attack"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 3, 3, "Hostile - will attack if provoked"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 4, 4, "Unfriendly - uncooperative"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 5, 5, "Cautious - wary but not aggressive"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 6, 6, "Neutral - indifferent"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 7, 7, "Neutral - willing to talk"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 8, 8, "Interested - curious about the characters"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 9, 9, "Friendly - helpful"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 10, 10, "Very friendly - generous"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 11, 11, "Enthusiastic - will go out of their way to help"],
    ["Reaction Table", "NPC reaction to player characters", "2d6", 12, 12, "Devoted - lifelong ally or devoted fan"],
    ["Patron Encounter", "Type of patron making contact", "d66", 11, 11, "Military officer"],
    ["Patron Encounter", "Type of patron making contact", "d66", 12, 12, "Corporate executive"],
    ["Patron Encounter", "Type of patron making contact", "d66", 13, 13, "Wealthy dilettante"],
    ["Patron Encounter", "Type of patron making contact", "d66", 14, 14, "Government minister"],
    ["Patron Encounter", "Type of patron making contact", "d66", 15, 15, "Merchant captain"],
    ["Patron Encounter", "Type of patron making contact", "d66", 16, 16, "Criminal boss"],
    ["Patron Encounter", "Type of patron making contact", "d66", 21, 21, "Intelligence agent"],
    ["Patron Encounter", "Type of patron making contact", "d66", 22, 22, "Academic researcher"],
    ["Patron Encounter", "Type of patron making contact", "d66", 23, 23, "Religious leader"],
    ["Patron Encounter", "Type of patron making contact", "d66", 24, 24, "Alien diplomat"],
    ["Patron Encounter", "Type of patron making contact", "d66", 25, 25, "Media representative"],
    ["Patron Encounter", "Type of patron making contact", "d66", 26, 26, "Underground contact"],
    ["Patron Encounter", "Type of patron making contact", "d66", 31, 31, "Medical professional"],
    ["Patron Encounter", "Type of patron making contact", "d66", 32, 32, "Belter prospector"],
    ["Patron Encounter", "Type of patron making contact", "d66", 33, 33, "Insurance agent"],
    ["Patron Encounter", "Type of patron making contact", "d66", 34, 34, "Labor union boss"],
    ["Patron Encounter", "Type of patron making contact", "d66", 35, 35, "Political activist"],
    ["Patron Encounter", "Type of patron making contact", "d66", 36, 36, "Smuggler"],
    ["Patron Encounter", "Type of patron making contact", "d66", 41, 41, "Mercenary leader"],
    ["Patron Encounter", "Type of patron making contact", "d66", 42, 42, "Entertainment producer"],
    ["Patron Encounter", "Type of patron making contact", "d66", 43, 43, "Archaeological society"],
    ["Patron Encounter", "Type of patron making contact", "d66", 44, 44, "Xenologist"],
    ["Patron Encounter", "Type of patron making contact", "d66", 45, 45, "Shipping magnate"],
    ["Patron Encounter", "Type of patron making contact", "d66", 46, 46, "Hacker or data broker"],
    ["Patron Encounter", "Type of patron making contact", "d66", 51, 51, "Retired adventurer"],
    ["Patron Encounter", "Type of patron making contact", "d66", 52, 52, "Planetary governor"],
    ["Patron Encounter", "Type of patron making contact", "d66", 53, 53, "Alien artifact collector"],
    ["Patron Encounter", "Type of patron making contact", "d66", 54, 54, "Mysterious stranger"],
    ["Patron Encounter", "Type of patron making contact", "d66", 55, 55, "Resistance leader"],
    ["Patron Encounter", "Type of patron making contact", "d66", 56, 56, "Corporate defector"],
    ["Patron Encounter", "Type of patron making contact", "d66", 61, 61, "Naval intelligence"],
    ["Patron Encounter", "Type of patron making contact", "d66", 62, 62, "Megacorp representative"],
    ["Patron Encounter", "Type of patron making contact", "d66", 63, 63, "Pirate captain"],
    ["Patron Encounter", "Type of patron making contact", "d66", 64, 64, "Guild master"],
    ["Patron Encounter", "Type of patron making contact", "d66", 65, 65, "Psionics institute"],
    ["Patron Encounter", "Type of patron making contact", "d66", 66, 66, "Ancient AI or alien entity"],
  ];

  for (const table of tables) {
    stmt.run(...table);
  }
}

function seedEquipment(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO equipment (name, category, tech_level, cost, weight, description) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const items: [string, string, number, string, string, string][] = [
    ["Blade", "Melee Weapon", 1, "Cr50", "0.5kg", "Simple edged weapon, common across known space"],
    ["Club", "Melee Weapon", 0, "Cr0", "1.5kg", "Improvised blunt weapon, requires no technology"],
    ["Body Pistol", "Ranged Weapon", 8, "Cr500", "0.1kg", "Concealable firearm, difficult to detect on scans"],
    ["Auto Pistol", "Ranged Weapon", 5, "Cr200", "0.75kg", "Standard semi-automatic sidearm"],
    ["Revolver", "Ranged Weapon", 4, "Cr150", "1kg", "Reliable cylinder-fed firearm"],
    ["Shotgun", "Ranged Weapon", 5, "Cr200", "3.75kg", "Close-range weapon, devastating at short distances"],
    ["Assault Rifle", "Ranged Weapon", 7, "Cr500", "4.5kg", "Standard military longarm, capable of automatic fire"],
    ["Laser Carbine", "Ranged Weapon", 8, "Cr2500", "4kg", "Energy weapon with integrated power pack"],
    ["Laser Rifle", "Ranged Weapon", 9, "Cr3500", "6kg", "Longer-range energy weapon, backpack power supply"],
    ["Stunner", "Ranged Weapon", 8, "Cr1000", "1kg", "Non-lethal energy weapon, causes unconsciousness"],
    ["Cloth Armor", "Armor", 7, "Cr500", "5kg", "Flexible ballistic cloth, can be worn under clothing"],
    ["Flak Jacket", "Armor", 7, "Cr300", "3kg", "Protective vest against shrapnel and small arms fire"],
    ["Mesh Armor", "Armor", 10, "Cr2000", "3kg", "Advanced synthetic fiber, protects against blades and bullets"],
    ["Reflec", "Armor", 10, "Cr1500", "1kg", "Reflective body suit, effective against laser weapons"],
    ["Combat Armor", "Armor", 12, "Cr12000", "20kg", "Full-body combat suit with integrated electronics"],
    ["Vacc Suit", "Armor", 7, "Cr10000", "10kg", "Standard spacesuit for vacuum operations, 6-hour life support"],
    ["Medkit", "Medical", 7, "Cr1000", "3kg", "Field medical kit with diagnostic tools and basic supplies"],
    ["Respirator", "Survival", 6, "Cr200", "0.5kg", "Filters airborne toxins and provides breathable air"],
    ["Cold Weather Clothing", "Survival", 1, "Cr200", "3kg", "Insulated clothing for extreme cold environments"],
    ["Hand Computer", "Electronics", 9, "Cr500", "0.5kg", "Portable computing device with wireless connectivity"],
    ["Communicator", "Electronics", 6, "Cr250", "0.25kg", "Short-range radio, 50km planetary range"],
    ["Binoculars", "Electronics", 6, "Cr500", "1.5kg", "Optical enhancement with light amplification"],
    ["Electronic Tool Set", "Tools", 7, "Cr2000", "8kg", "Comprehensive toolkit for electronics repair"],
    ["Mechanical Tool Set", "Tools", 6, "Cr1000", "12kg", "Comprehensive toolkit for mechanical repair"],
    ["Food Concentrate", "Survival", 8, "Cr50", "0.5kg", "One week of compressed rations for one person"],
    ["Water Purifier", "Survival", 5, "Cr200", "3kg", "Filters and purifies water from most sources"],
  ];

  for (const item of items) {
    stmt.run(...item);
  }
}

function seedCombat(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO combat (topic, content, category) VALUES (?, ?, ?)"
  );

  const entries: [string, string, string][] = [
    ["Initiative", "Combat begins with an initiative determination. Each character rolls 2d6 + DEX DM. Characters act in order from highest to lowest total. Ties are resolved by DEX score, then randomly.", "Basic Combat"],
    ["Combat Rounds", "Each combat round represents approximately 6 seconds of action. A character may perform one significant action and one minor action per round. Significant actions include attacking, operating equipment, or complex maneuvers. Minor actions include moving short distances, drawing weapons, or speaking.", "Basic Combat"],
    ["Attack Roll", "To attack, roll 2d6 + the relevant weapon skill DM + DEX DM (or STR DM for melee) + range DM + other modifiers. The target number is 8+ for a standard attack. Armor provides a negative DM to the attack roll.", "Attack Resolution"],
    ["Damage", "Weapons have a base damage rating expressed as a number of d6. Add the Effect margin from the attack roll to the damage total. Subtract the target's armor value from the total. The remaining damage is applied to the target's physical characteristics (END first, then STR or DEX).", "Damage"],
    ["Range Bands", "Ranged attacks use range bands: Personal (0-2m, +2 DM), Close (2-10m, +0), Short (10-50m, -1), Medium (50-250m, -2), Long (250-500m, -4), Very Long (500m+, -6). Weapon types modify these ranges.", "Attack Resolution"],
    ["Cover", "Cover provides DM to avoid being hit: 1/4 cover (-1 to attacker), 1/2 cover (-2), 3/4 cover (-4), Full cover (cannot be hit). Going prone gives -2 DM to ranged attackers.", "Defense"],
    ["Medical Treatment", "First Aid (Medic check, 8+, 1-6 minutes) restores 1d3 characteristic points but cannot raise above the original value. Surgery (Medic check, 8+, 10-60 minutes) restores more but requires a medical facility. Natural healing restores 1 point per characteristic per day of rest.", "Recovery"],
  ];

  for (const entry of entries) {
    stmt.run(...entry);
  }
}

function seedShipOps(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO starship_operations (topic, content, category) VALUES (?, ?, ?)"
  );

  const entries: [string, string, string][] = [
    ["Star System Travel", "Travel between worlds within a star system uses maneuver drives (M-drives) that provide constant acceleration. Typical in-system journeys take hours to days. Travel time depends on distance and drive rating.", "Travel"],
    ["Interstellar Travel", "Travel between star systems uses jump drives. A Jump-1 drive can travel 1 parsec (3.26 light-years) in roughly 1 week. Jump-2 covers 2 parsecs, etc. Jump drives require refined fuel: 10% of ship tonnage per parsec jumped.", "Travel"],
    ["Starship Combat", "Space combat occurs at range bands: Close, Short, Medium, Long, and Very Long. Each round, crew members man positions: Pilot (evasive action), Gunner (attack), Engineer (power allocation), and Commander (initiative/orders). Weapons include beam lasers, pulse lasers, missile bays, and sandcasters.", "Combat"],
    ["Ship Design", "Starships are designed by allocating tonnage to components: bridge (2% of hull), power plant, maneuver drive, jump drive, fuel tanks, staterooms (4 tons each), cargo holds, weapon hardpoints (1 per 100 tons), and armor. Ship computer rating determines software capacity.", "Design"],
    ["Trade and Commerce", "Cargo is classified as Major (10 tons), Minor (5 tons), or Incidental (1 ton). Freight rates vary by distance and cargo type. Speculative trade involves purchasing goods at one world and selling at another: roll 2d6 + Broker skill + SOC DM for purchase price and sale price.", "Economy"],
    ["Passenger Travel", "Passengers are categorized as High (wealthy, first class), Middle (standard accommodation), and Low (cold berth). High passage costs Cr10,000 per parsec, Middle costs Cr8,000, and Low costs Cr1,000. Characters may take on passengers for extra income during travel.", "Economy"],
  ];

  for (const entry of entries) {
    stmt.run(...entry);
  }
}

function seedWorldBuilding(db: Database.Database): void {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO world_building (topic, content, category) VALUES (?, ?, ?)"
  );

  const entries: [string, string, string][] = [
    ["Starport Type", "Starports are rated A (excellent, refined fuel, shipyard, repair), B (good, refined fuel, repair), C (routine, unrefined fuel only), D (poor, unrefined fuel, limited repairs), E (frontier, no facilities), and X (no starport). Starports set the baseline for available services.", "World Generation"],
    ["World Size", "Worlds range from Size 0 (800 km or less, asteroid belt) to Size A/F (16,000+ km, super-earth). Size affects surface gravity: Size 8 is approximately 1G. Worlds smaller than Size 2 cannot retain atmospheres.", "World Generation"],
    ["Atmosphere Type", "Atmosphere codes: 0 (none), 1 (trace), 2-3 (very thin, requires respirator), 4-5 (thin, breathable), 6-7 (standard, breathable), 8-9 (dense, breathable with filter), A (exotic), B-C (corrosive, requires vacc suit), D+ (insidious).", "World Generation"],
    ["Hydrographics", "Hydrographic percentage: 0 (no water, desert world) to A (100% water, water world). Worlds with 0-1 hydrographics require survival gear for water. Worlds with 9-A have island chains and floating cities.", "World Generation"],
    ["Population", "Population codes: 0 (none), 1 (tens), 2 (hundreds), 3 (thousands), 4 (tens of thousands), 5 (hundreds of thousands), 6 (millions), 7 (tens of millions), 8 (hundreds of millions), 9 (billions), A (tens of billions).", "World Generation"],
    ["Government Type", "Government types range from 0 (none/anarchy) to F (religious dictatorship). Common types include: 1 (company/corporate), 3 (self-perpetuating oligarchy), 6 (captive government), 7 (balkanized), B (non-charismatic leader), D (religious autocracy).", "World Generation"],
    ["Law Level", "Law Level ranges from 0 (no restrictions) to 9+ (total ban on most items). Higher law levels restrict weapons: L1 bans WMDs, L2 bans military weapons, L3 bans assault weapons, L4 bans all firearms, L5 bans melee weapons, L6 bans all weapons.", "World Generation"],
    ["Tech Level", "Tech Level ranges from 0 (stone age) to F (maximum imaginable). Key thresholds: TL5 (industrial revolution), TL7 (computers, basic spaceflight), TL9 (fusion power, jump-1), TL11 (gravitic technology), TL12 (jump-4), TL15 (jump-6, maximum in standard rules).", "World Generation"],
    ["Trade Codes", "Worlds receive trade classifications based on their characteristics: Agricultural (size 5-8, atmosphere 4-9, hydro 4-8), Asteroid (size 0), Barren (population 0), Desert (hydro 0), Fluid Oceans (hydro A, non-water), Garden (atmosphere 6, hydro 4-8, size 6-8), High Population (population 9+), Industrial (atmosphere 0-4/7-9, population 9+), Poor (atmosphere 2-5, hydro 0-3), Rich (atmosphere 6-8, population 6-8), Vacuum (atmosphere 0).", "World Generation"],
  ];

  for (const entry of entries) {
    stmt.run(...entry);
  }
}

function rebuildFts(db: Database.Database): void {
  db.exec(`INSERT INTO rules_fts(rules_fts) VALUES ('rebuild');`);
  db.exec(`INSERT INTO core_rules_fts(core_rules_fts) VALUES ('rebuild');`);
}
