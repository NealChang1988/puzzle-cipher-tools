import { looksLikeMorse } from "../lib/morse.js";
import {
  FE0E,
  toSymbols,
  toText,
  unknownLetterMessage,
  unknownSymbolMessage,
} from "../lib/wingdings.js";
import { COPY_FAILED, copyText, downloadBlob, slugName, withBusy } from "./ui.js";

export const REQUIRED_IDS = [
  "wd-text",
  "wd-symbols",
  "wd-note",
  "btn-copy-symbols",
  "btn-copy-text",
  "btn-png",
  "btn-clear",
];

export function mount(doc) {
  const text = doc.getElementById("wd-text");
  const symbols = doc.getElementById("wd-symbols");
  const note = doc.getElementById("wd-note");
  let lock = false;

  function setNote(message, link) {
    note.replaceChildren();
    if (message) note.append(message + (link ? " " : ""));
    if (link) {
      note.append("Open the ");
      const anchor = doc.createElement("a");
      anchor.href = link.href;
      anchor.textContent = link.label;
      note.append(anchor, ".");
    }
  }

  function fromText() {
    const result = toSymbols(text.value);
    if (result.error) {
      symbols.value = "";
      setNote(result.error);
      return;
    }
    symbols.value = result.symbols;
    const morse = looksLikeMorse(text.value) && text.value.trim();
    setNote(
      unknownSymbolMessage(result.unknown),
      morse
        ? {
            href: "/",
            label: "Morse Code Translator",
          }
        : null,
    );
    if (morse && !result.unknown.length) {
      setNote("This looks like Morse code. Open the Morse Code Translator if you wanted the dots and dashes read as letters.", {
        href: "/",
        label: "Morse Code Translator",
      });
    }
  }

  function fromSymbols() {
    const result = toText(symbols.value);
    if (result.error) {
      text.value = "";
      setNote(result.error);
      return;
    }
    text.value = result.text;
    setNote(unknownLetterMessage(result.unknown));
  }

  text.addEventListener("input", () => {
    if (lock) return;
    lock = true;
    fromText();
    lock = false;
  });
  symbols.addEventListener("input", () => {
    if (lock) return;
    lock = true;
    fromSymbols();
    lock = false;
  });

  doc.getElementById("btn-copy-symbols").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-copy-symbols"), async () => {
      if (!symbols.value) {
        setNote("There is nothing to copy yet. Type into Text first.");
        return;
      }
      const ok = await copyText(symbols.value);
      setNote(ok ? "Copied the symbols." : COPY_FAILED);
    }),
  );
  doc.getElementById("btn-copy-text").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-copy-text"), async () => {
      if (!text.value) {
        setNote("There is nothing to copy yet. Type into Text or Symbols first.");
        return;
      }
      const ok = await copyText(text.value);
      setNote(ok ? "Copied the text." : COPY_FAILED);
    }),
  );
  doc.getElementById("btn-png").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-png"), async () => {
      if (!symbols.value.trim()) {
        setNote("There is nothing to draw yet. Type into Text or Symbols first.");
        return;
      }
      try {
        if (doc.fonts?.load) await doc.fonts.load('42px "Puzzle Cipher Symbols"');
      } catch {
        /* draw anyway */
      }
      const blob = await drawSymbols(doc, symbols.value);
      if (!blob) {
        setNote("The picture could not be created. Press Copy symbols instead.");
        return;
      }
      const name = `text-as-symbols-${slugName(text.value, "message")}.png`;
      downloadBlob(doc, name, blob);
      setNote(`Downloaded ${name}. Open it in any image app. The picture uses this site’s font, not a Microsoft font.`);
    }),
  );
  doc.getElementById("btn-clear").addEventListener("click", () => {
    text.value = "";
    symbols.value = "";
    setNote("Cleared.");
  });
}

export async function drawSymbols(doc, value) {
  const canvas = doc.createElement("canvas");
  const ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx || !canvas.toBlob) return null;
  const plain = String(value).replaceAll(FE0E, "");
  const size = 42;
  ctx.font = `${size}px "Puzzle Cipher Symbols", sans-serif`;
  const max = 1000;
  const lines = wrap(ctx, plain, max);
  canvas.width = 1100;
  canvas.height = Math.min(4000, 80 + lines.length * (size + 18));
  const paint = canvas.getContext("2d");
  paint.fillStyle = "#fffaf1";
  paint.fillRect(0, 0, canvas.width, canvas.height);
  paint.fillStyle = "#1c1915";
  paint.font = `${size}px "Puzzle Cipher Symbols", sans-serif`;
  paint.textBaseline = "top";
  lines.forEach((line, index) => paint.fillText(line, 40, 36 + index * (size + 18)));
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return blob;
}

function wrap(ctx, text, max) {
  const lines = [];
  let line = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const trial = line + ch;
    const width = ctx.measureText(trial).width;
    if (line && width > max) {
      lines.push(line);
      line = ch === " " ? "" : ch;
    } else line = trial;
  }
  lines.push(line);
  return lines.length ? lines : [""];
}

if (typeof document !== "undefined" && document.getElementById?.("wd-text")) {
  mount(document);
}
