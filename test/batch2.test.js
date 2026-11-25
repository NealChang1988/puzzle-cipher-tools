import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findPattern } from "../src/lib/crossword.js";
import { hideOffensive, solveCryptogram } from "../src/lib/cryptogram.js";
import { analyzeMaze, generateMaze, sameMaze } from "../src/lib/maze.js";
import { mazeDocument, wordSearchDocument, wordSearchPdf } from "../src/lib/pdf.js";
import {
  cleanWord,
  countStraight,
  generateWordSearch,
  placementFollows,
  SIMPLE_DIRECTIONS,
} from "../src/lib/wordsearch.js";
import { parseLevelTsv, splitWords } from "../src/lib/wordlist.js";

const words = splitWords(readFileSync(new URL("../data/enable1.txt", import.meta.url), "utf8"));
const levelMap = parseLevelTsv(readFileSync(new URL("../data/scowl-levels-le70.tsv", import.meta.url), "utf8"));
const offensive = new Set(splitWords(readFileSync(new URL("../data/offensive-single.txt", import.meta.url), "utf8")));
const levelOf = new Map();
for (const word of words) levelOf.set(word, levelMap.get(word) || 0);
for (const extra of ["a", "i"]) levelOf.set(extra, levelMap.get(extra) || 0);
const dictionary = { words, levelOf };

const CIPHER = "YGXK LEGKT QFR LTCTF NTQKL QUG GXK YQZITKL WKGXUIZ YGKZI GF ZIOL EGFZOFTFZ Q FTV FQZOGF";
const PLAIN = "FOUR SCORE AND SEVEN YEARS AGO OUR FATHERS BROUGHT FORTH ON THIS CONTINENT A NEW NATION";

test("maze seeds stay perfect, connected, and repeatable", () => {
  const cases = [
    [10, 10, 12345, 99],
    [25, 15, 2026, 374],
    [5, 5, 1, 24],
  ];
  for (const [width, height, seed, passages] of cases) {
    const maze = generateMaze(width, height, seed);
    const again = generateMaze(width, height, seed);
    const other = generateMaze(width, height, seed + 1);
    const info = analyzeMaze(maze);
    assert.equal(info.passages, passages);
    assert.equal(info.perfectCount, true);
    assert.equal(info.connected, true);
    assert.equal(info.uniquePath, true);
    assert.equal(info.pathReachesExit, true);
    assert.equal(info.pathLength > 1, true);
    assert.equal(sameMaze(maze, again), true);
    assert.equal(sameMaze(maze, other), false);
  }
  const big = generateMaze(100, 100, 7);
  assert.equal(analyzeMaze(big).passages, 10000 - 1);
  assert.match(mazeDocument(generateMaze(5, 5, 1)), /^%PDF-1\.4/);
});

test("word search placement rules, cleaning, and a word that does not fit", () => {
  assert.equal(cleanWord("ice cream").letters, "ICECREAM");
  assert.equal(cleanWord("T-Rex").letters, "TREX");
  const puzzle = generateWordSearch({
    text: "cat, dog, elephant, zebra, lion, hippo, ice cream, T-Rex",
    size: 12,
    directions: SIMPLE_DIRECTIONS,
    seed: 1,
  });
  assert.equal(puzzle.ok, true);
  assert.equal(puzzle.placed.length, 8);
  assert.equal(placementFollows(puzzle.grid, puzzle.placed, SIMPLE_DIRECTIONS), true);
  const originals = puzzle.placed.map((item) => item.original);
  assert.ok(originals.includes("ice cream"));
  assert.ok(originals.includes("T-Rex"));
  for (const item of puzzle.placed) assert.equal(countStraight(puzzle.grid, item.letters), 1);
  const again = generateWordSearch({
    text: "cat, dog, elephant, zebra, lion, hippo, ice cream, T-Rex",
    size: 12,
    directions: SIMPLE_DIRECTIONS,
    seed: 1,
  });
  assert.deepEqual(again.grid, puzzle.grid);
  const tooLong = generateWordSearch({ text: "abcdefghijklmnop", size: 12, seed: 1 });
  assert.equal(tooLong.placed.length, 0);
  assert.match(tooLong.skipped[0].reason, /longer than the grid \(12\)/);
  const example = generateWordSearch({
    text: "cat, dog, elephant, zebra, lion, hippo, ice cream, T-Rex",
    size: 12,
    directions: SIMPLE_DIRECTIONS,
    seed: 1,
  });
  const puzzlePage = wordSearchPdf(example, { title: "Example", answer: false });
  const answerPage = wordSearchPdf(example, { title: "Example", answer: true });
  assert.notEqual(puzzlePage.stream, answerPage.stream);
  const boxes = answerPage.stream.match(/ re S/g) || [];
  const letters = example.placed.reduce((sum, item) => sum + item.letters.length, 0);
  assert.equal(boxes.length, letters);
  assert.equal((puzzlePage.stream.match(/ re S/g) || []).length, 0);
  const pdf = wordSearchDocument(example, "Example");
  assert.equal(pdf.includes(answerPage.stream), true);
  assert.notEqual(pdf.indexOf(puzzlePage.stream), pdf.lastIndexOf(" re S"));
});

