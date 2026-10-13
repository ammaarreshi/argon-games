import * as THREE from '../assets/vendor/three.module.js';

/**
 * Grand Theft Argon: Argon City Stories / Grand Theft Argon (1986)
 * Mini-Games, 1986 Pocket Pager/PDA & Black Market Contraband Economy System
 *
 * Implements:
 * 1. Three Interactive Grand Theft Argon Contextual Canvas Mini-Games (#vc-minigame-modal):
 *    - Hotwiring 80s Exotics (3-stage: Unscrew Column -> Strip & Twist Wires -> Bridge Starter Fuse / Turn Screwdriver)
 *    - Gas Station Molotov Assembly at ARGON GAS '86 (2-stage: Pump High-Octane Fuel -> Stuff Pastel Bandana Wicks & Flick Lighter)
 *    - Dumpster Diving & Beach Cooler Stash Search (Flip Lid -> Drag Aside Trash/Ice/Coconuts -> Collect Hidden Loot)
 * 2. 1986 Argon City Pocket Terminal & Motorola Beeper Pager (#vc-pda-modal):
 *    - Tab 1: Pager Tips & Hotspots ("59" unread yellow envelope messages, Fire Sales, Kingpin Surges, GPS Waypoint setter)
 *    - Tab 2: Contraband Market Matrix (6 1980s commodities, Buy Low / Sell High, local vs. avg prices, ACPD Sting risk)
 *    - Tab 3: Starfish Island Safehouse Stash (transfer between 50-unit mobile briefcase & 500-unit Mansion Vault)
 *    - Tab 4: Argon City Rampages & Challenges Launcher (instant trigger or waypoint to 3D skull markers)
 * 3. 1980s Argon City Rampage Challenges & Grand Theft Argon Combo Chain Multipliers:
 *    - 3 rotating neon-magenta 3D Skull Markers + 90s timer + 2X..5X VICE KINGPIN combo chain multiplier
 */

const COMMODITIES = [
  {
    id: 'miami_snow',
    name: 'Miami Snow',
    unit: 'Kilo Brick',
    icon: '❄️',
    basePrice: 1800,
    minPrice: 650,
    maxPrice: 4400,
    color: '#00f6ff',
    desc: 'High-purity Starfish Cayo powder smuggled via fast cigarette boats.'
  },
  {
    id: 'starfish_dust',
    name: 'Starfish Dust',
    unit: 'Neon Vial',
    icon: '✨',
    basePrice: 950,
    minPrice: 340,
    maxPrice: 2400,
    color: '#ff2a9d',
    desc: 'Ocean Drive nightclub favorite; surges every midnight along the strip.'
  },
  {
    id: 'voodoo_herb',
    name: 'Haitian Voodoo Herb',
    unit: 'Pressed Bale',
    icon: '🌿',
    basePrice: 420,
    minPrice: 150,
    maxPrice: 1150,
    color: '#39ff14',
    desc: 'Aromatic Little Haiti botanical bundles cured in Auntie Poulet’s compound.'
  },
  {
    id: 'synth_tabs',
    name: 'Vice Synth-Tabs',
    unit: 'Chrome Blister',
    icon: '💊',
    basePrice: 620,
    minPrice: 220,
    maxPrice: 1650,
    color: '#bd00ff',
    desc: '80s synth-wave club tablets pressed behind Washington Beach arcades.'
  },
  {
    id: 'cohiba_crates',
    name: 'Cuban Cohiba Crates',
    unit: 'Cedar Box',
    icon: '🚬',
    basePrice: 310,
    minPrice: 110,
    maxPrice: 820,
    color: '#ff9e00',
    desc: 'Embargo-run Havana reserve cigars prized by Little Havana bosses.'
  },
  {
    id: 'gold_bullion',
    name: 'Smuggled Gold Bullion',
    unit: 'Stamped Ingot',
    icon: '🪙',
    basePrice: 2600,
    minPrice: 1050,
    maxPrice: 5900,
    color: '#ffe600',
    desc: 'Untraceable Cortez syndicate Krugerrands & bullion bars.'
  }
];

const DEALERS = [
  {
    id: 'dealer_ocean_beach',
    name: 'Rico’s Marina Dock',
    contact: 'Colonel Cortez’s Lieutenant',
    district: 'Ocean Beach',
    x: 52,
    z: 38,
    surveillance: 0.14,
    surveillanceLabel: 'LOW (14%)',
    specialtyLow: 'cohiba_crates',
    specialtyHigh: 'starfish_dust',
    color: '#00f6ff'
  },
  {
    id: 'dealer_washington',
    name: 'Neon Strip Backlot',
    contact: 'Ken Rosenberg’s Runner',
    district: 'Washington Beach',
    x: 46,
    z: -12,
    surveillance: 0.28,
    surveillanceLabel: 'HIGH (28% ACPD METRO)',
    specialtyLow: 'synth_tabs',
    specialtyHigh: 'miami_snow',
    color: '#ff2a9d'
  },
  {
    id: 'dealer_starfish',
    name: 'Starfish Cabana Dock',
    contact: 'Ricardo Diaz’s Broker',
    district: 'Starfish Island',
    x: -16,
    z: 10,
    surveillance: 0.10,
    surveillanceLabel: 'MINIMAL (10%)',
    specialtyLow: 'gold_bullion',
    specialtyHigh: 'gold_bullion',
    color: '#ffe600'
  },
  {
    id: 'dealer_little_haiti',
    name: 'Poulet’s Courtyard',
    contact: 'Auntie Poulet’s Scout',
    district: 'Little Haiti',
    x: -106,
    z: -36,
    surveillance: 0.18,
    surveillanceLabel: 'MODERATE (18%)',
    specialtyLow: 'voodoo_herb',
    specialtyHigh: 'synth_tabs',
    color: '#39ff14'
  },
  {
    id: 'dealer_little_havana',
    name: 'Umberto’s Bodega Alley',
    contact: 'Umberto Robina’s Crew',
    district: 'Little Havana',
    x: -106,
    z: 32,
    surveillance: 0.22,
    surveillanceLabel: 'ELEVATED (22%)',
    specialtyLow: 'miami_snow',
    specialtyHigh: 'cohiba_crates',
    color: '#ff9e00'
  }
];

const STASH_SPOTS = [
  {
    id: 'stash_haiti_motel',
    type: 'dumpster',
    name: 'Little Haiti Motel Dumpster',
    district: 'Little Haiti',
    x: -124,
    z: -29
  },
  {
    id: 'stash_havana_backlot',
    type: 'dumpster',
    name: 'Calle Ocho Cafe Dumpster',
    district: 'Little Havana',
    x: -124,
    z: 18
  },
  {
    id: 'stash_ocean_cooler',
    type: 'beach_stash',
    name: 'Ocean Beach Buried Cooler',
    district: 'Ocean Beach',
    x: 106,
    z: 18
  },
  {
    id: 'stash_washington_cooler',
    type: 'beach_stash',
    name: 'North Lifeguard Dune Cooler',
    district: 'Washington Beach',
    x: 106,
    z: -24
  }
];

const RAMPAGE_DEFS = {
  neon_arcade_blitz: {
    id: 'neon_arcade_blitz',
    title: 'OCEAN DRIVE TURBO BLITZ',
    subtitle: 'Take down 12 Syndicate Enforcers along Ocean Beach in 90s!',
    district: 'Ocean Beach Promenade',
    x: 90.5,
    z: -12,
    target: 12,
    duration: 90.0,
    rewardCash: 5000,
    weaponGrant: 'mac10',
    acceptsTypes: ['kill', 'melee', 'any'],
    color: '#ff006e'
  },
  molotov_mayhem: {
    id: 'molotov_mayhem',
    title: 'MOLOTOV MAYHEM',
    subtitle: 'Torch 10 Gangsters & Rides with Molotovs & MAC-10 in 90s!',
    district: 'Little Haiti Boulevard',
    x: -106.5,
    z: -22,
    target: 10,
    duration: 90.0,
    rewardCash: 5000,
    weaponGrant: 'molotov',
    acceptsTypes: ['kill', 'vehicle', 'molotov', 'explosion', 'any'],
    color: '#ff7b00'
  },
  vcpd_demolition: {
    id: 'vcpd_demolition',
    title: 'ACPD TAKEDOWN DERBY',
    subtitle: 'Wreck 4 Pursuing Police Cruisers & Enforcers in 90s!',
    district: 'Starfish Causeway',
    x: -18,
    z: -6,
    target: 4,
    duration: 90.0,
    rewardCash: 6500,
    weaponGrant: 'python',
    acceptsTypes: ['police_vehicle', 'vehicle', 'kill', 'explosion', 'any'],
    color: '#00f6ff'
  }
};
Object.defineProperty(RAMPAGE_DEFS, 'chainsaw_carnage', {
  value: RAMPAGE_DEFS.neon_arcade_blitz,
  enumerable: false
});

const COMBO_LABELS = [
  '',
  '1X HIT',
  '2X CHAIN!',
  '3X CHAIN!',
  '4X WICKED!',
  '5X OUTRUN!',
  'VICE KINGPIN!'
];

const TIKI_PACKAGE_DEFS = [
  {
    id: 'tiki_ocean_promenade',
    name: 'Ocean Drive Beach Promenade',
    district: 'Ocean Beach',
    x: 90.2,
    z: -28.0,
    hint: 'Right along the neon palm boardwalk near player start!'
  },
  {
    id: 'tiki_synth_studio',
    name: "Ocean Drive '86 Synth Studio",
    district: 'Ocean Beach',
    x: 54.5,
    z: 4.5,
    hint: 'Outside the glowing 1986 analog synthesizer studio on Ocean Beach!'
  },
  {
    id: 'tiki_seaplane_pier',
    name: 'Ocean Beach Seaplane Charter Pad',
    district: 'Ocean Beach Pier',
    x: 112.0,
    z: -22.0,
    hint: 'Floating dock beside the Skimmer Dodo Seaplane!'
  },
  {
    id: 'tiki_malibu_club',
    name: 'The Malibu Club VIP Entrance',
    district: 'Washington Beach',
    x: 70.0,
    z: -115.0,
    hint: 'Under the neon pink palm arches of The Malibu!'
  },
  {
    id: 'tiki_sunshine_autos',
    name: 'Sunshine Autos Showroom Lot',
    district: 'Little Havana South',
    x: 44.0,
    z: 118.0,
    hint: 'Tucked beside the exotic import garage bays!'
  },
  {
    id: 'tiki_vercetti_pool',
    name: 'Vercetti Estate Turquoise Swimming Pool',
    district: 'Starfish Island',
    x: -30.0,
    z: -44.0,
    hint: 'By the Starfish Mansion mosaic diving board!'
  },
  {
    id: 'tiki_film_studio',
    name: 'InterGlobal Films Apollo Moon Lander',
    district: 'Prawn Island Studio',
    x: -52.0,
    z: -50.0,
    hint: 'Inside Soundstage C next to the lunar module prop!'
  },
  {
    id: 'tiki_cherry_popper',
    name: 'Cherry Popper Ice Cream Factory',
    district: 'Little Havana',
    x: -124.0,
    z: -80.0,
    hint: 'Loading bay behind the "ice cream" distribution depot!'
  },
  {
    id: 'tiki_escobar_tower',
    name: 'Escobar International Airport Control Tower',
    district: 'Escobar Airport',
    x: -142.0,
    z: 132.0,
    hint: 'At the base of the radar control tower tarmac!'
  },
  {
    id: 'tiki_lighthouse',
    name: 'Ocean Beach Southern Lighthouse',
    district: 'Ocean Beach Point',
    x: 118.0,
    z: 148.0,
    hint: 'At the rocky southern headland beneath the coastal beacon!'
  }
];

const EASTER_EGG_DEFS = [
  {
    id: 'egg_synth_studio',
    name: "Jan Hammer '86 Synth Studio",
    subtitle: 'ANALOG KEYTAR & DEGENATRON ARCADE LOUNGE • OCEAN BEACH',
    x: 54.5,
    z: 4.5
  },
  {
    id: 'egg_cement_shoes',
    name: 'Submerged Cement-Shoes Goon',
    subtitle: 'SLEEPING WITH THE FISHES OFF STARFISH REEF',
    x: 16.0,
    z: 14.0
  },
  {
    id: 'egg_vcn_chocolate',
    name: 'VCN Chocolate Easter Egg',
    subtitle: 'SECRET ROOFTOP WINDOW ROOM • DOWNTOWN VCN TOWER',
    x: 42.0,
    z: -96.0
  },
  {
    id: 'egg_moon_lander',
    name: 'InterGlobal Moon Lander',
    subtitle: 'APOLLO 11 SOUNDSTAGE PROP • INTERGLOBAL FILMS',
    x: -52.0,
    z: -50.0
  },
  {
    id: 'egg_sandcastle',
    name: 'Beach Sandcastle Treasure',
    subtitle: 'SMUGGLER GOLD DUBLOON FORTRESS • OCEAN BEACH SANDS',
    x: 108.0,
    z: -8.0
  },
  {
    id: 'egg_lighthouse',
    name: 'Ocean Beach Lighthouse',
    subtitle: 'HISTORIC 1986 MARITIME BEACON • SOUTHERN POINT',
    x: 118.0,
    z: 148.0
  }
];

const AVIATION_GPS_TARGETS = [
  {
    id: 'gps_dodo_seaplane',
    label: 'Dodo Seaplane Charter',
    badge: '🛩️ DODO SEAPLANE',
    x: 112,
    z: -26,
    color: '#00f6ff',
    desc: 'Ocean Beach Pier Seaplane Dock (x: 112, z: -26)'
  },
  {
    id: 'gps_vice_maverick',
    label: 'Argon Maverick Helipad',
    badge: '🚁 ARGON MAVERICK HELI',
    x: 90,
    z: -16,
    color: '#ff2a9d',
    desc: 'Ocean Drive Rooftop / Promenade Helipad (x: 90, z: -16)'
  },
  {
    id: 'gps_escobar_airport',
    label: 'Escobar International Airport',
    badge: '✈️ ESCOBAR AIRPORT',
    x: -146,
    z: 128,
    color: '#ffe600',
    desc: 'Main Runway & Hangar Terminal (x: -146, z: 128)'
  }
];

