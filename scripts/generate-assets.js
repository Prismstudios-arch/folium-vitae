/**
 * Generates the app's icon, splash, favicon and in-app brand mark from
 * vector sources.
 *
 * Assets are generated rather than committed as hand-made binaries so the
 * mark can be adjusted in one place and every size stays consistent. Run:
 *   node scripts/generate-assets.js
 *
 * The mark: a single leaf inside a camera viewfinder. It says "plant
 * identification" in the time it takes to scan a home screen, which the
 * previous arrow-shaped sorrel leaf did not — at icon size it read as a
 * spade, or a rocket.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "assets");

// --- Brand ----------------------------------------------------------------

const GROUND_LIT = "#1F7A57"; // top-left, where the light comes from
const GROUND_DEEP = "#05261B"; // bottom-right; also the splash background
const GLOW = "#4DB883"; // halo behind the leaf so it sits in light, not on a slab
const LEAF_TIP = "#DDF8A8"; // new growth is paler at the tip
const LEAF_MID = "#8FD86F";
const LEAF_BASE = "#3F9F5B";
const VEIN = "#1B5E3A";

// Leaf, pointing straight up, centred on the origin. Rotated into place.
const LEAF = "M 0 270 C 205 185, 262 -70, 0 -318 C -262 -70, -205 185, 0 270 Z";
const LEAF_LEFT_HALF = "M 0 270 C -205 185, -262 -70, 0 -318 Z";
// Straight, so the mirrored side veins actually meet it. A curved midrib
// left the left-hand veins floating free of it.
const MIDRIB = "M 0 236 L 0 -284";
const STEM = "M 0 248 C 6 300, -2 340, -30 376";
const VEINS = [
  "M 0 150 C 55 124, 108 92, 150 40",
  "M 0 40 C 55 12, 102 -30, 138 -86",
  "M 0 -70 C 38 -100, 70 -140, 92 -186",
];

// The viewfinder. Inset so the corners clear iOS's squircle mask with room
// to spare, and so the glass treatment on iOS 26 doesn't crowd them.
const FRAME = { min: 212, max: 812, arm: 120, radius: 50, stroke: 36 };

function frameCorners({ color, opacity }) {
  const { min, max, arm, radius, stroke } = FRAME;
  const corners = [
    `M ${min} ${min + arm} L ${min} ${min + radius} Q ${min} ${min} ${min + radius} ${min} L ${min + arm} ${min}`,
    `M ${max - arm} ${min} L ${max - radius} ${min} Q ${max} ${min} ${max} ${min + radius} L ${max} ${min + arm}`,
    `M ${max} ${max - arm} L ${max} ${max - radius} Q ${max} ${max} ${max - radius} ${max} L ${max - arm} ${max}`,
    `M ${min + arm} ${max} L ${min + radius} ${max} Q ${min} ${max} ${min} ${max - radius} L ${min} ${max - arm}`,
  ];

  return corners
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join("\n");
}

/**
 * The leaf, with its gradient, sheen, veins and shadow.
 * `mono` renders it in greys for the tinted icon, where iOS supplies colour.
 */
function leaf({ id, mono = false, shadow = true }) {
  const tip = mono ? "#FFFFFF" : LEAF_TIP;
  const mid = mono ? "#E4E4E4" : LEAF_MID;
  const base = mono ? "#BDBDBD" : LEAF_BASE;
  const vein = mono ? "#6E6E6E" : VEIN;

  return `
  <defs>
    <linearGradient id="${id}-fill" gradientUnits="userSpaceOnUse" x1="0" y1="-318" x2="0" y2="270">
      <stop offset="0%" stop-color="${tip}"/>
      <stop offset="45%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${base}"/>
    </linearGradient>
    <linearGradient id="${id}-sheen" gradientUnits="userSpaceOnUse" x1="-260" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <filter id="${id}-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="22"/>
      <feOffset dx="0" dy="20" result="blur"/>
      <feFlood flood-color="#01120C" flood-opacity="0.55"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g ${shadow ? `filter="url(#${id}-shadow)"` : ""}>
    <path d="${STEM}" fill="none" stroke="${mid}" stroke-width="24" stroke-linecap="round"/>
    <path d="${LEAF}" fill="url(#${id}-fill)"/>
    <path d="${LEAF_LEFT_HALF}" fill="url(#${id}-sheen)"/>
    <path d="${MIDRIB}" fill="none" stroke="${vein}" stroke-opacity="0.5" stroke-width="15" stroke-linecap="round"/>
    ${VEINS.map(
      (d) => `
    <path d="${d}" fill="none" stroke="${vein}" stroke-opacity="0.32" stroke-width="9" stroke-linecap="round"/>
    <path d="${d}" transform="scale(-1 1)" fill="none" stroke="${vein}" stroke-opacity="0.32" stroke-width="9" stroke-linecap="round"/>`
    ).join("")}
  </g>`;
}

