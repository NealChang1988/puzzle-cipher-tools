# Puzzle & Cipher Tools

Free puzzle tools that run entirely in the browser. This repository is batch 1:

- `/` Morse Code Translator
- `/anagram-solver/` and `/unscramble-words/`
- `/sudoku-solver/`
- `/maze-generator/`
- `/wingdings-translator/`
- `/word-search-generator/`
- `/cryptogram-solver/`
- `/crossword-solver/`
- `/about/`, `/privacy/`, `/credits/`

Letter tools, the cryptogram solver, and the crossword helper share `src/lib/wordlist.js`. ENABLE has no `a` or `i`. The cryptogram solver adds those two single-letter words. The crossword helper does not read clues.

The site name and canonical origin live only in `site.config.json`. The working name is **Puzzle & Cipher Tools**. The origin is a placeholder until a domain is chosen.

## Build

Requires Node.js 20 or newer. There are no npm dependencies.

Production build (writes `dist/`, safe to commit, allows indexing):

```bash
npm run build
```

Preview build (same `dist/` folder, but `robots.txt` is `Disallow: /`, every page gets `<meta name="robots" content="noindex">`, and `_headers` sends `X-Robots-Tag: noindex`):

```bash
npm run build:preview
```

That is `NOINDEX=1 node scripts/build.js`. It overwrites `dist/`. Run `npm run build` again before committing if you generated a preview. To keep the committed production files in place, send the preview somewhere else:

```bash
NOINDEX=1 DIST_DIR=dist-preview npm run build
```

`dist/` in git is the production build. Deploy that directory yourself as a Cloudflare Worker static-asset site. `wrangler.jsonc` points `assets.directory` at `./dist`. This repo does not deploy.

Change `canonicalOrigin` in `site.config.json`, then rebuild, when the domain is chosen. Sitemap and canonical links read that value.

## Tests

```bash
npm test
```

`npm test` runs the unit tests, then `node scripts/check-nav.mjs`. That script opens headless Chrome against the built site and checks that all nine tool names have a real box on screen at 1024, 1280, and 1440, and that the Tools menu at 375px opens to the same nine names. Chrome must be on `PATH` (`google-chrome`). Set `CHROME_PATH` if it lives somewhere else.

Rebuilding the symbol-font subsets needs Python `fonttools` and `brotli` (`pip install fonttools brotli`). The coverage test reads the committed `.woff2` files with fontTools.

## Data and fonts

- `data/enable1.txt` — ENABLE, public domain, md5 `33f2b09e2d9dfb732fa16b5f05a5a8d1`
- `data/scowl-levels-le70.tsv` — SCOWL 2020.12.07 levels 10–70 (111,596 words)
- `data/ldnoobw-en.txt` — LDNOOBW English list at commit `5faf2ba`, sha256 `af851ecef1d5f212caba17339b12ac39cc2fef7d78c74876f67237644fcee8bd`
- `data/offensive-single.txt` — that list modified to single `a–z` words only (145 of them also appear in ENABLE)
- `fonts/puzzle-cipher-symbols.woff2` and `fonts/puzzle-cipher-symbols-2.woff2` — subsets of Noto Sans Symbols and Noto Sans Symbols 2 (SIL OFL 1.1). The license is `data/OFL-NotoSansSymbols.txt` and is copied to `dist/fonts/OFL.txt`.

Word lists are fetched only by the letter tools, from `/data/` on this site. Nothing the visitor types is added to those requests. Share links keep the message in the URL hash.

No Microsoft font files are included. Wingdings is used only as the descriptive name of one tool. The footer states that Wingdings is a trademark of Microsoft and that this site is not affiliated with Microsoft.
