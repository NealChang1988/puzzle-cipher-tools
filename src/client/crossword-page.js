import { PAGE_SIZE, findPattern, normalizePattern } from "../lib/crossword.js";
import { WORD_LIST_LOAD_ERROR, loadWordIndex } from "../lib/wordlist.js";
import { COPY_FAILED, copyText, withBusy } from "./ui.js";

export const REQUIRED_IDS = [
  "cross-pattern",
  "cross-length",
  "cross-boxes",
  "cross-results",
  "cross-status",
  "btn-find",
  "btn-copy",
  "btn-more",
  "btn-clear",
];

export function mount(doc) {
  const pattern = doc.getElementById("cross-pattern");
  const length = doc.getElementById("cross-length");
  const boxes = doc.getElementById("cross-boxes");
  const results = doc.getElementById("cross-results");
  const status = doc.getElementById("cross-status");
  const more = doc.getElementById("btn-more");
  let dictionary = null;
  let last = null;
  let shown = PAGE_SIZE;
  let lock = false;

  function say(text) {
    status.textContent = text;
  }
  function paintBoxes() {
    const value = normalizePattern(pattern.value);
    boxes.replaceChildren();
    [...value].forEach((ch, index) => {
      const input = doc.createElement("input");
      input.type = "text";
      input.maxLength = 1;
      input.value = ch === "?" ? "" : ch.toUpperCase();
      input.setAttribute("aria-label", `Letter ${index + 1}`);
      input.addEventListener("input", () => {
        const chars = [...normalizePattern(pattern.value)];
        const typed = input.value.normalize("NFKC").toLowerCase();
        chars[index] = typed >= "a" && typed <= "z" ? typed : "?";
        lock = true;
        pattern.value = chars.join("").toUpperCase();
        length.value = String(chars.length);
        lock = false;
      });
      boxes.append(input);
    });
    if (value) length.value = String(value.length);
  }
  function paint() {
    results.replaceChildren();
    if (!last || last.empty) {
      results.textContent = "Matching words will show up here.";
      more.hidden = true;
      return;
    }
    if (!last.ok) {
      const p = doc.createElement("p");
      p.className = "error";
      p.textContent = last.error;
      results.append(p);
      more.hidden = true;
      return;
    }
    const summary = doc.createElement("p");
    const hidden = last.hidden ? ` ${last.hidden} offensive ${last.hidden === 1 ? "word" : "words"} hidden.` : "";
    summary.textContent = `${last.words.length} words.${hidden}`;
    results.append(summary);
    const ul = doc.createElement("ul");
    ul.className = "words";
    for (const word of last.words.slice(0, shown)) {
      const li = doc.createElement("li");
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "word";
      button.textContent = word;
      button.addEventListener("click", () =>
        withBusy(button, async () => {
          const ok = await copyText(word);
          say(ok ? `Copied ${word}.` : COPY_FAILED);
        }),
      );
      li.append(button);
      ul.append(li);
    }
    results.append(ul);
    if (!last.words.length) {
      const p = doc.createElement("p");
      p.textContent = "No words found. Change a letter, or replace one with ? and press Find words again.";
      results.append(p);
    }
    more.hidden = shown >= last.words.length;
  }
  async function run() {
    await withBusy([doc.getElementById("btn-find"), doc.getElementById("btn-copy")], async () => {
      try {
        if (!dictionary) dictionary = await loadWordIndex();
      } catch {
        say(WORD_LIST_LOAD_ERROR);
        return;
      }
      last = findPattern(dictionary.words, dictionary.levelOf, dictionary.offensive, pattern.value);
      shown = PAGE_SIZE;
      paint();
      if (!last.ok || last.empty || !last.words?.length) {
        say(last.ok && !last.empty ? "No words found. Change a letter and press Find words again." : "");
      } else {
        say("Common words are first. Click a word to copy it, or press Copy all.");
      }
    });
  }

  pattern.addEventListener("input", () => {
    if (lock) return;
    paintBoxes();
  });
  length.addEventListener("change", () => {
    const size = Math.max(2, Math.min(28, Number(length.value) || 2));
    let value = normalizePattern(pattern.value);
    if (value.length < size) value += "?".repeat(size - value.length);
    if (value.length > size) value = value.slice(0, size);
    pattern.value = value.toUpperCase();
    paintBoxes();
  });
  doc.getElementById("btn-example")?.addEventListener("click", () => {
    pattern.value = "C?T";
    pattern.dispatchEvent(new Event("input", { bubbles: true }));
  });
  doc.getElementById("btn-find").addEventListener("click", () => run());
  more.addEventListener("click", () => {
    shown += PAGE_SIZE;
    paint();
  });
  doc.getElementById("btn-copy").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-copy"), async () => {
      if (!last?.words?.length) {
        say("There are no words to copy. Change the pattern and press Find words.");
        return;
      }
      const ok = await copyText(last.words.join("\n"));
      say(ok ? `Copied ${last.words.length} words.` : COPY_FAILED);
    }),
  );
  doc.getElementById("btn-clear").addEventListener("click", () => {
    pattern.value = "";
    last = null;
    paintBoxes();
    paint();
    say("Cleared.");
  });
  paintBoxes();
  paint();
}

if (typeof document !== "undefined" && document.getElementById?.("cross-pattern")) mount(document);
