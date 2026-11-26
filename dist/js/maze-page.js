import { generateMaze, neighbors } from "../lib/maze.js";
import { mazeDocument } from "../lib/pdf.js";
import { downloadBlob, slugName, syncPrintTitle, withBusy } from "./ui.js";
import { titleImage } from "../lib/pdf.js";

const CELL = 18;

function freshSeed() {
  return String((((Date.now() ^ ((Math.random() * 1e6) | 0)) >>> 0) % 1000000) || 1);
}

function metrics(lineWidth) {
  return { cell: CELL, pad: Math.max(10, lineWidth + 8) };
}

export const REQUIRED_IDS = [
  "maze-width",
  "maze-height",
  "maze-seed",
  "maze-thickness",
  "maze-view",
  "maze-answer",
  "maze-status",
  "btn-new",
  "btn-show",
  "btn-print",
  "btn-png",
  "btn-pdf",
];

export function mount(doc) {
  const status = doc.getElementById("maze-status");
  const width = doc.getElementById("maze-width");
  const height = doc.getElementById("maze-height");
  const seed = doc.getElementById("maze-seed");
  const thickness = doc.getElementById("maze-thickness");
  const view = doc.getElementById("maze-view");
  const board = doc.getElementById("maze-board");
  const answer = doc.getElementById("maze-answer");
  const titleInput = doc.getElementById("maze-title");
  let maze = null;
  let show = false;
  let seedEdited = false;
  let player = [];
  let drawing = false;
  let ignoreMouse = 0;
  let pan = null;
  if (!seed.value) seed.value = "12345";

  function say(text) {
    status.textContent = text;
  }
  function lineWidth() {
    return Number(thickness.value) || 2;
  }
  function readSize() {
    return { w: Number(width.value), h: Number(height.value), s: Number(seed.value) };
  }
  function showPlay() {
    if (board?.style?.setProperty) board.style.setProperty("--cols", String(maze?.width || 10));
    paint(view, maze, false, lineWidth(), player, true);
    if (view?.dataset) view.dataset.steps = String(player.length);
  }
  function showClean() {
    if (!maze) return;
    paint(view, maze, false, lineWidth());
  }
  function draw() {
    const made = generateMaze(readSize().w, readSize().h, readSize().s);
    if (!made.ok) {
      say(made.error);
      return;
    }
    maze = made;
    player = [];
    showPlay();
    paint(answer, maze, true, lineWidth());
    answer.classList.toggle("answer-only", !show);
    say(
      `Maze ${maze.width} by ${maze.height}, seed ${maze.seed}. Start drawing at the marked entrance, the top-left opening.`,
    );
  }

  function redrawPlay() {
    showPlay();
    const last = player[player.length - 1];
    if (last && last[0] === maze.width - 1 && last[1] === maze.height - 1) say("You reached the exit.");
  }
  function cellAt(clientX, clientY) {
    if (!maze || !view.getBoundingClientRect) return null;
    const rect = view.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((clientX - rect.left) * view.width) / rect.width;
    const y = ((clientY - rect.top) * view.height) / rect.height;
    const { cell, pad } = metrics(lineWidth());
    const cx = Math.floor((x - pad) / cell);
    const cy = Math.floor((y - pad) / cell);
    if (cx < 0 || cy < 0 || cx >= maze.width || cy >= maze.height) return null;
    return [cx, cy];
  }
  function bridge(from, to) {
    const limit = 40;
    const key = (x, y) => `${x},${y}`;
    const goal = key(to[0], to[1]);
    const start = key(from[0], from[1]);
    if (start === goal) return [];
    const prev = new Map([[start, ""]]);
    const queue = [[from[0], from[1], 0]];
    let found = false;
    for (let i = 0; i < queue.length && !found; i++) {
      const [x, y, depth] = queue[i];
      if (depth >= limit) continue;
      for (const [nx, ny] of neighbors(maze, x, y)) {
        const next = key(nx, ny);
        if (prev.has(next)) continue;
        prev.set(next, key(x, y));
        if (next === goal) {
          found = true;
          break;
        }
        queue.push([nx, ny, depth + 1]);
      }
    }
    if (!found) return null;
    const path = [];
    let cursor = goal;
    while (cursor && cursor !== start) {
      const [x, y] = cursor.split(",").map(Number);
      path.push([x, y]);
      cursor = prev.get(cursor);
    }
    path.reverse();
    return path;
  }
  function cellPixels() {
    if (!view.getBoundingClientRect || !view.width) return CELL;
    const rect = view.getBoundingClientRect();
    if (!rect.width) return CELL;
    return CELL * (rect.width / view.width);
  }
  function extend(cell, travel = 0) {
    if (!cell) return;
    if (!player.length) {
      if (cell[0] === 0 && cell[1] === 0) {
        player = [[0, 0]];
        say("Draw through the open path to the bottom-right exit.");
      } else say("Start at the marked entrance in the top-left cell.");
      return;
    }
    const seen = player.findIndex(([x, y]) => x === cell[0] && y === cell[1]);
    if (seen >= 0) {
      player = player.slice(0, seen + 1);
      return;
    }
    const last = player[player.length - 1];
    const hop = Math.abs(cell[0] - last[0]) + Math.abs(cell[1] - last[1]);
    const jumped = travel > cellPixels() * 0.75;
    if (hop === 1 && !jumped) {
      const open = neighbors(maze, last[0], last[1]).some(([x, y]) => x === cell[0] && y === cell[1]);
      if (open) player.push(cell);
      else say("That cell is blocked by a wall. Stay on the open path.");
      return;
    }
    const path = bridge(last, cell);
    if (!path) {
      if (hop === 1) say("That cell is blocked by a wall. Stay on the open path.");
      return;
    }
    for (const next of path) {
      const back = player.findIndex(([x, y]) => x === next[0] && y === next[1]);
      if (back >= 0) player = player.slice(0, back + 1);
      else player.push(next);
    }
  }
  let lastPointer = null;
  function down(x, y) {
    drawing = true;
    extend(cellAt(x, y), 0);
    lastPointer = { x, y };
    redrawPlay();
  }
  function move(x, y) {
    if (!drawing) return;
    const travel = lastPointer ? Math.hypot(x - lastPointer.x, y - lastPointer.y) : cellPixels() * 2;
    lastPointer = { x, y };
    extend(cellAt(x, y), travel);
    redrawPlay();
  }
  view.addEventListener("mousedown", (event) => {
    if (Date.now() < ignoreMouse || event.button !== 0) return;
    event.preventDefault?.();
    down(event.clientX, event.clientY);
  });
  const root = doc.body?.addEventListener ? doc.body : doc;
  root.addEventListener("mousemove", (event) => {
    if (!drawing || Date.now() < ignoreMouse) return;
    move(event.clientX, event.clientY);
  });
  root.addEventListener("mouseup", () => {
    drawing = false;
    lastPointer = null;
  });
  let gesture = null;
  function rememberGesture(x, y) {
    const current = {
      snapshot: player.map(([cx, cy]) => [cx, cy]),
      message: status.textContent,
      cell: cellAt(x, y),
      x,
      y,
      committed: false,
      timer: 0,
    };
    current.timer = setTimeout(() => {
      if (gesture !== current || current.committed) return;
      current.committed = true;
      drawing = true;
      extend(current.cell);
      redrawPlay();
    }, 80);
    gesture = current;
  }
  function cancelGesture() {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    player = gesture.snapshot.map(([cx, cy]) => [cx, cy]);
    status.textContent = gesture.message;
    gesture = null;
    drawing = false;
    showPlay();
  }
  function commitGesture(x, y) {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    if (!gesture.committed) {
      gesture.committed = true;
      drawing = true;
      extend(gesture.cell, 0);
    }
    drawing = true;
    extend(cellAt(x, y), Math.hypot(x - gesture.x, y - gesture.y));
    gesture.x = x;
    gesture.y = y;
    redrawPlay();
  }
  view.addEventListener("touchstart", (event) => {
    ignoreMouse = Date.now() + 1000;
    if (event.touches?.length > 1) {
      cancelGesture();
      pan = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      event.preventDefault?.();
      return;
    }
    pan = null;
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    event.preventDefault?.();
    rememberGesture(touch.clientX, touch.clientY);
  });
  view.addEventListener("touchmove", (event) => {
    if (event.touches?.length > 1) {
      cancelGesture();
      if (pan && board) {
        board.scrollLeft -= event.touches[0].clientX - pan.x;
        board.scrollTop -= event.touches[0].clientY - pan.y;
      }
      pan = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      event.preventDefault?.();
      return;
    }
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    event.preventDefault?.();
    commitGesture(touch.clientX, touch.clientY);
  });
  view.addEventListener("touchend", (event) => {
    ignoreMouse = Date.now() + 1000;
    if (event.touches?.length) {
      cancelGesture();
      pan = null;
      event.preventDefault?.();
      return;
    }
    if (gesture && !gesture.committed) {
      clearTimeout(gesture.timer);
      gesture.committed = true;
      drawing = true;
      extend(gesture.cell, 0);
      redrawPlay();
    }
    gesture = null;
    drawing = false;
    pan = null;
    event.preventDefault?.();
  });
  globalThis.addEventListener?.("beforeprint", showClean);
  globalThis.addEventListener?.("afterprint", () => {
    if (maze) showPlay();
  });

  doc.getElementById("btn-new").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-new"), async () => {
      seed.value = freshSeed();
      seedEdited = false;
      draw();
    }),
  );
  doc.getElementById("btn-show").addEventListener("click", () => {
    show = !show;
    answer.classList.toggle("answer-only", !show);
    doc.getElementById("btn-show").querySelector(".btn-label").textContent = show ? "Hide solution" : "Show solution";
    say(show ? "The answer path is on the second picture. Print includes it on its own page." : "The answer path is hidden. Press Show solution to see it.");
  });
  seed.addEventListener("input", () => {
    seedEdited = true;
  });
  titleInput?.addEventListener("input", () => syncPrintTitle(doc, titleInput.value));
  for (const id of ["maze-width", "maze-height", "maze-seed", "maze-thickness"]) {
    doc.getElementById(id).addEventListener("change", () => draw());
  }
  for (const [id, w, h] of [
    ["preset-easy", 10, 10],
    ["preset-medium", 20, 20],
    ["preset-hard", 40, 40],
  ]) {
    doc.getElementById(id).addEventListener("click", () => {
      width.value = String(w);
      height.value = String(h);
      if (!seedEdited) seed.value = freshSeed();
      draw();
    });
  }
  doc.getElementById("btn-print").addEventListener("click", () => {
    syncPrintTitle(doc, titleInput?.value || "");
    if (typeof globalThis.print === "function") globalThis.print();
    else say("Press Download PDF to save the puzzle and the answer.");
  });
  doc.getElementById("btn-png").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-png"), async () => {
      if (!maze) draw();
      const shot = doc.createElement("canvas");
      paint(shot, maze, false, lineWidth());
      const blob = await canvasBlob(shot);
      if (!blob) {
        say("The picture could not be created. Press Download PDF instead.");
        return;
      }
      const title = titleInput?.value.trim();
      const name = `maze-${title ? `${slugName(title, "maze")}-` : ""}${maze.width}x${maze.height}-seed-${maze.seed}.png`;
      downloadBlob(doc, name, blob);
      say(`Downloaded ${name}.`);
    }),
  );
  doc.getElementById("btn-pdf").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-pdf"), async () => {
      if (!maze) draw();
      const title = titleInput?.value.trim() || "";
      const pdf = mazeDocument(maze, title, titleImage(title));
      const name = `maze-${title ? `${slugName(title, "maze")}-` : ""}${maze.width}x${maze.height}-seed-${maze.seed}.pdf`;
      downloadBlob(doc, name, new Blob([pdf], { type: "application/pdf" }));
      say(`Downloaded ${name}. Page 1 is the maze. Page 2 is the answer.`);
    }),
  );
  draw();
}

