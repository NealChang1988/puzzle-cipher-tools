import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFLICT,
  LOW_GIVENS,
  MULTI,
  NONE,
  TIMEOUT,
  compactGrid,
  explain,
  findConflicts,
  formatGrid,
  hint,
  lowGivens,
  parseGrid,
  solve,
} from "../src/lib/sudoku.js";

const PUZZLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

test("wikipedia example has one exact solution", () => {
  const parsed = parseGrid(PUZZLE);
  assert.equal(parsed.ok, true);
  const result = solve(parsed.values);
  assert.equal(result.timedOut, false);
  assert.equal(result.solutions.length, 1);
  assert.equal(compactGrid(result.solutions[0]), SOLUTION);
  assert.equal(
    formatGrid(result.solutions[0]),
    [
      "5 3 4 6 7 8 9 1 2",
      "6 7 2 1 9 5 3 4 8",
      "1 9 8 3 4 2 5 6 7",
      "8 5 9 7 6 1 4 2 3",
      "4 2 6 8 5 3 7 9 1",
      "7 1 3 9 2 4 8 5 6",
      "9 6 1 5 3 7 2 8 4",
      "2 8 7 4 1 9 6 3 5",
      "3 4 5 2 8 6 1 7 9",
    ].join("\n"),
  );
  assert.equal(lowGivens(parsed.values), false);
});

test("conflict, multiple solutions, and no solution", () => {
  const conflicted = PUZZLE.split("");
  conflicted[1] = "5";
  const values = conflicted.map(Number);
  assert.deepEqual(findConflicts(values), [[0, 1]]);
  const blocked = solve(values);
  assert.equal(blocked.conflict, true);
  assert.equal(CONFLICT, "These two cells have the same number.");

  const empty = solve(Array(81).fill(0));
  assert.equal(empty.solutions.length, 2);
  assert.equal(MULTI, "This puzzle has more than one solution.");
  assert.equal(lowGivens(Array(81).fill(0)), true);
  assert.match(LOW_GIVENS, /17/);

  const firstRow = parseGrid(PUZZLE.slice(0, 9) + "0".repeat(72));
  const many = solve(firstRow.values);
  assert.equal(many.solutions.length, 2);

  const impossible = parseGrid(
    [
      "123456780",
      "000000901",
      "000000002",
      "000000003",
      "000000004",
      "000000005",
      "000000006",
      "000000007",
      "000000008",
    ].join(""),
  );
  assert.equal(findConflicts(impossible.values).length, 0);
  const none = solve(impossible.values);
  assert.equal(none.solutions.length, 0);
  assert.equal(none.timedOut, false);
  assert.equal(NONE, "This puzzle has no solution. Check for a typo.");
});

test("hint names the digit and matches the unique solution", () => {
  const values = parseGrid(PUZZLE).values;
  const step = hint(values);
  assert.ok(step);
  const solution = solve(values).solutions[0];
  assert.equal(solution[step.index], step.digit);
  const sentence = explain(step);
  assert.match(sentence, new RegExp(String(step.digit)));
  if (step.kind === "naked") {
    assert.match(sentence, /can only be/);
  } else {
    assert.match(sentence, /must be/);
  }
  assert.match(explain(null), /use Solve/);
});

test("paste accepts dots, pipes, spaces, and full-width digits", () => {
  const pretty = PUZZLE.replace(/(.{9})/g, "$1\n").trim().replace(/0/g, ".");
  const piped = pretty
    .split("\n")
    .map((line) => line.slice(0, 3) + "|" + line.slice(3, 6) + "|" + line.slice(6))
    .join("\n");
  assert.equal(compactGrid(parseGrid(piped).values), PUZZLE);
  const spaced = PUZZLE.split("").join(" ");
  assert.equal(compactGrid(parseGrid(spaced).values), PUZZLE);
  const full = PUZZLE.replace(/\d/g, (digit) => String.fromCharCode(0xff10 + Number(digit)));
  assert.equal(compactGrid(parseGrid(full).values), PUZZLE);
  const letters = parseGrid("listen please");
  assert.equal(letters.ok, false);
  assert.equal(letters.hint.label, "Anagram Solver");
});

test("solver stops when the deadline has passed", () => {
  const result = solve(parseGrid(PUZZLE).values, { deadline: 0, now: () => 1 });
  assert.equal(result.timedOut, true);
  assert.equal(TIMEOUT.includes("2 seconds"), true);
});
