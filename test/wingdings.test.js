import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { CODEPOINTS, FE0E, toSymbols, toText } from "../src/lib/wingdings.js";

function codes(text) {
  return [...text.replaceAll(FE0E, "").replaceAll("\uFE0F", "")]
    .map((ch) => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"))
    .join(" ");
}

test("published examples and a perfect round trip", () => {
  assert.equal(codes(toSymbols("A").symbols), "U+270C");
  assert.equal(codes(toSymbols("a").symbols), "U+264B");
  assert.equal(codes(toSymbols("Z").symbols), "U+262A");
  assert.equal(codes(toSymbols("z").symbols), "U+2318");
  assert.equal(codes(toSymbols("Hello").symbols), "U+1F597 U+264F U+26AB U+26AB U+1F78F");
  assert.equal(codes(toSymbols("SOS").symbols), "U+1F322 U+1F3F3 U+1F322");
  assert.equal(
    codes(toSymbols("Gaster 123").symbols).replace(" U+0020", ""),
    "U+261D U+264B U+1F79F U+29EB U+264F U+2752 U+1F5C1 U+1F5CE U+1F5CF",
  );
  const accent = toSymbols("é");
  assert.equal(accent.symbols, "é");
  assert.deepEqual(accent.unknown, ["é"]);

  const reverse = toText(String.fromCodePoint(0x270c) + FE0E + String.fromCodePoint(0x1f44d));
  assert.equal(reverse.text, "AC");
  assert.deepEqual(reverse.unknown, []);

  let alphabet = "";
  for (let code = 0x21; code <= 0x7e; code++) alphabet += String.fromCharCode(code);
  assert.equal(alphabet.length, 94);
  assert.equal(CODEPOINTS.length, 94);
  const symbols = toSymbols(alphabet).symbols;
  assert.equal(toText(symbols).text, alphabet);
  assert.equal(new Set(CODEPOINTS).size, 94);
});

test("Noto Sans Symbols and Symbols 2 cover 94 of 94 code points", () => {
  const script = `
from fontTools.ttLib import TTFont
import json
paths = [
  "fonts/puzzle-cipher-symbols.woff2",
  "fonts/puzzle-cipher-symbols-2.woff2",
]
covered = set()
for path in paths:
    font = TTFont(path)
    family = font["name"].getDebugName(1)
    if "Wingding" in family or "Microsoft" in family:
        raise SystemExit(family)
    covered.update(font.getBestCmap())
print(json.dumps(sorted(covered)))
`;
  const run = spawnSync("python3", ["-c", script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const covered = new Set(JSON.parse(run.stdout));
  const missing = CODEPOINTS.filter((cp) => !covered.has(cp));
  assert.deepEqual(missing, []);
  assert.equal(CODEPOINTS.filter((cp) => covered.has(cp)).length, 94);
});