export function paint(canvas, maze, showSolution, lineWidth, path, showStart) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { cell, pad } = metrics(lineWidth);
  canvas.width = maze.width * cell + pad * 2;
  canvas.height = maze.height * cell + pad * 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "square";
  ctx.beginPath();
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const bits = maze.open[y][x];
      const x0 = pad + x * cell;
      const y0 = pad + y * cell;
      if (!(bits & 1)) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + cell, y0);
      }
      if (!(bits & 2)) {
        ctx.moveTo(x0 + cell, y0);
        ctx.lineTo(x0 + cell, y0 + cell);
      }
      if (!(bits & 4)) {
        ctx.moveTo(x0, y0 + cell);
        ctx.lineTo(x0 + cell, y0 + cell);
      }
      if (!(bits & 8)) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0, y0 + cell);
      }
    }
  }
  ctx.stroke();
  if (showStart && ctx.arc) {
    ctx.fillStyle = "#0f5e56";
    ctx.beginPath();
    ctx.arc(pad + cell * 0.5, pad + cell * 0.5, Math.max(3, cell * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
  if (path?.length) {
    ctx.strokeStyle = "#0f5e56";
    ctx.lineWidth = Math.max(3, lineWidth + 1);
    ctx.beginPath();
    path.forEach(([x, y], index) => {
      const px = pad + (x + 0.5) * cell;
      const py = pad + (y + 0.5) * cell;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
  if (showSolution && maze.solution?.length) {
    ctx.strokeStyle = "#9a3412";
    ctx.lineWidth = Math.max(2, lineWidth);
    ctx.beginPath();
    ctx.moveTo(pad + 0.5 * cell, pad - 0.45 * cell);
    maze.solution.forEach(([x, y]) => {
      ctx.lineTo(pad + (x + 0.5) * cell, pad + (y + 0.5) * cell);
    });
    ctx.lineTo(pad + (maze.width - 0.5) * cell, pad + (maze.height + 0.45) * cell);
    ctx.stroke();
  }
}

function canvasBlob(canvas) {
  return new Promise((resolve) => {
    if (!canvas.toBlob) resolve(null);
    else canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

if (typeof document !== "undefined" && document.getElementById?.("maze-view")) mount(document);
