/**
 * Descriptive Wingdings mapping for Unicode symbols.
 * Code points follow the Unicode 7.0 Wingdings chart (UTC L2/12-368),
 * characters U+0021 through U+007E. No Microsoft font is used.
 * U+FE0E is added on the way to symbols so phones keep a text style,
 * and removed on the way back.
 */

export const TOO_LONG =
  "Too long \u2014 please split into parts under 5,000 characters";

export const MAX_CHARS = 5000;
export const FE0E = "\uFE0E";
export const FE0F = "\uFE0F";

/** 94 code points, in order, for ASCII 0x21..0x7E. */
export const CODEPOINTS = [
  0x1f589, 0x2702, 0x2701, 0x1f453, 0x1f56d, 0x1f56e, 0x1f56f, 0x1f57f, 0x2706, 0x1f582,
  0x1f583, 0x1f4ea, 0x1f4eb, 0x1f4ec, 0x1f4ed, 0x1f5c0, 0x1f5c1, 0x1f5ce, 0x1f5cf, 0x1f5d0,
  0x1f5c4, 0x23f3, 0x1f5ae, 0x1f5b0, 0x1f5b2, 0x1f5b3, 0x1f5b4, 0x1f5ab, 0x1f5ac, 0x2707,
  0x270d, 0x1f58e, 0x270c, 0x1f58f, 0x1f44d, 0x1f44e, 0x261c, 0x261e, 0x261d, 0x1f597,
  0x1f590, 0x263a, 0x1f610, 0x2639, 0x1f4a3, 0x1f571, 0x1f3f3, 0x1f3f1, 0x2708, 0x263c,
  0x1f322, 0x2744, 0x1f546, 0x271e, 0x1f548, 0x2720, 0x2721, 0x262a, 0x262f, 0x1f549,
  0x2638, 0x2648, 0x2649, 0x264a, 0x264b, 0x264c, 0x264d, 0x264e, 0x264f, 0x2650,
  0x2651, 0x2652, 0x2653, 0x1f670, 0x1f675, 0x26ab, 0x1f53e, 0x25fc, 0x1f78f, 0x1f790,
  0x2751, 0x2752, 0x1f79f, 0x29eb, 0x25c6, 0x2756, 0x1f799, 0x2327, 0x2bb9, 0x2318,
  0x1f3f5, 0x1f3f6, 0x1f676, 0x1f677,
];

if (CODEPOINTS.length !== 94 || new Set(CODEPOINTS).size !== 94) {
  throw new Error("Wingdings map must be 94 unique symbols");
}

export const TEXT_TO_SYMBOL = new Map();
export const SYMBOL_TO_TEXT = new Map();
for (let i = 0; i < CODEPOINTS.length; i++) {
  const letter = String.fromCharCode(0x21 + i);
  const symbol = String.fromCodePoint(CODEPOINTS[i]);
  TEXT_TO_SYMBOL.set(letter, symbol);
  SYMBOL_TO_TEXT.set(symbol, letter);
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function normalizePlain(raw) {
  return String(raw)
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .normalize("NFKC")
    .normalize("NFC");
}

export function toSymbols(raw) {
  const text = normalizePlain(raw);
  if ([...text].length > MAX_CHARS) return { error: TOO_LONG };
  let symbols = "";
  const unknown = [];
  for (const ch of text) {
    const symbol = TEXT_TO_SYMBOL.get(ch);
    if (symbol) {
      symbols += symbol + FE0E;
    } else {
      symbols += ch;
      if (!/\s/.test(ch)) unknown.push(ch);
    }
  }
  return { text, symbols, unknown: unique(unknown) };
}

export function toText(raw) {
  const stripped = String(raw).replaceAll(FE0E, "").replaceAll(FE0F, "");
  if ([...stripped].length > MAX_CHARS) return { error: TOO_LONG };
  let text = "";
  const unknown = [];
  for (const ch of stripped) {
    const letter = SYMBOL_TO_TEXT.get(ch);
    if (letter) text += letter;
    else {
      text += ch;
      if (!/\s/.test(ch)) unknown.push(ch);
    }
  }
  return { text, unknown: unique(unknown) };
}

export function unknownSymbolMessage(unknown) {
  if (!unknown.length) return "";
  return `These characters have no matching symbol: ${unknown.join(", ")}. They are left as they are.`;
}

export function unknownLetterMessage(unknown) {
  if (!unknown.length) return "";
  return `These symbols have no matching letter: ${unknown.join(", ")}. They are left as they are.`;
}

export function chartRows() {
  const rows = [];
  for (let i = 0; i < CODEPOINTS.length; i++) {
    const letter = String.fromCharCode(0x21 + i);
    const symbol = String.fromCodePoint(CODEPOINTS[i]);
    const cp = CODEPOINTS[i];
    rows.push({
      letter,
      symbol,
      display: symbol + FE0E,
      hex: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
    });
  }
  return rows;
}