export class MiniGamesAndEconomySystem {
  constructor(scene, world, combatSystem, vehicleSystem, callbacks = {}) {
    this.scene = scene;
    this.world = world;
    this.combatSystem = combatSystem;
    this.vehicleSystem = vehicleSystem;
    this.callbacks = {
      onCallout: callbacks.onCallout || null,
      onCashChange: callbacks.onCashChange || null,
      onPlaySFX: callbacks.onPlaySFX || null,
      onPlayVoice: callbacks.onPlayVoice || null,
      onWaypointChange: callbacks.onWaypointChange || null
    };

    // Player economy & contraband inventory
    this.briefcaseCap = 50;
    this.stashCap = 500;
    this.netProfit = 0;
    this.unreadTipsCount = 59; // Matches Grand Theft Argon "59" yellow envelope HUD badge!
    this.activeDistrict = 'Ocean Beach';
    this.selectedDealerId = DEALERS[0].id;
    this.activePDATab = 'tips'; // 'tips' | 'market' | 'stash' | 'rampages'
    this.pdaOpen = false;

    this.briefcase = {};
    this.safehouseStash = {};
    for (const c of COMMODITIES) {
      this.briefcase[c.id] = 0;
      this.safehouseStash[c.id] = 0;
    }
    // Starter contraband sample in Starfish Vault & briefcase so player can trade immediately
    this.briefcase.cohiba_crates = 4;
    this.briefcase.voodoo_herb = 3;
    this.safehouseStash.miami_snow = 6;
    this.safehouseStash.gold_bullion = 2;
    this.safehouseStash.starfish_dust = 8;

    // Dynamic district market prices & pager tips
    this.marketPrices = {};
    this.pagerMessages = [];
    this.marketCycleTimer = 0;
    this.marketCycleIndex = 0;
    this._generateMarketCycle(0);

    // Active GPS Waypoint
    this.waypoint = null; // { x, z, label, color }

    // Active mini-game modal state
    this.activeMiniGame = null; // { type, stage, timer, maxTimer, onSuccess, onCancel, data, completed }
    this.canvasAnimFrame = null;
    this.pointerState = { down: false, x: 0, y: 0, startX: 0, startY: 0 };

    // Stash cooldowns
    this.stashCooldowns = new Map();

    // Active Rampage & Grand Theft Argon Combo Multiplier state
    this.activeRampage = null; // { id, title, subtitle, progress, target, timeLeft, duration, rewardCash, color }
    this.comboChain = 0;
    this.comboTimer = 0;
    this.comboMaxWindow = 6.0;
    this.bestComboChain = 0;

    // Cached reference to latest playerState for synchronous UI operations
    this.lastPlayerState = null;
    this.nearbyContext = null; // { type, id, label, promptText, x, z, data }
    this.interactCooldown = 0;

    // 10 Collectible 3D Jade Tiki Statues (Hidden Packages) & 6 Easter Egg Landmarks
    this.tikiPackages = [];
    this.tikiCollectedCount = 0;
    this.easterEggs = [];
    this.discoveredEggsCount = 0;

    // 3D World Markers Group
    this.markersGroup = new THREE.Group();
    this.markersGroup.name = 'ViceCityEconomyAndRampageMarkers';
    if (this.scene) {
      this.scene.add(this.markersGroup);
    }
    this.worldMarkers = [];
    this.waypointArrowMesh = null;
    this.waypointBeaconMesh = null;

    this._build3DWorldMarkers();
    this._initHiddenTikiPackages();
    this._initEasterEggLandmarks();
    this._injectStylesAndDOM();
    this._bindGlobalEvents();
  }

  // ============================================================================
  // MARKET PRICING & 1986 PAGER RUMORS
  // ============================================================================

  _generateMarketCycle(seedOffset = 0) {
    this.marketCycleIndex = seedOffset;
    const dealersCount = DEALERS.length;
    const fireSaleDealer = DEALERS[(seedOffset * 2) % dealersCount];
    const surgeDealer = DEALERS[(seedOffset * 2 + 2) % dealersCount];
    const secondaryLowDealer = DEALERS[(seedOffset + 3) % dealersCount];

    const fireSaleItem = COMMODITIES[(seedOffset) % COMMODITIES.length];
    const surgeItem = COMMODITIES[(seedOffset + 1) % COMMODITIES.length];
    const secondaryItem = COMMODITIES[(seedOffset + 3) % COMMODITIES.length];

    for (const dealer of DEALERS) {
      this.marketPrices[dealer.id] = {};
      for (let i = 0; i < COMMODITIES.length; i++) {
        const comm = COMMODITIES[i];
        // Deterministic pseudo-random variance around basePrice
        const hash = Math.sin((seedOffset + 1) * 17.3 + i * 11.7 + dealer.x * 0.13) * 0.5 + 0.5;
        let factor = 0.82 + hash * 0.38;

        if (dealer.specialtyLow === comm.id) factor *= 0.72;
        if (dealer.specialtyHigh === comm.id) factor *= 1.38;

        if (dealer.id === fireSaleDealer.id && comm.id === fireSaleItem.id) {
          factor = 0.40; // FIRE SALE -60%
        } else if (dealer.id === surgeDealer.id && comm.id === surgeItem.id) {
          factor = 2.20; // KINGPIN SURGE +220% (or 3.2x base capped at maxPrice)
        } else if (dealer.id === secondaryLowDealer.id && comm.id === secondaryItem.id) {
          factor = 0.48;
        }

        const rawPrice = Math.round((comm.basePrice * factor) / 10) * 10;
        const clamped = Math.max(comm.minPrice, Math.min(comm.maxPrice, rawPrice));
        this.marketPrices[dealer.id][comm.id] = {
          price: clamped,
          basePrice: comm.basePrice,
          diffPct: Math.round(((clamped - comm.basePrice) / comm.basePrice) * 100),
          tag:
            dealer.id === fireSaleDealer.id && comm.id === fireSaleItem.id
              ? 'FIRE SALE -60%'
              : dealer.id === surgeDealer.id && comm.id === surgeItem.id
              ? 'KINGPIN SURGE +220%'
              : dealer.id === secondaryLowDealer.id && comm.id === secondaryItem.id
              ? 'BULK CLEARANCE -52%'
              : 'STANDARD'
        };
      }
    }

    const firePrice = this.marketPrices[fireSaleDealer.id][fireSaleItem.id].price;
    const surgePrice = this.marketPrices[surgeDealer.id][surgeItem.id].price;
    const secPrice = this.marketPrices[secondaryLowDealer.id][secondaryItem.id].price;

    this.pagerMessages = [
      {
        id: 'msg_diaz_surge',
        sender: 'RICARDO DIAZ // STARFISH PAGER #01',
        badge: 'KINGPIN SURGE +220%',
        badgeColor: '#39ff14',
        time: '22:14 EST',
        body: `"Listen up! Buyers at ${surgeDealer.name} (${surgeDealer.district}) are desperate for ${surgeItem.icon} ${surgeItem.name} — paying $${surgePrice.toLocaleString()} per unit! Move your stash NOW!"`,
        dealerId: surgeDealer.id,
        x: surgeDealer.x,
        z: surgeDealer.z,
        commodityId: surgeItem.id
      },
      {
        id: 'msg_cortez_firesale',
        sender: 'COLONEL CORTEZ // YACHT FREQ #59',
        badge: 'FIRE SALE -60%',
        badgeColor: '#00f6ff',
        time: '21:58 EST',
        body: `"Amigo, a speedboat just unloaded excess ${fireSaleItem.icon} ${fireSaleItem.name} at ${fireSaleDealer.name} (${fireSaleDealer.district}) for only $${firePrice.toLocaleString()}! Load your briefcase before dawn."`,
        dealerId: fireSaleDealer.id,
        x: fireSaleDealer.x,
        z: fireSaleDealer.z,
        commodityId: fireSaleItem.id
      },
      {
        id: 'msg_poulet_clearance',
        sender: 'AUNTIE POULET // HAITI BEEPER #14',
        badge: 'LOW STOCK DEAL -52%',
        badgeColor: '#ff9e00',
        time: '21:40 EST',
        body: `"Chérie, the spirits say ${secondaryLowDealer.name} (${secondaryLowDealer.district}) is quietly moving ${secondaryItem.icon} ${secondaryItem.name} at $${secPrice.toLocaleString()}. Stash it in your Starfish Mansion vault."`,
        dealerId: secondaryLowDealer.id,
        x: secondaryLowDealer.x,
        z: secondaryLowDealer.z,
        commodityId: secondaryItem.id
      },
      {
        id: 'msg_ken_sting',
        sender: 'KEN ROSENBERG // ESQ. WIRE #86',
        badge: 'ACPD METRO ALERT',
        badgeColor: '#ff2a9d',
        time: '21:19 EST',
        body: `"I'm having a panic attack here! Undercover ACPD Metro Squad detectives are staking out Washington Beach (${DEALERS[1].name}). Keep your piece loaded if you deal there!"`,
        dealerId: DEALERS[1].id,
        x: DEALERS[1].x,
        z: DEALERS[1].z,
        commodityId: 'miami_snow'
      },
      {
        id: 'msg_umberto_molotov',
        sender: 'UMBERTO ROBINA // HAVANA CAFE #07',
        badge: 'ARGON GAS ’86 TIP',
        badgeColor: '#ffe600',
        time: '20:55 EST',
        body: `"Oye! Drive into the glowing blue fuel ring at ARGON GAS '86 (Washington Beach, x:62 z:-42) to pump high-octane Molotov Cocktails on the house!"`,
        dealerId: null,
        x: 62,
        z: -42,
        commodityId: null
      }
    ];
  }

  // ============================================================================
  // 3D WORLD MARKERS (GAS STATION RING, DEALERS, STASHES, SAFEHOUSE, RAMPAGES, GPS)
  // ============================================================================