/** Leaf placed and rotated on a 1024 canvas. */
function placedLeaf(options, scale = 0.8) {
  return `<g transform="translate(512 512) rotate(38) scale(${scale})">${leaf(options)}</g>`;
}

function ground(id) {
  return `
  <defs>
    <linearGradient id="${id}-ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GROUND_LIT}"/>
      <stop offset="100%" stop-color="${GROUND_DEEP}"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="512" cy="480" r="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${GLOW}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${GLOW}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#${id}-ground)"/>
  <rect width="1024" height="1024" fill="url(#${id}-glow)"/>`;
}

const svg = (body, width = 1024, height = 1024, viewBox = "0 0 1024 1024") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${body}</svg>`;

// --- Sources --------------------------------------------------------------

/** iOS light icon. Full bleed: iOS applies its own corner mask. */
const icon = svg(`
  ${ground("icon")}
  ${frameCorners({ color: "#FFFFFF", opacity: 0.92 })}
  ${placedLeaf({ id: "icon" })}
`);

/**
 * iOS dark icon. Apple asks for the foreground on a transparent background;
 * the system draws its own dark ground behind it.
 */
const iconDark = svg(`
  ${frameCorners({ color: "#FFFFFF", opacity: 0.85 })}
  ${placedLeaf({ id: "dark", shadow: false })}
`);

/** iOS tinted icon: greyscale luminance only. iOS supplies the tint colour. */
const iconTinted = svg(`
  ${frameCorners({ color: "#FFFFFF", opacity: 0.9 })}
  ${placedLeaf({ id: "tint", mono: true, shadow: false })}
`);

/** Android adaptive foreground: inside the inner 66%, launchers crop the rest. */
const adaptiveIcon = svg(`
  <g transform="translate(512 512) scale(0.66) translate(-512 -512)">
    ${frameCorners({ color: "#FFFFFF", opacity: 0.92 })}
    ${placedLeaf({ id: "adaptive" })}
  </g>
`);

/** Splash: the mark small and centred on the deep ground. */
const splash = svg(
  `
  <rect width="1284" height="2778" fill="${GROUND_DEEP}"/>
  <g transform="translate(642 1389) scale(0.36) translate(-512 -512)">
    ${frameCorners({ color: "#FFFFFF", opacity: 0.92 })}
    ${placedLeaf({ id: "splash" })}
  </g>
`,
  1284,
  2778,
  "0 0 1284 2778"
);

/**
 * The app icon as it appears on a home screen, for use inside the app —
 * onboarding and the home header — so the brand is the same everywhere.
 */
const brandMark = svg(`
  <defs><clipPath id="squircle"><rect width="1024" height="1024" rx="230"/></clipPath></defs>
  <g clip-path="url(#squircle)">
    ${ground("mark")}
    ${frameCorners({ color: "#FFFFFF", opacity: 0.92 })}
    ${placedLeaf({ id: "mark" })}
  </g>
`);

const favicon = brandMark;

/** Notification icon: Android renders a silhouette, so it is flat white. */
const notificationIcon = svg(`
  <g transform="translate(512 512) rotate(38) scale(0.85)">
    <path d="${LEAF}" fill="#FFFFFF"/>
  </g>
`);

const targets = [
  { name: "icon.png", svg: icon, size: 1024, flatten: true },
  { name: "icon-dark.png", svg: iconDark, size: 1024 },
  { name: "icon-tinted.png", svg: iconTinted, size: 1024 },
  { name: "adaptive-icon.png", svg: adaptiveIcon, size: 1024 },
  { name: "splash.png", svg: splash, width: 1284, height: 2778, flatten: true },
  { name: "brand-mark.png", svg: brandMark, size: 512 },
  { name: "favicon.png", svg: favicon, size: 48 },
  { name: "notification-icon.png", svg: notificationIcon, size: 96 },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  for (const target of targets) {
    const width = target.width ?? target.size;
    const height = target.height ?? target.size;

    let image = sharp(Buffer.from(target.svg), { density: 144 }).resize(width, height);

    // App Store Connect rejects an icon with an alpha channel.
    if (target.flatten) image = image.flatten({ background: GROUND_DEEP });

    await image.png({ compressionLevel: 9 }).toFile(path.join(OUT, target.name));

    const { size } = fs.statSync(path.join(OUT, target.name));
    console.log(`  ${target.name.padEnd(24)} ${width}x${height}  ${(size / 1024).toFixed(1)}kb`);
  }

  console.log("\nAssets written to assets/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
