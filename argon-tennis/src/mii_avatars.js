// ============================================================================
// Argon Tennis — Argon Tennis SVG & HiDPI 2D Canvas Mii Avatar Module
// ============================================================================
// Renders ultra-crisp, authentic Argon Tennis Mii character portraits
// matching the 3D Miis in assets/renders/render_03_assets_lineup.png and
// reference_frames/ref_06_game_point_hud.png.
//
// Supports BOTH:
//   1. Synchronous inline <svg viewBox="0 0 120 120"> DOM injection (infinite
//      vector sharpness at any DPI, zero async Image load latency on Frame 0).
//   2. Synchronous 192x192 HiDPI Canvas 2D Path2D rendering onto <canvas>
//      elements for full backwards compatibility.
// ============================================================================

let _svgInstanceCounter = 0;

export const MII_PROFILES = {
  player1: {
    id: 'player1',
    name: 'Ammaar',
    team: 'player',
    badgeBgInner: 'rgba(255, 118, 88, 0.56)',
    badgeBgOuter: 'rgba(220, 44, 24, 0.22)',
    badgeRim: 'rgba(255, 230, 220, 0.72)',
    skinLight: '#fff4e8',
    skinMid: '#ffdfc4',
    skinShade: '#e8aa86',
    skinStroke: '#c9825b',
    earInner: '#de926b',
    blushColor: 'rgba(255, 105, 95, 0.38)',
    hairLight: '#6b3c1e',
    hairMid: '#4a2812',
    hairDark: '#2e1709',
    hairSpecular: 'rgba(255, 220, 185, 0.30)',
    hairStyle: 'swept_puffs',
    headgear: 'white_red_headband',
    browColor: '#361b0b',
    browTilt: 'confident',
    irisLight: '#2c3d59',
    irisDark: '#121824',
    lashes: false,
    glasses: false,
    mouthStyle: 'happy_grin',
    shirtLight: '#f64a35',
    shirtDark: '#c62312',
    collarAccent: '#e83b28',
  },
  player2: {
    id: 'player2',
    name: 'Maya',
    team: 'player',
    badgeBgInner: 'rgba(255, 132, 102, 0.52)',
    badgeBgOuter: 'rgba(225, 52, 32, 0.20)',
    badgeRim: 'rgba(255, 232, 222, 0.68)',
    skinLight: '#fff7ee',
    skinMid: '#ffe4cc',
    skinShade: '#ebb08a',
    skinStroke: '#cc8862',
    earInner: '#e29872',
    blushColor: 'rgba(255, 112, 108, 0.42)',
    hairLight: '#874222',
    hairMid: '#632c13',
    hairDark: '#3f1a09',
    hairSpecular: 'rgba(255, 210, 175, 0.32)',
    hairStyle: 'bouncy_locks',
    headgear: 'white_red_visor',
    browColor: '#4a200d',
    browTilt: 'cheerful',
    irisLight: '#4a2e1b',
    irisDark: '#1f1209',
    lashes: true,
    glasses: false,
    mouthStyle: 'joyful_smile',
    shirtLight: '#f64a35',
    shirtDark: '#c62312',
    collarAccent: '#e83b28',
  },
  opponent1: {
    id: 'opponent1',
    name: 'Matt',
    team: 'opponent',
    badgeBgInner: 'rgba(92, 148, 255, 0.56)',
    badgeBgOuter: 'rgba(38, 78, 230, 0.24)',
    badgeRim: 'rgba(215, 232, 255, 0.72)',
    skinLight: '#fff0dc',
    skinMid: '#f5cba7',
    skinShade: '#dc9c6e',
    skinStroke: '#bc7a4c',
    earInner: '#d48c5e',
    blushColor: 'rgba(245, 115, 95, 0.28)',
    hairLight: '#313b52',
    hairMid: '#181c26',
    hairDark: '#0b0e14',
    hairSpecular: 'rgba(165, 202, 255, 0.34)',
    hairStyle: 'spiky_rival',
    headgear: 'blue_white_headband',
    browColor: '#12161f',
    browTilt: 'fierce_v',
    irisLight: '#263654',
    irisDark: '#0f1522',
    lashes: false,
    glasses: false,
    mouthStyle: 'rival_smirk',
    shirtLight: '#4276ff',
    shirtDark: '#1c44c9',
    collarAccent: '#2b5cff',
  },
  opponent2: {
    id: 'opponent2',
    name: 'Akira',
    team: 'opponent',
    badgeBgInner: 'rgba(84, 165, 255, 0.52)',
    badgeBgOuter: 'rgba(32, 92, 224, 0.22)',
    badgeRim: 'rgba(215, 236, 255, 0.68)',
    skinLight: '#ffeed9',
    skinMid: '#f0c49e',
    skinShade: '#d6986a',
    skinStroke: '#b87648',
    earInner: '#ce895c',
    blushColor: 'rgba(240, 115, 95, 0.26)',
    hairLight: '#2b3c63',
    hairMid: '#17223b',
    hairDark: '#0c1221',
    hairSpecular: 'rgba(140, 210, 255, 0.32)',
    hairStyle: 'sleek_parted',
    headgear: 'blue_visor_band',
    browColor: '#121b30',
    browTilt: 'focused',
    irisLight: '#1e3a5f',
    irisDark: '#0d1829',
    lashes: false,
    glasses: true,
    mouthStyle: 'cool_smile',
    shirtLight: '#4276ff',
    shirtDark: '#1c44c9',
    collarAccent: '#2b5cff',
  },
};