  _build3DWorldMarkers() {
    if (!this.scene) return;

    // 1. ARGON GAS '86 Blue Pulsing Molotov Fuel Ring (x: 66, z: -38)
    const gasGroup = new THREE.Group();
    gasGroup.position.set(66, 0.08, -38);

    const ringGeo = new THREE.RingGeometry(2.4, 3.1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    gasGroup.add(ringMesh);

    const innerRingGeo = new THREE.RingGeometry(1.3, 1.65, 24);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff7b00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    gasGroup.add(innerRing);

    // Floating Molotov Bottle Hologram inside the ring
    const bottleGroup = new THREE.Group();
    bottleGroup.position.set(0, 1.5, 0);
    const bodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 0.9, 10),
      new THREE.MeshBasicMaterial({ color: 0xff6d00, wireframe: false })
    );
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 0.42, 8),
      new THREE.MeshBasicMaterial({ color: 0x00f6ff })
    );
    neckMesh.position.y = 0.62;
    const flameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.55, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe600 })
    );
    flameMesh.position.y = 1.05;
    bottleGroup.add(bodyMesh, neckMesh, flameMesh);
    gasGroup.add(bottleGroup);

    this.markersGroup.add(gasGroup);
    this.worldMarkers.push({
      id: 'vice_gas_molotov',
      type: 'molotov_station',
      label: "ARGON GAS '86 — MOLOTOV PUMP",
      x: 62,
      z: -42,
      radius: 4.5,
      color: '#00f6ff',
      group: gasGroup,
      spinner: bottleGroup,
      ring: ringMesh
    });

    // 2. Street Contraband Dealers (5 Districts)
    for (const dealer of DEALERS) {
      const dGroup = new THREE.Group();
      dGroup.position.set(dealer.x, 0.08, dealer.z);

      const dRingGeo = new THREE.RingGeometry(1.6, 2.1, 24);
      dRingGeo.rotateX(-Math.PI / 2);
      const dRing = new THREE.Mesh(
        dRingGeo,
        new THREE.MeshBasicMaterial({
          color: dealer.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.82
        })
      );
      dGroup.add(dRing);

      // Floating Neon Briefcase Icon
      const caseGroup = new THREE.Group();
      caseGroup.position.set(0, 1.65, 0);
      const caseBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.6, 0.24),
        new THREE.MeshBasicMaterial({ color: dealer.color })
      );
      const caseOutline = new THREE.Mesh(
        new THREE.BoxGeometry(0.93, 0.68, 0.28),
        new THREE.MeshBasicMaterial({ color: 0x090414, side: THREE.BackSide })
      );
      caseGroup.add(caseBox, caseOutline);
      dGroup.add(caseGroup);

      this.markersGroup.add(dGroup);
      this.worldMarkers.push({
        id: dealer.id,
        type: 'dealer',
        label: `${dealer.name} (${dealer.district})`,
        x: dealer.x,
        z: dealer.z,
        radius: 3.6,
        color: dealer.color,
        dealerData: dealer,
        group: dGroup,
        spinner: caseGroup,
        ring: dRing
      });
    }

    // 3. Starfish Island Safehouse Vault Marker (x: -30, z: -8)
    const safeGroup = new THREE.Group();
    safeGroup.position.set(-30, 0.08, -8);
    const safeRingGeo = new THREE.RingGeometry(1.9, 2.45, 28);
    safeRingGeo.rotateX(-Math.PI / 2);
    const safeRing = new THREE.Mesh(
      safeRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffe600,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    );
    safeGroup.add(safeRing);

    const vaultSpinner = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe600, wireframe: false })
    );
    vaultSpinner.position.y = 1.75;
    safeGroup.add(vaultSpinner);
    this.markersGroup.add(safeGroup);
    this.worldMarkers.push({
      id: 'starfish_safehouse_vault',
      type: 'safehouse_stash',
      label: 'STARFISH MANSION VAULT STASH',
      x: -30,
      z: -8,
      radius: 3.8,
      color: '#ffe600',
      group: safeGroup,
      spinner: vaultSpinner,
      ring: safeRing
    });

    // 4. Dumpster Diving & Beach Cooler Stash Spots
    for (const stash of STASH_SPOTS) {
      const sGroup = new THREE.Group();
      sGroup.position.set(stash.x, 0.08, stash.z);

      const isDumpster = stash.type === 'dumpster';
      const propColor = isDumpster ? 0x2ec4b6 : 0xff2a9d;

      // Physical 3D Dumpster or Beach Cooler prop with comic outline
      const propBox = new THREE.Mesh(
        new THREE.BoxGeometry(isDumpster ? 1.8 : 1.1, isDumpster ? 1.15 : 0.7, isDumpster ? 1.1 : 0.75),
        new THREE.MeshBasicMaterial({ color: propColor })
      );
      propBox.position.y = isDumpster ? 0.58 : 0.35;
      const propOutline = new THREE.Mesh(
        new THREE.BoxGeometry(isDumpster ? 1.92 : 1.2, isDumpster ? 1.25 : 0.8, isDumpster ? 1.2 : 0.85),
        new THREE.MeshBasicMaterial({ color: 0x05020a, side: THREE.BackSide })
      );
      propOutline.position.copy(propBox.position);
      sGroup.add(propBox, propOutline);

      const sRingGeo = new THREE.RingGeometry(1.5, 1.95, 20);
      sRingGeo.rotateX(-Math.PI / 2);
      const sRing = new THREE.Mesh(
        sRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0x39ff14,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.78
        })
      );
      sGroup.add(sRing);

      const starLoot = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshBasicMaterial({ color: 0x39ff14 })
      );
      starLoot.position.y = 1.75;
      sGroup.add(starLoot);

      this.markersGroup.add(sGroup);
      this.worldMarkers.push({
        id: stash.id,
        type: stash.type,
        label: stash.name,
        x: stash.x,
        z: stash.z,
        radius: 3.4,
        color: '#39ff14',
        stashData: stash,
        group: sGroup,
        spinner: starLoot,
        ring: sRing
      });
    }

    // 5. Three Rotating Neon-Magenta Rampage Skull Markers
    for (const key of Object.keys(RAMPAGE_DEFS)) {
      const rDef = RAMPAGE_DEFS[key];
      const rGroup = new THREE.Group();
      rGroup.position.set(rDef.x, 0.08, rDef.z);

      const rRingGeo = new THREE.RingGeometry(1.8, 2.35, 28);
      rRingGeo.rotateX(-Math.PI / 2);
      const rRing = new THREE.Mesh(
        rRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff006e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9
        })
      );
      rGroup.add(rRing);

      // Stylized 3D Neon Skull Token
      const skullGroup = new THREE.Group();
      skullGroup.position.set(0, 1.8, 0);
      const cranium = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.52, 0),
        new THREE.MeshBasicMaterial({ color: 0xff006e })
      );
      const jaw = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.32, 0.42),
        new THREE.MeshBasicMaterial({ color: 0xffbe0b })
      );
      jaw.position.set(0, -0.38, 0.08);
      const eyeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.16),
        new THREE.MeshBasicMaterial({ color: 0x08020f })
      );
      eyeL.position.set(-0.16, 0.05, 0.44);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.16;
      skullGroup.add(cranium, jaw, eyeL, eyeR);
      rGroup.add(skullGroup);

      this.markersGroup.add(rGroup);
      this.worldMarkers.push({
        id: rDef.id,
        type: 'rampage',
        label: `RAMPAGE: ${rDef.title}`,
        x: rDef.x,
        z: rDef.z,
        radius: 3.6,
        color: '#ff006e',
        rampageDef: rDef,
        group: rGroup,
        spinner: skullGroup,
        ring: rRing
      });
    }

    // 6. 3D Neon Directional GPS Arrow & Destination Pillar
    const arrowGroup = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.35, 6),
      new THREE.MeshBasicMaterial({ color: 0x00f6ff })
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = 0.45;
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.95),
      new THREE.MeshBasicMaterial({ color: 0xffe600 })
    );
    tail.position.z = -0.35;
    arrowGroup.add(cone, tail);
    arrowGroup.visible = false;
    this.waypointArrowMesh = arrowGroup;
    this.markersGroup.add(arrowGroup);

    const beaconGeo = new THREE.CylinderGeometry(0.55, 1.4, 26, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x00f6ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.waypointBeaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.waypointBeaconMesh.position.y = 13;
    this.waypointBeaconMesh.visible = false;
    this.markersGroup.add(this.waypointBeaconMesh);
  }

  // ============================================================================
  // 10 COLLECTIBLE 3D JADE TIKI STATUES (HIDDEN PACKAGES) & EASTER EGG LANDMARKS
  // ============================================================================

  _initHiddenTikiPackages() {
    this.tikiPackages = [];
    this.tikiCollectedCount = 0;

    for (let i = 0; i < TIKI_PACKAGE_DEFS.length; i++) {
      const def = TIKI_PACKAGE_DEFS[i];
      const tikiGroup = new THREE.Group();
      tikiGroup.name = `HiddenTikiPackage_${def.id}`;
      tikiGroup.position.set(def.x, 0.08, def.z);

      // Ground pulsing gold & neon-emerald aura rings
      const outerRingGeo = new THREE.RingGeometry(1.15, 1.58, 24);
      outerRingGeo.rotateX(-Math.PI / 2);
      const outerRing = new THREE.Mesh(
        outerRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0x39ff14,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.86
        })
      );
      tikiGroup.add(outerRing);

      const innerGoldRingGeo = new THREE.RingGeometry(0.68, 0.92, 20);
      innerGoldRingGeo.rotateX(-Math.PI / 2);
      const innerGoldRing = new THREE.Mesh(
        innerGoldRingGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffe600,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        })
      );
      innerGoldRing.position.y = 0.02;
      tikiGroup.add(innerGoldRing);

      // Rotating & bobbing carved Polynesian Jade Tiki Statue totem
      const totemSpinner = new THREE.Group();
      totemSpinner.position.set(0, 1.45, 0);

      // Comic black BackSide outline for the jade body
      const bodyOutline = new THREE.Mesh(
        new THREE.CylinderGeometry(0.50, 0.56, 1.46, 8),
        new THREE.MeshBasicMaterial({ color: 0x05020a, side: THREE.BackSide })
      );
      // Glowing Neon-Emerald Jade carved cylinder body
      const bodyCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.48, 1.34, 8),
        new THREE.MeshBasicMaterial({ color: 0x18e85e })
      );

      // Polynesian Gold Feather Crest / Crown
      const crestOutline = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 0.36, 0.62),
        new THREE.MeshBasicMaterial({ color: 0x05020a, side: THREE.BackSide })
      );
      crestOutline.position.set(0, 0.76, 0);
      const crestGold = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.28, 0.52),
        new THREE.MeshBasicMaterial({ color: 0xffe600 })
      );
      crestGold.position.set(0, 0.76, 0);

      // Carved Jade Brow Ridge & Cheek Flanges
      const browMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 0.16, 0.58),
        new THREE.MeshBasicMaterial({ color: 0x0a8754 })
      );
      browMesh.position.set(0, 0.34, 0.12);

      // Glowing Gold/Ruby Polynesian Mask Eyes
      const eyeGeo = new THREE.BoxGeometry(0.19, 0.14, 0.14);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.18, 0.16, 0.44);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.18, 0.16, 0.44);

      // Carved Tiki Nose & Grimacing Gold Mouth
      const noseMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.26, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x39ff14 })
      );
      noseMesh.position.set(0, 0.02, 0.46);

      const mouthMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.22, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xffe600 })
      );
      mouthMesh.position.set(0, -0.26, 0.43);

      // Floating Gold Halo Ring orbiting the Tiki Totem
      const haloRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.74, 0.055, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe600 })
      );
      haloRing.rotation.x = Math.PI / 2;
      haloRing.position.y = 0.05;

      totemSpinner.add(
        bodyOutline,
        bodyCore,
        crestOutline,
        crestGold,
        browMesh,
        eyeL,
        eyeR,
        noseMesh,
        mouthMesh,
        haloRing
      );
      tikiGroup.add(totemSpinner);

      if (this.scene) {
        this.markersGroup.add(tikiGroup);
      }

      this.tikiPackages.push({
        id: def.id,
        name: def.name,
        district: def.district,
        x: def.x,
        z: def.z,
        hint: def.hint,
        collected: false,
        mesh: tikiGroup,
        spinner: totemSpinner,
        ring: outerRing
      });
    }
  }

  _initEasterEggLandmarks() {
    this.easterEggs = EASTER_EGG_DEFS.map((def) => ({
      ...def,
      discovered: false
    }));
    this.discoveredEggsCount = 0;
  }

  _checkEasterEggDiscoveries(playerState) {
    if (!playerState || !this.easterEggs || this.easterEggs.length === 0) return;
    const px =
      (playerState && (playerState.x ?? (playerState.position && playerState.position.x))) ?? 0;
    const pz =
      (playerState && (playerState.z ?? (playerState.position && playerState.position.z))) ?? 0;

    for (const egg of this.easterEggs) {
      if (egg.discovered) continue;
      const dist = Math.hypot(px - egg.x, pz - egg.z);
      if (dist <= 11.0) {
        egg.discovered = true;
        this.discoveredEggsCount++;
        this._addPlayerCash(playerState, 1000, `EASTER EGG: ${egg.name.toUpperCase()}`);
        this.callbacks.onCallout?.(
          'EASTER EGG DISCOVERED! +$1,000',
          `${egg.name.toUpperCase()} — ${egg.subtitle}`,
          '#ffe600'
        );
        this.callbacks.onPlaySFX?.('cash');
        if (this.pdaOpen) {
          this._renderPDAContent();
        }
      }
    }
  }

  // ============================================================================
  // DOM & CSS INJECTION (MINI-GAME CANVAS MODAL, 1986 PAGER/PDA, RAMPAGE & COMBO HUD)
  // ============================================================================

  _injectStylesAndDOM() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('vc-minigames-pda-styles')) {
      const style = document.createElement('style');
      style.id = 'vc-minigames-pda-styles';
      style.textContent = `
        #vc-minigame-modal, #vc-pda-modal {
          position: fixed;
          inset: 0;
          z-index: 9500;
          display: none;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, rgba(16, 4, 34, 0.82) 0%, rgba(4, 2, 10, 0.94) 100%);
          backdrop-filter: blur(4px);
          font-family: 'Impact', 'Arial Black', 'Trebuchet MS', sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        #vc-minigame-modal.vc-open, #vc-pda-modal.vc-open {
          display: flex;
        }
        .vc-comic-window {
          position: relative;
          width: min(760px, 94vw);
          background: linear-gradient(165deg, #16082c 0%, #0b0418 65%, #1d0936 100%);
          border: 4px solid #00f6ff;
          box-shadow:
            0 0 0 4px #05020a,
            8px 8px 0 0 #ff2a9d,
            0 0 36px rgba(0, 246, 255, 0.45);
          border-radius: 6px;
          overflow: hidden;
          color: #ffffff;
        }
        .vc-scanlines::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0) 0px,
            rgba(255, 255, 255, 0) 2px,
            rgba(0, 0, 0, 0.24) 3px,
            rgba(0, 0, 0, 0.24) 4px
          );
          z-index: 20;
        }
        .vc-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: linear-gradient(90deg, #ff2a9d 0%, #9b00e8 55%, #00b8ff 100%);
          border-bottom: 4px solid #05020a;
          text-shadow: 2px 2px 0 #05020a;
        }
        .vc-modal-title {
          font-size: 24px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #ffe600;
        }
        .vc-modal-subtitle {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          background: rgba(5, 2, 10, 0.65);
          padding: 3px 9px;
          border: 2px solid #ffe600;
          border-radius: 3px;
        }
        .vc-modal-body {
          padding: 16px 20px;
          position: relative;
        }
        #vc-minigame-canvas {
          display: block;
          width: 100%;
          height: 360px;
          background: #0d061a;
          border: 3px solid #ffe600;
          box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.85);
          cursor: pointer;
          touch-action: none;
        }
        .vc-minigame-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 12px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
        }
        .vc-btn {
          font-family: 'Impact', 'Arial Black', sans-serif;
          font-size: 15px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 7px 14px;
          border: 3px solid #05020a;
          background: #ffe600;
          color: #05020a;
          box-shadow: 3px 3px 0 #ff2a9d;
          cursor: pointer;
          transition: transform 0.08s ease;
        }
        .vc-btn:hover {
          transform: translate(-1px, -1px);
          background: #00f6ff;
        }
        .vc-btn:active {
          transform: translate(2px, 2px);
        }
        .vc-btn-pink {
          background: #ff2a9d;
          color: #ffffff;
          box-shadow: 3px 3px 0 #00f6ff;
        }
        .vc-btn-green {
          background: #39ff14;
          color: #05020a;
          box-shadow: 3px 3px 0 #05020a;
        }
        .vc-btn-cyan {
          background: #00f6ff;
          color: #05020a;
          box-shadow: 3px 3px 0 #ff2a9d;
        }

        /* 1986 PAGER / PDA STYLES */
        .vc-pda-tabs {
          display: flex;
          gap: 8px;
          padding: 10px 18px;
          background: #090314;
          border-bottom: 3px solid #00f6ff;
          flex-wrap: wrap;
        }
        .vc-pda-tab {
          flex: 1;
          min-width: 135px;
          text-align: center;
          padding: 8px 10px;
          font-size: 15px;
          letter-spacing: 1px;
          background: #1a0b33;
          color: #b8c7e0;
          border: 2px solid #3c1e6e;
          cursor: pointer;
          text-transform: uppercase;
        }
        .vc-pda-tab.active {
          background: #ffe600;
          color: #05020a;
          border-color: #05020a;
          box-shadow: 3px 3px 0 #ff2a9d;
        }
        .vc-pda-stats-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px 18px;
          background: #120624;
          border-bottom: 2px solid rgba(0, 246, 255, 0.35);
          font-family: 'Courier New', monospace;
          font-size: 13px;
          font-weight: 700;
        }
        .vc-pda-panel {
          padding: 14px 18px;
          max-height: 410px;
          overflow-y: auto;
          font-family: 'Courier New', monospace;
        }
        .vc-pager-card {
          background: rgba(18, 9, 38, 0.92);
          border: 2px solid #00f6ff;
          border-left: 8px solid #ff2a9d;
          padding: 10px 14px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .vc-market-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .vc-market-table th {
          text-align: left;
          padding: 7px 8px;
          background: #230c45;
          color: #ffe600;
          border-bottom: 2px solid #00f6ff;
          font-family: 'Impact', sans-serif;
          letter-spacing: 0.8px;
          font-weight: normal;
        }
        .vc-market-table td {
          padding: 8px;
          border-bottom: 1px solid rgba(0, 246, 255, 0.22);
          vertical-align: middle;
        }
        .vc-badge {
          display: inline-block;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 800;
          border-radius: 3px;
          color: #05020a;
          background: #00f6ff;
        }

        /* CONTEXTUAL PROXIMITY BANNER & RAMPAGE / COMBO OVERLAY */
        #vc-economy-prompt {
          position: fixed;
          bottom: 94px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8200;
          display: none;
          align-items: center;
          gap: 12px;
          padding: 9px 18px;
          background: rgba(11, 4, 24, 0.92);
          border: 3px solid #ffe600;
          box-shadow: 0 0 0 3px #05020a, 5px 5px 0 #ff2a9d;
          color: #ffffff;
          font-family: 'Impact', 'Arial Black', sans-serif;
          font-size: 18px;
          letter-spacing: 1px;
          pointer-events: auto;
          cursor: pointer;
        }
        #vc-rampage-banner {
          position: fixed;
          top: 82px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8100;
          display: none;
          flex-direction: column;
          align-items: center;
          min-width: 340px;
          padding: 8px 20px;
          background: linear-gradient(180deg, rgba(28, 4, 42, 0.94), rgba(10, 2, 18, 0.94));
          border: 3px solid #ff006e;
          box-shadow: 0 0 0 3px #05020a, 5px 5px 0 #ffe600;
          font-family: 'Impact', 'Arial Black', sans-serif;
          color: #ffffff;
          pointer-events: none;
        }
        #vc-combo-popup {
          position: fixed;
          top: 235px;
          right: 24px;
          z-index: 8150;
          display: none;
          padding: 7px 14px;
          background: #ffe600;
          color: #05020a;
          border: 3px solid #05020a;
          box-shadow: 5px 5px 0 #ff006e;
          font-family: 'Impact', 'Arial Black', sans-serif;
          font-size: 22px;
          letter-spacing: 1.2px;
          transform: rotate(-3deg);
          pointer-events: none;
          text-shadow: none;
        }
      `;
      document.head.appendChild(style);
    }

    // 1. Mini-Game Modal (#vc-minigame-modal)
    let mgModal = document.getElementById('vc-minigame-modal');
    if (!mgModal) {
      mgModal = document.createElement('div');
      mgModal.id = 'vc-minigame-modal';
      mgModal.innerHTML = `
        <div class="vc-comic-window vc-scanlines">
          <div class="vc-modal-header">
            <div>
              <div class="vc-modal-title" id="vc-mg-title">GRAND THEFT ARGON MINI-GAME</div>
              <div id="vc-mg-desc" style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#fff;text-shadow:1px 1px 0 #05020a;"></div>
            </div>
            <div class="vc-modal-subtitle" id="vc-mg-stage">STAGE 1 / 3</div>
          </div>
          <div class="vc-modal-body">
            <canvas id="vc-minigame-canvas" width="700" height="360"></canvas>
            <div class="vc-minigame-footer">
              <div id="vc-mg-hint" style="color:#00f6ff;font-weight:700;">
                TIP: Click/Drag on Canvas or press [SPACE] / [1][2][3] to perform action!
              </div>
              <div style="display:flex;gap:8px;">
                <button type="button" class="vc-btn vc-btn-green" id="vc-mg-instant-btn" title="Deterministic Quick Complete">[SPACE] ACTION / AUTO-COMPLETE</button>
                <button type="button" class="vc-btn vc-btn-pink" id="vc-mg-cancel-btn">[ESC] ABORT</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(mgModal);
    }
    this.mgModalEl = mgModal;
    this.mgCanvas = document.getElementById('vc-minigame-canvas');
    this.mgCtx = this.mgCanvas ? this.mgCanvas.getContext('2d') : null;

    // 2. 1986 Argon City Pager / PDA Modal (#vc-pda-modal)
    let pdaModal = document.getElementById('vc-pda-modal');
    if (!pdaModal) {
      pdaModal = document.createElement('div');
      pdaModal.id = 'vc-pda-modal';
      pdaModal.innerHTML = `
        <div class="vc-comic-window vc-scanlines" style="width:min(840px, 95vw);">
          <div class="vc-modal-header">
            <div>
              <div class="vc-modal-title">📟 1986 MOTOROLA VICE-PAGER & CONTRABAND PDA</div>
              <div style="font-family:'Courier New',monospace;font-size:12px;font-weight:800;color:#05020a;background:#ffe600;display:inline-block;padding:2px 8px;margin-top:3px;text-shadow:none;border:1.5px solid #05020a;">
                ENCRYPTED SYNDICATE NETWORK // FREQ 86.5 MHz
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="vc-modal-subtitle" id="vc-pda-district-badge">TURF: OCEAN BEACH</div>
              <button type="button" class="vc-btn vc-btn-pink" id="vc-pda-close-btn">[P / ESC] CLOSE</button>
            </div>
          </div>

          <div class="vc-pda-tabs">
            <button type="button" class="vc-pda-tab active" data-tab="tips">✉️ PAGER TIPS (59)</button>
            <button type="button" class="vc-pda-tab" data-tab="market">💼 CONTRABAND MARKET</button>
            <button type="button" class="vc-pda-tab" data-tab="stash">🏛️ SAFEHOUSE VAULT</button>
            <button type="button" class="vc-pda-tab" data-tab="rampages">💀 VICE RAMPAGES (3)</button>
          </div>

          <div class="vc-pda-stats-bar" id="vc-pda-stats-bar"></div>
          <div class="vc-pda-panel" id="vc-pda-content"></div>
        </div>
      `;
      document.body.appendChild(pdaModal);
    }
    this.pdaModalEl = pdaModal;

    // 3. Contextual Proximity Prompt Banner (#vc-economy-prompt)
    let ctxPrompt = document.getElementById('vc-economy-prompt');
    if (!ctxPrompt) {
      ctxPrompt = document.createElement('div');
      ctxPrompt.id = 'vc-economy-prompt';
      document.body.appendChild(ctxPrompt);
    }
    this.ctxPromptEl = ctxPrompt;

    // 4. Active Rampage & Combo Overlays
    let rampBanner = document.getElementById('vc-rampage-banner');
    if (!rampBanner) {
      rampBanner = document.createElement('div');
      rampBanner.id = 'vc-rampage-banner';
      document.body.appendChild(rampBanner);
    }
    this.rampageBannerEl = rampBanner;

    let comboPopup = document.getElementById('vc-combo-popup');
    if (!comboPopup) {
      comboPopup = document.createElement('div');
      comboPopup.id = 'vc-combo-popup';
      document.body.appendChild(comboPopup);
    }
    this.comboPopupEl = comboPopup;
  }

  _bindGlobalEvents() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Mini-game buttons
    const instantBtn = document.getElementById('vc-mg-instant-btn');
    if (instantBtn) {
      instantBtn.addEventListener('click', () => {
        this._advanceOrCompleteMiniGameStep();
      });
    }
    const cancelBtn = document.getElementById('vc-mg-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.cancelActiveMiniGame();
      });
    }

    // PDA close & tabs
    const pdaCloseBtn = document.getElementById('vc-pda-close-btn');
    if (pdaCloseBtn) {
      pdaCloseBtn.addEventListener('click', () => this.togglePDA(false));
    }
    if (this.pdaModalEl) {
      const tabBtns = this.pdaModalEl.querySelectorAll('.vc-pda-tab');
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activePDATab = btn.getAttribute('data-tab') || 'tips';
          this._playSFX('ui_tab');
          this._renderPDAContent();
        });
      });
    }

    // Contextual prompt click
    if (this.ctxPromptEl) {
      this.ctxPromptEl.addEventListener('click', () => {
        this._triggerNearbyContext();
      });
    }

    // Canvas pointer interaction
    if (this.mgCanvas) {
      const getCanvasPos = (clientX, clientY) => {
        const rect = this.mgCanvas.getBoundingClientRect();
        return {
          x: ((clientX - rect.left) / Math.max(1, rect.width)) * this.mgCanvas.width,
          y: ((clientY - rect.top) / Math.max(1, rect.height)) * this.mgCanvas.height
        };
      };

      this.mgCanvas.addEventListener('pointerdown', (e) => {
        if (!this.activeMiniGame) return;
        const pos = getCanvasPos(e.clientX, e.clientY);
        this.pointerState.down = true;
        this.pointerState.x = pos.x;
        this.pointerState.y = pos.y;
        this.pointerState.startX = pos.x;
        this.pointerState.startY = pos.y;
        this._handleMiniGamePointerDown(pos.x, pos.y);
      });

      window.addEventListener('pointermove', (e) => {
        if (!this.activeMiniGame || !this.pointerState.down) return;
        const pos = getCanvasPos(e.clientX, e.clientY);
        this.pointerState.x = pos.x;
        this.pointerState.y = pos.y;
        this._handleMiniGamePointerMove(pos.x, pos.y);
      });

      window.addEventListener('pointerup', () => {
        if (!this.activeMiniGame) return;
        this.pointerState.down = false;
      });
    }

    // Keyboard shortcuts for PDA (P), Mini-Games (Space / 1 / 2 / 3 / Escape), and Context (E)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' && !this.activeMiniGame) {
        e.preventDefault();
        this.togglePDA();
        return;
      }

      if (e.code === 'Escape') {
        if (this.activeMiniGame) {
          e.preventDefault();
          this.cancelActiveMiniGame();
          return;
        }
        if (this.pdaOpen) {
          e.preventDefault();
          this.togglePDA(false);
          return;
        }
      }

      if (this.activeMiniGame) {
        if (
          e.code === 'Space' ||
          e.code === 'Digit1' ||
          e.code === 'Digit2' ||
          e.code === 'Digit3' ||
          e.code === 'Enter'
        ) {
          e.preventDefault();
          this._advanceOrCompleteMiniGameStep();
        }
        return;
      }

      if (!this.pdaOpen && (e.code === 'KeyE' || e.code === 'KeyB')) {
        if (this.nearbyContext && this.interactCooldown <= 0) {
          this._triggerNearbyContext();
        }
      }
    });
  }

  // ============================================================================
  // HELPER CALLBACKS (CASH, SFX, VOICE, CALLOUTS, WAYPOINTS)
  // ============================================================================

  _playSFX(name) {
    if (this.callbacks.onPlaySFX) {
      try {
        this.callbacks.onPlaySFX(name);
      } catch (_) {}
    }
  }

  _playVoice(line, speaker = 'PAGER') {
    if (this.callbacks.onPlayVoice) {
      try {
        this.callbacks.onPlayVoice(line, speaker);
      } catch (_) {}
    }
  }

  _callout(text, speaker = 'VICE PAGER', color = '#00f6ff') {
    if (this.callbacks.onCallout) {
      try {
        this.callbacks.onCallout(text, speaker, color);
      } catch (_) {}
    }
  }

  _getPlayerCash(playerState) {
    const ps = playerState || this.lastPlayerState;
    if (ps && typeof ps.cash === 'number') return ps.cash;
    if (ps && typeof ps.money === 'number') return ps.money;
    if (this.combatSystem && typeof this.combatSystem.cash === 'number') return this.combatSystem.cash;
    return this._internalCash ?? 2500;
  }

  _addPlayerCash(arg1, arg2 = '', arg3 = '') {
    let ps = this.lastPlayerState;
    let delta = 0;
    let reason = '';
    if (typeof arg1 === 'object' && arg1 !== null) {
      ps = arg1;
      delta = Number(arg2) || 0;
      reason = String(arg3 || '');
    } else {
      delta = Number(arg1) || 0;
      reason = String(arg2 || '');
    }

    if (this.combatSystem && typeof this.combatSystem.addCash === 'function') {
      try {
        this.combatSystem.addCash(delta);
      } catch (_) {}
    }
    if (ps) {
      if (typeof ps.cash === 'number') {
        ps.cash = Math.max(0, ps.cash + delta);
      } else if (typeof ps.money === 'number') {
        ps.money = Math.max(0, ps.money + delta);
      } else {
        ps.cash = Math.max(0, 2500 + delta);
      }
    }
    this._internalCash = Math.max(0, (this._internalCash ?? 2500) + delta);
    if (this.callbacks.onCashChange) {
      try {
        this.callbacks.onCashChange(delta, reason, this._getPlayerCash(ps));
      } catch (_) {}
    }
  }

  _grantWeaponOrAmmo(weaponId, ammoAmount = 6) {
    const resolvedId =
      weaponId === 'chainsaw' ? 'stun_baton' : weaponId === 'python' ? 'revolver' : weaponId;
    if (this.combatSystem) {
      if (resolvedId === 'molotov' && typeof this.combatSystem.addMolotovs === 'function') {
        this.combatSystem.addMolotovs(ammoAmount);
      } else if (typeof this.combatSystem.addAmmo === 'function') {
        this.combatSystem.addAmmo(resolvedId, ammoAmount);
      } else if (typeof this.combatSystem.addWeaponAmmo === 'function') {
        this.combatSystem.addWeaponAmmo(resolvedId, ammoAmount);
      } else if (typeof this.combatSystem.giveWeapon === 'function') {
        this.combatSystem.giveWeapon(resolvedId, ammoAmount);
      } else if (typeof this.combatSystem.unlockWeapon === 'function') {
        this.combatSystem.unlockWeapon(resolvedId, ammoAmount);
      } else if (this.combatSystem.weapons && this.combatSystem.weapons[resolvedId]) {
        const w = this.combatSystem.weapons[resolvedId];
        w.unlocked = true;
        if (typeof w.ammo === 'number') w.ammo += ammoAmount;
      }
    }
    const ps = this.lastPlayerState;
    if (ps && ps.weapons && ps.weapons[resolvedId]) {
      ps.weapons[resolvedId].unlocked = true;
      ps.weapons[resolvedId].ammo = (ps.weapons[resolvedId].ammo || 0) + ammoAmount;
    }
  }

  _triggerPoliceWanted(minStars = 1, reason = 'ACPD METRO DISPATCH') {
    const ps = this.lastPlayerState;
    if (ps && typeof ps.wantedStars === 'number') {
      ps.wantedStars = Math.max(ps.wantedStars, minStars);
    }
    if (this.combatSystem && typeof this.combatSystem.setWantedLevel === 'function') {
      this.combatSystem.setWantedLevel(minStars, reason);
    } else if (this.combatSystem && typeof this.combatSystem.addWantedStars === 'function') {
      this.combatSystem.addWantedStars(minStars);
    }
  }

  // ============================================================================
  // PUBLIC MODAL STATE & INSTANT TEST COMPLETION
  // ============================================================================

  isModalOpen() {
    return Boolean(this.activeMiniGame || this.pdaOpen);
  }

  closeActiveModal() {
    if (this.activeMiniGame) this.cancelActiveMiniGame();
    if (this.pdaOpen) this.togglePDA(false);
  }

  completeActiveMiniGameInstantly() {
    if (!this.activeMiniGame) return false;
    this._finishMiniGameSuccess();
    return true;
  }

  cancelActiveMiniGame() {
    if (!this.activeMiniGame) return;
    const cb = this.activeMiniGame.onCancel;
    this.activeMiniGame = null;
    if (this.mgModalEl) this.mgModalEl.classList.remove('vc-open');
    this.interactCooldown = 1.2;
    this._playSFX('ui_cancel');
    if (typeof cb === 'function') {
      try {
        cb();
      } catch (_) {}
    }
  }

  // ============================================================================
  // MINI-GAME 1: HOTWIRING 80s EXOTICS (CHEETAH / INFERNUS)
  // ============================================================================

  startHotwireMiniGame(vehicle, onSuccess, onCancel) {
    if (this.pdaOpen) this.togglePDA(false);
    const carName = (vehicle && (vehicle.name || vehicle.model || vehicle.type)) || '80s V12 EXOTIC SUPERCAR';

    this.activeMiniGame = {
      type: 'hotwire',
      title: `HOTWIRE EXOTIC: ${String(carName).toUpperCase()}`,
      subtitle: 'Bypass the 1986 Alpine Alarm before ACPD Dispatch arrives!',
      stage: 1,
      maxStage: 3,
      timer: 18.0,
      maxTimer: 18.0,
      vehicle,
      onSuccess,
      onCancel,
      sparks: [],
      data: {
        screws: [
          { x: 195, y: 85, unscrewed: false },
          { x: 505, y: 85, unscrewed: false },
          { x: 195, y: 275, unscrewed: false },
          { x: 505, y: 275, unscrewed: false }
        ],
        wires: [
          { id: 'pink', label: 'IGNITION 12V (NEON PINK)', y: 135, color: '#ff2a9d', progress: 0, twisted: false },
          { id: 'cyan', label: 'STARTER SOLENOID (ELECTRIC CYAN)', y: 225, color: '#00f6ff', progress: 0, twisted: false }
        ],
        fuseTurn: 0
      }
    };

    this._openMiniGameModal();
    this._playSFX('alarm_chirp');
    this._callout(`HOTWIRING ${String(carName).toUpperCase()} — POP THE COLUMN & TWIST IGNITION WIRES!`, 'STREET MECHANIC');
  }

  // ============================================================================
  // MINI-GAME 2: GAS STATION MOLOTOV ASSEMBLY (ARGON GAS '86)
  // ============================================================================

  startMolotovMiniGame(onSuccess, onCancel) {
    if (this.pdaOpen) this.togglePDA(false);

    this.activeMiniGame = {
      type: 'molotov',
      title: "ARGON GAS '86 — HIGH-OCTANE MOLOTOV ASSEMBLY",
      subtitle: 'Fill 3 glass bottles to the green 85% target zone, stuff paisley wicks & flick the lighter!',
      stage: 1,
      maxStage: 2,
      timer: 25.0,
      maxTimer: 25.0,
      onSuccess,
      onCancel,
      sparks: [],
      data: {
        activeBottle: 0,
        bottles: [
          { x: 185, fill: 0.15, wicked: false, lit: false },
          { x: 350, fill: 0.10, wicked: false, lit: false },
          { x: 515, fill: 0.12, wicked: false, lit: false }
        ],
        lighterFlicked: false
      }
    };

    this._openMiniGameModal();
    this._playSFX('gas_pump');
    this._callout("ARGON GAS '86: PUMP OCTANE INTO BOTTLES & STUFF BANDANA WICKS FOR +6 MOLOTOVS!", 'UMBERTO');
  }

  // ============================================================================
  // MINI-GAME 3: DUMPSTER DIVING & BEACH COOLER STASH SEARCH
  // ============================================================================

  startStashMiniGame(stashInfo = {}, onSuccess, onCancel) {
    if (this.pdaOpen) this.togglePDA(false);
    const isBeach = stashInfo && stashInfo.type === 'beach_stash';
    const stashTitle = (stashInfo && stashInfo.name) || (isBeach ? 'OCEAN BEACH BURIED COOLER' : 'LITTLE HAITI MOTEL DUMPSTER');

    this.activeMiniGame = {
      type: 'stash',
      title: `STASH RUMMAGE: ${String(stashTitle).toUpperCase()}`,
      subtitle: isBeach
        ? 'Flip the cooler lid & brush aside coconuts and ice packs to grab smuggled loot!'
        : 'Flip the heavy dumpster lid & drag aside trash bags to uncover syndicate contraband!',
      stage: 1,
      maxStage: 2,
      timer: 20.0,
      maxTimer: 20.0,
      stashInfo,
      onSuccess,
      onCancel,
      sparks: [],
      data: {
        isBeach,
        lidOpen: false,
        debris: [
          { id: 0, x: 230, y: 150, r: 54, cleared: false, label: isBeach ? 'ICE PACK' : 'TRASH BAG', color: isBeach ? '#00b4d8' : '#2b9348' },
          { id: 1, x: 355, y: 135, r: 58, cleared: false, label: isBeach ? 'COCONUT HUSK' : 'CARDBOARD', color: isBeach ? '#b08968' : '#bc6c25' },
          { id: 2, x: 470, y: 165, r: 54, cleared: false, label: isBeach ? 'KELP BUNDLE' : 'GARBAGE SACK', color: isBeach ? '#38b000' : '#495057' },
          { id: 3, x: 290, y: 230, r: 56, cleared: false, label: isBeach ? 'DRIFTWOOD' : 'OLD TIRE', color: isBeach ? '#9c6644' : '#343a40' },
          { id: 4, x: 420, y: 235, r: 54, cleared: false, label: isBeach ? 'SEA SHELLS' : 'NEON SCRAP', color: isBeach ? '#ffafcc' : '#7209b7' }
        ],
        lootClaimed: false
      }
    };

    this._openMiniGameModal();
    this._playSFX('stash_open');
    this._callout(`SEARCHING ${String(stashTitle).toUpperCase()} — CLEAR DEBRIS FOR WEAPONS & CONTRABAND!`, 'VICE PAGER');
  }

  _openMiniGameModal() {
    if (!this.mgModalEl || !this.activeMiniGame) return;
    this.mgModalEl.classList.add('vc-open');
    this._syncMiniGameHeader();
    this._renderMiniGameCanvas();
  }

  _syncMiniGameHeader() {
    if (!this.activeMiniGame) return;
    const titleEl = document.getElementById('vc-mg-title');
    const descEl = document.getElementById('vc-mg-desc');
    const stageEl = document.getElementById('vc-mg-stage');
    if (titleEl) titleEl.textContent = this.activeMiniGame.title;
    if (descEl) descEl.textContent = this.activeMiniGame.subtitle;
    if (stageEl) {
      stageEl.textContent = `STAGE ${this.activeMiniGame.stage} / ${this.activeMiniGame.maxStage}  |  ${this.activeMiniGame.timer.toFixed(1)}s`;
    }
  }

  // ============================================================================
  // MINI-GAME INTERACTION & STEP ADVANCEMENT
  // ============================================================================

  _addSparks(x, y, color = '#ffe600', count = 14) {
    if (!this.activeMiniGame) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 60 + Math.random() * 140;
      this.activeMiniGame.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.25,
        color
      });
    }
  }

  _handleMiniGamePointerDown(x, y) {
    const mg = this.activeMiniGame;
    if (!mg) return;

    if (mg.type === 'hotwire') {
      if (mg.stage === 1) {
        // Unscrew the nearest screw or clicked screw
        let hit = false;
        for (const s of mg.data.screws) {
          if (!s.unscrewed && Math.hypot(x - s.x, y - s.y) < 58) {
            s.unscrewed = true;
            hit = true;
            this._addSparks(s.x, s.y, '#00f6ff', 12);
            this._playSFX('ratchet_click');
            break;
          }
        }
        if (!hit) {
          const nextScrew = mg.data.screws.find((s) => !s.unscrewed);
          if (nextScrew) {
            nextScrew.unscrewed = true;
            this._addSparks(nextScrew.x, nextScrew.y, '#00f6ff', 12);
            this._playSFX('ratchet_click');
          }
        }
        if (mg.data.screws.every((s) => s.unscrewed)) {
          mg.stage = 2;
          this._playSFX('panel_pop');
        }
      } else if (mg.stage === 2) {
        for (const w of mg.data.wires) {
          if (!w.twisted && Math.abs(y - w.y) < 55) {
            w.progress = Math.min(1, w.progress + 0.55);
            this._addSparks(350, w.y, w.color, 16);
            this._playSFX('wire_spark');
            if (w.progress >= 1) w.twisted = true;
          }
        }
        if (mg.data.wires.every((w) => w.twisted)) {
          mg.stage = 3;
        }
      } else if (mg.stage === 3) {
        mg.data.fuseTurn = Math.min(1, mg.data.fuseTurn + 0.55);
        this._addSparks(350, 190, '#ffe600', 20);
        this._playSFX('engine_crank');
        if (mg.data.fuseTurn >= 1) {
          this._finishMiniGameSuccess();
        }
      }
    } else if (mg.type === 'molotov') {
      if (mg.stage === 1) {
        // Fill bottles toward 88%
        const b = mg.data.bottles.find((bt) => bt.fill < 0.85);
        if (b) {
          b.fill = Math.min(0.9, b.fill + 0.42);
          this._addSparks(b.x, 180, '#ff9e00', 10);
          this._playSFX('fuel_glug');
        }
        if (mg.data.bottles.every((bt) => bt.fill >= 0.82)) {
          mg.stage = 2;
        }
      } else if (mg.stage === 2) {
        const unwicked = mg.data.bottles.find((bt) => !bt.wicked);
        if (unwicked) {
          unwicked.wicked = true;
          this._addSparks(unwicked.x, 105, '#ff2a9d', 12);
          this._playSFX('cloth_stuff');
        } else {
          mg.data.lighterFlicked = true;
          for (const bt of mg.data.bottles) bt.lit = true;
          this._addSparks(350, 95, '#ffe600', 22);
          this._finishMiniGameSuccess();
        }
      }
    } else if (mg.type === 'stash') {
      if (mg.stage === 1) {
        mg.data.lidOpen = true;
        mg.stage = 2;
        this._addSparks(350, 90, '#39ff14', 16);
        this._playSFX('lid_slam');
      } else if (mg.stage === 2) {
        let hitDebris = mg.data.debris.find((d) => !d.cleared && Math.hypot(x - d.x, y - d.y) <= d.r + 22);
        if (!hitDebris) {
          hitDebris = mg.data.debris.find((d) => !d.cleared);
        }
        if (hitDebris) {
          hitDebris.cleared = true;
          this._addSparks(hitDebris.x, hitDebris.y, '#00f6ff', 14);
          this._playSFX('rummage_toss');
        }
        if (mg.data.debris.every((d) => d.cleared)) {
          this._finishMiniGameSuccess();
        }
      }
    }

    this._syncMiniGameHeader();
    this._renderMiniGameCanvas();
  }

  _handleMiniGamePointerMove(x, y) {
    const mg = this.activeMiniGame;
    if (!mg) return;

    if (mg.type === 'hotwire' && mg.stage === 2) {
      for (const w of mg.data.wires) {
        if (!w.twisted && Math.abs(y - w.y) < 48) {
          w.progress = Math.min(1, w.progress + 0.045);
          if (Math.random() < 0.35) this._addSparks(x, w.y, w.color, 3);
          if (w.progress >= 1) w.twisted = true;
        }
      }
      if (mg.data.wires.every((w) => w.twisted)) mg.stage = 3;
    } else if (mg.type === 'hotwire' && mg.stage === 3) {
      mg.data.fuseTurn = Math.min(1, mg.data.fuseTurn + 0.04);
      if (mg.data.fuseTurn >= 1) this._finishMiniGameSuccess();
    } else if (mg.type === 'molotov' && mg.stage === 1) {
      for (const b of mg.data.bottles) {
        if (Math.abs(x - b.x) < 62 && b.fill < 0.88) {
          b.fill = Math.min(0.9, b.fill + 0.032);
        }
      }
      if (mg.data.bottles.every((bt) => bt.fill >= 0.82)) mg.stage = 2;
    } else if (mg.type === 'stash' && mg.stage === 2) {
      for (const d of mg.data.debris) {
        if (!d.cleared && Math.hypot(x - d.x, y - d.y) < d.r) {
          d.cleared = true;
          this._addSparks(d.x, d.y, '#39ff14', 8);
        }
      }
      if (mg.data.debris.every((d) => d.cleared)) this._finishMiniGameSuccess();
    }
  }

  _advanceOrCompleteMiniGameStep() {
    const mg = this.activeMiniGame;
    if (!mg) return;

    if (mg.type === 'hotwire') {
      if (mg.stage === 1) {
        mg.data.screws.forEach((s) => { s.unscrewed = true; });
        mg.stage = 2;
        this._addSparks(350, 180, '#00f6ff', 18);
      } else if (mg.stage === 2) {
        mg.data.wires.forEach((w) => {
          w.progress = 1;
          w.twisted = true;
        });
        mg.stage = 3;
        this._addSparks(350, 180, '#ff2a9d', 20);
      } else {
        mg.data.fuseTurn = 1;
        this._finishMiniGameSuccess();
        return;
      }
    } else if (mg.type === 'molotov') {
      if (mg.stage === 1) {
        mg.data.bottles.forEach((b) => { b.fill = 0.88; });
        mg.stage = 2;
        this._addSparks(350, 200, '#ff9e00', 18);
      } else {
        mg.data.bottles.forEach((b) => {
          b.wicked = true;
          b.lit = true;
        });
        this._finishMiniGameSuccess();
        return;
      }
    } else if (mg.type === 'stash') {
      if (mg.stage === 1) {
        mg.data.lidOpen = true;
        mg.stage = 2;
      } else {
        mg.data.debris.forEach((d) => { d.cleared = true; });
        this._finishMiniGameSuccess();
        return;
      }
    }

    this._syncMiniGameHeader();
    this._renderMiniGameCanvas();
  }

  _finishMiniGameSuccess() {
    const mg = this.activeMiniGame;
    if (!mg) return;

    const { type, vehicle, stashInfo, onSuccess } = mg;
    this.activeMiniGame = null;
    if (this.mgModalEl) this.mgModalEl.classList.remove('vc-open');
    this.interactCooldown = 1.2;

    if (type === 'hotwire') {
      if (vehicle) {
        vehicle.locked = false;
        vehicle.hotwired = true;
      }
      this._addPlayerCash(350, 'EXOTIC HOTWIRE BONUS');
      this._playSFX('v12_roar');
      this._callout('V12 IGNITION HOTWIRED! EXOTIC SUPERCAR UNLOCKED (+$350)', 'HOTWIRE SUCCESS');
    } else if (type === 'molotov') {
      this._grantWeaponOrAmmo('molotov', 6);
      this._playSFX('molotov_ready');
      this._callout("ARGON GAS '86: +6 HIGH-OCTANE MOLOTOV COCKTAILS ADDED TO INVENTORY!", 'ARMORY');
    } else if (type === 'stash') {
      if (stashInfo && stashInfo.id) {
        this.stashCooldowns.set(stashInfo.id, 45.0);
      }
      this._addPlayerCash(1200, 'STASH CASH BUNDLE');
      this._grantWeaponOrAmmo('mac10', 150);
      this._grantWeaponOrAmmo('python', 18);
      if (this.getBriefcaseUsed() <= this.briefcaseCap - 2) {
        this.briefcase.miami_snow = (this.briefcase.miami_snow || 0) + 1;
        this.briefcase.starfish_dust = (this.briefcase.starfish_dust || 0) + 1;
      }
      this._playSFX('loot_jackpot');
      this._callout(
        'STASH JACKPOT: +$1,200 CASH, MAC-10 (+150 AMMO), COLT PYTHON & 2X CONTRABAND PACKAGES!',
        'STASH FOUND'
      );
    }

    if (typeof onSuccess === 'function') {
      try {
        onSuccess(vehicle || stashInfo || true);
      } catch (_) {}
    }
  }

  // ============================================================================
  // MINI-GAME HTML5 CANVAS RENDERER (COMIC-BOOK GRAND THEFT ARGON STYLE)
  // ============================================================================

  _renderMiniGameCanvas() {
    if (!this.mgCtx || !this.mgCanvas || !this.activeMiniGame) return;
    const ctx = this.mgCtx;
    const w = this.mgCanvas.width;
    const h = this.mgCanvas.height;
    const mg = this.activeMiniGame;

    ctx.clearRect(0, 0, w, h);

    // Retro 80s Sunset Grid Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#140628');
    bgGrad.addColorStop(1, '#070210');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 246, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 35) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 35) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    if (mg.type === 'hotwire') {
      this._drawHotwireCanvas(ctx, w, h, mg);
    } else if (mg.type === 'molotov') {
      this._drawMolotovCanvas(ctx, w, h, mg);
    } else if (mg.type === 'stash') {
      this._drawStashCanvas(ctx, w, h, mg);
    }

    // Alarm / Countdown Bar along bottom of canvas
    const pct = Math.max(0, Math.min(1, mg.timer / mg.maxTimer));
    ctx.fillStyle = '#05020a';
    ctx.fillRect(24, h - 28, w - 48, 16);
    ctx.fillStyle = pct > 0.35 ? '#00f6ff' : '#ff2a9d';
    ctx.fillRect(26, h - 26, (w - 52) * pct, 12);
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, h - 28, w - 48, 16);

    // Electric Sparks Overlay
    for (const sp of mg.sparks) {
      ctx.fillStyle = sp.color;
      ctx.fillRect(sp.x - 3, sp.y - 3, 6, 6);
    }
  }

  _drawHotwireCanvas(ctx, w, h, mg) {
    // 1. 1986 Italian V12 Leather Dashboard & Steering Column Shroud
    ctx.fillStyle = '#181326';
    ctx.strokeStyle = '#00f6ff';
    ctx.lineWidth = 4;
    ctx.fillRect(95, 34, 510, 278);
    ctx.strokeRect(95, 34, 510, 278);

    // Recessed dark steering column cavity showing copper wiring harness underneath
    ctx.fillStyle = '#0c0814';
    ctx.fillRect(125, 58, 450, 230);
    ctx.strokeStyle = '#ff2a9d';
    ctx.lineWidth = 2;
    ctx.strokeRect(125, 58, 450, 230);

    // Alpine '86 Security Relay Module (top-right of cavity, clear of wire labels)
    ctx.fillStyle = '#221b38';
    ctx.fillRect(418, 66, 148, 40);
    ctx.strokeStyle = '#ffe600';
    ctx.strokeRect(418, 66, 148, 40);
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 10px Courier New, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ALPINE-86 IMMOBILIZER', 425, 82);
    ctx.fillStyle = mg.stage >= 3 ? '#39ff14' : '#ff2a9d';
    ctx.fillText(mg.stage >= 3 ? '● RELAY BYPASSED' : '● ARMED // 12V LOCK', 425, 98);

    // Background braided copper/amber/green loom cables running across cavity
    const bgCables = [
      { y: 145, color: '#b87333' },
      { y: 185, color: '#3a5a40' },
      { y: 245, color: '#9c6644' },
    ];
    for (const bc of bgCables) {
      ctx.strokeStyle = bc.color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(128, bc.y);
      ctx.bezierCurveTo(250, bc.y - 16, 420, bc.y + 16, 572, bc.y);
      ctx.stroke();
    }

    if (mg.stage === 1) {
      // Exposed preview of the Neon-Pink & Electric-Cyan ignition wires beneath the cracked shroud
      for (const wire of mg.data.wires) {
        ctx.lineWidth = 10;
        ctx.strokeStyle = wire.color;
        ctx.beginPath();
        ctx.moveTo(135, wire.y + 18);
        ctx.lineTo(315, wire.y + 18);
        ctx.moveTo(385, wire.y + 18);
        ctx.lineTo(565, wire.y + 18);
        ctx.stroke();

        // Exposed copper strands at the cut gap
        ctx.strokeStyle = '#ffaa33';
        ctx.lineWidth = 3;
        for (let k = -6; k <= 6; k += 4) {
          ctx.beginPath();
          ctx.moveTo(315, wire.y + 18 + k);
          ctx.lineTo(334, wire.y + 18 + k * 1.4);
          ctx.moveTo(385, wire.y + 18 + k);
          ctx.lineTo(366, wire.y + 18 + k * 1.4);
          ctx.stroke();
        }
      }

      // Semi-transparent cracked steering column cover plate held by 4 corner screws
      ctx.fillStyle = 'rgba(38, 28, 62, 0.82)';
      ctx.fillRect(165, 62, 370, 222);
      ctx.strokeStyle = '#00f6ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(165, 62, 370, 222);

      // Diagonal stress crack across the plastic column cover
      ctx.strokeStyle = '#ff2a9d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(260, 62);
      ctx.lineTo(340, 155);
      ctx.lineTo(315, 205);
      ctx.lineTo(410, 284);
      ctx.stroke();

      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 17px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE 1: POP ALL 4 STEERING COLUMN SCREWS TO EXPOSE IGNITION LOOM', w / 2, 49);

      for (const s of mg.data.screws) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 24, 0, Math.PI * 2);
        ctx.fillStyle = s.unscrewed ? '#39ff14' : '#ff2a9d';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#05020a';
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y - 10);
        ctx.lineTo(s.x + 10, s.y + 10);
        ctx.moveTo(s.x + 10, s.y - 10);
        ctx.lineTo(s.x - 10, s.y + 10);
        ctx.stroke();
      }
    } else if (mg.stage === 2) {
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 17px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE 2: DRAG ACROSS NEON COPPER WIRES TO STRIP & TWIST IGNITION LEADS', w / 2, 49);

      for (const wire of mg.data.wires) {
        const leftTip = 285 + wire.progress * 65;
        const rightTip = 415 - wire.progress * 65;

        // Thick outer PVC insulation with black comic outline
        ctx.lineWidth = 18;
        ctx.strokeStyle = '#05020a';
        ctx.beginPath();
        ctx.moveTo(132, wire.y + 16);
        ctx.lineTo(leftTip - 18, wire.y + 16);
        ctx.moveTo(568, wire.y + 16);
        ctx.lineTo(rightTip + 18, wire.y + 16);
        ctx.stroke();

        ctx.lineWidth = 12;
        ctx.strokeStyle = wire.color;
        ctx.beginPath();
        ctx.moveTo(132, wire.y + 16);
        ctx.lineTo(leftTip - 18, wire.y + 16);
        ctx.moveTo(568, wire.y + 16);
        ctx.lineTo(rightTip + 18, wire.y + 16);
        ctx.stroke();

        // Braided bare copper strands at tips
        ctx.strokeStyle = '#ffae42';
        ctx.lineWidth = 3.5;
        for (let s = -6; s <= 6; s += 4) {
          ctx.beginPath();
          ctx.moveTo(leftTip - 18, wire.y + 16 + s);
          ctx.lineTo(leftTip + 6, wire.y + 16 + s * (1 - wire.progress * 0.7));
          ctx.moveTo(rightTip + 18, wire.y + 16 + s);
          ctx.lineTo(rightTip - 6, wire.y + 16 + s * (1 - wire.progress * 0.7));
          ctx.stroke();
        }

        // Electric arc lightning across the splice gap!
        ctx.strokeStyle = wire.twisted ? '#39ff14' : '#fff75e';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(leftTip, wire.y + 16);
        ctx.lineTo(350, wire.y + 6);
        ctx.lineTo(350, wire.y + 26);
        ctx.lineTo(rightTip, wire.y + 16);
        ctx.stroke();

        // Exposed copper splice node
        ctx.fillStyle = wire.twisted ? '#39ff14' : '#ffe600';
        ctx.beginPath();
        ctx.arc(350, wire.y + 16, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#05020a';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Courier New, monospace';
        ctx.fillText(
          `${wire.label}: ${Math.round(wire.progress * 100)}% ${wire.twisted ? '[SPLICED!]' : '[DRAG TO TWIST]'}`,
          350,
          wire.y - 14
        );
      }
    } else if (mg.stage === 3) {
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 18px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE 3: TURN FLATHEAD SCREWDRIVER IN IGNITION BARREL TO FIRE V12!', w / 2, 49);

      // Spliced glowing wires feeding into the starter barrel
      for (const wire of mg.data.wires) {
        ctx.lineWidth = 10;
        ctx.strokeStyle = wire.color;
        ctx.beginPath();
        ctx.moveTo(135, wire.y + 16);
        ctx.lineTo(350, 185);
        ctx.stroke();
      }

      // Ignition Cylinder
      ctx.beginPath();
      ctx.arc(350, 185, 66, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd000';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#05020a';
      ctx.stroke();

      // Rotating Screwdriver Slot
      ctx.save();
      ctx.translate(350, 185);
      ctx.rotate(mg.data.fuseTurn * Math.PI * 0.75);
      ctx.fillStyle = '#00f6ff';
      ctx.fillRect(-52, -10, 104, 20);
      ctx.strokeRect(-52, -10, 104, 20);
      ctx.restore();

      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 15px Courier New, monospace';
      ctx.fillText(`STARTER TORQUE: ${Math.round(mg.data.fuseTurn * 100)}%`, 350, 276);
    }
  }

  _drawMolotovCanvas(ctx, w, h, mg) {
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 18px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      mg.stage === 1
        ? "STAGE 1: CLICK / HOLD BOTTLES TO PUMP HIGH-OCTANE GAS TO THE GREEN 85% LINE"
        : "STAGE 2: CLICK BOTTLES TO STUFF PAISLEY BANDANA WICKS & FLICK CHROME LIGHTER!",
      w / 2,
      44
    );

    for (let i = 0; i < mg.data.bottles.length; i++) {
      const b = mg.data.bottles[i];
      const bx = b.x;
      const by = 110;
      const bw = 76;
      const bh = 175;

      // Bottle outline
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = b.fill >= 0.82 ? '#39ff14' : '#00f6ff';
      ctx.lineWidth = 4;
      ctx.fillRect(bx - bw / 2, by, bw, bh);
      ctx.strokeRect(bx - bw / 2, by, bw, bh);

      // Bottle neck
      ctx.strokeRect(bx - 16, by - 36, 32, 36);

      // Liquid gasoline fill
      const fillH = Math.round(bh * b.fill);
      const gasGrad = ctx.createLinearGradient(0, by + bh - fillH, 0, by + bh);
      gasGrad.addColorStop(0, '#ff2a9d');
      gasGrad.addColorStop(1, '#ff9e00');
      ctx.fillStyle = gasGrad;
      ctx.fillRect(bx - bw / 2 + 4, by + bh - fillH, bw - 8, fillH);

      // Target 85% green zone line
      const targetY = by + bh * 0.15;
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - bw / 2 - 8, targetY);
      ctx.lineTo(bx + bw / 2 + 8, targetY);
      ctx.stroke();

      // Bandana Wick
      if (b.wicked) {
        ctx.fillStyle = '#ff2a9d';
        ctx.fillRect(bx - 10, by - 58, 20, 34);
        ctx.strokeStyle = '#ffe600';
        ctx.strokeRect(bx - 10, by - 58, 20, 34);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Courier New, monospace';
      ctx.fillText(
        `BOTTLE #${i + 1}: ${Math.round(b.fill * 100)}% ${b.wicked ? '[WICKED]' : ''}`,
        bx,
        by + bh + 22
      );
    }
  }

  _drawStashCanvas(ctx, w, h, mg) {
    // Container Frame
    ctx.fillStyle = '#14242b';
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 4;
    ctx.fillRect(130, 58, 440, 245);
    ctx.strokeRect(130, 58, 440, 245);

    if (mg.stage === 1 && !mg.data.lidOpen) {
      ctx.fillStyle = mg.data.isBeach ? '#ff2a9d' : '#1b4332';
      ctx.fillRect(140, 68, 420, 225);
      ctx.fillStyle = '#ffe600';
      ctx.font = 'bold 22px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STAGE 1: CLICK OR PRESS [SPACE] TO FLIP OPEN HEAVY STASH LID!', w / 2, 185);
      return;
    }

    // Hidden Loot Layer Underneath
    ctx.fillStyle = '#091318';
    ctx.fillRect(145, 72, 410, 215);

    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 16px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🔫 MAC-10 +150 AMMO   |   🔫 COLT PYTHON', w / 2, 145);
    ctx.fillStyle = '#39ff14';
    ctx.fillText('💵 +$1,200 CASH BUNDLE   |   ❄️ 2X CONTRABAND BRICKS', w / 2, 210);

    // Debris items covering the loot
    for (const d of mg.data.debris) {
      if (d.cleared) continue;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#05020a';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, d.x, d.y + 4);
    }
  }

  // ============================================================================
  // 1986 ARGON CITY PAGER / PDA & CONTRABAND ECONOMY MODAL
  // ============================================================================

  togglePDA(forceState) {
    if (this.activeMiniGame) return false;
    const next = typeof forceState === 'boolean' ? forceState : !this.pdaOpen;
    this.pdaOpen = next;

    if (this.pdaModalEl) {
      if (this.pdaOpen) {
        this.pdaModalEl.classList.add('vc-open');
        this._playSFX('pda_beep');
        this._renderPDAContent();
      } else {
        this.pdaModalEl.classList.remove('vc-open');
        this._playSFX('ui_cancel');
      }
    }
    return this.pdaOpen;
  }

  openPDA(initialTab = 'tips') {
    this.activePDATab = initialTab;
    return this.togglePDA(true);
  }

  closePDA() {
    return this.togglePDA(false);
  }

  openDealerTrade(dealerInfo) {
    if (dealerInfo && dealerInfo.id) {
      this.selectedDealerId = dealerInfo.id;
    } else if (dealerInfo && dealerInfo.district) {
      const found = DEALERS.find(
        (d) => d.district.toLowerCase() === String(dealerInfo.district).toLowerCase()
      );
      if (found) this.selectedDealerId = found.id;
    }
    this.activePDATab = 'market';
    this.togglePDA(true);
  }

  getBriefcaseUsed() {
    let sum = 0;
    for (const c of COMMODITIES) sum += this.briefcase[c.id] || 0;
    return sum;
  }

  getStashUsed() {
    let sum = 0;
    for (const c of COMMODITIES) sum += this.safehouseStash[c.id] || 0;
    return sum;
  }

  _getCurrentDealer() {
    return DEALERS.find((d) => d.id === this.selectedDealerId) || DEALERS[0];
  }

  _renderPDAContent() {
    if (!this.pdaModalEl) return;

    // Sync active tab button styling
    const tabBtns = this.pdaModalEl.querySelectorAll('.vc-pda-tab');
    tabBtns.forEach((btn) => {
      const t = btn.getAttribute('data-tab');
      btn.classList.toggle('active', t === this.activePDATab);
    });

    const dealer = this._getCurrentDealer();
    const badgeEl = document.getElementById('vc-pda-district-badge');
    if (badgeEl) {
      badgeEl.textContent = `TURF: ${this.activeDistrict.toUpperCase()}`;
    }

    const statsBar = document.getElementById('vc-pda-stats-bar');
    if (statsBar) {
      const cash = this._getPlayerCash();
      const bUsed = this.getBriefcaseUsed();
      const sUsed = this.getStashUsed();
      const profitSign = this.netProfit >= 0 ? '+' : '-';
      statsBar.innerHTML = `
        <span style="color:#39ff14;">💵 CASH: $${cash.toLocaleString()}</span>
        <span style="color:#00f6ff;">💼 BRIEFCASE: ${bUsed} / ${this.briefcaseCap}</span>
        <span style="color:#ffe600;">🏛️ VAULT: ${sUsed} / ${this.stashCap}</span>
        <span style="color:#39ff14;">🗿 TIKIS: ${this.tikiCollectedCount} / 10</span>
        <span style="color:#ffe600;">🥚 SECRETS: ${this.discoveredEggsCount} / 6</span>
        <span style="color:${this.netProfit >= 0 ? '#39ff14' : '#ff2a9d'};">📈 PROFIT: ${profitSign}$${Math.abs(this.netProfit).toLocaleString()}</span>
      `;
    }

    const contentEl = document.getElementById('vc-pda-content');
    if (!contentEl) return;

    if (this.activePDATab === 'tips') {
      this._renderPDATipsTab(contentEl);
    } else if (this.activePDATab === 'market') {
      this._renderPDAMarketTab(contentEl, dealer);
    } else if (this.activePDATab === 'stash') {
      this._renderPDAStashTab(contentEl);
    } else if (this.activePDATab === 'rampages') {
      this._renderPDARampagesTab(contentEl);
    }
  }

  _buildSecretsAndAviationGPSHtml() {
    const uncollectedTikis = (this.tikiPackages || []).filter((t) => !t.collected);
    const nextTiki = uncollectedTikis[0] || null;

    const aviationBtns = AVIATION_GPS_TARGETS.map(
      (av) => `
        <button type="button" class="vc-btn vc-btn-cyan vc-gps-btn" data-x="${av.x}" data-z="${av.z}" data-label="${av.label}" data-color="${av.color}" style="font-size:11px;padding:5px 9px;">
          📍 SET GPS: ${av.badge}
        </button>
      `
    ).join('');

    const nextTikiBtn = nextTiki
      ? `
        <button type="button" class="vc-btn vc-btn-green vc-gps-btn" data-x="${nextTiki.x}" data-z="${nextTiki.z}" data-label="HIDDEN TIKI: ${nextTiki.name}" data-color="#39ff14" style="font-size:11px;padding:5px 9px;">
          🗿 SET GPS: NEXT TIKI (${nextTiki.name.toUpperCase()})
        </button>
      `
      : `<span class="vc-badge" style="background:#39ff14;">🏆 ALL 10 TIKIS COLLECTED!</span>`;

    const tikiCardsHtml = uncollectedTikis
      .map(
        (t) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(10,32,22,0.82);border:1px solid #39ff14;gap:8px;">
            <div>
              <strong style="color:#39ff14;font-size:12px;">🗿 ${t.name} (${t.district})</strong>
              <div style="color:#b8c7e0;font-size:11px;">${t.hint} • Reward: +$2,500 & Armor/Ammo</div>
            </div>
            <button type="button" class="vc-btn vc-btn-green vc-gps-btn" data-x="${t.x}" data-z="${t.z}" data-label="TIKI: ${t.name}" data-color="#39ff14" style="font-size:11px;padding:4px 8px;white-space:nowrap;">
              📍 SET GPS
            </button>
          </div>
        `
      )
      .join('');

    return `
      <div style="margin-bottom:12px;padding:9px 12px;background:rgba(14, 6, 30, 0.95);border:2px solid #ffe600;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:7px;">
          <strong style="color:#ffe600;font-size:13px;">
            ✈️ ARGON AVIATION & SIGHTSEEING QUICK-GPS TRACKER (TIKIS: ${this.tikiCollectedCount}/10 • EASTER EGGS: ${this.discoveredEggsCount}/6)
          </strong>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:${uncollectedTikis.length > 0 ? '8px' : '0'};">
          ${aviationBtns}
          ${nextTikiBtn}
        </div>
        ${
          uncollectedTikis.length > 0
            ? `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(310px, 1fr));gap:6px;max-height:135px;overflow-y:auto;padding-right:2px;">
                ${tikiCardsHtml}
              </div>`
            : ''
        }
      </div>
    `;
  }

  _renderPDATipsTab(container) {
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="color:#ffe600;font-weight:700;">
          📡 LIVE 1986 SYNDICATE BEEPER FEED (${this.unreadTipsCount} ENCRYPTED PACKETS)
        </div>
        <button type="button" class="vc-btn vc-btn-cyan" id="vc-refresh-market-btn" style="font-size:12px;padding:4px 10px;">
          🔄 SCAN NEW MARKET CYCLE
        </button>
      </div>
      ${this._buildSecretsAndAviationGPSHtml()}
    `;

    for (const msg of this.pagerMessages) {
      html += `
        <div class="vc-pager-card">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span class="vc-badge" style="background:${msg.badgeColor};">${msg.badge}</span>
              <strong style="color:#ffe600;">${msg.sender}</strong>
              <span style="color:#99a8c2;font-size:11px;">[${msg.time}]</span>
            </div>
            <div style="color:#ffffff;line-height:1.35;">${msg.body}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:155px;">
            <button type="button" class="vc-btn vc-gps-btn" data-x="${msg.x}" data-z="${msg.z}" data-label="${msg.sender}" data-dealer="${msg.dealerId || ''}" style="font-size:12px;padding:5px 8px;">
              📍 SET GPS WAYPOINT
            </button>
            ${
              msg.dealerId
                ? `<button type="button" class="vc-btn vc-btn-green vc-jump-dealer-btn" data-dealer="${msg.dealerId}" style="font-size:12px;padding:5px 8px;">
                    💼 TRADE THIS TURF
                  </button>`
                : ''
            }
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    const refreshBtn = container.querySelector('#vc-refresh-market-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this._generateMarketCycle(this.marketCycleIndex + 1);
        this._playSFX('pda_beep');
        this._renderPDAContent();
      });
    }

    container.querySelectorAll('.vc-gps-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const x = parseFloat(btn.getAttribute('data-x'));
        const z = parseFloat(btn.getAttribute('data-z'));
        const label = btn.getAttribute('data-label') || 'DEALER HOTSPOT';
        const color = btn.getAttribute('data-color') || '#00f6ff';
        this.setWaypoint(x, z, label, color);
        this.togglePDA(false);
      });
    });

    container.querySelectorAll('.vc-jump-dealer-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dId = btn.getAttribute('data-dealer');
        if (dId) {
          this.selectedDealerId = dId;
          this.activePDATab = 'market';
          this._renderPDAContent();
        }
      });
    });
  }

  _renderPDAMarketTab(container, dealer) {
    const dealerButtons = DEALERS.map(
      (d) => `
        <button type="button" class="vc-btn ${d.id === dealer.id ? 'vc-btn-green' : 'vc-btn-cyan'} vc-select-dealer-btn" data-dealer="${d.id}" style="font-size:12px;padding:4px 9px;">
          ${d.district}
        </button>
      `
    ).join('');

    let rowsHtml = '';
    const prices = this.marketPrices[dealer.id] || {};
    for (const comm of COMMODITIES) {
      const pInfo = prices[comm.id] || { price: comm.basePrice, diffPct: 0, tag: 'STANDARD' };
      const owned = this.briefcase[comm.id] || 0;
      const diffColor = pInfo.diffPct <= -25 ? '#00f6ff' : pInfo.diffPct >= 40 ? '#39ff14' : '#ffffff';
      const diffStr = pInfo.diffPct >= 0 ? `+${pInfo.diffPct}%` : `${pInfo.diffPct}%`;

      rowsHtml += `
        <tr>
          <td>
            <strong style="color:${comm.color};font-size:14px;">${comm.icon} ${comm.name}</strong><br/>
            <span style="font-size:11px;color:#b8c7e0;">Avg: $${comm.basePrice.toLocaleString()} / ${comm.unit}</span>
          </td>
          <td>
            <span style="font-size:15px;font-weight:700;color:${diffColor};">$${pInfo.price.toLocaleString()}</span>
            <span style="font-size:11px;color:${diffColor};">(${diffStr})</span><br/>
            ${
              pInfo.tag !== 'STANDARD'
                ? `<span class="vc-badge" style="background:${pInfo.diffPct < 0 ? '#00f6ff' : '#39ff14'};">${pInfo.tag}</span>`
                : ''
            }
          </td>
          <td style="font-weight:700;color:#ffe600;">${owned} units</td>
          <td>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
              <button type="button" class="vc-btn vc-trade-btn" data-action="buy1" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">BUY 1</button>
              <button type="button" class="vc-btn vc-btn-cyan vc-trade-btn" data-action="buymax" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">BUY MAX</button>
              <button type="button" class="vc-btn vc-btn-pink vc-trade-btn" data-action="sell1" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">SELL 1</button>
              <button type="button" class="vc-btn vc-btn-green vc-trade-btn" data-action="sellall" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">SELL ALL</button>
            </div>
          </td>
        </tr>
      `;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${dealerButtons}</div>
        <button type="button" class="vc-btn" id="vc-market-gps-btn" style="font-size:12px;padding:4px 10px;">
          📍 GPS TO ${dealer.name.toUpperCase()}
        </button>
      </div>
      <div style="margin-bottom:8px;padding:6px 10px;background:#1a0933;border:1px solid #ff2a9d;display:flex;justify-content:space-between;font-size:12px;">
        <span>🤝 ACTIVE CONTACT: <strong>${dealer.name}</strong> (${dealer.contact})</span>
        <span style="color:#ff2a9d;">🚨 ACPD SURVEILLANCE: ${dealer.surveillanceLabel}</span>
      </div>
      <table class="vc-market-table">
        <thead>
          <tr>
            <th>COMMODITY</th>
            <th>LOCAL PRICE vs AVG</th>
            <th>BRIEFCASE</th>
            <th>SYNDICATE TRADE</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    container.querySelectorAll('.vc-select-dealer-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedDealerId = btn.getAttribute('data-dealer') || DEALERS[0].id;
        this._playSFX('ui_tab');
        this._renderPDAContent();
      });
    });

    const gpsBtn = container.querySelector('#vc-market-gps-btn');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        this.setWaypoint(dealer.x, dealer.z, `${dealer.name} (${dealer.district})`, dealer.color);
        this.togglePDA(false);
      });
    }

    container.querySelectorAll('.vc-trade-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const commId = btn.getAttribute('data-comm');
        this._executeContrabandTrade(dealer, commId, action);
      });
    });
  }

  _executeContrabandTrade(dealer, commId, action) {
    const comm = COMMODITIES.find((c) => c.id === commId);
    if (!comm) return;
    const pInfo = (this.marketPrices[dealer.id] && this.marketPrices[dealer.id][commId]) || {
      price: comm.basePrice
    };
    const unitPrice = pInfo.price;
    const cash = this._getPlayerCash();
    const freeSpace = Math.max(0, this.briefcaseCap - this.getBriefcaseUsed());
    const owned = this.briefcase[commId] || 0;

    let tradedUnits = 0;
    if (action === 'buy1' || action === 'buymax') {
      const affordable = Math.floor(cash / unitPrice);
      const qty = action === 'buy1' ? Math.min(1, freeSpace, affordable) : Math.min(freeSpace, affordable);
      if (qty <= 0) {
        this._playSFX('ui_error');
        this._callout(
          freeSpace <= 0 ? 'BRIEFCASE FULL (50/50)! DEPOSIT IN STARFISH VAULT OR SELL.' : 'INSUFFICIENT CASH FOR TRADE!',
          'PAGER TRADE'
        );
        return;
      }
      const totalCost = qty * unitPrice;
      this.briefcase[commId] = owned + qty;
      this.netProfit -= totalCost;
      this._addPlayerCash(-totalCost, `BOUGHT ${qty}x ${comm.name}`);
      tradedUnits = qty;
      this._playSFX('cash_register');
      this._callout(`BOUGHT ${qty}x ${comm.name} @ $${unitPrice.toLocaleString()} (-$${totalCost.toLocaleString()})`, dealer.name);
    } else if (action === 'sell1' || action === 'sellall') {
      const qty = action === 'sell1' ? Math.min(1, owned) : owned;
      if (qty <= 0) {
        this._playSFX('ui_error');
        return;
      }
      const totalRevenue = qty * unitPrice;
      this.briefcase[commId] = owned - qty;
      this.netProfit += totalRevenue;
      this._addPlayerCash(totalRevenue, `SOLD ${qty}x ${comm.name}`);
      tradedUnits = qty;
      this._playSFX('cash_register');
      this._callout(`SOLD ${qty}x ${comm.name} @ $${unitPrice.toLocaleString()} (+$${totalRevenue.toLocaleString()})`, dealer.name);
    }

    // Check ACPD Undercover Sting risk in high-surveillance turf
    if (tradedUnits >= 3 && Math.random() < dealer.surveillance * 0.45) {
      this._triggerPoliceWanted(2, '2-STAR ACPD UNDERCOVER STING!');
      this._callout(`🚨 2-STAR ACPD STING! UNDERCOVER VICE DETECTIVES AMBUSHED THE DEAL AT ${dealer.name.toUpperCase()}!`, 'ACPD DISPATCH');
    }

    this._renderPDAContent();
  }

  _renderPDAStashTab(container) {
    let rowsHtml = '';
    for (const comm of COMMODITIES) {
      const inBriefcase = this.briefcase[comm.id] || 0;
      const inVault = this.safehouseStash[comm.id] || 0;

      rowsHtml += `
        <tr>
          <td><strong style="color:${comm.color};">${comm.icon} ${comm.name}</strong></td>
          <td style="color:#00f6ff;font-weight:700;">${inBriefcase} units</td>
          <td style="color:#ffe600;font-weight:700;">${inVault} units</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="vc-btn vc-stash-btn" data-dir="to_vault_1" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">STORE 1 ➔</button>
              <button type="button" class="vc-btn vc-btn-cyan vc-stash-btn" data-dir="to_vault_all" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">STORE ALL ➔</button>
              <button type="button" class="vc-btn vc-btn-pink vc-stash-btn" data-dir="to_case_1" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">⬅ TAKE 1</button>
              <button type="button" class="vc-btn vc-btn-green vc-stash-btn" data-dir="to_case_max" data-comm="${comm.id}" style="font-size:11px;padding:4px 8px;">⬅ TAKE MAX</button>
            </div>
          </td>
        </tr>
      `;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div>
          <strong style="color:#ffe600;">🏛️ STARFISH ISLAND MANSION SAFEHOUSE VAULT (x: -30, z: -8)</strong><br/>
          <span style="font-size:12px;color:#b8c7e0;">Hoard low-priced Fire Sale contraband in your 500-unit vault until a Kingpin Surge arrives!</span>
        </div>
        <button type="button" class="vc-btn" id="vc-stash-gps-btn" style="font-size:12px;padding:5px 10px;">
          📍 GPS TO MANSION VAULT
        </button>
      </div>
      <table class="vc-market-table">
        <thead>
          <tr>
            <th>COMMODITY</th>
            <th>MOBILE BRIEFCASE (${this.getBriefcaseUsed()}/${this.briefcaseCap})</th>
            <th>MANSION VAULT (${this.getStashUsed()}/${this.stashCap})</th>
            <th>TRANSFER STOCK</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    const gpsBtn = container.querySelector('#vc-stash-gps-btn');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        this.setWaypoint(-30, -8, 'STARFISH MANSION VAULT', '#ffe600');
        this.togglePDA(false);
      });
    }

    container.querySelectorAll('.vc-stash-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-dir');
        const commId = btn.getAttribute('data-comm');
        const inCase = this.briefcase[commId] || 0;
        const inVault = this.safehouseStash[commId] || 0;
        const vaultFree = Math.max(0, this.stashCap - this.getStashUsed());
        const caseFree = Math.max(0, this.briefcaseCap - this.getBriefcaseUsed());

        if (dir === 'to_vault_1' || dir === 'to_vault_all') {
          const qty = dir === 'to_vault_1' ? Math.min(1, inCase, vaultFree) : Math.min(inCase, vaultFree);
          if (qty > 0) {
            this.briefcase[commId] -= qty;
            this.safehouseStash[commId] += qty;
            this._playSFX('stash_transfer');
          }
        } else {
          const qty = dir === 'to_case_1' ? Math.min(1, inVault, caseFree) : Math.min(inVault, caseFree);
          if (qty > 0) {
            this.safehouseStash[commId] -= qty;
            this.briefcase[commId] += qty;
            this._playSFX('stash_transfer');
          }
        }
        this._renderPDAContent();
      });
    });
  }

  _renderPDARampagesTab(container) {
    let html = `
      <div style="margin-bottom:10px;color:#ffe600;font-weight:700;">
        💀 1986 ARGON CITY RAMPAGE CHALLENGES — BUILD 5X GRAND THEFT ARGON COMBO CHAINS FOR +$5,000 BONUS!
      </div>
    `;

    for (const key of Object.keys(RAMPAGE_DEFS)) {
      const r = RAMPAGE_DEFS[key];
      html += `
        <div class="vc-pager-card" style="border-left-color:${r.color};">
          <div>
            <strong style="color:${r.color};font-size:16px;">💀 ${r.title} (${r.district})</strong>
            <div style="color:#ffffff;margin-top:3px;">${r.subtitle}</div>
            <div style="color:#39ff14;font-size:12px;margin-top:4px;">
              REWARD: +$${r.rewardCash.toLocaleString()} CASH + FULL HEALTH & ARMOR RESTORE
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:165px;">
            <button type="button" class="vc-btn vc-btn-pink vc-launch-rampage-btn" data-id="${r.id}" style="font-size:12px;padding:6px 10px;">
              🔥 START RAMPAGE NOW
            </button>
            <button type="button" class="vc-btn vc-btn-cyan vc-gps-rampage-btn" data-x="${r.x}" data-z="${r.z}" data-label="${r.title}" style="font-size:12px;padding:5px 10px;">
              📍 SET SKULL GPS
            </button>
          </div>
        </div>
      `;
    }

    html += this._buildSecretsAndAviationGPSHtml();

    container.innerHTML = html;

    container.querySelectorAll('.vc-launch-rampage-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rId = btn.getAttribute('data-id');
        this.togglePDA(false);
        this.startRampage(rId);
      });
    });

    container.querySelectorAll('.vc-gps-rampage-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const x = parseFloat(btn.getAttribute('data-x'));
        const z = parseFloat(btn.getAttribute('data-z'));
        const label = btn.getAttribute('data-label');
        this.setWaypoint(x, z, `RAMPAGE: ${label}`, '#ff006e');
        this.togglePDA(false);
      });
    });

    container.querySelectorAll('.vc-gps-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const x = parseFloat(btn.getAttribute('data-x'));
        const z = parseFloat(btn.getAttribute('data-z'));
        const label = btn.getAttribute('data-label') || 'SECRET TARGET';
        const color = btn.getAttribute('data-color') || '#39ff14';
        this.setWaypoint(x, z, label, color);
        this.togglePDA(false);
      });
    });
  }

  // ============================================================================
  // GPS WAYPOINT SYSTEM
  // ============================================================================

  setWaypoint(x, z, label = 'SYNDICATE TARGET', color = '#00f6ff') {
    this.waypoint = { x, z, label, color };
    if (this.waypointBeaconMesh) {
      this.waypointBeaconMesh.position.set(x, 13, z);
      this.waypointBeaconMesh.visible = true;
    }
    if (this.waypointArrowMesh) {
      this.waypointArrowMesh.visible = true;
    }
    this._playSFX('waypoint_set');
    this._callout(`GPS WAYPOINT LOCKED: ${label.toUpperCase()}`, 'VICE GPS');
    if (this.callbacks.onWaypointChange) {
      try {
        this.callbacks.onWaypointChange(this.waypoint);
      } catch (_) {}
    }
  }

  clearWaypoint() {
    this.waypoint = null;
    if (this.waypointBeaconMesh) this.waypointBeaconMesh.visible = false;
    if (this.waypointArrowMesh) this.waypointArrowMesh.visible = false;
    if (this.callbacks.onWaypointChange) {
      try {
        this.callbacks.onWaypointChange(null);
      } catch (_) {}
    }
  }

  // ============================================================================
  // 1980s ARGON CITY RAMPAGES & GRAND THEFT ARGON COMBO CHAIN MULTIPLIERS
  // ============================================================================

  startRampage(rampageId = 'neon_arcade_blitz') {
    const def = RAMPAGE_DEFS[rampageId] || RAMPAGE_DEFS.neon_arcade_blitz;
    this.activeRampage = {
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      progress: 0,
      target: def.target,
      timeLeft: def.duration,
      duration: def.duration,
      rewardCash: def.rewardCash,
      color: def.color,
      acceptsTypes: def.acceptsTypes
    };
    this.comboChain = 1;
    this.comboTimer = this.comboMaxWindow;

    // Grant challenge weapon + ammo so player can immediately engage targets
    if (def.weaponGrant) {
      this._grantWeaponOrAmmo(def.weaponGrant, 99);
    }

    this._playSFX('rampage_start');
    this._callout(`💀 RAMPAGE STARTED: ${def.title} — ${def.subtitle}`, 'RAMPAGE');
    this._updateRampageDOM();
    return this.activeRampage;
  }

  recordRampageProgress(type = 'any', amount = 1) {
    // Advance Grand Theft Argon Combo Chain Multiplier on any kill / wreck
    this.comboChain = Math.min(6, (this.comboChain || 0) + 1);
    this.comboTimer = this.comboMaxWindow;
    if (this.comboChain > this.bestComboChain) {
      this.bestComboChain = this.comboChain;
    }

    const comboBonus = this.comboChain * 75;
    this._addPlayerCash(comboBonus, this.getComboLabel());

    if (this.activeRampage) {
      this.activeRampage.progress = Math.min(
        this.activeRampage.target,
        this.activeRampage.progress + Math.max(1, amount)
      );
      if (this.activeRampage.progress >= this.activeRampage.target) {
        this._completeActiveRampage();
      }
    }

    this._updateRampageDOM();
  }

  // Convenience aliases for combatSystem / vehicleSystem hooks
  onEnemyKilled(weaponId = 'any') {
    this.recordRampageProgress(weaponId, 1);
  }

  onVehicleDestroyed(isPolice = false) {
    this.recordRampageProgress(isPolice ? 'police_vehicle' : 'vehicle', 1);
  }

  getComboLabel() {
    if (this.comboChain <= 0 || this.comboTimer <= 0) return '';
    return COMBO_LABELS[Math.min(COMBO_LABELS.length - 1, this.comboChain)];
  }

  _completeActiveRampage() {
    if (!this.activeRampage) return;
    const r = this.activeRampage;
    this.activeRampage = null;

    this._addPlayerCash(r.rewardCash, `RAMPAGE PASSED: ${r.title}`);
    // Restore player full health & armor
    const ps = this.lastPlayerState;
    if (ps) {
      if (typeof ps.health === 'number') ps.health = ps.maxHealth || 100;
      if (typeof ps.armor === 'number') ps.armor = ps.maxArmor || 100;
    }

    this._playSFX('rampage_complete');
    this._callout(
      `🏆 RAMPAGE PASSED: ${r.title}! +$${r.rewardCash.toLocaleString()} BONUS & FULL HEALTH/ARMOR RESTORED!`,
      'VICE KINGPIN'
    );
    this._updateRampageDOM();
  }

  _updateRampageDOM() {
    if (this.rampageBannerEl) {
      if (this.activeRampage) {
        const r = this.activeRampage;
        this.rampageBannerEl.style.display = 'flex';
        this.rampageBannerEl.innerHTML = `
          <div style="font-size:20px;color:#ffe600;letter-spacing:1.2px;">
            💀 ${r.title}: ${r.progress} / ${r.target}   |   ⏱️ ${r.timeLeft.toFixed(1)}s
          </div>
          <div style="font-family:'Courier New',monospace;font-size:12px;color:#00f6ff;">
            ${r.subtitle}
          </div>
        `;
      } else {
        this.rampageBannerEl.style.display = 'none';
      }
    }

    if (this.comboPopupEl) {
      if (this.activeRampage && this.comboChain >= 2 && this.comboTimer > 0) {
        this.comboPopupEl.style.display = 'block';
        this.comboPopupEl.textContent = `${this.getComboLabel()} (${this.comboTimer.toFixed(1)}s)`;
      } else {
        this.comboPopupEl.style.display = 'none';
      }
    }
  }

  // ============================================================================
  // PROXIMITY CONTEXTUAL TRIGGERS & MAIN UPDATE LOOP
  // ============================================================================

  _triggerNearbyContext() {
    const ctx = this.nearbyContext;
    if (!ctx) return;
    this.interactCooldown = 1.0;

    if (ctx.type === 'molotov_station') {
      this.startMolotovMiniGame();
    } else if (ctx.type === 'dealer') {
      this.openDealerTrade(ctx.dealerData);
    } else if (ctx.type === 'safehouse_stash') {
      this.openPDA('stash');
    } else if (ctx.type === 'dumpster' || ctx.type === 'beach_stash') {
      this.startStashMiniGame(ctx.stashData);
    } else if (ctx.type === 'rampage') {
      this.startRampage(ctx.rampageDef.id);
    }
  }

  update(dt, playerState, inputState) {
    const safeDt = Math.min(0.1, Math.max(0.001, dt || 0.016));
    if (playerState) this.lastPlayerState = playerState;
    if (this.interactCooldown > 0) this.interactCooldown = Math.max(0, this.interactCooldown - safeDt);

    // 1. Update Market Cycle every 75 seconds
    this.marketCycleTimer += safeDt;
    if (this.marketCycleTimer >= 75.0) {
      this.marketCycleTimer = 0;
      this._generateMarketCycle(this.marketCycleIndex + 1);
    }

    // 2. Update Active Mini-Game Canvas & Timer
    if (this.activeMiniGame) {
      const mg = this.activeMiniGame;
      mg.timer = Math.max(0, mg.timer - safeDt);

      // Update spark particles
      for (let i = mg.sparks.length - 1; i >= 0; i--) {
        const sp = mg.sparks[i];
        sp.x += sp.vx * safeDt;
        sp.y += sp.vy * safeDt;
        sp.life -= safeDt;
        if (sp.life <= 0) mg.sparks.splice(i, 1);
      }

      if (mg.timer <= 0) {
        if (mg.type === 'hotwire') {
          this._triggerPoliceWanted(1, 'HOTWIRE CAR ALARM TRIGGERED 1-STAR ACPD DISPATCH!');
          this._callout('🚨 CAR ALARM SOUNDED! 1-STAR ACPD DISPATCH ALERTED!', 'ACPD DISPATCH');
        }
        // Complete or close gracefully so player is never soft-locked
        this._finishMiniGameSuccess();
        return;
      }

      this._syncMiniGameHeader();
      this._renderMiniGameCanvas();
    }

    // 3. Update Stash Cooldowns
    for (const [id, cd] of this.stashCooldowns.entries()) {
      if (cd <= safeDt) this.stashCooldowns.delete(id);
      else this.stashCooldowns.set(id, cd - safeDt);
    }

    // 4. Update Combo Chain & Active Rampage Timer
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - safeDt);
      if (this.comboTimer <= 0) this.comboChain = 0;
    }

    if (this.activeRampage) {
      this.activeRampage.timeLeft = Math.max(0, this.activeRampage.timeLeft - safeDt);
      if (this.activeRampage.timeLeft <= 0) {
        const failedTitle = this.activeRampage.title;
        this.activeRampage = null;
        this._callout(`⏱️ RAMPAGE TIME EXPIRED: ${failedTitle}`, 'RAMPAGE');
      }
    }
    this._updateRampageDOM();

    // 5. Animate 3D World Markers & Check Player Proximity
    const px =
      (playerState && (playerState.x ?? (playerState.position && playerState.position.x))) ?? 0;
    const py =
      (playerState && (playerState.y ?? (playerState.position && playerState.position.y))) ?? 0;
    const pz =
      (playerState && (playerState.z ?? (playerState.position && playerState.position.z))) ?? 0;

    // Update current district estimate
    if (px > 18) {
      this.activeDistrict = pz >= 0 ? 'Ocean Beach' : 'Washington Beach';
    } else if (px > -36) {
      this.activeDistrict = 'Starfish Island';
    } else {
      this.activeDistrict = pz < 0 ? 'Little Haiti' : 'Little Havana';
    }

    const timeNow = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
    let closestMarker = null;
    let closestDist = Infinity;

    for (const m of this.worldMarkers) {
      if (m.spinner) {
        m.spinner.rotation.y += safeDt * 2.4;
        m.spinner.position.y = 1.65 + Math.sin(timeNow * 3.2 + m.x) * 0.18;
      }
      if (m.ring) {
        const pulse = 1.0 + Math.sin(timeNow * 4.0 + m.z) * 0.08;
        m.ring.scale.set(pulse, pulse, 1);
      }

      const dist = Math.hypot(px - m.x, pz - m.z);
      if (dist <= m.radius && dist < closestDist) {
        if ((m.type === 'dumpster' || m.type === 'beach_stash') && this.stashCooldowns.has(m.id)) {
          continue;
        }
        closestDist = dist;
        closestMarker = m;
      }
    }

    // 6. Animate & Check Proximity for 10 Collectible 3D Jade Tiki Statues (Hidden Packages)
    if (this.tikiPackages && this.tikiPackages.length > 0) {
      for (const tiki of this.tikiPackages) {
        if (tiki.collected) continue;
        if (tiki.spinner) {
          tiki.spinner.rotation.y += safeDt * 2.6;
          tiki.spinner.position.y = 1.45 + Math.sin(timeNow * 3.5 + tiki.x) * 0.20;
        }
        if (tiki.ring) {
          const tPulse = 1.0 + Math.sin(timeNow * 4.2 + tiki.z) * 0.10;
          tiki.ring.scale.set(tPulse, tPulse, 1);
        }

        const tikiDist = Math.hypot(px - tiki.x, pz - tiki.z);
        if (tikiDist <= 4.2) {
          tiki.collected = true;
          if (tiki.mesh) tiki.mesh.visible = false;
          this.tikiCollectedCount++;

          // Grant +$2,500 cash, +50 MAC-10 ammo, and +25 Armor
          this._addPlayerCash(playerState, 2500, 'HIDDEN TIKI PACKAGE');
          this._grantWeaponOrAmmo('mac10', 50);
          if (playerState && typeof playerState.armor === 'number') {
            playerState.armor = Math.min(playerState.maxArmor || 100, playerState.armor + 25);
          }
          if (this.combatSystem && typeof this.combatSystem.armor === 'number') {
            this.combatSystem.armor = Math.min(
              this.combatSystem.maxArmor || 100,
              this.combatSystem.armor + 25
            );
          }

          this.callbacks.onCallout?.(
            `HIDDEN TIKI ${this.tikiCollectedCount}/10 FOUND!`,
            `${tiki.name.toUpperCase()} • +$2,500`,
            '#39ff14'
          );
          this.callbacks.onPlaySFX?.('cash');
          if (this.pdaOpen) {
            this._renderPDAContent();
          }
        }
      }
    }

    // 7. Check Easter Egg & Landmark Proximity Discoveries
    this._checkEasterEggDiscoveries(playerState);

    // Update 3D Neon GPS Waypoint Arrow above player
    if (this.waypoint && this.waypointArrowMesh) {
      const dx = this.waypoint.x - px;
      const dz = this.waypoint.z - pz;
      const wpDist = Math.hypot(dx, dz);
      if (wpDist < 4.5) {
        this.clearWaypoint();
      } else {
        this.waypointArrowMesh.visible = true;
        this.waypointArrowMesh.position.set(px, py + 3.1, pz);
        this.waypointArrowMesh.rotation.y = Math.atan2(dx, dz);
      }
    }

    // Update Contextual Proximity Banner
    this.nearbyContext = closestMarker;
    if (this.ctxPromptEl) {
      if (closestMarker && !this.isModalOpen()) {
        let actionLabel = '[E] INTERACT';
        if (closestMarker.type === 'molotov_station') {
          actionLabel = "⛽ [E] PUMP HIGH-OCTANE MOLOTOVS AT ARGON GAS '86";
        } else if (closestMarker.type === 'dealer') {
          actionLabel = `💼 [E] TRADE CONTRABAND WITH ${closestMarker.label.toUpperCase()}`;
        } else if (closestMarker.type === 'safehouse_stash') {
          actionLabel = '🏛️ [E] OPEN STARFISH MANSION VAULT STASH';
        } else if (closestMarker.type === 'dumpster' || closestMarker.type === 'beach_stash') {
          actionLabel = `🗑️ [E] RUMMAGE ${closestMarker.label.toUpperCase()}`;
        } else if (closestMarker.type === 'rampage') {
          actionLabel = `💀 [E] START ${closestMarker.label.toUpperCase()}`;
        }
        this.ctxPromptEl.style.display = 'flex';
        this.ctxPromptEl.textContent = actionLabel;

        // Also check inputState.interact if passed by main loop
        if (
          inputState &&
          (inputState.interact || inputState.use || inputState.action) &&
          this.interactCooldown <= 0
        ) {
          this._triggerNearbyContext();
        }
      } else {
        this.ctxPromptEl.style.display = 'none';
      }
    }
  }

  // ============================================================================
  // HUD & RADAR MINIMAP STATE EXPORT
  // ============================================================================

  getInteractableMarkers() {
    const baseMarkers = this.worldMarkers.map((m) => ({
      id: m.id,
      type: m.type,
      label: m.label,
      x: m.x,
      z: m.z,
      color: m.color
    }));

    const tikiMarkers = (this.tikiPackages || [])
      .filter((t) => !t.collected)
      .map((t) => ({
        id: t.id,
        type: 'tiki',
        label: `HIDDEN TIKI: ${t.name}`,
        x: t.x,
        z: t.z,
        color: '#39ff14'
      }));

    return baseMarkers.concat(tikiMarkers);
  }

  getEconomyHUDState() {
    return {
      unreadTipsCount: this.unreadTipsCount,
      activeDistrict: this.activeDistrict,
      briefcaseUsed: this.getBriefcaseUsed(),
      briefcaseCap: this.briefcaseCap,
      stashUsed: this.getStashUsed(),
      stashCap: this.stashCap,
      netProfit: this.netProfit,
      tikiCollected: this.tikiCollectedCount,
      tikiTotal: 10,
      easterEggsFound: this.discoveredEggsCount,
      activeRampage: this.activeRampage
        ? {
            id: this.activeRampage.id,
            title: this.activeRampage.title,
            subtitle: this.activeRampage.subtitle,
            progress: this.activeRampage.progress,
            target: this.activeRampage.target,
            timeLeft: this.activeRampage.timeLeft,
            duration: this.activeRampage.duration
          }
        : null,
      comboChain: this.comboChain,
      comboLabel: this.getComboLabel(),
      comboTimer: this.comboTimer,
      waypoint: this.waypoint ? { ...this.waypoint } : null
    };
  }
}
