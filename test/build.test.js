import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { TRADEMARK, tools } from "../src/registry.js";
import { loadConfig } from "../scripts/build.js";
import { headersFile, renderSite, robotsTxt, sitemapXml } from "../src/render.js";

const config = loadConfig();

function assertActionsWrap(css, label) {
  const blocks = css.match(/[^{}]*\.actions[^{]*\{[^}]*\}/g) || [];
  assert.ok(blocks.length > 0, `${label} has no .actions rule`);
  for (const block of blocks) {
    assert.equal(/nowrap/.test(block), false, `${label} nowrap: ${block}`);
    assert.equal(/overflow-x/.test(block), false, `${label} overflow-x: ${block}`);
    assert.equal(/overflow\s*:\s*auto/.test(block), false, `${label} overflow auto: ${block}`);
  }
  assert.match(css, /\.actions\s*\{[^}]*flex-wrap:\s*wrap/);
}

test("action buttons wrap instead of scrolling sideways", () => {
  assertActionsWrap(readFileSync(new URL("../src/site.css", import.meta.url), "utf8"), "src");
});

test("desktop nav is a plain list, not a closed details menu", () => {
  const css = readFileSync(new URL("../src/site.css", import.meta.url), "utf8");
  const blocks = css.match(/[^{}]*\.tools[^{]*\{[^}]*\}/g) || [];
  for (const block of blocks) {
    assert.equal(/overflow-x\s*:\s*(auto|scroll)/.test(block), false, block);
  }
  assert.match(css, /@media \(min-width: 960px\) \{[\s\S]*\.desktop-nav \{[^}]*display:\s*flex/);
  assert.match(css, /@media \(min-width: 960px\) \{[\s\S]*\.tool-menu \{\s*display:\s*none/);
  const home = renderSite(config, { noindex: false }).find((page) => page.path === "/").html;
  assert.match(home, /<nav class="tools desktop-nav"/);
  assert.equal(home.includes("<details"), true);
  const details = home.slice(home.indexOf("<details"), home.indexOf("</details>"));
  assert.equal(details.includes("desktop-nav"), false);
});

test("config keeps the site name and canonical origin in one file", () => {
  assert.equal(config.siteName, "Puzzle & Cipher Tools");
  assert.equal(config.canonicalOrigin, "https://puzzle-cipher-tools.example");
  assert.equal(config.feedbackEmail, "alan.chang198807@gmail.com");
  for (const banned of ["Wingdings", "Scrabble", "Wordle", "Boggle"]) {
    assert.equal(config.siteName.includes(banned), false);
  }
});

test("production pages use the spec titles and do not noindex", () => {
  const html = Object.fromEntries(renderSite(config, { noindex: false }).map((page) => [page.path, page.html]));
  for (const tool of tools) {
    assert.match(html[tool.path], new RegExp(`<title>${tool.title.replace(/&/g, "&amp;")}</title>`));
    assert.match(html[tool.path], new RegExp(`<h1>${tool.h1}</h1>`));
    assert.match(html[tool.path], new RegExp(`<a href="${tool.path}"[^>]*>${tool.name}</a>`));
    assert.equal(html[tool.path].includes("<form"), false);
    assert.equal(html[tool.path].includes('name="robots" content="noindex"'), false);
    assert.match(html[tool.path], new RegExp(TRADEMARK.replace(/[.]/g, "\\.")));
    assert.match(html[tool.path], /mailto:alan\.chang198807@gmail\.com/);
    assert.match(html[tool.path], />Puzzle &amp; Cipher Tools</);
  }
  assert.match(html["/credits/"], /ENABLE \(public domain\), compiled by Alan Beale and M\. Cooper/);
  assert.match(html["/credits/"], /The ENABLE master word list, WORD\.LST, is herewith formally released/);
  assert.match(html["/credits/"], /Offensive-word filter based on LDNOOBW/);
  assert.match(html["/credits/"], /SIL OPEN FONT LICENSE/);
  assert.match(html["/privacy/"], /not upload/i);
  assert.match(sitemapXml(config), /\/maze-generator\//);
  assert.match(sitemapXml(config), /\/word-search-generator\//);
  assert.match(sitemapXml(config), /\/cryptogram-solver\//);
  assert.match(sitemapXml(config), /\/crossword-solver\//);
  assert.equal(sitemapXml(config).includes("/word-search-maker/"), false);
  assert.match(sitemapXml(config), /<loc>https:\/\/puzzle-cipher-tools\.example\/anagram-solver\/<\/loc>/);
  assert.match(robotsTxt(config, false), /Allow: \//);
  assert.equal(robotsTxt(config, false).includes("Disallow"), false);
  assert.match(robotsTxt(config, true), /Disallow: \//);
  assert.match(headersFile(true), /X-Robots-Tag: noindex/);
  assert.equal(headersFile(false).includes("X-Robots-Tag"), false);
  const preview = renderSite(config, { noindex: true }).find((page) => page.path === "/");
  assert.match(preview.html, /name="robots" content="noindex"/);
});

test("preview build writes noindex files and prod build does not", () => {
  const prod = mkdtempSync(join(tmpdir(), "pct-prod-"));
  const preview = mkdtempSync(join(tmpdir(), "pct-preview-"));
  const run = (env, dir) =>
    spawnSync("node", ["scripts/build.js"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, ...env, DIST_DIR: dir },
      encoding: "utf8",
    });
  const prodRun = run({ NOINDEX: "" }, prod);
  assert.equal(prodRun.status, 0, prodRun.stderr);
  const previewRun = run({ NOINDEX: "1" }, preview);
  assert.equal(previewRun.status, 0, previewRun.stderr);
  assert.match(readFileSync(join(prod, "robots.txt"), "utf8"), /Allow: \//);
  assert.match(readFileSync(join(preview, "robots.txt"), "utf8"), /Disallow: \//);
  assert.match(readFileSync(join(preview, "_headers"), "utf8"), /X-Robots-Tag: noindex/);
  assert.equal(readFileSync(join(prod, "_headers"), "utf8").includes("X-Robots-Tag"), false);
  assert.match(readFileSync(join(preview, "index.html"), "utf8"), /noindex/);
  assert.equal(readFileSync(join(prod, "index.html"), "utf8").includes('content="noindex"'), false);
  const names = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else names.push(path.slice(prod.length).toLowerCase());
    }
  };
  walk(prod);
  for (const name of names) {
    const isFont = /\.(ttf|otf|eot|woff2?)$/.test(name);
    if (isFont) {
      assert.equal(/wingding|webding|segoe|calibri|comic|arial|times/.test(name), false, name);
    }
    assert.equal(name.endsWith(".ttf"), false, name);
  }
  assertActionsWrap(readFileSync(join(prod, "css", "site.css"), "utf8"), "dist");
  assert.ok(names.some((name) => name.endsWith("puzzle-cipher-symbols.woff2")));
  assert.ok(names.some((name) => name.endsWith("puzzle-cipher-symbols-2.woff2")));
});
