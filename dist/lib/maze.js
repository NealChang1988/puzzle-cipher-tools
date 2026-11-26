/**
 * Perfect mazes from a seeded recursive backtracker.
 * mulberry32 keeps the same seed identical. Math.random is not used.
 * Entrance is the top-left cell. Exit is the bottom-right cell.
 */

export const MIN_SIZE = 5;
export const MAX_SIZE = 100;

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];

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

export function generateMaze(width, height, seed) {
  const w = width | 0;
  const h = height | 0;
  if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) {
    return {
      ok: false,
      error: "Use a width and height from 5 to 100. Try Easy, Medium, or Hard.",
    };
  }
  const open = Array.from({ length: h }, () => Array(w).fill(0));
  const seen = Array.from({ length: h }, () => Array(w).fill(false));
  const rand = mulberry32(seed >>> 0);
  const stack = [[0, 0]];
  seen[0][0] = true;
  let passages = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = DIRS.slice();
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const swap = options[i];
      options[i] = options[j];
      options[j] = swap;
    }
    let moved = false;
    for (const dir of options) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny][nx]) continue;
      open[y][x] |= dir.bit;
      open[ny][nx] |= dir.opp;
      seen[ny][nx] = true;
      passages += 1;
      stack.push([nx, ny]);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }
  open[0][0] |= N;
  open[h - 1][w - 1] |= S;
  const maze = { ok: true, width: w, height: h, seed: seed >>> 0, open, passages };
  maze.solution = solutionPath(maze);
  return maze;
}

export function neighbors(maze, x, y) {
  const bits = maze.open[y][x];
  const out = [];
  for (const dir of DIRS) {
    if (!(bits & dir.bit)) continue;
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (nx < 0 || ny < 0 || nx >= maze.width || ny >= maze.height) continue;
    out.push([nx, ny]);
  }
  return out;
}

export function solutionPath(maze) {
  const start = "0,0";
  const goalX = maze.width - 1;
  const goalY = maze.height - 1;
  const goal = `${goalX},${goalY}`;
  const prev = new Map();
  const queue = [[0, 0]];
  prev.set(start, null);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (`${x},${y}` === goal) break;
    for (const [nx, ny] of neighbors(maze, x, y)) {
      const key = `${nx},${ny}`;
      if (prev.has(key)) continue;
      prev.set(key, `${x},${y}`);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(goal)) return [];
  const path = [];
  let cursor = goal;
  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    path.push([x, y]);
    cursor = prev.get(cursor);
  }
  path.reverse();
  return path;
}

export function analyzeMaze(maze) {
  const cells = maze.width * maze.height;
  const seen = new Set(["0,0"]);
  const stack = [[0, 0]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [nx, ny] of neighbors(maze, x, y)) {
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push([nx, ny]);
    }
  }
  const path = maze.solution || solutionPath(maze);
  let pathOpen = path.length > 0;
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i - 1];
    const [nx, ny] = path[i];
    const step = neighbors(maze, x, y).some(([ax, ay]) => ax === nx && ay === ny);
    if (!step) pathOpen = false;
  }
  const reachesExit =
    path.length > 0 &&
    path[0][0] === 0 &&
    path[0][1] === 0 &&
    path[path.length - 1][0] === maze.width - 1 &&
    path[path.length - 1][1] === maze.height - 1;
  return {
    cells,
    passages: maze.passages,
    perfectCount: maze.passages === cells - 1,
    connected: seen.size === cells,
    pathLength: path.length,
    pathReachesExit: reachesExit && pathOpen,
    uniquePath: maze.passages === cells - 1 && seen.size === cells,
  };
}

export function sameMaze(a, b) {
  if (!a?.ok || !b?.ok) return false;
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (a.open[y][x] !== b.open[y][x]) return false;
    }
  }
  return true;
}
