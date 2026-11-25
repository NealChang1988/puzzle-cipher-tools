import { generateMaze } from "../lib/maze.js";
import { mazeDocument } from "../lib/pdf.js";
import { downloadBlob, withBusy } from "./ui.js";

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
  let maze = null;
  let show = false;
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
    paint(view, maze, false, Number(thickness.value) || 2);
    paint(answer, maze, true, Number(thickness.value) || 2);
    answer.classList.toggle("answer-only", !show);
    say(
      `Maze ${maze.width} by ${maze.height}, seed ${maze.seed}. The entrance is the top-left opening and the exit is the bottom-right opening.`,
    );
  }

  doc.getElementById("btn-new").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-new"), async () => {
      seed.value = String((Date.now() ^ ((Math.random() * 1e6) | 0)) % 1000000);
      draw();
    }),
  );
  doc.getElementById("btn-show").addEventListener("click", () => {
    show = !show;
    answer.classList.toggle("answer-only", !show);
    doc.getElementById("btn-show").querySelector(".btn-label").textContent = show ? "Hide solution" : "Show solution";
    say(show ? "The answer path is on the second picture. Print includes it on its own page." : "The answer path is hidden. Press Show solution to see it.");
  });
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
      draw();
    });
  }
  doc.getElementById("btn-print").addEventListener("click", () => {
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
      const pdf = mazeDocument(maze);
      const name = `maze-${maze.width}x${maze.height}-seed-${maze.seed}.pdf`;
      downloadBlob(doc, name, new Blob([pdf], { type: "application/pdf" }));
      say(`Downloaded ${name}. Page 1 is the maze. Page 2 is the answer.`);
    }),
  );
  draw();
}

export function paint(canvas, maze, showSolution, lineWidth) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cell = 18;
  const pad = Math.max(4, lineWidth);
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
  if (showSolution && maze.solution?.length) {
    ctx.strokeStyle = "#9a3412";
    ctx.lineWidth = Math.max(2, lineWidth);
    ctx.beginPath();
    maze.solution.forEach(([x, y], index) => {
      const px = pad + (x + 0.5) * cell;
      const py = pad + (y + 0.5) * cell;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
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
