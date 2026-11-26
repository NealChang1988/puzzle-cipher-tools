/**
 * International Morse code, ITU-R M.1677-1 (October 2009).
 * Timing follows the PARIS rule: one dot is 1200 / WPM milliseconds.
 * A dash is 3 dots, the gap inside a letter is 1 dot, the gap between
 * letters is 3 dots, and the gap between words is 7 dots.
 */

export const TOO_LONG =
  "Too long \u2014 please split into parts under 10,000 characters";

export const MAX_CHARS = 10000;
export const MAX_SOUND_MS = 10 * 60 * 1000;

/** Letters, digits, and punctuation in ITU-R M.1677-1. */
export const ITU = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
  "\u00C9": "..-..",
  ".": ".-.-.-",
  ",": "--..--",
  ":": "---...",
  "?": "..--..",
  "'": ".----.",
  "-": "-....-",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  '"': ".-..-.",
  "=": "-...-",
  "+": ".-.-.",
  "@": ".--.-.",
};

/** Widely used marks that are not part of ITU-R M.1677-1. */
export const COMMON = {
  "!": "-.-.--",
  "&": ".-...",
  ";": "-.-.-.",
  _: "..--.-",
  $: "...-..-",
};

const TO_CODE = { ...ITU, ...COMMON };
const FROM_CODE = new Map();
for (const [char, code] of Object.entries(TO_CODE)) {
  if (FROM_CODE.has(code)) {
    throw new Error(`Duplicate Morse code ${code} for ${char}`);
  }
  FROM_CODE.set(code, char);
}

export function timings(wpm) {
  const dot = 1200 / wpm;
  return {
    wpm,
    dot,
    dash: dot * 3,
    elementGap: dot,
    letterGap: dot * 3,
    wordGap: dot * 7,
  };
}

export function prepare(raw) {
  return String(raw)
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .normalize("NFKC")
    .normalize("NFC")
    .replace(/[·•∙‧⋅]/g, ".")
    .replace(/[−–—―‒‐]/g, "-")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"');
}

export function looksLikeMorse(prepared) {
  if (!/[.\-_]/.test(prepared)) return false;
  return /^[\s.\-_/|]+$/.test(prepared);
}

function uniqueInOrder(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function encodeText(prepared) {
  const upper = prepared.toUpperCase();
  const unknown = [];
  const words = upper.trim().length ? upper.trim().split(/\s+/) : [];
  const out = [];
  for (const word of words) {
    const codes = [];
    for (const ch of word) {
      const code = TO_CODE[ch];
      if (code) codes.push(code);
      else unknown.push(ch);
    }
    if (codes.length) out.push(codes.join(" "));
  }
  return { output: out.join(" / "), unknown: uniqueInOrder(unknown), morse: out.join(" / ") };
}

export function decodeMorse(prepared) {
  const source = prepared.replace(/_/g, "-");
  const unknown = [];
  const lookup = (token) => {
    const char = FROM_CODE.get(token);
    if (char) return char;
    unknown.push(token);
    return "#";
  };
  let words;
  if (/[/|\n\r]/.test(source)) {
    words = [];
    for (const chunk of source.split(/[/|\n\r]+/)) {
      const letters = chunk.trim().split(/\s+/).filter(Boolean);
      if (!letters.length) continue;
      words.push(letters.map(lookup).join(""));
    }
  } else {
    const trimmed = source.trim();
    if (!trimmed) {
      return { output: "", unknown: [], morse: "" };
    }
    const items = [];
    const re = /(\S+)(\s*)/g;
    let match;
    while ((match = re.exec(trimmed))) {
      items.push({ token: match[1], gap: match[2].length });
    }
    const gaps = items.slice(0, -1).map((item) => item.gap);
    const wordOnLongGap = gaps.some((gap) => gap === 1) && gaps.some((gap) => gap >= 3);
    const built = [];
    let letters = [];
    items.forEach((item, index) => {
      letters.push(lookup(item.token));
      const last = index === items.length - 1;
      if (last || (wordOnLongGap && item.gap >= 3)) {
        built.push(letters.join(""));
        letters = [];
      }
    });
    words = built;
  }
  const output = words.join(" ");
  const morse = encodeText(output.replace(/#/g, "")).morse;
  return { output, unknown: uniqueInOrder(unknown), morse };
}

export function translate(raw, mode = "auto") {
  const text = String(raw);
  if ([...text].length > MAX_CHARS) {
    return { error: TOO_LONG };
  }
  const prepared = prepare(text);
  const direction =
    mode === "text" || mode === "morse"
      ? mode
      : looksLikeMorse(prepared)
        ? "morse"
        : "text";
  const result = direction === "morse" ? decodeMorse(prepared) : encodeText(prepared);
  return { ...result, direction, plain: direction === "morse" ? result.output : prepared.toUpperCase() };
}

export function segments(morse) {
  if (!morse) return [];
  const words = morse.split(" / ");
  const segs = [];
  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) segs.push({ on: false, units: 7 });
    const letters = word.split(" ").filter(Boolean);
    letters.forEach((letter, letterIndex) => {
      if (letterIndex > 0) segs.push({ on: false, units: 3 });
      [...letter].forEach((element, elementIndex) => {
        if (elementIndex > 0) segs.push({ on: false, units: 1 });
        segs.push({ on: true, units: element === "-" ? 3 : 1 });
      });
    });
  });
  return segs;
}

