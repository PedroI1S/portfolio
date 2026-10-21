/* Cal & Sombra — one sun for the whole page.
   Shared by main.js (page), hero.js (Three.js study model) and _src/build-poster.mjs (static poster). */

const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// A stylised midsummer day in Porto: up at 06:00, down at 21:00, 58° at its highest.
export const DAY = { rise: 6, set: 21, peak: 58 };

// The hours the page passes through, top to bottom. Section labels carry the same numbers.
export const HOURS = { top: 7, pinEnd: 15.75, work: 16, practice: 17, services: 18, people: 19, contact: 20, end: 20.5 };

// Reduced motion and the no-JS/no-WebGL poster freeze the sun here.
export const FROZEN_HOUR = 10.5;

/** Sun position for a clock hour: elevation and azimuth in degrees (azimuth from south, + toward west). */
export function sunAt(h) {
  const s = clamp((h - DAY.rise) / (DAY.set - DAY.rise), 0, 1);
  return { el: Math.max(0.4, DAY.peak * Math.sin(Math.PI * s)), az: -95 + 190 * s };
}

/** Unit vector pointing at the sun in model space: x east (right), y up, z south (toward the viewer). */
export function sunVector(el, az) {
  const ce = Math.cos(el * RAD);
  return [-Math.sin(az * RAD) * ce, Math.sin(el * RAD), Math.cos(az * RAD) * ce];
}

/**
 * Cast shadow of upright type standing on the page. Length follows 1/tan(elevation), the lean follows
 * the azimuth (morning sun from the east throws it left, evening sun right). Returns the CSS matrix
 * terms for transform-origin at the baseline, matrix(1, 0, c, d, 0, 0), plus the length used for blur.
 */
export function typeShadow(el, az) {
  const L = 1 / Math.tan(Math.max(el, 4) * RAD);
  const c = clamp(-Math.sin(az * RAD) * L, -3.2, 3.2);
  const d = clamp(L * (0.35 + 0.65 * Math.cos(az * RAD)), 0.15, 3);
  return { c, d, len: Math.hypot(c, d) };
}

export function clockText(h) {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/*
 * The study model: eleven white slabs on an irregular courtyard plan, 18.4 × 12.6 m.
 * Metres, x east, z south, y up. [x0, z0, x1, z1, height, base, rotation° about the centre]
 */
export const SLABS = [
  [-9.2, -6.3, 4.0, -5.85, 5.4, 0, 0],    // north wall
  [5.2, -6.3, 9.2, -3.6, 7.2, 0, 0],      // stair tower
  [-9.2, -5.85, -8.75, 2.4, 3.6, 0, 0],   // west wall
  [-9.2, 5.85, -2.6, 6.3, 2.1, 0, 0],     // south-west low wall
  [0.8, 5.85, 9.2, 6.3, 3.0, 0, 0],       // south-east wall
  [8.75, -1.2, 9.2, 5.85, 4.4, 0, 0],     // east wall
  [-8.75, -5.85, -3.4, -1.6, 0.25, 3.2, 0], // canopy plate over the west wing
  [-3.7, -1.9, -3.4, -1.6, 3.2, 0, 0],    // canopy column
  [-2.0, -1.18, 3.2, -0.82, 2.6, 0, 12],  // freestanding screen wall in the courtyard
  [4.4, -3.6, 4.8, 2.2, 3.0, 0, 0],       // east-wing partition
  [-4.6, 2.6, -0.6, 3.4, 0.45, 0, 0]      // stone bench
];

// court: the courtyard dimension string runs between x = court[0] and court[1] at z = courtZ
export const PLAN = { x0: -9.2, z0: -6.3, x1: 9.2, z1: 6.3, court: [-3.4, 4.4], courtZ: 4.3 };
