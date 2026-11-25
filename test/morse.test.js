import assert from "node:assert/strict";
import test from "node:test";
import {
  TOO_LONG,
  buildWav,
  chartRows,
  soundDurationMs,
  timings,
  translate,
  unitCount,
  unknownMessage,
} from "../src/lib/morse.js";

test("ITU examples and timing", () => {
  assert.equal(translate("SOS").output, "... --- ...");
  assert.equal(translate("Hello World").output, ".... . .-.. .-.. --- / .-- --- .-. .-.. -..");
  assert.equal(translate("Meet at 7pm?").output, "-- . . - / .- - / --... .--. -- ..--..");
  const clue = translate("Escape room clue #4!");
  assert.equal(
    clue.output,
    ". ... -.-. .- .--. . / .-. --- --- -- / -.-. .-.. ..- . / ....- -.-.--",
  );
  assert.deepEqual(clue.unknown, ["#"]);
  assert.match(unknownMessage(clue.unknown), /#/);

  const spaced = translate("...   ---   ...\n.... ..  |  -  .... . .-. .");
  assert.equal(spaced.output, "SOS HI THERE");
  assert.equal(spaced.direction, "morse");

  const bullets = translate("\u2022\u2022\u2022  \u2212\u2212\u2212  \u2022\u2022\u2022");
  assert.equal(bullets.output, "SOS");

  assert.equal(translate("..--- ----- ..--- -....").output, "2026");
  const bad = translate(".-.-. ......");
  assert.equal(bad.output, "+#");
  assert.deepEqual(bad.unknown, ["......"]);

  for (const [wpm, dot, dash, letterGap, wordGap] of [
    [5, 240, 720, 720, 1680],
    [15, 80, 240, 240, 560],
    [20, 60, 180, 180, 420],
    [40, 30, 90, 90, 210],
  ]) {
    const timing = timings(wpm);
    assert.equal(timing.dot, dot);
    assert.equal(timing.dash, dash);
    assert.equal(timing.letterGap, letterGap);
    assert.equal(timing.wordGap, wordGap);
  }
  assert.equal(unitCount("... --- ..."), 27);
  assert.equal(soundDurationMs("... --- ...", 20), 1620);
});

test("text to morse and back matches uppercase original", () => {
  const samples = [
    "SOS",
    "HELLO WORLD",
    "MEET AT 7PM?",
    "ESCAPE ROOM CLUE 4!",
    "2026",
    "A/B",
    "EMAIL@X.COM",
    "C'EST +1 = 2",
    "\u00C9",
  ];
  for (const sample of samples) {
    const morse = translate(sample, "text");
    assert.equal(morse.unknown.length, 0, sample);
    const back = translate(morse.output, "morse");
    assert.equal(back.output, sample.toUpperCase(), sample);
  }
});

test("manual direction overrides auto detect", () => {
  assert.equal(translate("SOS", "text").direction, "text");
  assert.equal(translate("SOS", "text").output, "... --- ...");
  assert.equal(translate("... --- ...", "morse").output, "SOS");
  assert.equal(translate("SOS", "auto").direction, "text");
  assert.equal(translate("... --- ...", "auto").direction, "morse");
});

test("non-ITU marks are labeled and underscore is a character in text", () => {
  const rows = chartRows();
  for (const char of ["!", "&", ";", "_", "$"]) {
    const row = rows.find((item) => item.char === char);
    assert.equal(row.standard, "Common, not an ITU standard");
  }
  assert.equal(rows.filter((row) => row.standard === "ITU standard").length > 40, true);
  const coded = translate("A_B", "text");
  assert.equal(coded.unknown.length, 0);
  assert.equal(translate(coded.output, "morse").output, "A_B");
  assert.equal(translate("_", "morse").output, "T");
});

test("too long input does not try to encode", () => {
  const result = translate("A".repeat(10001));
  assert.equal(result.error, TOO_LONG);
  assert.equal(result.output, undefined);
});

test("SOS wav is a playable 1620 ms tone at 20 WPM", () => {
  const { wav, durationMs, error } = buildWav("... --- ...", { wpm: 20, freq: 600 });
  assert.equal(error, undefined);
  assert.equal(durationMs, 1620);
  const header = Buffer.from(wav.slice(0, 44)).toString("latin1");
  assert.equal(header.slice(0, 4), "RIFF");
  assert.equal(header.slice(8, 12), "WAVE");
  assert.ok(Math.abs(durationMs - 1620) / 1620 <= 0.05);
  let peak = 0;
  for (let i = 44; i < wav.length; i += 2) {
    const sample = wav[i] | (wav[i + 1] << 8);
    const signed = sample > 0x7fff ? sample - 0x10000 : sample;
    peak = Math.max(peak, Math.abs(signed));
  }
  assert.ok(peak > 1000);
  const tooLong = buildWav("... --- ... ".repeat(8000).trim(), { wpm: 5 });
  assert.match(tooLong.error, /10 minutes/);
});

test("messy morse input", () => {
  assert.equal(translate("  HeLLo    WoRLD!!  ").output, translate("HELLO WORLD!!").output);
  assert.equal(translate("ｓｏｓ").output, "... --- ...");
  assert.equal(translate("．．．　　－－－　　．．．").output, "SOS");
  assert.equal(translate("...\t---\t...").output, "SOS");
  const junk = translate("SOS # hello 你好");
  assert.ok(junk.unknown.includes("#"));
  assert.ok(junk.unknown.includes("你"));
  assert.ok(junk.output.startsWith("... --- ..."));
  assert.equal(translate("Hello\u2019s \u201Cworld\u201D").unknown.length, 0);
  assert.equal(translate("Hello\u2019s \u201Cworld\u201D").direction, "text");
});