export const ELEMENT_ID_TO_CHARACTER = {
  'mii-icon-player': 'player1',
  'mii-icon-player-2': 'player2',
  'plate-mii-player': 'player1',
  'setup-mii-player': 'player1',
  'victory-mii-icon': 'player1',
  'mii-icon-opponent': 'opponent1',
  'mii-icon-opponent-2': 'opponent2',
  'setup-mii-opponent': 'opponent1',
};

// Shared SVG path geometry in 120x120 viewBox coordinates
const PATHS = {
  // Plump lower-cheek Argon Mii head silhouette
  head: 'M 60 20 C 79 20, 91 31, 93 48 C 95 62, 96 71, 86 81 C 78 88, 69 91, 60 91 C 51 91, 42 88, 34 81 C 24 71, 25 62, 27 48 C 29 31, 41 20, 60 20 Z',
  // Forehead highlight crescent
  foreheadGlow: 'M 38 30 C 48 23, 72 23, 82 30 C 75 27, 45 27, 38 30 Z',
  // Broad sporty polo shoulders
  shoulders: 'M 15 120 C 17 95, 35 87, 60 87 C 85 87, 103 95, 105 120 Z',
  shoulderHighlight: 'M 22 116 C 25 97, 40 90, 60 90 C 80 90, 95 97, 98 116 L 92 116 C 89 101, 76 94, 60 94 C 44 94, 31 101, 28 116 Z',
  // Crisp white Argon Tennis polo collar flaps & V-neck placket
  collarLeft: 'M 46 85 C 39 87, 37 94, 44 98 L 58 94 L 51 85 Z',
  collarRight: 'M 74 85 C 81 87, 83 94, 76 98 L 62 94 L 69 85 Z',
  neckV: 'M 51 85 L 60 96 L 69 85 Z',

  // Hair Style 1: Ammaar (Voluminous 4-puff swept dark-chestnut Mii hair matching render_03_assets_lineup.png)
  hairSweptBase: 'M 23 43 C 20 26, 29 15, 41 16 C 47 9, 59 8, 65 14 C 72 9, 83 11, 88 19 C 96 22, 100 31, 97 43 C 95 49, 95 54, 93 55 L 91 41 C 83 35, 37 35, 29 41 L 27 55 C 25 54, 25 49, 23 43 Z',
  hairSweptPuffs: 'M 27 38 C 27 25, 34 18, 43 20 C 48 13, 58 12, 64 18 C 70 13, 80 15, 84 22 C 91 24, 94 31, 93 38 Z',
  hairSweptHighlight: 'M 33 25 C 37 19, 43 19, 46 23 C 51 16, 60 15, 64 21 C 70 16, 78 17, 83 24 C 77 21, 70 20, 64 24 C 58 19, 51 20, 46 26 C 41 22, 36 22, 33 25 Z',

  // Hair Style 2: Maya (Bouncy auburn locks with cute side framing tufts)
  hairBouncyBase: 'M 21 46 C 18 24, 34 10, 60 10 C 86 10, 102 24, 99 46 C 101 58, 99 69, 93 75 C 91 66, 92 54, 90 43 C 78 36, 42 36, 30 43 C 28 54, 29 66, 27 75 C 21 69, 19 58, 21 46 Z',
  hairBouncyCrown: 'M 26 39 C 29 19, 44 12, 60 12 C 76 12, 91 19, 94 39 Z',
  hairBouncyHighlight: 'M 36 23 C 48 15, 72 15, 84 23 C 72 19, 48 19, 36 23 Z',

  // Hair Style 3: Matt / Club Rival (5 bold upward spiky jet-black tufts matching render_03_assets_lineup.png)
  hairSpikyBase: 'M 23 42 C 21 31, 23 21, 31 25 C 32 14, 39 9, 47 19 C 52 8, 57 4, 60 4 C 63 4, 68 8, 73 19 C 81 9, 88 14, 89 25 C 97 21, 99 31, 97 42 L 93 55 L 90 41 C 78 35, 42 35, 30 41 L 27 55 Z',
  hairSpikyTufts: 'M 26 37 C 25 29, 27 24, 33 28 C 34 18, 40 13, 47 22 C 52 12, 57 7, 60 7 C 63 7, 68 12, 73 22 C 80 13, 86 18, 87 28 C 93 24, 95 29, 94 37 Z',
  hairSpikyHighlight: 'M 36 24 C 38 17, 42 16, 45 23 C 41 20, 38 20, 36 24 Z M 54 19 C 57 10, 63 10, 66 19 C 62 14, 58 14, 54 19 Z M 75 23 C 78 16, 82 17, 84 24 C 82 20, 79 20, 75 23 Z',

  // Hair Style 4: Akira (Sleek side-parted dark-navy hair with swept front fringe)
  hairSleekBase: 'M 23 43 C 20 23, 36 11, 60 11 C 85 11, 100 23, 97 43 L 93 55 L 90 41 C 80 35, 58 34, 42 42 C 36 38, 32 39, 30 42 L 27 55 Z',
  hairSleekFringe: 'M 30 36 C 44 31, 68 32, 88 39 C 74 43, 52 44, 34 39 Z',
  hairSleekHighlight: 'M 36 22 C 50 14, 74 15, 86 24 C 72 19, 50 18, 36 22 Z',

  // Headbands & Visors
  headbandBand: 'M 22 37 C 38 31, 82 31, 98 37 L 97 43.5 C 82 38, 38 38, 23 43.5 Z',
  headbandCenterStripe: 'M 22.5 40.2 C 38 34.5, 82 34.5, 97.5 40.2',
  headbandTopTrim: 'M 22.3 38.0 C 38 32.3, 82 32.3, 97.7 38.0',
  headbandBottomTrim: 'M 22.8 42.4 C 38 36.8, 82 36.8, 97.2 42.4',
  visorBrim: 'M 19 39 C 36 29, 84 29, 101 39 C 88 45, 32 45, 19 39 Z',

  // Nose C-contour
  noseContour: 'M 55 58.5 C 54.2 62.8, 57 64.8, 60 64.8 C 63 64.8, 65.8 62.8, 65 58.5',

  // Mouth shapes
  mouthHappyOuter: 'M 47.5 70.5 C 50.5 81, 69.5 81, 72.5 70.5 C 65 72.5, 55 72.5, 47.5 70.5 Z',
  mouthHappyTeeth: 'M 49 71.2 C 55 72.8, 65 72.8, 71 71.2 L 69.5 74.8 C 64 75.8, 56 75.8, 50.5 74.8 Z',
  mouthHappyTongue: 'M 52.5 76.2 C 56 74.2, 64 74.2, 67.5 76.2 C 64.5 79.5, 55.5 79.5, 52.5 76.2 Z',

  mouthJoyfulOuter: 'M 46.5 69.8 C 49.5 82, 70.5 82, 73.5 69.8 C 65 72, 55 72, 46.5 69.8 Z',
  mouthJoyfulTeeth: 'M 48 70.6 C 55 72.4, 65 72.4, 72 70.6 L 70.2 74.5 C 64 75.6, 56 75.6, 49.8 74.5 Z',

  mouthRivalOuter: 'M 48.5 71.5 C 53 78.5, 68 77.5, 73 69.5 C 65 71.5, 55 72, 48.5 71.5 Z',
  mouthRivalTeeth: 'M 50 71.8 C 56 72.5, 65 71.8, 71.5 70.2 L 69.5 73.8 C 63 74.8, 55 74.8, 51 73.8 Z',

  mouthCoolOuter: 'M 49 71.2 C 52.5 78.5, 67.5 78.5, 71 71.2 C 64 72.6, 56 72.6, 49 71.2 Z',
  mouthCoolTeeth: 'M 50.5 71.7 C 56 72.8, 64 72.8, 69.5 71.7 L 68 74.6 C 63 75.5, 57 75.5, 52 74.6 Z',
};

