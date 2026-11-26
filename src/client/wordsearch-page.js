import { wordSearchDocument } from "../lib/pdf.js";
import { generateWordSearch } from "../lib/wordsearch.js";
import { downloadBlob, slugName, syncPrintTitle, withBusy } from "./ui.js";

const SAMPLE = "cat, dog, elephant, zebra, lion, hippo, ice cream, T-Rex";

function freshSeed() {
  return String((((Date.now() ^ ((Math.random() * 1e6) | 0)) >>> 0) % 1000000) || 1);
}

function straight(cells) {
  if (cells.length < 2) return false;
  const dx = Math.sign(cells[1][0] - cells[0][0]);
  const dy = Math.sign(cells[1][1] - cells[0][1]);
  if (!dx && !dy) return false;
  for (let i = 1; i < cells.length; i++) {
    if (cells[i][0] - cells[i - 1][0] !== dx || cells[i][1] - cells[i - 1][1] !== dy) return false;
  }
  return true;
}

export const REQUIRED_IDS = [
  "ws-words",
  "ws-title",
  "ws-size",
  "ws-seed",
  "ws-case",
  "ws-puzzle",
  "ws-answer",
  "ws-list",
  "ws-status",
  "btn-new",
  "btn-show",
  "btn-print",
  "btn-png",
  "btn-pdf",
];

