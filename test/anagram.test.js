import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  NO_WORDS,
  cleanLetters,
  createIndex,
  hiddenMessage,
  search,
  sortByLengthThenAlpha,
} from "../src/lib/anagram.js";
import { encodeLevels, parseLevelTsv, splitWords } from "../src/lib/wordlist.js";

const enableText = readFileSync(new URL("../data/enable1.txt", import.meta.url));
const tsvText = readFileSync(new URL("../data/scowl-levels-le70.tsv", import.meta.url), "utf8");
const offensiveText = readFileSync(new URL("../data/offensive-single.txt", import.meta.url), "utf8");
const ldnoobw = readFileSync(new URL("../data/ldnoobw-en.txt", import.meta.url));

const words = splitWords(enableText.toString("utf8"));
const levels = parseLevelTsv(tsvText);
const offensive = splitWords(offensiveText);
const index = createIndex(words, encodeLevels(words, levels), offensive);

function names(result) {
  return result.words.map((item) => item.word);
}

test("source files match the published checksums and counts", () => {
  assert.equal(createHash("md5").update(enableText).digest("hex"), "33f2b09e2d9dfb732fa16b5f05a5a8d1");
  assert.equal(
    createHash("sha256").update(ldnoobw).digest("hex"),
    "af851ecef1d5f212caba17339b12ac39cc2fef7d78c74876f67237644fcee8bd",
  );
  assert.equal(words.length, 172823);
  assert.equal(levels.size, 111596);
  const enable = new Set(words);
  const overlap = offensive.filter((word) => enable.has(word));
  assert.equal(overlap.length, 145);
});

test("LISTEN, evil, tca, ploe, cat? and qzx", () => {
  const listen = names(search(index, "LISTEN", { mode: "all", minLength: 3 }));
  assert.deepEqual(listen.slice().sort(), ["elints", "enlist", "inlets", "listen", "silent", "tinsel"]);
  assert.deepEqual(listen, ["listen", "silent", "enlist", "inlets", "tinsel", "elints"]);

  const evil = names(search(index, "evil", { mode: "all", minLength: 3 }));
  assert.deepEqual(evil.slice().sort(), ["evil", "live", "veil", "vile"]);
  assert.deepEqual(evil, ["live", "evil", "vile", "veil"]);

  assert.deepEqual(names(search(index, "tca", { mode: "any", minLength: 3 })), ["act", "cat"]);
  assert.deepEqual(names(search(index, "tca", { mode: "any", minLength: 2 })), ["act", "cat", "at", "ta"]);

  const ploe = names(search(index, "ploe", { mode: "any", minLength: 3 }));
  assert.deepEqual(sortByLengthThenAlpha(ploe), ["lope", "pole", "lop", "ole", "ope", "pol"]);
  assert.deepEqual(ploe, ["pole", "lope", "lop", "pol", "ope", "ole"]);

  const cat = names(search(index, "cat?", { mode: "all", minLength: 3 }));
  assert.deepEqual(cat.slice().sort().slice(0, 5), ["acta", "acts", "cant", "cart", "cast"]);
  const acta = search(index, "cat?", { mode: "all" }).words.find((item) => item.word === "acta");
  assert.deepEqual(acta.mask, [false, false, false, true]);

  const none = search(index, "qzx", { mode: "any", minLength: 2 });
  assert.deepEqual(none.words, []);
  assert.equal(NO_WORDS.startsWith("No words found"), true);
});

test("every overlapping offensive word is hidden", () => {
  const enable = new Set(words);
  const overlap = offensive.filter((word) => enable.has(word));
  assert.equal(overlap.length, 145);
  for (const word of overlap) {
    const result = search(index, word, { mode: "all", minLength: 2 });
    assert.equal(names(result).includes(word), false, word);
    assert.ok(result.hidden >= 1);
  }
  assert.equal(hiddenMessage(3), "3 offensive words hidden");
  assert.equal(hiddenMessage(1), "1 offensive word hidden");
});

test("wildcard limit and letter limit", () => {
  assert.equal(search(index, "ab???", { mode: "all" }).ok, false);
  assert.match(search(index, "abcdefghijklmnop", { mode: "any" }).error, /15 letters/);
  assert.equal(cleanLetters("P, L, O, E!!").letters, "ploe");
  assert.equal(cleanLetters("ｔｃａ").letters, "tca");
  assert.equal(cleanLetters("cat？").wild, 1);
});
