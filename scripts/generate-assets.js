/**
 * Generates the app's icon, splash and favicon from vector sources.
 *
 * Assets are generated rather than committed as binaries so the mark can be
 * adjusted in one place and every size stays consistent. Run with:
 *   node scripts/generate-assets.js
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "assets");

// --- Brand ----------------------------------------------------------------

const INK_DEEP = "#0C2A1F"; // near-black green, the icon ground
const INK_MID = "#27614A"; // lifted green: the ground reads as lit, not flat
const LEAF = "#F2F7F0"; // near-white with a green cast — maximum silhouette
const ACCENT = "#6FC79A"; // fresh sage, used sparingly

/**
 * A sorrel leaf: sagittate, meaning arrow-shaped with two backward-pointing
 * basal lobes. Chosen because the silhouette is unmistakably not the monstera
 * fan every other app in this category uses — it has to read as ours at 40px.
 *
 * Drawn down the right side and mirrored up the left, so it is exactly
 * symmetrical about x=512.
 */
const LEAF_PATH = [
  "M 512 150", // apex
  "C 604 296, 726 436, 748 578", // right edge, out to the widest point
  "C 764 672, 706 722, 636 742", // back in to the waist above the lobes
  "C 692 776, 728 818, 736 866", // right basal lobe, out and down
  "C 668 872, 592 852, 540 812", // lobe's inner edge, back toward the base
  "L 512 860", // shallow central notch
  "L 484 812",
  "C 432 852, 356 872, 288 866", // left lobe, mirrored
  "C 296 818, 332 776, 388 742",
  "C 318 722, 260 672, 276 578",
  "C 298 436, 420 296, 512 150",
  "Z",
].join(" ");

/**
 * The midrib is cut out of the leaf rather than drawn on top, so the ground
 * shows through. A negative-space cut stays crisp when the icon is scaled
 * down; a thin light-on-light stroke turns to mush.
 */
function leafMark({ fill = LEAF, cutColor = null }) {
  // Stops well inside the blade. Running it to the base made it break out of
  // the silhouette at the notch and read as a stray mark rather than a vein.
  const midrib = cutColor
    ? `<path d="M 512 258 L 512 792" stroke="${cutColor}" stroke-width="34"
         stroke-linecap="round" fill="none"/>`
    : "";

  return `
    <path d="${LEAF_PATH}" fill="${fill}"/>
    ${midrib}
  `;
}

// --- Sources --------------------------------------------------------------

/** iOS app icon. Full bleed: iOS applies its own corner mask. */
const icon = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${INK_MID}"/>
      <stop offset="100%" stop-color="${INK_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#ground)"/>
  <g transform="translate(512 512) scale(0.87) translate(-512 -512)">
    ${leafMark({ cutColor: INK_DEEP })}
  </g>
</svg>`;

/**
 * Android adaptive foreground. The mark sits inside the inner 66% because
 * launchers mask these to arbitrary shapes and crop the outer ring.
 */
const adaptiveIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(0.54) translate(-512 -512)">
    ${leafMark({ cutColor: "none" })}
  </g>
</svg>`;

/** Splash: the mark alone on the brand ground, small and centred. */
const splash = `
<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
  <rect width="1284" height="2778" fill="${INK_DEEP}"/>
  <g transform="translate(642 1389) scale(0.42) translate(-512 -512)">
    ${leafMark({ cutColor: INK_DEEP })}
  </g>
</svg>`;

const favicon = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="180" fill="${INK_DEEP}"/>
  <g transform="translate(512 512) scale(0.78) translate(-512 -512)">
    ${leafMark({ cutColor: INK_DEEP })}
  </g>
</svg>`;

/** Notification icon: Android renders this as a silhouette, so it is flat white. */
const notificationIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(0.8) translate(-512 -512)">
    <path d="${LEAF_PATH}" fill="#FFFFFF"/>
  </g>
</svg>`;

const targets = [
  { name: "icon.png", svg: icon, size: 1024 },
  { name: "adaptive-icon.png", svg: adaptiveIcon, size: 1024 },
  { name: "splash.png", svg: splash, width: 1284, height: 2778 },
  { name: "favicon.png", svg: favicon, size: 48 },
  { name: "notification-icon.png", svg: notificationIcon, size: 96 },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  for (const target of targets) {
    const width = target.width ?? target.size;
    const height = target.height ?? target.size;

    await sharp(Buffer.from(target.svg))
      .resize(width, height)
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, target.name));

    const { size } = fs.statSync(path.join(OUT, target.name));
    console.log(`  ${target.name.padEnd(24)} ${width}x${height}  ${(size / 1024).toFixed(1)}kb`);
  }

  console.log("\nAssets written to assets/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
