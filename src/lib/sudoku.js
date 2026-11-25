/**
 * Standard 9×9 sudoku. The solver stops after two solutions
 * (enough to know whether the puzzle is unique) and can stop
 * on a caller-supplied deadline.
 */

export const MULTI =
  "This puzzle has more than one solution.";
export const NONE =
  "This puzzle has no solution. Check for a typo.";
export const CONFLICT =
  "These two cells have the same number.";
export const NO_HINT =
  "No simple hint \u2014 use Solve.";
export const LOW_GIVENS =
  "Fewer than 17 numbers are filled in. The answer is likely not unique.";
export const TIMEOUT =
  "Solving stopped after 2 seconds. Add more numbers, then press Solve again.";

const DIGITS = 0x3fe;

export function givenCount(values) {
  let n = 0;
  for (const value of values) if (value) n++;
  return n;
}

export function parseGrid(raw) {
  const original = String(raw);
  let text = original
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .normalize("NFKC")
    .normalize("NFC");
  text = text.replace(/[\s|_\-]/g, "").replace(/\./g, "0");
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 81) {
    const hint = /[a-z]/i.test(original)
      ? {
          href: "/anagram-solver/",
          label: "Anagram Solver",
        }
      : null;
    const base = `After removing extra symbols there are ${digits.length} cells. A sudoku needs 81. Check the copy, or fill the grid by hand.`;
    return {
      ok: false,
      count: digits.length,
      error: hint ? `${base} If these are scrambled letters, open the Anagram Solver.` : base,
      hint,
    };
  }
  return { ok: true, values: [...digits].map((ch) => Number(ch)) };
}

function units() {
  const list = [];
  for (let r = 0; r < 9; r++) list.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) list.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) cells.push((br * 3 + r) * 9 + (bc * 3 + c));
      }
      list.push(cells);
    }
  }
  return list;
}

const UNITS = units();

export function findConflicts(values) {
  const pairs = [];
  const seen = new Set();
  for (const unit of UNITS) {
    const where = new Map();
    for (const index of unit) {
      const value = values[index] | 0;
      if (!value) continue;
      let bucket = where.get(value);
      if (!bucket) where.set(value, (bucket = []));
      bucket.push(index);
    }
    for (const indexes of where.values()) {
      if (indexes.length < 2) continue;
      for (let a = 0; a < indexes.length; a++) {
        for (let b = a + 1; b < indexes.length; b++) {
          const lo = Math.min(indexes[a], indexes[b]);
          const hi = Math.max(indexes[a], indexes[b]);
          const key = lo + "," + hi;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push([lo, hi]);
        }
      }
    }
  }
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return pairs;
}

function boxIndex(index) {
  const row = (index / 9) | 0;
  const col = index % 9;
  return ((row / 3) | 0) * 3 + ((col / 3) | 0);
}

export function solve(values, { limit = 2, deadline = Infinity, now = Date.now } = {}) {
  if (now() > deadline) return { solutions: [], timedOut: true };
  const cells = values.map((value) => value | 0);
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const digit = cells[i];
    if (!digit) continue;
    const bit = 1 << digit;
    const row = (i / 9) | 0;
    const col = i % 9;
    const box = boxIndex(i);
    if (rows[row] & bit || cols[col] & bit || boxes[box] & bit) {
      return { solutions: [], timedOut: false, conflict: true };
    }
    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;
  }
  const solutions = [];
  let timedOut = false;
  let nodes = 0;
  function dfs() {
    if (solutions.length >= limit || timedOut) return;
    if ((nodes++ & 63) === 0 && now() > deadline) {
      timedOut = true;
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (cells[i]) continue;
      const row = (i / 9) | 0;
      const col = i % 9;
      const mask = (~(rows[row] | cols[col] | boxes[boxIndex(i)])) & DIGITS;
      let count = 0;
      for (let bits = mask; bits; bits &= bits - 1) count++;
      if (count === 0) return;
      if (count < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = count;
        if (count === 1) break;
      }
    }
    if (best < 0) {
      solutions.push(cells.slice());
      return;
    }
    const row = (best / 9) | 0;
    const col = best % 9;
    const box = boxIndex(best);
    for (let digit = 1; digit <= 9; digit++) {
      const bit = 1 << digit;
      if (!(bestMask & bit)) continue;
      cells[best] = digit;
      rows[row] |= bit;
      cols[col] |= bit;
      boxes[box] |= bit;
      dfs();
      rows[row] ^= bit;
      cols[col] ^= bit;
      boxes[box] ^= bit;
      cells[best] = 0;
      if (solutions.length >= limit || timedOut) return;
    }
  }
  dfs();
  return { solutions, timedOut };
}

function candidatesAt(values, index) {
  if (values[index]) return [];
  const row = (index / 9) | 0;
  const col = index % 9;
  const used = new Set();
  for (let c = 0; c < 9; c++) used.add(values[row * 9 + c]);
  for (let r = 0; r < 9; r++) used.add(values[r * 9 + col]);
  const br = (row / 3) | 0;
  const bc = (col / 3) | 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) used.add(values[(br * 3 + r) * 9 + (bc * 3 + c)]);
  }
  used.delete(0);
  const list = [];
  for (let digit = 1; digit <= 9; digit++) if (!used.has(digit)) list.push(digit);
  return list;
}

export function hint(values) {
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    const cand = candidatesAt(values, i);
    if (cand.length === 1) {
      return { index: i, digit: cand[0], kind: "naked" };
    }
  }
  for (const unit of UNITS) {
    const kind = unitKind(unit);
    for (let digit = 1; digit <= 9; digit++) {
      if (unit.some((index) => values[index] === digit)) continue;
      const places = unit.filter((index) => !values[index] && candidatesAt(values, index).includes(digit));
      if (places.length === 1) {
        return { index: places[0], digit, kind: "hidden", unit: kind };
      }
    }
  }
  return null;
}

function unitKind(unit) {
  const rows = new Set(unit.map((index) => (index / 9) | 0));
  if (rows.size === 1) return "row";
  const cols = new Set(unit.map((index) => index % 9));
  if (cols.size === 1) return "column";
  return "box";
}

export function explain(hintResult) {
  if (!hintResult) return NO_HINT;
  const digit = hintResult.digit;
  if (hintResult.kind === "naked") {
    return `This cell can only be ${digit}, because 1\u20139 except ${digit} already appear in its row, column or box.`;
  }
  return `This cell must be ${digit}, because it is the only cell in its ${hintResult.unit} that can be ${digit}.`;
}

export function formatGrid(values) {
  const lines = [];
  for (let r = 0; r < 9; r++) {
    lines.push(values.slice(r * 9, r * 9 + 9).join(" "));
  }
  return lines.join("\n");
}

export function compactGrid(values) {
  return values.join("");
}

export function lowGivens(values) {
  return givenCount(values) < 17;
}
