import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { search, createIndex } from "../src/lib/anagram.js";
import { translate } from "../src/lib/morse.js";
import { parseGrid } from "../src/lib/sudoku.js";
import { toSymbols, toText } from "../src/lib/wingdings.js";
import { encodeLevels, parseLevelTsv, splitWords } from "../src/lib/wordlist.js";

const words = splitWords(readFileSync(new URL("../data/enable1.txt", import.meta.url), "utf8"));
const index = createIndex(
  words,
  encodeLevels(words, parseLevelTsv(readFileSync(new URL("../data/scowl-levels-le70.tsv", import.meta.url), "utf8"))),
  splitWords(readFileSync(new URL("../data/offensive-single.txt", import.meta.url), "utf8")),
);

test("messy pasted input across the batch-1 tools", () => {
  assert.equal(translate("  SoS  \n").output, "... --- ...");
  assert.equal(translate("Hello,   WORLD!!!").output, translate("HELLO, WORLD!!!").output);
  assert.equal(translate("\uFF33\uFF2F\uFF33").output, "... --- ...");
  assert.equal(translate("...\u00A0---\u00A0...").output, "SOS");

  assert.deepEqual(
    search(index, "  P, L, O, E!! ", { mode: "any", minLength: 3 }).words.map((item) => item.word),
    search(index, "ploe", { mode: "any", minLength: 3 }).words.map((item) => item.word),
  );
  assert.equal(search(index, "ＬＩＳＴＥＮ", { mode: "all" }).words[0].word, "listen");
  assert.equal(search(index, "cat *", { mode: "all" }).words.some((item) => item.mask.some(Boolean)), true);

  const grid = parseGrid("５３０ ０７０ ０００\n600|195|000\n" + "0".repeat(63));
  assert.equal(grid.ok, true);
  assert.equal(grid.values.slice(0, 9).join(""), "530070000");

  const symbols = toSymbols("  Ｈｅｌｌｏ  ");
  assert.equal(toText(symbols.symbols).text, "  Hello  ");
  const junk = toSymbols("Hello\uFF01 é");
  assert.ok(junk.unknown.includes("é"));
  assert.equal(toText(junk.symbols).text.includes("Hello!"), true);
});
