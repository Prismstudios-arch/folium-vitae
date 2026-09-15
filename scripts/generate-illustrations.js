/**
 * Generates the in-app illustrations, drawn with exactly the leaf from the
 * app icon so the art and the brand are one thing.
 *
 *   node scripts/generate-illustrations.js
 *
 * The composition is a sprig: one curved stem entering from a corner, with
 * icon leaves set along it at the angles a real stem would hold them, and a
 * second, softer sprig behind for depth. It's generated rather than drawn by
 * hand so the leaves stay identical to the icon's at any size.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(__dirname, "..", "assets", "illustrations");

// The icon's leaf, base at the origin, pointing up.
const LEAF = "M 0 0 C 205 -85, 262 -340, 0 -588 C -262 -340, -205 -85, 0 0 Z";
const LEAF_LEFT = "M 0 0 C -205 -85, -262 -340, 0 -588 Z";
const MIDRIB = "M 0 -34 L 0 -554";
const VEINS = [
  "M 0 -120 C 55 -146, 108 -178, 150 -230",
  "M 0 -230 C 55 -258, 102 -300, 138 -356",
  "M 0 -340 C 38 -370, 70 -410, 92 -456",
];

const FRONT = { tip: "#DDF8A8", mid: "#8FD86F", base: "#3F9F5B", vein: "#1B5E3A" };
const BACK = { tip: "#9FD68A", mid: "#5BAE6E", base: "#2A7049", vein: "#123F28" };

let uid = 0;

function leaf({ x, y, angle, scale, colors, shadow }) {
  const id = `leaf${uid++}`;
  // Leaf axis points up (-90°); rotate it onto the requested direction.
  const rotation = angle + 90;

  return `
  <defs>
    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="-588" x2="0" y2="0">
      <stop offset="0%" stop-color="${colors.tip}"/>
      <stop offset="45%" stop-color="${colors.mid}"/>
      <stop offset="100%" stop-color="${colors.base}"/>
    </linearGradient>
    <linearGradient id="${id}-sheen" gradientUnits="userSpaceOnUse" x1="-260" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale})" ${shadow ? 'filter="url(#shadow)"' : ""}>
    <path d="${LEAF}" fill="url(#${id})"/>
    <path d="${LEAF_LEFT}" fill="url(#${id}-sheen)"/>
    <path d="${MIDRIB}" stroke="${colors.vein}" stroke-opacity="0.5" stroke-width="15" stroke-linecap="round"/>
    ${VEINS.map(
      (d) => `
    <path d="${d}" fill="none" stroke="${colors.vein}" stroke-opacity="0.32" stroke-width="9" stroke-linecap="round"/>
    <path d="${d}" transform="scale(-1 1)" fill="none" stroke="${colors.vein}" stroke-opacity="0.32" stroke-width="9" stroke-linecap="round"/>`
    ).join("")}
  </g>`;
}

/** Point on a quadratic Bézier and the direction of travel there, in degrees. */
function along([p0, p1, p2], t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    y: mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
    angle:
      (Math.atan2(
        2 * mt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]),
        2 * mt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
      ) *
        180) /
      Math.PI,
  };
}

/**
 * A stem with leaves. Nodes alternate sides and splay out at 42°; leaves get
 * smaller towards the growing tip, as they do on a real stem.
 */
function sprig({ curve, nodes, colors, shadow, stemWidth }) {
  const [p0, p1, p2] = curve;
  const stem = `<path d="M ${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}" fill="none" stroke="${colors.base}" stroke-width="${stemWidth}" stroke-linecap="round"/>`;

  const leaves = nodes.map(({ t, side, scale }) => {
    const point = along(curve, t);
    return leaf({
      x: point.x,
      y: point.y,
      angle: point.angle + side * 42,
      scale,
      colors,
      shadow,
    });
  });

  return `<g ${shadow ? 'filter="url(#shadow)"' : ""}>${stem}</g>${leaves.join("")}`;
}

const defs = `
  <defs>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="16"/>
      <feOffset dx="0" dy="18" result="blur"/>
      <feFlood flood-color="#00140C" flood-opacity="0.5"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soften"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>`;

/** For hero cards: enters from the bottom-right corner, reaches up and left. */
const heroSprig = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="900" viewBox="0 0 1000 900">
  ${defs}
  <g opacity="0.55" filter="url(#soften)">
    ${sprig({
      curve: [[1060, 700], [880, 520], [760, 180]],
      nodes: [
        { t: 0.35, side: 1, scale: 0.42 },
        { t: 0.65, side: -1, scale: 0.36 },
        { t: 1, side: 0, scale: 0.34 },
      ],
      colors: BACK,
      shadow: false,
      stemWidth: 12,
    })}
  </g>
  ${sprig({
    curve: [[1040, 960], [820, 820], [470, 380]],
    nodes: [
      { t: 0.3, side: -1, scale: 0.5 },
      { t: 0.55, side: 1, scale: 0.46 },
      { t: 0.8, side: -1, scale: 0.4 },
      { t: 1, side: 0, scale: 0.38 },
    ],
    colors: FRONT,
    shadow: true,
    stemWidth: 16,
  })}
</svg>`;

const targets = [{ name: "hero-sprig.png", svg: heroSprig, width: 1000, height: 900 }];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // The earlier, rejected illustrations.
  for (const stale of ["bouquet.png", "sprig.png"]) {
    fs.rmSync(path.join(OUT, stale), { force: true });
  }

  for (const target of targets) {
    await sharp(Buffer.from(target.svg), { density: 144 })
      .resize(target.width, target.height)
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, target.name));

    const { size } = fs.statSync(path.join(OUT, target.name));
    console.log(`  ${target.name.padEnd(16)} ${target.width}x${target.height}  ${(size / 1024).toFixed(1)}kb`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