export function unitCount(morse) {
  return segments(morse).reduce((total, seg) => total + seg.units, 0);
}

export function soundDurationMs(morse, wpm) {
  return unitCount(morse) * timings(wpm).dot;
}

/**
 * 16-bit PCM WAV. The sounding length matches the Morse timeline
 * (no extra silence after the last tone).
 */
export function buildWav(morse, { wpm = 20, freq = 600, sampleRate = 44100 } = {}) {
  const ms = soundDurationMs(morse, wpm);
  if (!morse || ms <= 0) {
    return { error: "There is nothing to play yet. Type a message first." };
  }
  if (ms > MAX_SOUND_MS) {
    return {
      error:
        "This sound is longer than 10 minutes. Shorten the message or raise the speed (WPM).",
    };
  }
  const dotMs = timings(wpm).dot;
  const totalSamples = Math.max(1, Math.round((ms / 1000) * sampleRate));
  const samples = new Float32Array(totalSamples);
  let cursorMs = 0;
  for (const seg of segments(morse)) {
    const start = Math.round((cursorMs / 1000) * sampleRate);
    cursorMs += seg.units * dotMs;
    const end = Math.min(totalSamples, Math.round((cursorMs / 1000) * sampleRate));
    if (!seg.on) continue;
    const ramp = Math.min(Math.floor(sampleRate * 0.0015), Math.max(1, Math.floor((end - start) / 4)));
    for (let i = start; i < end; i++) {
      const t = i / sampleRate;
      let amp = 0.72;
      const into = i - start;
      const left = end - 1 - i;
      if (into < ramp) amp *= Math.sin((Math.PI / 2) * (into / ramp));
      if (left < ramp) amp *= Math.sin((Math.PI / 2) * (left / ramp));
      samples[i] = amp * Math.sin(2 * Math.PI * freq * t);
    }
  }
  return { wav: encodeWav(samples, sampleRate), durationMs: (totalSamples / sampleRate) * 1000 };
}

function encodeWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

export function unknownMessage(unknown) {
  if (!unknown.length) return "";
  const shown = unknown.map((item) => `"${item}"`).join(", ");
  if (unknown.length === 1 && /^[.\-]+$/.test(unknown[0])) {
    return `This is not a Morse code letter: ${shown}`;
  }
  return `These characters could not be turned into Morse code: ${shown}`;
}

export function chartRows() {
  const rows = [];
  const push = (char, code, standard) => {
    rows.push({ char, code, standard });
  };
  for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") push(char, ITU[char], "ITU standard");
  for (const char of "0123456789") push(char, ITU[char], "ITU standard");
  push("\u00C9", ITU["\u00C9"], "ITU standard");
  for (const char of [".", ",", ":", "?", "'", "-", "/", "(", ")", '"', "=", "+", "@"]) {
    push(char, ITU[char], "ITU standard");
  }
  for (const char of ["!", "&", ";", "_", "$"]) {
    push(char, COMMON[char], "Common, not an ITU standard");
  }
  return rows;
}
