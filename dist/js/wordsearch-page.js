import { wordSearchDocument } from "../lib/pdf.js";
import { generateWordSearch } from "../lib/wordsearch.js";
import { downloadBlob, slugName, withBusy } from "./ui.js";

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
  let puzzle = null;
  let show = false;

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
    words.textContent = puzzle.placed.map((item) => item.original).join(", ");
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
    renderGrid(puzzleBox, false);
    renderGrid(answerBox, true);
    renderList();
    const skipped = puzzle.skipped.length ? ` ${puzzle.skipped.length} word${puzzle.skipped.length === 1 ? "" : "s"} left out. The reason is under the list.` : "";
    say(`Made a ${puzzle.size} by ${puzzle.size} puzzle, seed ${puzzle.seed}.${skipped}`);
  }

  doc.getElementById("btn-new").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-new"), async () => {
      if (!doc.getElementById("ws-seed").value) {
        doc.getElementById("ws-seed").value = String((Date.now() % 1000000) | 0);
      }
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
    if (typeof globalThis.print === "function") globalThis.print();
    else say("Press Download PDF to save the puzzle and the answer.");
  });
  doc.getElementById("btn-png").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-png"), async () => {
      if (!puzzle) make();
      if (!puzzle?.ok) return;
      const canvas = doc.createElement("canvas");
      drawGrid(canvas, puzzle, false);
      const blob = await new Promise((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
      if (!blob) {
        say("The picture could not be created. Press Download PDF instead.");
        return;
      }
      const name = `word-search-${slugName(doc.getElementById("ws-title").value, "puzzle")}.png`;
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
      const name = `word-search-${slugName(title, "puzzle")}.pdf`;
      downloadBlob(doc, name, new Blob([pdf], { type: "application/pdf" }));
      say(`Downloaded ${name}. Page 1 is the puzzle. Page 2 is the answer.`);
    }),
  );
  if (!doc.getElementById("ws-seed").value) doc.getElementById("ws-seed").value = "1";
  answerBox.classList.add("answer-only");
}

function drawGrid(canvas, puzzle, marks) {
  const ctx = canvas.getContext("2d");
  const side = puzzle.grid.length;
  const cell = 28;
  canvas.width = side * cell + 24;
  canvas.height = side * cell + 24;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  puzzle.grid.forEach((row, y) => {
    row.forEach((letter, x) => {
      ctx.fillText(letter, 12 + (x + 0.5) * cell, 12 + (y + 0.5) * cell);
    });
  });
  void marks;
}

if (typeof document !== "undefined" && document.getElementById?.("ws-words")) mount(document);
