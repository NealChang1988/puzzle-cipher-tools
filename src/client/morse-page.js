import {
  MAX_SOUND_MS,
  buildWav,
  segments,
  soundDurationMs,
  timings,
  translate,
  unknownMessage,
} from "../lib/morse.js";
import { COPY_FAILED, copyText, downloadBlob, slugName, withBusy } from "./ui.js";

export const REQUIRED_IDS = [
  "morse-input",
  "morse-output",
  "morse-unknown",
  "morse-status",
  "mode-auto",
  "mode-text",
  "mode-morse",
  "wpm",
  "wpm-value",
  "pitch",
  "pitch-value",
  "btn-copy",
  "btn-play",
  "btn-stop",
  "btn-wav",
  "btn-txt",
  "btn-share",
  "btn-clear",
];

export function mount(doc) {
  const input = doc.getElementById("morse-input");
  const output = doc.getElementById("morse-output");
  const unknown = doc.getElementById("morse-unknown");
  const status = doc.getElementById("morse-status");
  const busyButtons = ["btn-copy", "btn-play", "btn-wav", "btn-txt", "btn-share"].map((id) =>
    doc.getElementById(id),
  );
  let mode = "auto";
  let audio = null;
  let oscillator = null;

  function wpm() {
    return clamp(Number(doc.getElementById("wpm").value), 5, 40, 20);
  }
  function pitch() {
    return clamp(Number(doc.getElementById("pitch").value), 400, 1000, 600);
  }
  function current() {
    return translate(input.value, mode);
  }
  function show(result) {
    if (result.error) {
      output.value = "";
      unknown.textContent = result.error;
      return;
    }
    output.value = result.output;
    unknown.replaceChildren();
    if (result.unknown?.length) {
      unknown.append(unknownMessage(result.unknown) + " ");
    }
    const hint = sudokuHint(input.value);
    if (hint) {
      unknown.append(hint.text + " Open the ");
      const link = doc.createElement("a");
      link.href = hint.href;
      link.textContent = hint.label;
      unknown.append(link, ".");
    }
  }
  function render() {
    show(current());
  }

  input.addEventListener("input", () => {
    status.textContent = "";
    render();
  });

  function setMode(next) {
    mode = next;
    for (const [id, value] of [
      ["mode-auto", "auto"],
      ["mode-text", "text"],
      ["mode-morse", "morse"],
    ]) {
      doc.getElementById(id).setAttribute("aria-pressed", value === mode ? "true" : "false");
    }
    render();
  }
  doc.getElementById("mode-auto").addEventListener("click", () => setMode("auto"));
  doc.getElementById("mode-text").addEventListener("click", () => setMode("text"));
  doc.getElementById("mode-morse").addEventListener("click", () => setMode("morse"));

  doc.getElementById("wpm").addEventListener("input", () => {
    doc.getElementById("wpm-value").textContent = String(wpm());
  });
  doc.getElementById("pitch").addEventListener("input", () => {
    doc.getElementById("pitch-value").textContent = String(pitch());
  });

  doc.getElementById("btn-copy").addEventListener("click", () =>
    withBusy(busyButtons, async () => {
      if (!output.value) {
        status.textContent = "There is nothing to copy yet. Type a message first.";
        return;
      }
      const ok = await copyText(output.value);
      status.textContent = ok ? "Copied." : COPY_FAILED;
    }),
  );

  doc.getElementById("btn-play").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-play"), async () => {
      const result = current();
      if (result.error) {
        status.textContent = result.error;
        return;
      }
      if (!result.morse) {
        status.textContent = "There is nothing to play yet. Type a message first.";
        return;
      }
      if (soundDurationMs(result.morse, wpm()) > MAX_SOUND_MS) {
        status.textContent =
          "This sound is longer than 10 minutes. Shorten the message or raise the speed (WPM).";
        return;
      }
      const played = await play(doc, result.morse, wpm(), pitch(), {
        get audio() {
          return audio;
        },
        set audio(value) {
          audio = value;
        },
        get oscillator() {
          return oscillator;
        },
        set oscillator(value) {
          oscillator = value;
        },
      });
      status.textContent = played
        ? "Playing. Press Stop to end the sound."
        : "This browser did not play the sound. Press Download WAV and open the file instead.";
    }),
  );

  doc.getElementById("btn-stop").addEventListener("click", () => {
    stopNode(oscillator);
    oscillator = null;
    status.textContent = "Stopped.";
  });

  doc.getElementById("btn-wav").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-wav"), async () => {
      const result = current();
      if (result.error) {
        status.textContent = result.error;
        return;
      }
      const built = buildWav(result.morse || "", { wpm: wpm(), freq: pitch() });
      if (built.error) {
        status.textContent = built.error;
        return;
      }
      const name = `morse-${slugName(result.plain || "message", "message")}.wav`;
      downloadBlob(doc, name, new Blob([built.wav], { type: "audio/wav" }));
      status.textContent = `Downloaded ${name}. Open it in any music or voice app.`;
    }),
  );

  doc.getElementById("btn-txt").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-txt"), async () => {
      const result = current();
      if (result.error) {
        status.textContent = result.error;
        return;
      }
      if (!result.output) {
        status.textContent = "There is nothing to download yet. Type a message first.";
        return;
      }
      const name = `morse-${slugName(result.plain || result.output, "message")}.txt`;
      downloadBlob(doc, name, new Blob([result.output + "\n"], { type: "text/plain" }));
      status.textContent = `Downloaded ${name}.`;
    }),
  );

  doc.getElementById("btn-share").addEventListener("click", () =>
    withBusy(doc.getElementById("btn-share"), async () => {
      const text = input.value;
      if (!text.trim()) {
        status.textContent = "Type a message first, then press Share link.";
        return;
      }
      if ([...text].length > 1800) {
        status.textContent = "This message is too long to put in a link. Press Download TXT instead.";
        return;
      }
      const loc = globalThis.location;
      const url = `${loc.origin}${loc.pathname}#m=${encodeURIComponent(text)}`;
      const ok = await copyText(url);
      status.textContent = ok
        ? "Copied a link. The message is only in the # part, which is not uploaded."
        : COPY_FAILED;
    }),
  );

  doc.getElementById("btn-clear").addEventListener("click", () => {
    stopNode(oscillator);
    oscillator = null;
    input.value = "";
    output.value = "";
    unknown.textContent = "";
    status.textContent = "Cleared.";
    const loc = globalThis.location;
    if (loc && loc.hash && globalThis.history?.replaceState) {
      history.replaceState(null, "", loc.pathname + loc.search);
    }
  });

  const hash = globalThis.location?.hash || "";
  if (hash.startsWith("#m=")) {
    try {
      input.value = decodeURIComponent(hash.slice(3));
    } catch {
      input.value = hash.slice(3);
    }
  }
  render();
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sudokuHint(raw) {
  const text = String(raw).normalize("NFKC").trim();
  if (!text || /[a-z]/i.test(text)) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 81 && /^[\d\s.\-|]+$/.test(text)) {
    return {
      href: "/sudoku-solver/",
      label: "Sudoku Solver",
      text: "This looks like a sudoku puzzle.",
    };
  }
  return null;
}

function stopNode(node) {
  try {
    node?.stop?.();
  } catch {
    /* already stopped */
  }
}

async function play(doc, morse, wpm, freq, state) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return false;
  try {
    if (!state.audio) state.audio = new Ctx();
    if (state.audio.state === "suspended" && state.audio.resume) await state.audio.resume();
    stopNode(state.oscillator);
    const dot = timings(wpm).dot / 1000;
    const t0 = (state.audio.currentTime || 0) + 0.03;
    let t = t0;
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain ? state.audio.createGain() : null;
    osc.frequency.value = freq;
    if (gain) {
      osc.connect(gain);
      gain.connect(state.audio.destination);
      gain.gain.setValueAtTime(0, t0);
    } else {
      osc.connect(state.audio.destination);
    }
    for (const seg of segments(morse)) {
      const dur = seg.units * dot;
      if (seg.on && gain) {
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.setValueAtTime(0, t + Math.max(0, dur - 0.005));
      }
      t += dur;
    }
    osc.start(t0);
    osc.stop(t + 0.02);
    state.oscillator = osc;
    return true;
  } catch {
    return false;
  }
}

if (typeof document !== "undefined" && document.getElementById?.("morse-input")) {
  mount(document);
}