export function mount(doc) {
  const status = doc.getElementById("ws-status");
  const puzzleBox = doc.getElementById("ws-puzzle");
  const answerBox = doc.getElementById("ws-answer");
  const list = doc.getElementById("ws-list");
  const titleInput = doc.getElementById("ws-title");
  let puzzle = null;
  let show = false;
  let drag = [];
  let dragStart = null;
  let drawing = false;
  let ignoreMouse = 0;
  const foundWords = new Set();
  const foundCells = new Set();

  function directions() {
    return ["E", "S", "SE", "NE", "W", "N", "NW", "SW"].filter((name) => doc.getElementById(`dir-${name}`).checked);
  }
  function say(text) {
    status.textContent = text;
  }
  function renderGrid(box, withMarks) {
    box.replaceChildren();
    if (!puzzle?.grid) {
      box.textContent = "Your word search will show up here.";
      return;
    }
    const table = doc.createElement("div");
    table.className = "letter-grid";
    table.style.gridTemplateColumns = `repeat(${puzzle.grid.length}, minmax(0, 1fr))`;
    const marks = new Set();
    if (withMarks) {
      for (const item of puzzle.placed) {
        for (let i = 0; i < item.letters.length; i++) {
          marks.add(`${item.x + item.dx * i},${item.y + item.dy * i}`);
        }
      }
    }
    puzzle.grid.forEach((row, y) => {
      row.forEach((letter, x) => {
        const cell = doc.createElement("span");
        cell.textContent = letter;
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        if (marks.has(`${x},${y}`)) cell.className = "hit";
        table.append(cell);
      });
    });
    box.append(table);
  }
  function renderList() {
    list.replaceChildren();
    if (!puzzle) return;
    const words = doc.createElement("p");
    puzzle.placed.forEach((item, index) => {
      if (index) words.append(", ");
      const span = doc.createElement("span");
      span.textContent = item.original;
      span.dataset.letters = item.letters;
      if (foundWords.has(item.letters)) span.className = "found-word";
      words.append(span);
    });
    list.append(words);
    if (puzzle.skipped?.length) {
      for (const item of puzzle.skipped) {
        const note = doc.createElement("p");
        note.className = "error";
        note.textContent = item.reason;
        list.append(note);
      }
    }
  }
  function make() {
    const made = generateWordSearch({
      text: doc.getElementById("ws-words").value,
      size: Number(doc.getElementById("ws-size").value),
      directions: directions(),
      seed: Number(doc.getElementById("ws-seed").value || 1),
      uppercase: doc.getElementById("ws-case").value !== "lower",
    });
    if (!made.ok) {
      say(made.error);
      return;
    }
    puzzle = made;
    foundWords.clear();
    foundCells.clear();
    drag = [];
    dragStart = null;
    renderGrid(puzzleBox, false);
    renderGrid(answerBox, true);
    renderList();
    const skipped = puzzle.skipped.length ? ` ${puzzle.skipped.length} word${puzzle.skipped.length === 1 ? "" : "s"} left out. The reason is under the list.` : "";
    say(`Made a ${puzzle.size} by ${puzzle.size} puzzle, seed ${puzzle.seed}.${skipped}`);
  }

  function paintPlay() {
    puzzleBox.querySelectorAll("[data-x]").forEach((span) => {
      const key = `${span.dataset.x},${span.dataset.y}`;
      const onDrag = drag.some(([x, y]) => `${x},${y}` === key);
      span.className = foundCells.has(key) ? "circled" : onDrag ? "drag" : "";
    });
  }
  function lettersOf(cells) {
    return cells.map(([x, y]) => puzzle.grid[y][x]).join("");
  }
  function lineBetween(start, current) {
    const dx = current[0] - start[0];
    const dy = current[1] - start[1];
    const len = Math.max(Math.abs(dx), Math.abs(dy));
    if (!len) return [[start[0], start[1]]];
    const snapped = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const sx = Math.round(Math.cos(snapped));
    const sy = Math.round(Math.sin(snapped));
    const side = puzzle.grid.length;
    const cells = [];
    for (let i = 0; i <= len; i++) {
      const x = start[0] + sx * i;
      const y = start[1] + sy * i;
      if (x < 0 || y < 0 || x >= side || y >= side) break;
      cells.push([x, y]);
    }
    return cells;
  }
  function finishDrag() {
    drawing = false;
    const word = lettersOf(drag);
    const reversed = [...word].reverse().join("");
    const hit = straight(drag)
      ? puzzle?.placed?.find((item) => item.letters === word || item.letters === reversed)
      : null;
    if (hit && drag.length === hit.letters.length) {
      foundWords.add(hit.letters);
      for (const [x, y] of drag) foundCells.add(`${x},${y}`);
      renderList();
      const left = puzzle.placed.length - foundWords.size;
      say(left ? `Found ${hit.letters} \u2014 ${left} left` : "You found them all!");
    } else if (drag.length > 1) say("That is not one of the words.");
    drag = [];
    dragStart = null;
    paintPlay();
  }
  function cellFromPoint(x, y) {
    const el = doc.elementFromPoint?.(x, y);
    const span = el?.closest?.("[data-x]");
    if (!span || !puzzleBox.contains?.(span)) return null;
    return [Number(span.dataset.x), Number(span.dataset.y)];
  }
  function setLine(x, y) {
    if (!dragStart) return;
    const cell = cellFromPoint(x, y);
    if (!cell) return;
    drag = lineBetween(dragStart, cell);
    paintPlay();
  }
  function beginDrag(x, y) {
    const cell = cellFromPoint(x, y);
    drawing = true;
    dragStart = cell;
    drag = cell ? [cell] : [];
    paintPlay();
  }
  puzzleBox.addEventListener("mousedown", (event) => {
    if (Date.now() < ignoreMouse || event.button !== 0 || !puzzle) return;
    event.preventDefault?.();
    beginDrag(event.clientX, event.clientY);
  });
  const root = doc.body?.addEventListener ? doc.body : doc;
  root.addEventListener("mousemove", (event) => {
    if (!drawing || Date.now() < ignoreMouse) return;
    setLine(event.clientX, event.clientY);
  });
  root.addEventListener("mouseup", (event) => {
    if (!drawing) return;
    if (event?.clientX != null) setLine(event.clientX, event.clientY);
    finishDrag();
  });
  puzzleBox.addEventListener("touchstart", (event) => {
    if (!puzzle) return;
    ignoreMouse = Date.now() + 1000;
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    event.preventDefault?.();
    beginDrag(touch.clientX, touch.clientY);
  });
  puzzleBox.addEventListener("touchmove", (event) => {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (!touch) return;
    event.preventDefault?.();
    setLine(touch.clientX, touch.clientY);
  });
  puzzleBox.addEventListener("touchend", (event) => {
    ignoreMouse = Date.now() + 1000;
    const touch = event.changedTouches?.[0];
    if (touch) setLine(touch.clientX, touch.clientY);
    if (drawing) finishDrag();
    event.preventDefault?.();
  });

  const seedBox = doc.getElementById("ws-seed");
  seedBox.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault?.();
    make();
  });
  doc.getElementById("btn-example")?.addEventListener("click", () => {
    doc.getElementById("ws-words").value = SAMPLE;
    doc.getElementById("ws-size").value = "12";
    make();
  });
  titleInput?.addEventListener("input", () => syncPrintTitle(doc, titleInput.value));
  doc.getElementById("btn-new").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-new"), async () => {
      seedBox.value = freshSeed();
      make();
    }),
  );
  doc.getElementById("btn-show").addEventListener("click", () => {
    show = !show;
    answerBox.classList.toggle("answer-only", !show);
    doc.getElementById("btn-show").querySelector(".btn-label").textContent = show ? "Hide answer" : "Show answer";
    say(show ? "The answer grid is below. Print puts it on the next page." : "The answer grid is hidden. Press Show answer to see it.");
  });
  doc.getElementById("btn-print").addEventListener("click", () => {
    if (!puzzle) make();
    syncPrintTitle(doc, titleInput?.value || "");
    if (typeof globalThis.print === "function") globalThis.print();
    else say("Press Download PDF to save the puzzle and the answer.");
  });
  doc.getElementById("btn-png").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-png"), async () => {
      if (!puzzle) make();
      if (!puzzle?.ok) return;
      const canvas = doc.createElement("canvas");
      const title = doc.getElementById("ws-title").value.trim() || "Word search";
      drawGrid(canvas, puzzle, show, title);
      const blob = await new Promise((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
      if (!blob) {
        say("The picture could not be created. Press Download PDF instead.");
        return;
      }
      const name = `word-search-${slugName(title, "puzzle")}${show ? "-answer" : ""}.png`;
      downloadBlob(doc, name, blob);
      say(`Downloaded ${name}.`);
    }),
  );
  doc.getElementById("btn-pdf").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-pdf"), async () => {
      if (!puzzle) make();
      if (!puzzle?.ok) return;
      const title = doc.getElementById("ws-title").value.trim() || "Word search";
      const pdf = wordSearchDocument(puzzle, title);
      const name = `word-search-${slugName(title, "puzzle")}${show ? "-answer" : ""}.pdf`;
      downloadBlob(doc, name, new Blob([pdf], { type: "application/pdf" }));
      say(`Downloaded ${name}. Page 1 is the puzzle. Page 2 is the answer.`);
    }),
  );
  if (!doc.getElementById("ws-seed").value) doc.getElementById("ws-seed").value = "1";
  answerBox.classList.add("answer-only");
}

