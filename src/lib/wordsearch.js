/**
 * Word search sheets. Placement uses a seeded generator, not Math.random.
 * A finished grid must contain each placed word exactly once, counting
 * every straight direction, including the ones the player did not use.
 */

export const MIN_GRID = 8;
export const MAX_GRID = 25;
export const MAX_WORDS = 40;
export const PLACE_TRIES = 300;

export const DIRECTIONS = {
  E: [1, 0],
  S: [0, 1],
  SE: [1, 1],
  NE: [1, -1],
  W: [-1, 0],
  N: [0, -1],
  NW: [-1, -1],
  SW: [-1, 1],
};

export const SIMPLE_DIRECTIONS = ["E", "S", "SE", "NE"];
export const ALL_DIRECTIONS = Object.keys(DIRECTIONS);
const SEARCH_DIRECTIONS = ALL_DIRECTIONS.map((name) => DIRECTIONS[name]);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cleanWord(raw) {
  const original = String(raw).replace(/[\u00A0\u3000]/g, " ").trim();
  const letters = original.normalize("NFKC").toUpperCase().replace(/[^A-Z]/g, "");
  return { original, letters };
}

export function parseWordInput(text) {
  return String(text)
    .split(/[\n,]+/)
    .map(cleanWord)
    .filter((item) => item.original);
}

export function generateWordSearch({
  text = "",
  words,
  size = 15,
  directions = SIMPLE_DIRECTIONS,
  seed = 1,
  uppercase = true,
} = {}) {
  const side = size | 0;
  if (side < MIN_GRID || side > MAX_GRID) {
    return {
      ok: false,
      error: "Use a grid from 8 by 8 up to 25 by 25.",
    };
  }
  const chosen = (directions.length ? directions : SIMPLE_DIRECTIONS).filter((name) => DIRECTIONS[name]);
  if (!chosen.length) {
    return { ok: false, error: "Choose at least one direction, then press New puzzle." };
  }
  const parsed = words || parseWordInput(text);
  if (parsed.length > MAX_WORDS) {
    return {
      ok: false,
      error: "Use 40 words or fewer. Remove a few and press New puzzle again.",
    };
  }
  const skipped = [];
  const unique = [];
  const seen = new Set();
  for (const item of parsed) {
    if (!item.letters) {
      skipped.push({ original: item.original, reason: `"${item.original}" has no letters. Remove it or type it as letters.` });
      continue;
    }
    if (item.letters.length < 2 || item.letters.length > 25) {
      skipped.push({
        original: item.original,
        reason: `"${item.original}" needs 2 to 25 letters after removing spaces and marks.`,
      });
      continue;
    }
    if (item.letters.length > side) {
      skipped.push({
        original: item.original,
        letters: item.letters,
        reason: `\`${item.letters.toLowerCase()}\` is longer than the grid (${side}). Make the grid bigger or remove it.`,
      });
      continue;
    }
    if (seen.has(item.letters)) continue;
    seen.add(item.letters);
    unique.push(item);
  }
  unique.sort((a, b) => b.letters.length - a.letters.length || (a.letters < b.letters ? -1 : 1));

  let puzzle = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const made = placeOnce(unique, side, chosen, (Number(seed) + attempt * 997) >>> 0, uppercase);
    if (made.ok) {
      puzzle = made;
      break;
    }
  }
  if (!puzzle) {
    return {
      ok: false,
      error: "Those words would not fit without repeating. Remove one or make the grid bigger, then press New puzzle.",
      skipped,
    };
  }
  return { ...puzzle, skipped: skipped.concat(puzzle.skipped), seed: Number(seed) >>> 0, size: side };
}

function placeOnce(words, side, directionNames, seed, uppercase) {
  const rand = mulberry32(seed);
  const grid = Array.from({ length: side }, () => Array(side).fill(""));
  const placed = [];
  const skipped = [];
  const dirs = directionNames.map((name) => ({ name, vec: DIRECTIONS[name] }));
  for (const item of words) {
    const spot = tryPlace(grid, item.letters, dirs, rand);
    if (!spot) {
      skipped.push({
        original: item.original,
        letters: item.letters,
        reason: `"${item.original}" did not fit after ${PLACE_TRIES} tries. Make the grid bigger or remove it.`,
      });
      continue;
    }
    placed.push({ ...item, ...spot });
  }
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (!grid[y][x]) {
        const code = 65 + Math.floor(rand() * 26);
        grid[y][x] = String.fromCharCode(code);
      }
    }
  }
  for (const item of placed) {
    if (countStraight(grid, item.letters) !== 1) return { ok: false };
  }
  const display = uppercase
    ? grid
    : grid.map((row) => row.map((letter) => letter.toLowerCase()));
  return { ok: true, grid: display, placed, skipped, uppercase };
}

function tryPlace(grid, word, dirs, rand) {
  const side = grid.length;
  for (let attempt = 0; attempt < PLACE_TRIES; attempt++) {
    const dir = dirs[Math.floor(rand() * dirs.length)];
    const [dx, dy] = dir.vec;
    const x = Math.floor(rand() * side);
    const y = Math.floor(rand() * side);
    const x1 = x + dx * (word.length - 1);
    const y1 = y + dy * (word.length - 1);
    if (x1 < 0 || y1 < 0 || x1 >= side || y1 >= side) continue;
    let fits = true;
    for (let i = 0; i < word.length; i++) {
      const letter = grid[y + dy * i][x + dx * i];
      if (letter && letter !== word[i]) {
        fits = false;
        break;
      }
    }
    if (!fits) continue;
    for (let i = 0; i < word.length; i++) grid[y + dy * i][x + dx * i] = word[i];
    return { x, y, dx, dy, direction: dir.name };
  }
  return null;
}

export function countStraight(grid, word) {
  const letters = word.toUpperCase();
  const height = grid.length;
  const width = grid[0].length;
  let found = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (const [dx, dy] of SEARCH_DIRECTIONS) {
        let ok = true;
        for (let i = 0; i < letters.length; i++) {
          const xx = x + dx * i;
          const yy = y + dy * i;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height || grid[yy][xx].toUpperCase() !== letters[i]) {
            ok = false;
            break;
          }
        }
        if (ok) found += 1;
      }
    }
  }
  return found;
}

export function placementFollows(grid, placed, allowed) {
  const allow = new Set(allowed);
  return placed.every((item) => {
    if (!allow.has(item.direction)) return false;
    for (let i = 0; i < item.letters.length; i++) {
      const x = item.x + item.dx * i;
      const y = item.y + item.dy * i;
      if (!grid[y] || grid[y][x].toUpperCase() !== item.letters[i]) return false;
    }
    return countStraight(grid, item.letters) === 1;
  });
}
