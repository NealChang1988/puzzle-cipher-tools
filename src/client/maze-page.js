import { generateMaze, neighbors } from "../lib/maze.js";
import { mazeDocument } from "../lib/pdf.js";
import { downloadBlob, syncPrintTitle, withBusy } from "./ui.js";

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
  const answer = doc.getElementById("maze-answer");
  const titleInput = doc.getElementById("maze-title");
  let maze = null;
  let show = false;
  let seedEdited = false;
  let player = [];
  let drawing = false;
  let ignoreMouse = 0;
  if (!seed.value) seed.value = "12345";

  function say(text) {
    status.textContent = text;
  }
  function readSize() {
    return { w: Number(width.value), h: Number(height.value), s: Number(seed.value) };
  }
  function draw() {
    const made = generateMaze(readSize().w, readSize().h, readSize().s);
    if (!made.ok) {
      say(made.error);
      return;
    }
    maze = made;
    player = [];
    const line = Number(thickness.value) || 2;
    paint(view, maze, false, line, player);
    paint(answer, maze, true, line);
    answer.classList.toggle("answer-only", !show);
    say(
      `Maze ${maze.width} by ${maze.height}, seed ${maze.seed}. The entrance is the top-left opening and the exit is the bottom-right opening.`,
    );
  }

  function redrawPlay() {
    paint(view, maze, false, Number(thickness.value) || 2, player);
    const last = player[player.length - 1];
    if (last && last[0] === maze.width - 1 && last[1] === maze.height - 1) say("You reached the exit.");
  }
  function cellAt(clientX, clientY) {
    if (!maze || !view.getBoundingClientRect) return null;
    const rect = view.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((clientX - rect.left) * view.width) / rect.width;
    const y = ((clientY - rect.top) * view.height) / rect.height;
    const { cell, pad } = metrics(Number(thickness.value) || 2);
    const cx = Math.floor((x - pad) / cell);
    const cy = Math.floor((y - pad) / cell);
    if (cx < 0 || cy < 0 || cx >= maze.width || cy >= maze.height) return null;
    return [cx, cy];
  }
  function step(cell) {
    if (!cell) return;
    if (!player.length) {
      if (cell[0] === 0 && cell[1] === 0) player = [[0, 0]];
      return;
    }
    const index = player.findIndex(([x, y]) => x === cell[0] && y === cell[1]);
    if (index >= 0) {
      player = player.slice(0, index + 1);
      return;
    }
    const last = player[player.length - 1];
    const open = neighbors(maze, last[0], last[1]).some(([x, y]) => x === cell[0] && y === cell[1]);
    if (open) player.push(cell);
  }
  function down(x, y) {
    drawing = true;
    step(cellAt(x, y));
    redrawPlay();
  }
  function move(x, y) {
    if (!drawing) return;
    step(cellAt(x, y));
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
  });
  view.addEventListener("touchstart", (event) => {
    ignoreMouse = Date.now() + 1000;
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    event.preventDefault?.();
    down(touch.clientX, touch.clientY);
  });
  view.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    event.preventDefault?.();
    move(touch.clientX, touch.clientY);
  });
  view.addEventListener("touchend", (event) => {
    ignoreMouse = Date.now() + 1000;
    drawing = false;
    event.preventDefault?.();
  });

  doc.getElementById("btn-new").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-new"), async () => {
      seed.value = freshSeed();
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
      const blob = await canvasBlob(view);
      if (!blob) {
        say("The picture could not be created. Press Download PDF instead.");
        return;
      }
      const name = `maze-${maze.width}x${maze.height}-seed-${maze.seed}.png`;
      downloadBlob(doc, name, blob);
      say(`Downloaded ${name}.`);
    }),
  );
  doc.getElementById("btn-pdf").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-pdf"), async () => {
      if (!maze) draw();
      const pdf = mazeDocument(maze, titleInput?.value || "");
      const name = `maze-${maze.width}x${maze.height}-seed-${maze.seed}.pdf`;
      downloadBlob(doc, name, new Blob([pdf], { type: "application/pdf" }));
      say(`Downloaded ${name}. Page 1 is the maze. Page 2 is the answer.`);
    }),
  );
  draw();
}

export function paint(canvas, maze, showSolution, lineWidth, path) {
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