export function placedCells(puzzle) {
  const cells = new Set();
  for (const item of puzzle.placed || []) {
    for (let i = 0; i < item.letters.length; i++) {
      cells.add(`${item.x + item.dx * i},${item.y + item.dy * i}`);
    }
  }
  return cells;
}

export function drawGrid(canvas, puzzle, marks, title = "Word search") {
  const ctx = canvas.getContext("2d");
  const side = puzzle.grid.length;
  const list = (puzzle.placed || []).map((item) => item.original || item.letters);
  const cols = 3;
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const width = 1200;
  const pad = 36;
  const titleH = 64;
  const listH = 48 + rows * 36;
  const cell = Math.floor((width - pad * 2) / side);
  const gridW = cell * side;
  const ox = Math.floor((width - gridW) / 2);
  const marked = marks ? placedCells(puzzle) : new Set();
  canvas.width = width;
  canvas.height = titleH + gridW + listH;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "32px sans-serif";
  ctx.fillText(title || "Word search", width / 2, 32);
  ctx.font = `${Math.max(18, Math.floor(cell * 0.45))}px sans-serif`;
  let boxed = 0;
  puzzle.grid.forEach((row, y) => {
    row.forEach((letter, x) => {
      ctx.fillText(letter, ox + (x + 0.5) * cell, titleH + (y + 0.5) * cell);
      if (marked.has(`${x},${y}`)) {
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + x * cell + 3, titleH + y * cell + 3, cell - 6, cell - 6);
        boxed += 1;
      }
    });
  });
  ctx.font = "22px sans-serif";
  ctx.textAlign = "left";
  const colW = (width - pad * 2) / cols;
  list.forEach((label, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx.fillText(label, pad + col * colW, titleH + gridW + 28 + row * 36);
  });
  return boxed;
}

if (typeof document !== "undefined" && document.getElementById?.("ws-words")) mount(document);
