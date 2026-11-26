import {
  CONFLICT,
  LOW_GIVENS,
  MULTI,
  NONE,
  NO_HINT,
  TIMEOUT,
  compactGrid,
  explain,
  findConflicts,
  formatGrid,
  hint,
  lowGivens,
  parseGrid,
  solve,
} from "../lib/sudoku.js";
import { COPY_FAILED, copyText, downloadBlob, withBusy } from "./ui.js";

export const REQUIRED_IDS = [
  "sudoku-grid",
  "sudoku-status",
  "paste-input",
  "btn-solve",
  "btn-hint",
  "btn-check",
  "btn-clear",
  "btn-copy",
  "btn-download",
  "btn-erase",
];

export function mount(doc) {
  const status = doc.getElementById("sudoku-status");
  const grid = doc.getElementById("sudoku-grid");
  const paste = doc.getElementById("paste-input");
  const pasteWrap = doc.getElementById("sudoku-paste");
  const pasteBtn = doc.getElementById("btn-paste");
  const values = Array(81).fill(0);
  const fixed = Array(81).fill(false);
  const solved = Array(81).fill(false);
  const bad = Array(81).fill(false);
  let hinted = -1;
  let selected = 0;
  const actionButtons = ["btn-solve", "btn-hint", "btn-check", "btn-copy", "btn-download"].map((id) =>
    doc.getElementById(id),
  );

  function paint() {
    for (let i = 0; i < 81; i++) {
      const cell = doc.getElementById("cell-" + i);
      cell.textContent = values[i] ? String(values[i]) : "";
      cell.classList.toggle("given", fixed[i]);
      cell.classList.toggle("solved", solved[i]);
      cell.classList.toggle("bad", bad[i]);
      cell.classList.toggle("hinted", hinted === i);
      cell.classList.toggle("selected", selected === i);
      cell.setAttribute("aria-selected", selected === i ? "true" : "false");
      if (bad[i]) cell.setAttribute("aria-invalid", "true");
      else cell.removeAttribute("aria-invalid");
    }
  }
  function say(text) {
    status.textContent = text;
  }
  function clearMarks() {
    bad.fill(false);
    hinted = -1;
  }
  function markConflicts(pairs) {
    bad.fill(false);
    for (const [a, b] of pairs) {
      bad[a] = true;
      bad[b] = true;
    }
  }
  function select(index) {
    selected = (index + 81) % 81;
    paint();
    const cell = doc.getElementById("cell-" + selected);
    const keyIn = doc.getElementById("sudoku-key");
    const narrow = typeof matchMedia === "function" && matchMedia("(max-width: 799px)").matches;
    if (narrow && keyIn) {
      keyIn.value = "";
      keyIn.focus();
    } else {
      cell.focus();
    }
  }
  function writeDigit(digit) {
    clearMarks();
    solved[selected] = false;
    values[selected] = digit;
    fixed[selected] = digit !== 0;
    paint();
  }
  function cluesMessage(base) {
    return lowGivens(values) ? `${base} ${LOW_GIVENS}` : base;
  }

  for (let i = 0; i < 81; i++) {
    doc.getElementById("cell-" + i).addEventListener("click", () => select(i));
  }
  const keyIn = doc.getElementById("sudoku-key");
  keyIn?.addEventListener("input", () => {
    const digit = (keyIn.value.match(/[1-9]/g) || []).pop();
    keyIn.value = "";
    if (digit) writeDigit(Number(digit));
  });
  function onGridKey(event) {
    const key = event.key;
    if (key >= "1" && key <= "9") {
      writeDigit(Number(key));
      event.preventDefault?.();
    } else if (key === "0" || key === "Backspace" || key === "Delete") {
      writeDigit(0);
      event.preventDefault?.();
    } else if (key === "ArrowRight") {
      select(selected + 1);
      event.preventDefault?.();
    } else if (key === "ArrowLeft") {
      select(selected - 1);
      event.preventDefault?.();
    } else if (key === "ArrowDown") {
      select(selected + 9);
      event.preventDefault?.();
    } else if (key === "ArrowUp") {
      select(selected - 9);
      event.preventDefault?.();
    }
  }
  grid.addEventListener("keydown", onGridKey);
  keyIn?.addEventListener("keydown", onGridKey);
  for (let digit = 1; digit <= 9; digit++) {
    doc.getElementById("btn-n" + digit).addEventListener("click", () => writeDigit(digit));
  }
  doc.getElementById("btn-erase").addEventListener("click", () => writeDigit(0));

  pasteBtn?.addEventListener("click", () => {
    const open = pasteWrap.classList.toggle("open");
    pasteBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) paste.focus();
  });
  paste.addEventListener("input", () => {
    if (!paste.value.trim()) return;
    const parsed = parseGrid(paste.value);
    if (!parsed.ok) {
      say(parsed.error);
      return;
    }
    for (let i = 0; i < 81; i++) {
      values[i] = parsed.values[i];
      fixed[i] = parsed.values[i] > 0;
      solved[i] = false;
      bad[i] = false;
    }
    hinted = -1;
    paint();
    say(cluesMessage("Filled the grid from your paste."));
  });

  doc.getElementById("btn-solve").addEventListener("click", () =>
    withBusy(actionButtons, async () => {
      const pairs = findConflicts(values);
      if (pairs.length) {
        markConflicts(pairs);
        paint();
        say(pairs.length === 1 ? CONFLICT : "Some cells share a number. Change one red cell, then press Solve again.");
        return;
      }
      const result = solve(values, { deadline: Date.now() + 2000 });
      if (result.timedOut) {
        say(TIMEOUT);
        return;
      }
      if (!result.solutions.length) {
        say(NONE);
        return;
      }
      const solution = result.solutions[0];
      for (let i = 0; i < 81; i++) {
        solved[i] = !values[i];
        values[i] = solution[i];
        if (solved[i]) fixed[i] = false;
      }
      clearMarks();
      paint();
      const lead =
        result.solutions.length > 1
          ? `${MULTI} One answer is filled in.`
          : "Solved. Bold numbers are the ones you started with. The other numbers were filled in.";
      say(cluesMessage(lead));
    }),
  );

  doc.getElementById("btn-hint").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-hint"), async () => {
      const pairs = findConflicts(values);
      if (pairs.length) {
        markConflicts(pairs);
        paint();
        say(CONFLICT);
        return;
      }
      const step = hint(values);
      if (!step) {
        say(NO_HINT);
        return;
      }
      values[step.index] = step.digit;
      fixed[step.index] = false;
      solved[step.index] = false;
      bad.fill(false);
      hinted = step.index;
      selected = step.index;
      paint();
      const row = ((step.index / 9) | 0) + 1;
      const col = (step.index % 9) + 1;
      say(`Row ${row}, column ${col}. ${explain(step)}`);
    }),
  );

  doc.getElementById("btn-check").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-check"), async () => {
      const pairs = findConflicts(values);
      if (pairs.length) {
        markConflicts(pairs);
        paint();
        say(pairs.length === 1 ? CONFLICT : "Some cells share a number. Change one red cell, then press Check again.");
        return;
      }
      const result = solve(values, { deadline: Date.now() + 2000 });
      if (result.timedOut) {
        say(TIMEOUT);
        return;
      }
      if (!result.solutions.length) {
        say(NONE);
        return;
      }
      if (result.solutions.length > 1) {
        say(cluesMessage(MULTI));
        return;
      }
      say(cluesMessage("No mistakes so far. Press Solve for the full answer, or press Hint for one next step."));
    }),
  );

  doc.getElementById("btn-clear").addEventListener("click", () => {
    values.fill(0);
    fixed.fill(false);
    solved.fill(false);
    bad.fill(false);
    hinted = -1;
    paste.value = "";
    paint();
    say("Cleared. Tap a cell and type a number, or paste a puzzle.");
  });

  function answerText() {
    if (values.some((value) => !value)) return null;
    return `${formatGrid(values)}\n\n${compactGrid(values)}\n`;
  }

  doc.getElementById("btn-copy").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-copy"), async () => {
      const text = answerText();
      if (!text) {
        say("Press Solve first, then press Copy answer.");
        return;
      }
      const ok = await copyText(text);
      say(ok ? "Copied the answer." : COPY_FAILED);
    }),
  );

  doc.getElementById("btn-download").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-download"), async () => {
      const text = answerText();
      if (!text) {
        say("Press Solve first, then press Download answer.");
        return;
      }
      downloadBlob(doc, "sudoku-answer.txt", new Blob([text], { type: "text/plain" }));
      say("Downloaded sudoku-answer.txt. Open it in any text app.");
    }),
  );

  paint();
}

if (typeof document !== "undefined" && document.getElementById?.("sudoku-grid")) {
  mount(document);
}
