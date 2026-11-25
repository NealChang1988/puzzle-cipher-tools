import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeLevels, parseLevelTsv, splitWords } from "../src/lib/wordlist.js";
import { headersFile, renderSite, robotsTxt, sitemapXml, symbolsCss } from "../src/render.js";

const root = fileURLToPath(new URL("..", import.meta.url));

export function loadConfig() {
  return JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));
}

export function build({ distDir, noindex = false, config = loadConfig() } = {}) {
  const dist = distDir || join(root, "dist");
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, "css"), { recursive: true });
  mkdirSync(join(dist, "js"), { recursive: true });
  mkdirSync(join(dist, "lib"), { recursive: true });
  mkdirSync(join(dist, "data"), { recursive: true });
  mkdirSync(join(dist, "fonts"), { recursive: true });
  mkdirSync(join(dist, "og"), { recursive: true });

  for (const page of renderSite(config, { noindex })) {
    const target = join(dist, page.file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, page.html);
  }
  writeFileSync(join(dist, "robots.txt"), robotsTxt(config, noindex));
  writeFileSync(join(dist, "sitemap.xml"), sitemapXml(config));
  writeFileSync(join(dist, "_headers"), headersFile(noindex));
  writeFileSync(join(dist, "css", "site.css"), readFileSync(join(root, "src", "site.css")));
  writeFileSync(join(dist, "css", "symbols.css"), symbolsCss());

  cpSync(join(root, "src", "client"), join(dist, "js"), { recursive: true });
  cpSync(join(root, "src", "lib"), join(dist, "lib"), { recursive: true });
  cpSync(join(root, "fonts", "puzzle-cipher-symbols.woff2"), join(dist, "fonts", "puzzle-cipher-symbols.woff2"));
  cpSync(join(root, "fonts", "puzzle-cipher-symbols-2.woff2"), join(dist, "fonts", "puzzle-cipher-symbols-2.woff2"));
  cpSync(join(root, "data", "OFL-NotoSansSymbols.txt"), join(dist, "fonts", "OFL.txt"));
  cpSync(join(root, "assets", "favicon.svg"), join(dist, "favicon.svg"));
  cpSync(join(root, "assets", "favicon.ico"), join(dist, "favicon.ico"));
  cpSync(join(root, "assets", "apple-touch-icon.png"), join(dist, "apple-touch-icon.png"));
  for (const name of [
    "og-morse.png",
    "og-anagram.png",
    "og-unscramble.png",
    "og-sudoku.png",
    "og-wingdings.png",
    "og-about.png",
    "og-privacy.png",
    "og-credits.png",
    "og-site.png",
  ]) {
    const base = name.replace(/^og-/, "").replace(/\.png$/, "");
    cpSync(join(root, "assets", name), join(dist, "og", `${base === "site" ? "site" : base}.png`));
  }

  const words = splitWords(readFileSync(join(root, "data", "enable1.txt"), "utf8"));
  const levels = parseLevelTsv(readFileSync(join(root, "data", "scowl-levels-le70.tsv"), "utf8"));
  writeFileSync(join(dist, "data", "enable1.txt"), words.join("\n") + "\n");
  writeFileSync(join(dist, "data", "levels.bin"), encodeLevels(words, levels));
  cpSync(join(root, "data", "offensive-single.txt"), join(dist, "data", "offensive.txt"));
  return dist;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dist = build({
    distDir: process.env.DIST_DIR || join(root, "dist"),
    noindex: process.env.NOINDEX === "1",
  });
  console.log(`Built ${dist} (${process.env.NOINDEX === "1" ? "preview, noindex" : "production"})`);
}
