import { NO_WORDS, PAGE_SIZE, hiddenMessage, search } from "../lib/anagram.js";
import { WORD_LIST_LOAD_ERROR, loadWordIndex } from "../lib/wordlist.js";
import { COPY_FAILED, copyText, withBusy } from "./ui.js";

export const REQUIRED_IDS = [
  "tool",
  "letters-input",
  "mode-all",
  "mode-any",
  "min-length",
  "btn-find",
  "btn-copy",
  "btn-clear",
  "btn-more",
  "letters-results",
  "letters-status",
];

export function mount(doc) {
  const input = doc.getElementById("letters-input");
  const results = doc.getElementById("letters-results");
  const status = doc.getElementById("letters-status");
  const more = doc.getElementById("btn-more");
  const find = doc.getElementById("btn-find");
  const copy = doc.getElementById("btn-copy");
  const root = doc.getElementById("tool");
  const defaultMode = root.getAttribute("data-default-mode") === "any" ? "any" : "all";
  doc.getElementById(defaultMode === "any" ? "mode-any" : "mode-all").checked = true;

  let index = null;
  let last = null;
  let shown = PAGE_SIZE;

  function mode() {
    return doc.getElementById("mode-any").checked ? "any" : "all";
  }
  function minLength() {
    return Number(doc.getElementById("min-length").value) || 3;
  }

  function paint() {
    results.replaceChildren();
    if (!last || last.emptyInput) {
      results.textContent = "Words you can spell will show up here.";
      more.hidden = true;
      return;
    }
    if (!last.ok) {
      const p = doc.createElement("p");
      p.className = "error";
      p.append(last.error + (last.hint ? " " : ""));
      if (last.hint) {
        const link = doc.createElement("a");
        link.href = last.hint.href;
        link.textContent = last.hint.label;
        p.append(link, ".");
      }
      results.append(p);
      more.hidden = true;
      return;
    }
    if (!last.words.length) {
      const p = doc.createElement("p");
      p.textContent = NO_WORDS;
      results.append(p);
      if (last.hidden) {
        const hidden = doc.createElement("p");
        hidden.textContent = hiddenMessage(last.hidden);
        results.append(hidden);
      }
      more.hidden = true;
      return;
    }
    const summary = doc.createElement("p");
    summary.className = "count";
    summary.textContent = last.hidden
      ? `${last.words.length} words. ${hiddenMessage(last.hidden)}.`
      : `${last.words.length} words.`;
    results.append(summary);
    let length = 0;
    let list = null;
    for (const item of last.words.slice(0, shown)) {
      if (item.length !== length) {
        length = item.length;
        const heading = doc.createElement("h3");
        heading.textContent = `${length} letters`;
        results.append(heading);
        list = doc.createElement("ul");
        list.className = "words";
        results.append(list);
      }
      const li = doc.createElement("li");
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "word";
      const spelling = doc.createElement("span");
      spelling.className = "spelling";
      if (item.mask?.some(Boolean)) {
        [...item.word].forEach((ch, index) => {
          const span = doc.createElement("span");
          span.textContent = ch;
          if (item.mask[index]) span.className = "wild";
          spelling.append(span);
        });
      } else {
        spelling.textContent = item.word;
      }
      const len = doc.createElement("span");
      len.className = "len";
      len.textContent = String(item.length);
      btn.append(spelling, len);
      btn.setAttribute("aria-label", `Copy ${item.word}, ${item.length} letters`);
      btn.addEventListener("click", () =>
        withBusy(btn, async () => {
          const ok = await copyText(item.word);
          status.textContent = ok ? `Copied ${item.word}.` : COPY_FAILED;
        }),
      );
      li.append(btn);
      list.append(li);
    }
    more.hidden = shown >= last.words.length;
  }

  async function run() {
    await withBusy([find, copy], async () => {
      try {
        if (!index) index = await loadWordIndex();
      } catch {
        status.textContent = WORD_LIST_LOAD_ERROR;
        return;
      }
      last = search(index, input.value, { mode: mode(), minLength: minLength() });
      shown = PAGE_SIZE;
      paint();
      if (last.ok && !last.emptyInput && last.words.length) {
        status.textContent = "Click a word to copy it, or press Copy all.";
      } else if (!last.ok) {
        status.textContent = "";
      }
    });
  }

  doc.getElementById("btn-example")?.addEventListener("click", () => {
    input.value = defaultMode === "any" ? "P, L, O, E" : "LISTEN";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  input.addEventListener("input", () => run());
  doc.getElementById("mode-all").addEventListener("change", () => run());
  doc.getElementById("mode-any").addEventListener("change", () => run());
  doc.getElementById("min-length").addEventListener("change", () => run());
  find.addEventListener("click", () => run());
  more.addEventListener("click", () => {
    shown += PAGE_SIZE;
    paint();
  });
  copy.addEventListener("click", () =>
    withBusy(copy, async () => {
      if (!last?.ok || !last.words.length) {
        status.textContent = "There are no words to copy. Change the letters and press Find words.";
        return;
      }
      const ok = await copyText(last.words.map((item) => item.word).join("\n"));
      status.textContent = ok ? `Copied ${last.words.length} words.` : COPY_FAILED;
    }),
  );
  doc.getElementById("btn-clear").addEventListener("click", () => {
    input.value = "";
    last = null;
    paint();
    status.textContent = "Cleared.";
  });
  paint();
}

if (typeof document !== "undefined" && document.getElementById?.("letters-input")) {
  mount(document);
}