/**
 * Resolves a character profile from a characterId or DOM element ID.
 */
export function resolveMiiProfile(characterOrElementId) {
  if (!characterOrElementId) return MII_PROFILES.player1;
  const key = String(characterOrElementId).trim();
  if (MII_PROFILES[key]) return MII_PROFILES[key];
  const mapped = ELEMENT_ID_TO_CHARACTER[key];
  if (mapped && MII_PROFILES[mapped]) return MII_PROFILES[mapped];
  if (key.includes('opponent-2') || key.includes('opponent2')) return MII_PROFILES.opponent2;
  if (key.includes('opponent')) return MII_PROFILES.opponent1;
  if (key.includes('player-2') || key.includes('player2')) return MII_PROFILES.player2;
  return MII_PROFILES.player1;
}

/**
 * Generates a complete, self-contained, ultra-crisp Argon Tennis Mii
 * inline `<svg viewBox="0 0 120 120">` string with unique `<defs>` IDs.
 */
export function getMiiAvatarSVG(characterId = 'player1', options = {}) {
  const p = resolveMiiProfile(characterId);
  const uid = options.uid || `${p.id}-${++_svgInstanceCounter}`;

  // Eyebrow paths based on expression
  let browPaths = '';
  if (p.browTilt === 'fierce_v') {
    browPaths = `
      <path d="M 32 42.5 Q 43 44.5 52 47.5" stroke="${p.browColor}" stroke-width="4.4" stroke-linecap="round" fill="none" />
      <path d="M 88 42.5 Q 77 44.5 68 47.5" stroke="${p.browColor}" stroke-width="4.4" stroke-linecap="round" fill="none" />
    `;
  } else if (p.browTilt === 'cheerful') {
    browPaths = `
      <path d="M 33 45.5 Q 43 40.5 51 44" stroke="${p.browColor}" stroke-width="3.6" stroke-linecap="round" fill="none" />
      <path d="M 69 44 Q 77 40.5 87 45.5" stroke="${p.browColor}" stroke-width="3.6" stroke-linecap="round" fill="none" />
    `;
  } else if (p.browTilt === 'focused') {
    browPaths = `
      <path d="M 33 44.5 Q 43 43 52 45.5" stroke="${p.browColor}" stroke-width="3.8" stroke-linecap="round" fill="none" />
      <path d="M 87 44.5 Q 77 43 68 45.5" stroke="${p.browColor}" stroke-width="3.8" stroke-linecap="round" fill="none" />
    `;
  } else {
    // confident (player1 Ammaar)
    browPaths = `
      <path d="M 33 45 Q 43 41 52 44.5" stroke="${p.browColor}" stroke-width="4.0" stroke-linecap="round" fill="none" />
      <path d="M 68 44.5 Q 77 41 87 45" stroke="${p.browColor}" stroke-width="4.0" stroke-linecap="round" fill="none" />
    `;
  }

  // Hair & Headband / Visor markup
  let hairAndHeadgearMarkup = '';
  if (p.hairStyle === 'swept_puffs') {
    hairAndHeadgearMarkup = `
      <path d="${PATHS.hairSweptBase}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairSweptPuffs}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairSweptHighlight}" fill="${p.hairSpecular}" />
      <!-- Forehead headband shadow -->
      <path d="${PATHS.headbandBand}" transform="translate(0, 1.8)" fill="rgba(110, 52, 22, 0.25)" />
      <!-- Crisp White Tennis Headband with Orange-Red Stripe (matches render_03_assets_lineup.png) -->
      <path d="${PATHS.headbandBand}" fill="url(#visor-white-${uid})" stroke="#d5e0ec" stroke-width="0.9" />
      <path d="${PATHS.headbandCenterStripe}" stroke="#e83b28" stroke-width="2.6" stroke-linecap="round" fill="none" />
    `;
  } else if (p.hairStyle === 'bouncy_locks') {
    hairAndHeadgearMarkup = `
      <path d="${PATHS.hairBouncyBase}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairBouncyCrown}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairBouncyHighlight}" fill="${p.hairSpecular}" />
      <!-- Sporty Red/White Tennis Sun Visor -->
      <path d="${PATHS.headbandBand}" fill="#e83b28" />
      <path d="${PATHS.headbandTopTrim}" stroke="#ffffff" stroke-width="1.3" fill="none" />
      <path d="${PATHS.visorBrim}" fill="url(#visor-white-${uid})" stroke="#ccd9e8" stroke-width="1.0" />
    `;
  } else if (p.hairStyle === 'spiky_rival') {
    hairAndHeadgearMarkup = `
      <path d="${PATHS.hairSpikyBase}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairSpikyTufts}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairSpikyHighlight}" fill="${p.hairSpecular}" />
      <!-- Forehead headband shadow -->
      <path d="${PATHS.headbandBand}" transform="translate(0, 1.8)" fill="rgba(60, 30, 15, 0.24)" />
      <!-- Sleek Royal-Blue Headband with Crisp White Trim (matches render_03_assets_lineup.png) -->
      <path d="${PATHS.headbandBand}" fill="url(#shirt-${uid})" stroke="#1738a8" stroke-width="0.9" />
      <path d="${PATHS.headbandTopTrim}" stroke="#ffffff" stroke-width="1.35" stroke-linecap="round" fill="none" />
      <path d="${PATHS.headbandBottomTrim}" stroke="#ffffff" stroke-width="1.35" stroke-linecap="round" fill="none" />
    `;
  } else {
    // sleek_parted (opponent2 Akira)
    hairAndHeadgearMarkup = `
      <path d="${PATHS.hairSleekBase}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairSleekFringe}" fill="url(#hair-${uid})" />
      <path d="${PATHS.hairSleekHighlight}" fill="${p.hairSpecular}" />
      <path d="${PATHS.headbandBand}" fill="url(#shirt-${uid})" />
      <path d="${PATHS.headbandCenterStripe}" stroke="#7be0ff" stroke-width="2.0" stroke-linecap="round" fill="none" />
    `;
  }

  // Eyelashes for Maya (player2)
  const lashesMarkup = p.lashes
    ? `
      <path d="M 34.5 50.5 L 31.5 48 M 36 48.2 L 33.8 45.5" stroke="#1a1412" stroke-width="2.0" stroke-linecap="round" />
      <path d="M 85.5 50.5 L 88.5 48 M 84 48.2 L 86.2 45.5" stroke="#1a1412" stroke-width="2.0" stroke-linecap="round" />
    `
    : '';

  // Sporty Cyan-Tinted Athletic Glasses for Akira (opponent2)
  const glassesMarkup = p.glasses
    ? `
      <g class="mii-sport-glasses">
        <rect x="31" y="46.5" width="24" height="14.5" rx="6" fill="rgba(85, 222, 255, 0.26)" stroke="#d8f6ff" stroke-width="1.8" />
        <rect x="65" y="46.5" width="24" height="14.5" rx="6" fill="rgba(85, 222, 255, 0.26)" stroke="#d8f6ff" stroke-width="1.8" />
        <path d="M 55 52.5 Q 60 50.5 65 52.5" stroke="#d8f6ff" stroke-width="2.0" fill="none" />
        <path d="M 25 51 L 31 52 M 89 52 L 95 51" stroke="#25a8f5" stroke-width="2.0" stroke-linecap="round" />
        <path d="M 35 49 L 40 58 M 69 49 L 74 58" stroke="rgba(255, 255, 255, 0.55)" stroke-width="1.6" stroke-linecap="round" />
      </g>
    `
    : '';

  // Mouth markup
  let mouthMarkup = '';
  if (p.mouthStyle === 'rival_smirk') {
    mouthMarkup = `
      <path d="${PATHS.mouthRivalOuter}" fill="#591b16" stroke="#3d120e" stroke-width="1.4" stroke-linejoin="round" />
      <path d="${PATHS.mouthRivalTeeth}" fill="#ffffff" />
      <path d="M 72.5 68.2 C 74.5 69.2, 75 71.2, 73.8 72.5" stroke="${p.skinStroke}" stroke-width="1.5" stroke-linecap="round" fill="none" />
    `;
  } else if (p.mouthStyle === 'cool_smile') {
    mouthMarkup = `
      <path d="${PATHS.mouthCoolOuter}" fill="#541a16" stroke="#3b110e" stroke-width="1.35" stroke-linejoin="round" />
      <path d="${PATHS.mouthCoolTeeth}" fill="#ffffff" />
      <path d="${PATHS.mouthHappyTongue}" fill="#ff7d7d" />
    `;
  } else if (p.mouthStyle === 'joyful_smile') {
    mouthMarkup = `
      <path d="${PATHS.mouthJoyfulOuter}" fill="#5e1b18" stroke="#421210" stroke-width="1.4" stroke-linejoin="round" />
      <path d="${PATHS.mouthJoyfulTeeth}" fill="#ffffff" />
      <path d="${PATHS.mouthHappyTongue}" fill="#ff7d7d" />
    `;
  } else {
    // happy_grin (player1 Ammaar)
    mouthMarkup = `
      <path d="${PATHS.mouthHappyOuter}" fill="#5e1b18" stroke="#421210" stroke-width="1.4" stroke-linejoin="round" />
      <path d="${PATHS.mouthHappyTeeth}" fill="#ffffff" />
      <path d="${PATHS.mouthHappyTongue}" fill="#ff7d7d" />
      <path d="M 45.8 69.5 C 44.5 70.8, 44.8 72.5, 46.2 73.2 M 74.2 69.5 C 75.5 70.8, 75.2 72.5, 73.8 73.2" stroke="${p.skinStroke}" stroke-width="1.3" stroke-linecap="round" fill="none" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="wii-mii-svg" data-mii-id="${p.id}" role="img" aria-label="${p.name} Mii Portrait">
  <defs>
    <clipPath id="badge-clip-${uid}">
      <circle cx="60" cy="60" r="56" />
    </clipPath>
    <radialGradient id="badge-bg-${uid}" cx="50%" cy="45%" r="56%">
      <stop offset="0%" stop-color="${p.badgeBgInner}" />
      <stop offset="72%" stop-color="${p.badgeBgOuter}" />
      <stop offset="100%" stop-color="rgba(12, 16, 22, 0.35)" />
    </radialGradient>
    <radialGradient id="skin-${uid}" cx="42%" cy="35%" r="64%">
      <stop offset="0%" stop-color="${p.skinLight}" />
      <stop offset="58%" stop-color="${p.skinMid}" />
      <stop offset="100%" stop-color="${p.skinShade}" />
    </radialGradient>
    <radialGradient id="nose-${uid}" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="${p.skinLight}" />
      <stop offset="55%" stop-color="${p.skinMid}" />
      <stop offset="100%" stop-color="${p.earInner}" />
    </radialGradient>
    <radialGradient id="blush-${uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${p.blushColor}" />
      <stop offset="100%" stop-color="rgba(255, 110, 100, 0)" />
    </radialGradient>
    <linearGradient id="hair-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${p.hairLight}" />
      <stop offset="55%" stop-color="${p.hairMid}" />
      <stop offset="100%" stop-color="${p.hairDark}" />
    </linearGradient>
    <linearGradient id="shirt-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${p.shirtLight}" />
      <stop offset="100%" stop-color="${p.shirtDark}" />
    </linearGradient>
    <linearGradient id="visor-white-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e5eef7" />
    </linearGradient>
    <linearGradient id="iris-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${p.irisDark}" />
      <stop offset="100%" stop-color="${p.irisLight}" />
    </linearGradient>
  </defs>

  <g clip-path="url(#badge-clip-${uid})">
    <!-- Glowing Team Backdrop -->
    <circle cx="60" cy="60" r="56" fill="url(#badge-bg-${uid})" />

    <!-- Sporty Polo Shirt Shoulders & Crisp White Collar -->
    <path d="${PATHS.shoulders}" fill="url(#shirt-${uid})" stroke="rgba(0,0,0,0.28)" stroke-width="1.4" />
    <path d="${PATHS.shoulderHighlight}" fill="rgba(255,255,255,0.16)" />

    <!-- Neck & Chin Shadow -->
    <rect x="50" y="80" width="20" height="14" rx="6" fill="${p.skinShade}" />
    <path d="${PATHS.neckV}" fill="${p.skinShade}" />

    <!-- White Polo Placket & Collar Flaps (matches render_03_assets_lineup.png) -->
    <rect x="56.2" y="91" width="7.6" height="19" rx="2.6" fill="#ffffff" stroke="#d4e0ec" stroke-width="0.9" />
    <circle cx="60" cy="96.5" r="1.2" fill="#b8c8d8" />
    <circle cx="60" cy="102.5" r="1.2" fill="#b8c8d8" />
    <path d="${PATHS.collarLeft}" fill="#ffffff" stroke="#d0dce8" stroke-width="1.1" stroke-linejoin="round" />
    <path d="${PATHS.collarRight}" fill="#ffffff" stroke="#d0dce8" stroke-width="1.1" stroke-linejoin="round" />

    <!-- Symmetrical Plump Mii Ears -->
    <g>
      <ellipse cx="23" cy="57.5" rx="7.2" ry="10.2" transform="rotate(-7 23 57.5)" fill="url(#skin-${uid})" stroke="${p.skinStroke}" stroke-width="1.5" />
      <path d="M 23.5 53 C 20.5 54, 20.5 60, 23.8 61.5" stroke="${p.earInner}" stroke-width="1.7" stroke-linecap="round" fill="none" />
      <ellipse cx="97" cy="57.5" rx="7.2" ry="10.2" transform="rotate(7 97 57.5)" fill="url(#skin-${uid})" stroke="${p.skinStroke}" stroke-width="1.5" />
      <path d="M 96.5 53 C 99.5 54, 99.5 60, 96.2 61.5" stroke="${p.earInner}" stroke-width="1.7" stroke-linecap="round" fill="none" />
    </g>

    <!-- Plump Rounded Argon Mii Head -->
    <path d="${PATHS.head}" fill="url(#skin-${uid})" stroke="${p.skinStroke}" stroke-width="1.6" stroke-linejoin="round" />
    <path d="${PATHS.foreheadGlow}" fill="rgba(255, 255, 255, 0.34)" />

    <!-- Warm Rosy Cheek Blushes -->
    <ellipse cx="35.5" cy="65.5" rx="8.5" ry="5.2" fill="url(#blush-${uid})" />
    <ellipse cx="84.5" cy="65.5" rx="8.5" ry="5.2" fill="url(#blush-${uid})" />

    <!-- Expressive Argon Mii Eyes (Left cx=43.5, Right cx=76.5, cy=54.5) -->
    <g class="mii-eyes">
      <!-- Left Eye -->
      <ellipse cx="43.5" cy="54.5" rx="8.2" ry="9.4" fill="#ffffff" stroke="#cfdbe6" stroke-width="0.9" />
      <ellipse cx="44.2" cy="54.8" rx="5.6" ry="6.7" fill="url(#iris-${uid})" />
      <circle cx="44.2" cy="54.8" r="3.1" fill="#090c12" />
      <circle cx="41.8" cy="51.8" r="2.5" fill="#ffffff" />
      <circle cx="46.2" cy="57.2" r="1.25" fill="#ffffff" />
      <path d="M 34.8 53.5 C 35.8 46.2, 51.2 46.2, 52.2 53.5" stroke="#181412" stroke-width="2.6" stroke-linecap="round" fill="none" />

      <!-- Right Eye -->
      <ellipse cx="76.5" cy="54.5" rx="8.2" ry="9.4" fill="#ffffff" stroke="#cfdbe6" stroke-width="0.9" />
      <ellipse cx="75.8" cy="54.8" rx="5.6" ry="6.7" fill="url(#iris-${uid})" />
      <circle cx="75.8" cy="54.8" r="3.1" fill="#090c12" />
      <circle cx="73.8" cy="51.8" r="2.5" fill="#ffffff" />
      <circle cx="78.2" cy="57.2" r="1.25" fill="#ffffff" />
      <path d="M 67.8 53.5 C 68.8 46.2, 84.2 46.2, 85.2 53.5" stroke="#181412" stroke-width="2.6" stroke-linecap="round" fill="none" />
      ${lashesMarkup}
    </g>

    ${glassesMarkup}

    <!-- Sculpted 3D Argon Mii Button Nose -->
    <g class="mii-nose">
      <ellipse cx="60" cy="61.8" rx="5.4" ry="4.2" fill="rgba(165, 88, 48, 0.24)" />
      <ellipse cx="60" cy="59.6" rx="5.4" ry="4.6" fill="url(#nose-${uid})" />
      <path d="${PATHS.noseContour}" stroke="${p.skinStroke}" stroke-width="1.65" stroke-linecap="round" fill="none" />
      <ellipse cx="58.4" cy="57.8" rx="2.1" ry="1.4" fill="rgba(255, 255, 255, 0.55)" />
    </g>

    <!-- Mouth / Smile -->
    <g class="mii-mouth">
      ${mouthMarkup}
    </g>

    <!-- Eyebrows -->
    <g class="mii-brows">
      ${browPaths}
    </g>

    <!-- Hair & Athletic Headband / Visor -->
    <g class="mii-hair-headgear">
      ${hairAndHeadgearMarkup}
    </g>
  </g>

  <!-- Subtle Crisp Outer Badge Rim Highlight -->
  <circle cx="60" cy="60" r="55.2" fill="none" stroke="${p.badgeRim}" stroke-width="1.6" />
</svg>`;
}

/**
 * Synchronously draws the high-DPI 192x192 Argon Mii portrait onto a 2D
 * `<canvas>` using `Path2D` in the exact same 120x120 coordinate space.
 */
export function drawMiiCanvasHiDPI(canvas, characterId = 'player1') {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const p = resolveMiiProfile(characterId);
  const targetSize = 192;
  if (canvas.width !== targetSize) canvas.width = targetSize;
  if (canvas.height !== targetSize) canvas.height = targetSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.scale(targetSize / 120, targetSize / 120);

  // Clip to circle (60, 60, 56)
  ctx.beginPath();
  ctx.arc(60, 60, 56, 0, Math.PI * 2);
  ctx.clip();

  // Badge backdrop gradient
  const bgGrad = ctx.createRadialGradient(60, 54, 4, 60, 60, 56);
  bgGrad.addColorStop(0, p.badgeBgInner);
  bgGrad.addColorStop(0.72, p.badgeBgOuter);
  bgGrad.addColorStop(1, 'rgba(12, 16, 22, 0.35)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 120, 120);

  const hasPath2D = typeof Path2D === 'function';

  // Shoulders
  const shirtGrad = ctx.createLinearGradient(60, 86, 60, 120);
  shirtGrad.addColorStop(0, p.shirtLight);
  shirtGrad.addColorStop(1, p.shirtDark);
  ctx.fillStyle = shirtGrad;
  if (hasPath2D) {
    ctx.fill(new Path2D(PATHS.shoulders));
  } else {
    ctx.beginPath();
    ctx.arc(60, 118, 42, Math.PI, 0, false);
    ctx.fill();
  }

  // Neck & White Polo Collar
  ctx.fillStyle = p.skinShade;
  ctx.fillRect(50, 80, 20, 14);
  if (hasPath2D) {
    ctx.fillStyle = '#ffffff';
    ctx.fill(new Path2D(PATHS.collarLeft));
    ctx.fill(new Path2D(PATHS.collarRight));
  }

  // Ears
  const skinGrad = ctx.createRadialGradient(50, 42, 6, 60, 56, 46);
  skinGrad.addColorStop(0, p.skinLight);
  skinGrad.addColorStop(0.58, p.skinMid);
  skinGrad.addColorStop(1, p.skinShade);

  ctx.fillStyle = skinGrad;
  ctx.strokeStyle = p.skinStroke;
  ctx.lineWidth = 1.5;
  [-1, 1].forEach((dir) => {
    ctx.beginPath();
    ctx.ellipse(60 + dir * 37, 57.5, 7.2, 10.2, dir * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Plump Argon Mii Head
  ctx.fillStyle = skinGrad;
  ctx.strokeStyle = p.skinStroke;
  ctx.lineWidth = 1.6;
  if (hasPath2D) {
    const headPath = new Path2D(PATHS.head);
    ctx.fill(headPath);
    ctx.stroke(headPath);
  } else {
    ctx.beginPath();
    ctx.arc(60, 56, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Cheek blushes
  [35.5, 84.5].forEach((bx) => {
    const blushGrad = ctx.createRadialGradient(bx, 65.5, 1, bx, 65.5, 8.5);
    blushGrad.addColorStop(0, p.blushColor);
    blushGrad.addColorStop(1, 'rgba(255, 110, 100, 0)');
    ctx.fillStyle = blushGrad;
    ctx.beginPath();
    ctx.ellipse(bx, 65.5, 8.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Eyes
  [
    { ex: 43.5, ix: 44.2, cx1: 41.8, cx2: 46.2 },
    { ex: 76.5, ix: 75.8, cx1: 73.8, cx2: 78.2 },
  ].forEach(({ ex, ix, cx1, cx2 }) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, 54.5, 8.2, 9.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.irisDark;
    ctx.beginPath();
    ctx.ellipse(ix, 54.8, 5.6, 6.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx1, 51.8, 2.5, 0, Math.PI * 2);
    ctx.arc(cx2, 57.2, 1.25, 0, Math.PI * 2);
    ctx.fill();
  });

  // Nose
  ctx.fillStyle = p.skinMid;
  ctx.beginPath();
  ctx.ellipse(60, 59.6, 5.4, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (hasPath2D) {
    ctx.strokeStyle = p.skinStroke;
    ctx.lineWidth = 1.65;
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D(PATHS.noseContour));
  }

  // Mouth
  if (hasPath2D) {
    if (p.mouthStyle === 'rival_smirk') {
      ctx.fillStyle = '#591b16';
      ctx.fill(new Path2D(PATHS.mouthRivalOuter));
      ctx.fillStyle = '#ffffff';
      ctx.fill(new Path2D(PATHS.mouthRivalTeeth));
    } else if (p.mouthStyle === 'cool_smile') {
      ctx.fillStyle = '#541a16';
      ctx.fill(new Path2D(PATHS.mouthCoolOuter));
      ctx.fillStyle = '#ffffff';
      ctx.fill(new Path2D(PATHS.mouthCoolTeeth));
      ctx.fillStyle = '#ff7d7d';
      ctx.fill(new Path2D(PATHS.mouthHappyTongue));
    } else {
      ctx.fillStyle = '#5e1b18';
      ctx.fill(new Path2D(PATHS.mouthHappyOuter));
      ctx.fillStyle = '#ffffff';
      ctx.fill(new Path2D(PATHS.mouthHappyTeeth));
      ctx.fillStyle = '#ff7d7d';
      ctx.fill(new Path2D(PATHS.mouthHappyTongue));
    }
  }

  // Hair & Headband
  const hairGrad = ctx.createLinearGradient(60, 8, 60, 55);
  hairGrad.addColorStop(0, p.hairLight);
  hairGrad.addColorStop(0.55, p.hairMid);
  hairGrad.addColorStop(1, p.hairDark);
  ctx.fillStyle = hairGrad;

  if (hasPath2D) {
    if (p.hairStyle === 'spiky_rival') {
      ctx.fill(new Path2D(PATHS.hairSpikyBase));
      ctx.fill(new Path2D(PATHS.hairSpikyTufts));
      ctx.fillStyle = shirtGrad;
      ctx.fill(new Path2D(PATHS.headbandBand));
    } else if (p.hairStyle === 'bouncy_locks') {
      ctx.fill(new Path2D(PATHS.hairBouncyBase));
      ctx.fill(new Path2D(PATHS.hairBouncyCrown));
      ctx.fillStyle = '#ffffff';
      ctx.fill(new Path2D(PATHS.visorBrim));
    } else if (p.hairStyle === 'sleek_parted') {
      ctx.fill(new Path2D(PATHS.hairSleekBase));
      ctx.fill(new Path2D(PATHS.hairSleekFringe));
      ctx.fillStyle = shirtGrad;
      ctx.fill(new Path2D(PATHS.headbandBand));
    } else {
      ctx.fill(new Path2D(PATHS.hairSweptBase));
      ctx.fill(new Path2D(PATHS.hairSweptPuffs));
      ctx.fillStyle = '#ffffff';
      ctx.fill(new Path2D(PATHS.headbandBand));
      ctx.strokeStyle = '#e83b28';
      ctx.lineWidth = 2.6;
      ctx.stroke(new Path2D(PATHS.headbandCenterStripe));
    }
  }

  // Outer rim highlight
  ctx.strokeStyle = p.badgeRim;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(60, 60, 55.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders the Argon Mii Avatar onto `target` (either a `<canvas>` or HTML
 * container element, or an element ID string).
 * - Draws synchronously onto `<canvas>` at 192x192 HiDPI.
 * - Injects a razor-sharp inline `<svg viewBox="0 0 120 120" class="wii-mii-svg">`
 *   into the parent badge/slot so vector rendering is 100% immediate on Frame 0.
 */
export function renderMiiAvatar(target, characterId = null, options = {}) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return null;

  const resolvedCharId = characterId || el.dataset?.miiId || el.id || 'player1';
  const profile = resolveMiiProfile(resolvedCharId);
  const uid = options.uid || (el.id ? `${el.id}-${profile.id}` : `${profile.id}-${++_svgInstanceCounter}`);
  const svgMarkup = getMiiAvatarSVG(profile.id, { ...options, uid });

  if (el.tagName && el.tagName.toLowerCase() === 'canvas') {
    // 1. Draw synchronous 192x192 HiDPI Canvas 2D fallback onto the canvas
    drawMiiCanvasHiDPI(el, profile.id);
    el.classList.add('mii-canvas-backed');

    // 2. Inject crisp inline <svg> into the parent badge/marker container
    const parent = el.parentElement;
    if (parent) {
      const existingSvg = parent.querySelector(`svg.wii-mii-svg[data-for-canvas="${el.id}"]`);
      if (existingSvg) {
        existingSvg.outerHTML = svgMarkup.replace(
          'class="wii-mii-svg"',
          `class="wii-mii-svg" data-for-canvas="${el.id}"`
        );
      } else {
        const temp = document.createElement('div');
        temp.innerHTML = svgMarkup.trim();
        const svgEl = temp.firstElementChild;
        if (svgEl) {
          if (el.id) svgEl.setAttribute('data-for-canvas', el.id);
          parent.insertBefore(svgEl, el.nextSibling);
        }
      }
    }
    return el;
  }

  // If `el` is a regular container div/span, inject the inline SVG directly
  el.innerHTML = svgMarkup;
  return el;
}

/**
 * Renders all 8 canonical Argon Tennis Mii avatar slots across the HUD,
 * Court Nameplates, Match Setup Modal, and Victory Skill Rating Modal.
 */
export function renderAllHudMiiAvatars() {
  Object.entries(ELEMENT_ID_TO_CHARACTER).forEach(([elementId, characterId]) => {
    const el = document.getElementById(elementId);
    if (el) {
      renderMiiAvatar(el, characterId);
    }
  });
}
