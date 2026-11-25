import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeLevels, parseLevelTsv, splitWords } from "../src/lib/wordlist.js";
import { loadConfig } from "../scripts/build.js";
import { renderSite } from "../src/render.js";
import { mount as mountMorse } from "../src/client/morse-page.js";
import { mount as mountLetters } from "../src/client/letters-page.js";
import { mount as mountSudoku } from "../src/client/sudoku-page.js";
import { mount as mountWingdings } from "../src/client/wingdings-page.js";
import { installBrowserGlobals, parseDocument } from "./helpers/dom.js";

const config = loadConfig();
const pages = renderSite(config, { noindex: false });
const byPath = Object.fromEntries(pages.map((page) => [page.path, page.html]));

const words = splitWords(readFileSync(new URL("../data/enable1.txt", import.meta.url), "utf8"));
const levels = encodeLevels(words, parseLevelTsv(readFileSync(new URL("../data/scowl-levels-le70.tsv", import.meta.url), "utf8")));
const offensive = readFileSync(new URL("../data/offensive-single.txt", import.meta.url), "utf8");

function page(path, pathname) {
  const doc = parseDocument(byPath[path]);
  installBrowserGlobals(doc, {
    origin: config.canonicalOrigin,
    pathname,
    search: "",
    hash: "",
  });
  globalThis.fetch = async (url) => {
    if (url === "/data/enable1.txt") return { ok: true, text: async () => words.join("\n") };
    if (url === "/data/levels.bin") {
      return { ok: true, arrayBuffer: async () => levels.buffer.slice(levels.byteOffset, levels.byteOffset + levels.byteLength) };
    }
    if (url === "/data/offensive.txt") return { ok: true, text: async () => offensive };
    throw new Error("unexpected fetch " + url);
  };
  return doc;
}

test("each tool page module mounts and its controls run", async () => {
  const morse = page("/", "/");
  mountMorse(morse);
  morse.getElementById("morse-input").value = "SOS";
  await morse.getElementById("morse-input").dispatchEvent({ type: "input" });
  assert.equal(morse.getElementById("morse-output").value, "... --- ...");
  for (const id of ["btn-copy", "btn-play", "btn-stop", "btn-wav", "btn-txt", "btn-share", "btn-clear"]) {
    await morse.getElementById(id).click();
  }
  assert.equal(morse.getElementById("btn-play").querySelector(".btn-label").textContent, "Play sound");

  const anagram = page("/anagram-solver/", "/anagram-solver/");
  mountLetters(anagram);
  assert.equal(anagram.getElementById("mode-all").checked, true);
  anagram.getElementById("letters-input").value = "LISTEN";
  await anagram.getElementById("btn-find").click();
  const anagramText = anagram.getElementById("letters-results").textContent;
  assert.match(anagramText, /listen/);
  assert.ok(anagramText.indexOf("listen") < anagramText.indexOf("silent"));
  await anagram.getElementById("btn-copy").click();
  await anagram.getElementById("btn-clear").click();

  const unscramble = page("/unscramble-words/", "/unscramble-words/");
  mountLetters(unscramble);
  assert.equal(unscramble.getElementById("mode-any").checked, true);
  unscramble.getElementById("letters-input").value = "tca";
  await unscramble.getElementById("letters-input").dispatchEvent({ type: "input" });
  assert.match(unscramble.getElementById("letters-results").textContent, /act/);
  assert.match(unscramble.getElementById("letters-results").textContent, /cat/);
  unscramble.getElementById("min-length").value = "2";
  await unscramble.getElementById("min-length").dispatchEvent({ type: "change" });
  assert.match(unscramble.getElementById("letters-results").textContent, /ta/);

  const sudoku = page("/sudoku-solver/", "/sudoku-solver/");
  mountSudoku(sudoku);
  const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
  sudoku.getElementById("paste-input").value = puzzle;
  await sudoku.getElementById("paste-input").dispatchEvent({ type: "input" });
  assert.equal(sudoku.getElementById("cell-0").textContent, "5");
  await sudoku.getElementById("btn-solve").click();
  assert.equal(sudoku.getElementById("cell-2").textContent, "4");
  assert.match(sudoku.getElementById("sudoku-status").textContent, /Solved|more than one solution|no solution/i);
  await sudoku.getElementById("btn-hint").click();
  await sudoku.getElementById("btn-check").click();
  await sudoku.getElementById("btn-copy").click();
  await sudoku.getElementById("btn-download").click();
  await sudoku.getElementById("btn-clear").click();

  const symbols = page("/wingdings-translator/", "/wingdings-translator/");
  mountWingdings(symbols);
  symbols.getElementById("wd-text").value = "Hello";
  await symbols.getElementById("wd-text").dispatchEvent({ type: "input" });
  assert.ok(symbols.getElementById("wd-symbols").value.includes("\u{1F597}"));
  await symbols.getElementById("btn-copy-symbols").click();
  await symbols.getElementById("btn-copy-text").click();
  await symbols.getElementById("btn-png").click();
  await symbols.getElementById("btn-clear").click();
  assert.equal(symbols.getElementById("wd-text").value, "");
});