test("cryptogram ranks the Lincoln line first", () => {
  const solved = solveCryptogram(CIPHER, dictionary);
  assert.equal(solved.ok, true);
  assert.equal(solved.timedOut, false);
  assert.equal(solved.solutions.length, 24);
  const texts = solved.solutions.map((item) => item.text);
  for (const sample of [
    "FOUR SCORE ANY SEMEN LEARS AGO OUR FATHERS DROUGHT FORTH ON THIS CONTINENT A NEB NATION",
    "FOUR SCORE ANY SEMEN PEARS AGO OUR FATHERS DROUGHT FORTH ON THIS CONTINENT A NEB NATION",
    "FOUR SCORE ANY SEMEN WEARS AGO OUR FATHERS DROUGHT FORTH ON THIS CONTINENT A NEB NATION",
    "FOUR SCORE AND SEMEN LEARS AGO OUR FATHERS BROUGHT FORTH ON THIS CONTINENT A NEW NATION",
    "FOUR SCORE AND SEMEN PEARS AGO OUR FATHERS BROUGHT FORTH ON THIS CONTINENT A NEW NATION",
  ]) {
    assert.equal(texts.includes(sample), true, sample);
  }
  assert.equal(texts[0], PLAIN);
  assert.equal(texts[1], "FOUR SCORE AND SEMEN YEARS AGO OUR FATHERS BROUGHT FORTH ON THIS CONTINENT A NEW NATION");
  assert.equal(texts[2], "FOUR SCORE AND SEVEN PEARS AGO OUR FATHERS BROUGHT FORTH ON THIS CONTINENT A NEW NATION");
  const hinted = solveCryptogram(CIPHER, dictionary, { known: "Q=A" });
  assert.equal(hinted.solutions.length, 24);
  assert.equal(hinted.solutions[0].text, PLAIN);
  const visible = hideOffensive(solved.solutions, offensive);
  assert.equal(visible.shown[0].text, PLAIN);
  assert.equal(visible.shown.some((item) => /\bSEMEN\b/.test(item.text)), false);
  assert.ok(visible.hidden >= 1);
});

test("crossword patterns match the ENABLE counts", () => {
  const cat = findPattern(words, levelOf, offensive, "C?T");
  assert.deepEqual(cat.words.slice().sort(), ["cat", "cot", "cut"]);
  assert.deepEqual(findPattern(words, levelOf, offensive, "c_t").words.slice().sort(), ["cat", "cot", "cut"]);
  const puzzle = findPattern(words, levelOf, offensive, "PU??LE");
  assert.deepEqual(puzzle.words.slice().sort(), ["puddle", "pungle", "purfle", "purple", "puzzle"]);
  const many = findPattern(words, levelOf, offensive, "?A?E?");
  assert.equal(many.total, 407);
  assert.deepEqual(many.words.slice().sort().slice(0, 10), [
    "aahed",
    "baaed",
    "babel",
    "babes",
    "bagel",
    "baked",
    "baker",
    "bakes",
    "baled",
    "baler",
  ]);
  assert.equal(findPattern(words, levelOf, offensive, "QZ?").words.length, 0);
  assert.match(findPattern(words, levelOf, offensive, "?".repeat(30)).error, /28/);
  const threes = findPattern(words, levelOf, offensive, "???");
  assert.equal(threes.total, 972);
  assert.equal(threes.words.length, 967);
  assert.equal(threes.hidden, 5);
});

test("messy batch-2 input", () => {
  const cream = cleanWord("  Ice-Cream!! ");
  assert.equal(cream.letters, "ICECREAM");
  const sheet = generateWordSearch({
    text: "  Ice-Cream ,  t-rex \n cat ",
    size: 12,
    directions: SIMPLE_DIRECTIONS,
    seed: 3,
  });
  assert.equal(sheet.ok, true);
  assert.deepEqual(
    sheet.placed.map((item) => item.letters).sort(),
    ["CAT", "ICECREAM", "TREX"],
  );
  const lower = solveCryptogram(CIPHER.toLowerCase() + "  ", dictionary);
  assert.equal(lower.solutions[0].text.trim(), PLAIN);
  assert.deepEqual(findPattern(words, levelOf, offensive, "Ｃ？Ｔ").words.slice().sort(), ["cat", "cot", "cut"]);
  assert.deepEqual(findPattern(words, levelOf, offensive, "c . t").words.slice().sort(), ["cat", "cot", "cut"]);
  const wide = generateMaze(10, 10, 12345);
  assert.equal(sameMaze(wide, generateMaze(10, 10, 12345)), true);
});
