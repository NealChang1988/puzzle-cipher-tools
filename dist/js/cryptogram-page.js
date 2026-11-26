import { hideOffensive, letterMap, parseKnown, solveCryptogram } from "../lib/cryptogram.js";
import { WORD_LIST_LOAD_ERROR, loadWordIndex } from "../lib/wordlist.js";
import { COPY_FAILED, copyText, withBusy } from "./ui.js";

export const REQUIRED_IDS = [
  "crypto-text",
  "crypto-known",
  "crypto-self",
  "crypto-results",
  "crypto-status",
  "btn-solve",
  "btn-letter",
  "btn-word",
  "btn-copy",
  "btn-clear",
];

export function mount(doc) {
  const text = doc.getElementById("crypto-text");
  const known = doc.getElementById("crypto-known");
  const selfBox = doc.getElementById("crypto-self");
  const results = doc.getElementById("crypto-results");
  const status = doc.getElementById("crypto-status");
  const buttons = ["btn-solve", "btn-letter", "btn-word", "btn-copy"].map((id) => doc.getElementById(id));
  let dictionary = null;
  let last = null;

  function say(message) {
    status.textContent = message;
  }
  async function ready() {
    if (!dictionary) {
      const loaded = await loadWordIndex();
      const levelOf = loaded.levelOf;
      if (!levelOf.has("a")) levelOf.set("a", 10);
      if (!levelOf.has("i")) levelOf.set("i", 40);
      dictionary = { words: loaded.words, levelOf, offensive: loaded.offensive };
    }
    return dictionary;
  }
  function visibleAnswers(solved) {
    return hideOffensive(solved?.solutions || [], dictionary?.offensive || new Set());
  }
  function render(solved) {
    results.replaceChildren();
    if (!solved) {
      results.textContent = "Answers will show up here.";
      return;
    }
    if (!solved.ok) {
      const p = doc.createElement("p");
      p.className = "error";
      p.append(solved.error + " ");
      if (solved.hint) {
        const link = doc.createElement("a");
        link.href = solved.hint.href;
        link.textContent = solved.hint.label;
        p.append(link, ".");
      }
      results.append(p);
      return;
    }
    const visible = visibleAnswers(solved);
    const list = visible.shown.slice(0, 10);
    if (!list.length) {
      const p = doc.createElement("p");
      p.textContent = solved.partial
        ? `Partial answer: ${solved.partial}. Some letters are still blank. Add a known letter, such as Q=A, and press Solve again.`
        : "No answer yet. Add a known letter, such as Q=A, and press Solve again.";
      results.append(p);
      return;
    }
    if (visible.hidden) {
      const note = doc.createElement("p");
      note.textContent = `${visible.hidden} offensive ${visible.hidden === 1 ? "answer" : "answers"} hidden`;
      results.append(note);
    }
    list.forEach((item, index) => {
      const block = doc.createElement("article");
      block.className = "answer";
      const title = doc.createElement("p");
      title.textContent = `${index + 1}. ${item.text}`;
      const map = doc.createElement("p");
      map.className = "fine";
      map.textContent = letterMap(item.assign);
      block.append(title, map);
      results.append(block);
    });
    if (solved.timedOut) {
      const note = doc.createElement("p");
      note.textContent = "Solving stopped after 5 seconds. These are the best answers so far. Add a known letter and press Solve again.";
      results.append(note);
    }
  }
  async function solveCurrent() {
    try {
      await ready();
    } catch {
      say(WORD_LIST_LOAD_ERROR.replace("Find words", "Solve"));
      return null;
    }
    const parsed = parseKnown(known.value);
    if (parsed.errors.length) {
      last = null;
      render(null);
      say(`Could not read ${parsed.errors[0]}. Write known letters as Q=A, separated by commas.`);
      return null;
    }
    last = solveCryptogram(text.value, dictionary, {
      known: parsed.map,
      noSelf: selfBox.checked,
      deadline: Date.now() + 5000,
    });
    return last;
  }
  function bestShown(solved) {
    return visibleAnswers(solved).shown[0] || null;
  }
  async function run() {
    await withBusy(buttons, async () => {
      const solved = await solveCurrent();
      if (!solved) return;
      render(solved);
      if (!solved.ok) {
        say("");
        return;
      }
      if (!bestShown(solved)) {
        say("No answer yet. Add a known letter, such as Q=A, and press Solve again.");
        return;
      }
      say("The most common answer is first. Press Copy best answer to copy it.");
    });
  }
  async function hint(kind) {
    await withBusy(buttons, async () => {
      const solved = await solveCurrent();
      if (!solved) return;
      if (!solved.ok) {
        render(solved);
        say("");
        return;
      }
      const best = bestShown(solved);
      if (!best) {
        render(solved);
        say("No answer yet. Add a known letter, such as Q=A, and press Solve again.");
        return;
      }
      if (kind === "letter") {
        const pair = [...best.assign.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))[0];
        say(`One letter: ${pair[0]} stands for ${pair[1].toUpperCase()}.`);
        return;
      }
      const cipher = (text.value.toUpperCase().match(/[A-Z]+/) || [])[0];
      const plain = [...cipher].map((ch) => best.assign.get(ch) || "_").join("").toUpperCase();
      say(`One word: ${cipher} is ${plain}.`);
    });
  }

  doc.getElementById("btn-example")?.addEventListener("click", () => {
    text.value = "YGXK LEGKT QFR LTCTF NTQKL QUG GXK YQZITKL WKGXUIZ YGKZI GF ZIOL EGFZOFTFZ Q FTV FQZOGF";
  });
  text.addEventListener("input", () => {
    last = null;
    render(null);
    say("");
  });
  known.addEventListener("input", () => {
    if (status.textContent.startsWith("Could not read")) say("");
  });
  doc.getElementById("btn-solve").addEventListener("click", () => run());
  doc.getElementById("btn-letter").addEventListener("click", () => hint("letter"));
  doc.getElementById("btn-word").addEventListener("click", () => hint("word"));
  doc.getElementById("btn-copy").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-copy"), async () => {
      const best = hideOffensive(last?.solutions || [], dictionary?.offensive || new Set()).shown[0];
      if (!best) {
        say("Press Solve first, then press Copy best answer.");
        return;
      }
      const ok = await copyText(best.text);
      say(ok ? "Copied the best answer." : COPY_FAILED);
    }),
  );
  doc.getElementById("btn-clear").addEventListener("click", () => {
    text.value = "";
    known.value = "";
    last = null;
    render(null);
    say("Cleared.");
  });
  render(null);
}

if (typeof document !== "undefined" && document.getElementById?.("crypto-text")) mount(document);
