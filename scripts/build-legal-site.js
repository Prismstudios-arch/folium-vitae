/**
 * Builds the public legal pages into docs/, which GitHub Pages serves free.
 *
 *   npm run legal:build
 *
 * App Store Connect requires a reachable privacy policy URL as a mandatory
 * submission field — the in-app screens do not satisfy it. These pages are
 * generated from src/content/legal.ts, the same data the app renders, so the
 * text a reviewer opens always matches the text in the build.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs");

// Reading the source rather than importing it keeps this a plain node script
// with no TypeScript toolchain in the way.
const legalSource = fs.readFileSync(path.join(ROOT, "src", "content", "legal.ts"), "utf8");
const configSource = fs.readFileSync(path.join(ROOT, "src", "constants", "config.ts"), "utf8");

const SUPPORT_EMAIL = configSource.match(/SUPPORT_EMAIL\s*=\s*"([^"]+)"/)?.[1];
const LAST_UPDATED = configSource.match(/LEGAL_LAST_UPDATED\s*=\s*"([^"]+)"/)?.[1];

if (!SUPPORT_EMAIL || !LAST_UPDATED) {
  console.error("Could not read SUPPORT_EMAIL / LEGAL_LAST_UPDATED from config.ts");
  process.exit(1);
}

/**
 * Evaluate the document literals out of the TypeScript source.
 *
 * The file is plain data with one interpolated constant, so stripping the
 * types and substituting that constant is enough — no compiler needed.
 */
function loadDocuments() {
  const body = legalSource
    .replace(/^import[\s\S]*?;$/gm, "")
    .replace(/export\s+type[\s\S]*?;\n/g, "")
    .replace(/export\s+interface[\s\S]*?\n}\n/g, "")
    .replace(/:\s*LegalDocument\b/g, "")
    .replace(/\$\{SUPPORT_EMAIL\}/g, SUPPORT_EMAIL)
    .replace(/export\s+const/g, "const");

  // eslint-disable-next-line no-new-func
  return new Function(`${body}; return { PRIVACY_POLICY, TERMS_OF_USE };`)();
}

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderBlocks(blocks) {
  const html = [];
  let openList = false;

  for (const block of blocks) {
    if (block.type === "bullet") {
      if (!openList) {
        html.push("<ul>");
        openList = true;
      }
      html.push(`<li>${escapeHtml(block.text)}</li>`);
      continue;
    }

    if (openList) {
      html.push("</ul>");
      openList = false;
    }

    if (block.type === "highlight") {
      html.push(`<div class="highlight">${escapeHtml(block.text)}</div>`);
    } else {
      html.push(`<p>${escapeHtml(block.text)}</p>`);
    }
  }

  if (openList) html.push("</ul>");

  return html.join("\n      ");
}

function renderPage(doc) {
  const sections = doc.sections
    .map(
      (section) =>
        `      <h2>${escapeHtml(section.heading)}</h2>\n      ${renderBlocks(section.blocks)}`
    )
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.title)} · Sorrel</title>
<style>
  :root {
    --ground: #FDFBF8;
    --ink: #1A1A1A;
    --ink-soft: #5C6B61;
    --leaf: #2D5842;
    --rule: #E8E5E0;
    --surface: #F1F4F0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground: #0C1410;
      --ink: #E8EDE7;
      --ink-soft: #9AA89E;
      --leaf: #6FC79A;
      --rule: #24302A;
      --surface: #151F1A;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 40rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
  a { color: var(--leaf); }
  .home { display: inline-block; margin-bottom: 2rem; font-weight: 500; text-decoration: none; }
  h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 .35rem; letter-spacing: -.02em; }
  .updated { color: var(--ink-soft); font-size: .875rem; margin: 0 0 2.5rem; }
  h2 { font-size: 1.1rem; margin: 2.25rem 0 .6rem; letter-spacing: -.01em; }
  p, li { color: var(--ink-soft); }
  ul { padding-left: 1.1rem; }
  li { margin-bottom: .4rem; }
  .highlight {
    background: var(--surface);
    border-left: 3px solid var(--leaf);
    border-radius: 4px;
    padding: 1rem 1.15rem;
    margin: 1.25rem 0;
    color: var(--ink);
  }
  footer { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid var(--rule); }
</style>
</head>
<body>
  <main>
    <a class="home" href="./">← Sorrel</a>
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="updated">Last updated ${escapeHtml(LAST_UPDATED)}</p>

      ${renderBlocks(doc.intro)}

${sections}

    <footer>
      <h2>Contact</h2>
      <p>Questions about any of this go to a person, not a form:</p>
      <p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    </footer>
  </main>
</body>
</html>
`;
}

function renderIndex() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sorrel</title>
<style>
  :root { --ground:#FDFBF8; --ink:#1A1A1A; --ink-soft:#5C6B61; --leaf:#2D5842; }
  @media (prefers-color-scheme: dark) {
    :root { --ground:#0C1410; --ink:#E8EDE7; --ink-soft:#9AA89E; --leaf:#6FC79A; }
  }
  body {
    margin:0; background:var(--ground); color:var(--ink);
    font:17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width:34rem; margin:0 auto; padding:5rem 1.5rem; }
  h1 { font-size:2.25rem; margin:0 0 .5rem; letter-spacing:-.025em; }
  .tagline { color:var(--ink-soft); margin:0 0 2.5rem; font-size:1.05rem; }
  a { color:var(--leaf); }
  ul { list-style:none; padding:0; }
  li { margin-bottom:.75rem; }
</style>
</head>
<body>
  <main>
    <h1>Sorrel</h1>
    <p class="tagline">The plant app that tells you when it doesn't know.</p>
    <ul>
      <li><a href="./privacy.html">Privacy</a></li>
      <li><a href="./terms.html">Terms of use</a></li>
      <li><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></li>
    </ul>
  </main>
</body>
</html>
`;
}

function main() {
  const { PRIVACY_POLICY, TERMS_OF_USE } = loadDocuments();

  fs.mkdirSync(OUT, { recursive: true });

  // Without this, GitHub Pages runs the output through Jekyll, which ignores
  // files and folders beginning with an underscore.
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

  for (const doc of [PRIVACY_POLICY, TERMS_OF_USE]) {
    const file = path.join(OUT, `${doc.slug}.html`);
    fs.writeFileSync(file, renderPage(doc));
    console.log(`  ${doc.slug}.html   ${doc.sections.length} sections`);
  }

  fs.writeFileSync(path.join(OUT, "index.html"), renderIndex());
  console.log("  index.html");

  console.log(`\nWritten to docs/`);
  console.log("Publish: GitHub repo → Settings → Pages → Source: main, folder: /docs\n");
}

main();
