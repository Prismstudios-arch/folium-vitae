/**
 * App Store screenshots: a real iPhone screenshot in a device frame, on the
 * brand background, under a caption.
 *
 *   node scripts/generate-store-screenshots.mjs
 *
 * Put screenshots taken on an iPhone in store/raw/, named as in
 * store/captions.json (01.png, 02.png…). Each becomes store/out/<name> at
 * 1290 × 2796 — a size App Store Connect accepts for the 6.9" iPhone slot,
 * which it scales down for smaller phones.
 *
 * The screens are never mocked up: Apple expects store screenshots to show
 * the app as it really is, and so do the people deciding whether to install.
 */

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "store");
// Overridable, so a layout change can be tried on other images without touching store/.
const RAW = process.env.STORE_RAW ?? path.join(STORE, "raw");
const OUT = process.env.STORE_OUT ?? path.join(STORE, "out");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const WIDTH = 1290;
const HEIGHT = 2796;

const captions = JSON.parse(fs.readFileSync(path.join(STORE, "captions.json"), "utf8"));

function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = ext === "jpg" ? "jpeg" : ext;
  return `data:image/${type};base64,${fs.readFileSync(file).toString("base64")}`;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "*word*" becomes the highlighted word; "\n" a line break. */
function formatTitle(title) {
  return escapeHtml(title)
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  return buffer.toString("ascii", 1, 4) === "PNG" ? { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) } : null;
}

function slideHtml({ title, body, theme }, screen, sprig) {
  const light = theme === "light";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;800&display=block">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body { font-family: "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif; -webkit-font-smoothing: antialiased; }

  .slide {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background:
      radial-gradient(1100px 900px at 88% 6%, ${light ? "rgba(143, 216, 111, 0.35)" : "rgba(143, 216, 111, 0.22)"}, transparent 62%),
      radial-gradient(900px 900px at 0% 100%, ${light ? "rgba(30, 122, 82, 0.10)" : "rgba(0, 0, 0, 0.35)"}, transparent 70%),
      ${light ? "linear-gradient(165deg, #F6FAF7 0%, #E3EFE7 100%)" : "linear-gradient(165deg, #1F7A57 0%, #0E4A33 48%, #062A1E 100%)"};
  }

  .sprig {
    position: absolute;
    right: -210px;
    top: 700px;
    width: 640px;
    transform: rotate(-6deg);
    opacity: ${light ? 0.9 : 1};
  }

  .caption {
    position: absolute;
    top: 200px;
    left: 110px;
    right: 110px;
  }

  h1 {
    font-size: 132px;
    line-height: 1.04;
    font-weight: 800;
    letter-spacing: -1.5px;
    color: ${light ? "#0F1A15" : "#FFFFFF"};
  }

  h1 em {
    font-style: normal;
    color: ${light ? "#1E7A52" : "#8FD86F"};
  }

  p {
    margin-top: 48px;
    font-size: 54px;
    line-height: 1.28;
    font-weight: 500;
    color: ${light ? "#44524C" : "rgba(255, 255, 255, 0.82)"};
  }

  .phone {
    position: absolute;
    top: 900px;
    left: 50%;
    width: 1020px;
    transform: translateX(-50%);
    padding: 24px;
    border-radius: 158px;
    background: #0A0F0D;
    box-shadow:
      0 0 0 6px ${light ? "#C9D6CE" : "#2C3B34"},
      0 90px 180px ${light ? "rgba(6, 42, 30, 0.28)" : "rgba(0, 0, 0, 0.5)"};
  }

  .screen {
    display: block;
    width: 100%;
    border-radius: 134px;
  }
</style>
</head>
<body>
  <div class="slide">
    <img class="sprig" src="${sprig}" alt="">
    <div class="caption">
      <h1>${formatTitle(title)}</h1>
      <p>${escapeHtml(body)}</p>
    </div>
    <div class="phone"><img class="screen" src="${screen}" alt=""></div>
  </div>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const sprig = dataUri(path.join(ROOT, "assets", "illustrations", "hero-sprig.png"));

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  let made = 0;

  try {
    for (const caption of captions) {
      const rawFile = path.join(RAW, caption.file);

      if (!fs.existsSync(rawFile)) {
        console.log(`  skip  ${caption.file} — no screenshot in store/raw (${caption.shot})`);
        continue;
      }

      const size = pngSize(rawFile);
      if (size && Math.abs(size.width / size.height - 1179 / 2556) > 0.02) {
        console.warn(`  note  ${caption.file} is ${size.width}×${size.height}; iPhone screenshots are about 9:19.5`);
      }

      const page = await browser.newPage();
      await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
      await page.setContent(slideHtml(caption, dataUri(rawFile), sprig), { waitUntil: "networkidle0" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(OUT, caption.file), type: "png" });
      await page.close();

      console.log(`  made  ${caption.file}`);
      made++;
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${made} of ${captions.length} screenshots written to store/out/.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
