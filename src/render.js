import { readFileSync } from "node:fs";
import { search } from "./lib/anagram.js";
import { chartRows as morseChart, translate } from "./lib/morse.js";
import { formatGrid } from "./lib/sudoku.js";
import { encodeLevels, indexFromParts, parseLevelTsv, splitWords } from "./lib/wordlist.js";
import { chartRows as symbolChart, toSymbols } from "./lib/wingdings.js";
import { MARK, button, icon } from "./icons.js";
import { crosswordBody, cryptogramBody, mazeBody, wordSearchBody } from "./batch2-html.js";
import { TRADEMARK, tools } from "./registry.js";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const PUZZLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letterIndex() {
  const words = splitWords(readFileSync(new URL("../data/enable1.txt", import.meta.url), "utf8"));
  const levels = parseLevelTsv(readFileSync(new URL("../data/scowl-levels-le70.tsv", import.meta.url), "utf8"));
  const offensive = splitWords(readFileSync(new URL("../data/offensive-single.txt", import.meta.url), "utf8"));
  return indexFromParts(words.join("\n"), encodeLevels(words, levels), offensive.join("\n"));
}

function groupLines(items) {
  const lines = [];
  let length = 0;
  let bucket = [];
  const flush = () => {
    if (bucket.length) lines.push(`${length} letters: ${bucket.join(", ")}`);
    bucket = [];
  };
  for (const item of items) {
    if (item.length !== length) {
      flush();
      length = item.length;
    }
    bucket.push(item.word);
  }
  flush();
  return lines.join("\n");
}

function head({ config, page, noindex }) {
  const canonical = config.canonicalOrigin.replace(/\/$/, "") + page.path;
  const css = [`/css/site.css`];
  if (page.symbols) css.push("/css/symbols.css");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(config.canonicalOrigin.replace(/\/$/, "") + page.og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1c1915">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
${css.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n")}
</head>`;
}

function header(config, current) {
  const links = tools
    .map(
      (tool) =>
        `<a href="${tool.path}"${tool.path === current ? ' aria-current="page"' : ""}>${esc(tool.name)}</a>`,
    )
    .join("");
  return `<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="/">${MARK}<span>${esc(config.siteName)}</span></a>
  <nav class="tools desktop-nav" aria-label="Tools">${links}</nav>
  <details class="tool-menu">
    <summary>Tools</summary>
    <nav class="tools mobile-nav" aria-label="Tools">${links}</nav>
  </details>
</header>`;
}

function footer(config) {
  return `<footer class="foot">
  <div class="inner">
    <nav aria-label="About this site">
      <a href="/about/">About</a>
      <a href="/privacy/">Privacy</a>
      <a href="/credits/">Credits</a>
      <a href="mailto:${esc(config.feedbackEmail)}">Feedback</a>
    </nav>
    <p class="trade">${esc(TRADEMARK)}</p>
  </div>
</footer>`;
}

function howTo(steps) {
  const icons = ["pencil", "bulb", "copy"];
  const items = steps
    .map(
      (step, index) =>
        `<li><span class="step-icon">${icon(icons[index])}</span><p>${esc(step)}</p></li>`,
    )
    .join("");
  return `<section class="how"><h2>How to use</h2><ol>${items}</ol></section>`;
}

function example(intro, before, after, afterClass = "") {
  return `<section class="example"><h2>Example</h2><p>${esc(intro)}</p>
<table><thead><tr><th>Before</th><th>After</th></tr></thead>
<tbody><tr><td><pre>${esc(before)}</pre></td><td${afterClass ? ` class="${afterClass}"` : ""}><pre>${esc(after)}</pre></td></tr></tbody></table></section>`;
}

function faq(items) {
  return `<section class="faq"><h2>FAQ</h2>${items
    .map(
      ([question, answer]) =>
        `<details><summary>${esc(question)}</summary><p>${answer}</p></details>`,
    )
    .join("")}</section>`;
}

function more(current) {
  const cards = tools
    .filter((tool) => tool.path !== current)
    .map(
      (tool) =>
        `<li class="card"><a href="${tool.path}">${esc(tool.name)}</a><p>${esc(tool.blurb)}</p></li>`,
    )
    .join("");
  return `<section class="more"><h2>More puzzle tools</h2><ul class="cards">${cards}</ul></section>`;
}

function shell(config, page, main, noindex) {
  const script = page.script ? `<script type="module" src="${page.script}"></script>` : "";
  return `${head({ config, page, noindex })}
<body>
${header(config, page.path)}
<main class="wrap" id="main">
<h1>${esc(page.h1)}</h1>
${main}
</main>
${footer(config)}
${script}
</body>
</html>`;
}

function lengthOptions() {
  let html = "";
  for (let n = 2; n <= 10; n++) {
    html += `<option value="${n}"${n === 3 ? " selected" : ""}>${n}</option>`;
  }
  return html;
}

function morseBody(index) {
  void index;
  const before = "\u2022\u2022\u2022  \u2212\u2212\u2212  \u2022\u2022\u2022";
  const after = translate(before).output;
  const rows = morseChart()
    .map(
      (row) =>
        `<li><span class="glyph">${esc(row.char)}</span><code>${esc(row.code)}</code><span class="tag${row.standard.startsWith("Common") ? " common" : ""}">${esc(row.standard)}</span></li>`,
    )
    .join("");
  return `<p class="lede">Turn text into Morse code, or Morse code back into text, and play it as sound.</p>
<div class="tool-wrap" id="tool">
  <p class="where">Everything runs in your browser; nothing you type is uploaded.</p>
  <section class="tool" aria-label="Morse Code Translator">
    <div class="pair">
      <div class="field">
        <label for="morse-input">Your message</label>
        <textarea id="morse-input" rows="4" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </div>
      <div class="field">
        <label for="morse-output">Result</label>
        <textarea id="morse-output" rows="4" readonly spellcheck="false" placeholder="The Morse code or the words will show up here."></textarea>
      </div>
    </div>
    <p id="morse-unknown" class="note" role="status"></p>
    <div class="modes" role="group" aria-label="Direction">
      <button type="button" class="btn" id="mode-auto" aria-pressed="true">Auto</button>
      <button type="button" class="btn" id="mode-text" aria-pressed="false">Text to Morse</button>
      <button type="button" class="btn" id="mode-morse" aria-pressed="false">Morse to text</button>
    </div>
    <div class="sliders">
      <label>Speed (WPM) <input id="wpm" type="range" min="5" max="40" value="20"> <span id="wpm-value">20</span></label>
      <label>Pitch (Hz) <input id="pitch" type="range" min="400" max="1000" step="10" value="600"> <span id="pitch-value">600</span></label>
    </div>
    <p class="hint">Speed (WPM) is words per minute. 20 is a usual speed. One dot lasts 1,200 divided by that number, in milliseconds. Pitch is how high the tone is.</p>
    <div class="actions">
      ${button("btn-copy", "Copy", "copy", "primary")}
      ${button("btn-play", "Play sound", "play")}
      ${button("btn-stop", "Stop", "stop")}
      ${button("btn-wav", "Download WAV", "download")}
      ${button("btn-txt", "Download TXT", "download")}
      ${button("btn-share", "Share link", "link")}
      ${button("btn-clear", "Clear", "clear")}
    </div>
    <p id="morse-status" class="status" role="status"></p>
    <p class="limits">Up to 10,000 characters at a time. Sound is limited to 10 minutes.</p>
  </section>
</div>
${howTo([
  'Type or paste into "Your message". The box turns text into Morse code, or Morse code into text, on its own.',
  'Press "Play sound" to hear it, or "Stop" to end the sound.',
  'Press "Copy" to copy the result, "Download WAV" or "Download TXT" to save a file, or "Share link" to copy a link.',
])}
${example(
  "Sam is in an escape room and types a messy note. The marks are bullets and long dashes, with uneven spaces.",
  before,
  after,
)}
${faq([
  [
    "Why did uneven spaces still come out as SOS?",
    "When every gap is two spaces or more, and there is no slash or new line, those gaps sit between letters of one word. Sam’s note is the three letters of SOS.",
  ],
  [
    "What happens to a character like #?",
    "A mark with no Morse code is left out of the result. The line under the boxes lists it, for example the # in a clue such as Escape room clue #4.",
  ],
  [
    "What does the slash in the result mean?",
    "A slash with spaces around it is the gap between words. Letters inside a word are separated by one space.",
  ],
  [
    "Why will a very long message not play?",
    "Sound stops at 10 minutes so the page does not freeze. Shorten the message or raise Speed (WPM), then press Play sound again.",
  ],
  [
    "Does Share link upload what I typed?",
    "No. The words are placed after a # in the link. Browsers do not send that part to the site.",
  ],
])}
<section class="reference">
  <h2>Morse code chart</h2>
  <p>ITU-R M.1677-1 is the international Morse code standard. Five marks are labeled “Common, not an ITU standard” because people use them, but they are not part of that standard.</p>
  <ul class="chart">${rows}</ul>
</section>
${more("/")}`;
}

function lettersBody(kind, index) {
  const anagram = kind === "anagram";
  const listen = search(index, "LISTEN", { mode: "all", minLength: 3 });
  const ploe = search(index, "P, L, O, E", { mode: "any", minLength: 3 });
  const lede = anagram
    ? "Rearrange all of your letters into real words, with the most common words first."
    : "See every word you can spell from your letters, with longer words first.";
  const steps = anagram
    ? [
        'Type the word you want to rearrange into "Your letters".',
        'Leave "Use all letters" selected so every letter has to be used.',
        'Press "Find words". Copy a full rearrangement to solve or make a puzzle.',
      ]
    : [
        'Type the letters from your rack into "Your letters".',
        'Leave "Any length" selected to see longer words and shorter words.',
        'Press "Find words", then click a word to copy it.',
      ];
  const intro = anagram
    ? "Jordan is writing a puzzle and checks every rearrangement of LISTEN."
    : "Alex is stuck on a paper puzzle. The letters on the card are written P, L, O, E.";
  const before = anagram ? "LISTEN" : "P, L, O, E";
  const after = anagram ? listen.words.map((item) => item.word).join(", ") : groupLines(ploe.words);
  const cross = anagram
    ? 'Need shorter words too? Try <a href="/unscramble-words/">Unscramble Words</a>.'
    : 'Need every letter used? Try <a href="/anagram-solver/">Anagram Solver</a>.';
  const own = anagram
    ? `<section class="about-tool"><h2>Rearrange every letter</h2><p>An anagram uses ALL of the letters, in a new order. Use this page to solve a word puzzle or to make a puzzle from a word you chose.</p></section>`
    : `<section class="about-tool"><h2>Letter racks</h2><p>A word-game rack does not have to use every letter. This page lists every longer word and every shorter word you can spell.</p></section>`;
  const limits = anagram
    ? "Use all letters is selected at the start. Up to 15 letters, plus at most 2 wildcards (? or *). The list shows 500 words at a time."
    : "Any length is selected at the start, so leftover letters are allowed. Up to 15 letters, plus at most 2 wildcards (? or *). The list shows 500 words at a time.";
  const faqs = anagram
    ? [
        ["How do I solve a word puzzle?", "Type the letters, leave Use all letters selected, and press Find words. The first words use every letter."],
        ["How do I make a puzzle?", "Type a word, press Find words, and pick another word that uses the same letters. That pair is the puzzle."],
        ["Why do listen and silent come first?", "Those two use every letter of LISTEN, and common words come first inside that length."],
      ]
    : [
        ["What is a letter rack?", "It is the set of letters you have in a word game. Any length lists every word those letters can spell."],
        ["Why are longer words listed first?", "Longer words are grouped above shorter ones. Inside one length, common words come first."],
        ["Can a word leave some letters unused?", "Yes. Any length is the start here, so a shorter word is listed even when letters are left over."],
      ];
  return `<p class="lede">${esc(lede)}</p>
<div class="tool-wrap" id="tool" data-default-mode="${anagram ? "all" : "any"}">
  <p class="where">Everything runs in your browser; nothing you type is uploaded.</p>
  <section class="tool" aria-label="${anagram ? "Anagram Solver" : "Unscramble Words"}">
    <div class="field">
      <label for="letters-input">Your letters</label>
      <textarea id="letters-input" rows="3" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      ${button("btn-example", "Try example", "pencil")}
    </div>
    <div class="choices">
      <label><input type="radio" name="mode" id="mode-all" value="all"${anagram ? " checked" : ""}> Use all letters</label>
      <label><input type="radio" name="mode" id="mode-any" value="any"${anagram ? "" : " checked"}> Any length</label>
      <label>Shortest word <select id="min-length">${lengthOptions()}</select></label>
    </div>
    <div class="actions">
      ${button("btn-find", "Find words", "search", "primary")}
      ${button("btn-copy", "Copy all", "copy")}
      ${button("btn-clear", "Clear", "clear")}
      ${button("btn-more", "Show more", "search").replace('id="btn-more"', 'id="btn-more" hidden')}
    </div>
    <div id="letters-results" class="results" aria-live="polite">Words you can spell will show up here.</div>
    <p id="letters-status" class="status" role="status"></p>
    <p class="fine">Words from the ENABLE word list. Not an official tournament word list.</p>
    <p class="fine">Offensive words are hidden. Letters filled by a ? or * wildcard are underlined.</p>
    <p class="limits">${esc(limits)}</p>
  </section>
</div>
<p class="cross">${cross}</p>
${own}
${howTo(steps)}
${example(intro, before, after)}
${faq(faqs)}
${more(anagram ? "/anagram-solver/" : "/unscramble-words/")}`;
}

function sudokuCells() {
  let html = "";
  for (let i = 0; i < 81; i++) {
    const row = (i / 9) | 0;
    const col = i % 9;
    const cls = ["cell"];
    if (col % 3 === 2) cls.push("b3");
    if (row % 3 === 2) cls.push("r3");
    html += `<button type="button" class="${cls.join(" ")}" id="cell-${i}" role="gridcell" aria-label="Row ${row + 1} column ${col + 1}"></button>`;
  }
  return html;
}

function sudokuNumbers() {
  let html = "";
  for (let n = 1; n <= 9; n++) {
    html += `<button type="button" class="btn num" id="btn-n${n}"><span class="btn-label">${n}</span></button>`;
  }
  html += button("btn-erase", "Erase", "clear");
  return html;
}

function sudokuBody() {
  const after = formatGrid(SOLUTION.split("").map(Number));
  return `<p class="lede">Solve a standard 9 by 9 sudoku, or take one next step with a plain reason.</p>
<div class="tool-wrap" id="tool">
  <p class="where">Everything runs in your browser; nothing you type is uploaded.</p>
  <section class="tool" aria-label="Sudoku Solver">
    <div class="sudoku-layout">
      <div id="sudoku-grid" class="grid" role="grid" aria-label="Sudoku grid">${sudokuCells()}</div>
      <input id="sudoku-key" class="sudoku-key" inputmode="numeric" autocomplete="off" aria-label="Number for the selected cell">
      <p id="sudoku-status" class="status" role="status">The answer will show up here and in the grid.</p>
      <div class="actions">
        ${button("btn-solve", "Solve", "check", "primary")}
        ${button("btn-hint", "Hint", "bulb")}
        ${button("btn-check", "Check", "check")}
        ${button("btn-clear", "Clear", "clear")}
        ${button("btn-copy", "Copy answer", "copy")}
        ${button("btn-download", "Download answer", "download")}
      </div>
      <div class="nums" aria-label="Numbers">${sudokuNumbers()}</div>
      <div class="paste" id="sudoku-paste">
        <div class="paste-head">
          <button type="button" class="btn paste-toggle" id="btn-paste" aria-expanded="false" aria-controls="paste-input">Paste a puzzle</button>
          ${button("btn-example", "Try example", "pencil")}
        </div>
        <label for="paste-input">Paste a puzzle</label>
        <textarea id="paste-input" rows="3" spellcheck="false" autocomplete="off" placeholder="81 digits. Use 0 or a dot for an empty cell."></textarea>
        <p class="hint">0, a dot, or a blank cell counts as empty. Line breaks, spaces, and | are removed.</p>
      </div>
      <p class="limits">Standard 9 by 9 only. Solving stops after 2 seconds. Fewer than 17 numbers usually means more than one answer. Bold numbers are the ones you entered. Thinner numbers on a green square were filled by Solve.</p>
    </div>
  </section>
</div>
${howTo([
  'Tap a cell, then press a number key or a "1"\u2013"9" button. Arrow keys move between cells.',
  'Press "Solve" for the full answer, "Hint" for the next step, or "Check" to test the grid.',
  'Press "Copy answer" to copy the digits, or "Download answer" to save a text file.',
])}
${example(
  "Riley copies a stuck newspaper puzzle as one long line of digits and pastes it into Paste a puzzle.",
  PUZZLE,
  after,
)}
${faq([
  [
    "What does it mean if two cells turn red?",
    "Those cells have the same number in one row, column, or box. Change one of them. The page will not solve a grid that still clashes.",
  ],
  [
    "What if it says there is more than one solution?",
    "The digits you entered do not pin the puzzle down to one grid. One possible answer is still filled in. Add more numbers from the paper if you have them.",
  ],
  [
    "What does a hint mean?",
    "Hint fills one cell and says why, either because that cell has only one possible number or because that number has only one home in the row, column, or box. If neither is true, it tells you to press Solve.",
  ],
  [
    "Why the note about 17 numbers?",
    "A sudoku puzzle needs at least 17 given numbers to have only one solution.",
  ],
  [
    "Can I print the grid?",
    "Yes. Use your browser’s print command. The printout keeps the grid and hides the buttons.",
  ],
])}
${more("/sudoku-solver/")}`;
}

function wingdingsBody() {
  const hello = toSymbols("Hello");
  const rows = symbolChart()
    .map(
      (row) =>
        `<li><span>${esc(row.letter)}</span><span class="glyph symbols">${esc(row.display)}</span><span class="tag">${esc(row.hex)}</span></li>`,
    )
    .join("");
  return `<p class="lede">Turn normal text into Wingdings symbols, or turn those symbols back into text.</p>
<div class="tool-wrap" id="tool">
  <p class="where">Everything runs in your browser; nothing you type is uploaded.</p>
  <section class="tool" aria-label="Wingdings Translator">
    <div class="pair">
      <div class="field">
        <label for="wd-text">Text</label>
        <textarea id="wd-text" rows="4" spellcheck="false" autocomplete="off"></textarea>
      </div>
      <div class="field">
        <label for="wd-symbols">Symbols</label>
        <textarea id="wd-symbols" class="symbols" rows="4" spellcheck="false" autocomplete="off" placeholder="Symbols will show up here."></textarea>
      </div>
    </div>
    <p id="wd-note" class="note" role="status"></p>
    <div class="actions">
      ${button("btn-copy-symbols", "Copy symbols", "copy", "primary")}
      ${button("btn-copy-text", "Copy text", "copy")}
      ${button("btn-png", "Download PNG", "image")}
      ${button("btn-clear", "Clear", "clear")}
    </div>
    <p class="fine">The symbols use a font included with this site, so they should not show up as empty boxes. ${esc(TRADEMARK)}</p>
    <p class="limits">Up to 5,000 characters.</p>
  </section>
</div>
${howTo([
  'Type or paste normal text into "Text", or paste symbols into "Symbols".',
  "The other box updates as you type.",
  'Press "Copy symbols" or "Copy text" to copy a result, or "Download PNG" to save a picture.',
])}
${example(
  "Casey is writing a symbol note for a party game and starts with the word Hello.",
  "Hello",
  hello.symbols,
  "symbols",
)}
${faq([
  [
    "Is this made by Microsoft?",
    esc(TRADEMARK) + " The symbols are ordinary Unicode characters.",
  ],
  [
    "Why did a letter like é stay the same?",
    "Only the 94 characters in the chart have a symbol. Anything else is left as you typed it, and the note under the boxes names it.",
  ],
  [
    "Will the symbols show as empty boxes on my phone?",
    "The page loads its own font, a subset of Noto Sans Symbols and Noto Sans Symbols 2. You do not need a special font installed.",
  ],
  [
    "Why are the symbols black and white instead of colorful pictures?",
    "Each symbol is followed by an invisible text-style mark so phones do not turn it into a color emoji. That mark is ignored when symbols are turned back into text.",
  ],
  [
    "How do I send the symbols to a friend?",
    "Press Copy symbols and paste them into a message, or press Download PNG and send the picture. The picture is drawn with this site’s font.",
  ],
])}
<section class="reference">
  <h2>Symbol chart</h2>
  <p>These 94 characters are the printable marks from the exclamation point through the tilde. Capital and small letters are different.</p>
  <ul class="chart">${rows}</ul>
</section>
${more("/wingdings-translator/")}`;
}

function aboutPage(config) {
  const list = tools
    .map((tool) => `<li><a href="${tool.path}">${esc(tool.name)}</a> — ${esc(tool.blurb)}</li>`)
    .join("");
  return `<p class="lede">${esc(config.siteName)} is a free set of puzzle tools for people who like codes, word games, and number grids.</p>
<div class="prose">
  <p>There is no account and nothing to buy. The first version is in English only.</p>
  <p>Each tool does its work in your browser. The letters, puzzles, and symbols you type are not uploaded.</p>
  <ul>${list}</ul>
  <p>${esc(TRADEMARK)}</p>
  <p>Questions and corrections: <a href="mailto:${esc(config.feedbackEmail)}">${esc(config.feedbackEmail)}</a>.</p>
</div>`;
}

function privacyPage(config) {
  return `<p class="lede">What you type stays in your browser. This site does not upload your puzzles.</p>
<div class="prose">
  <p>There is no account, no sign-in, and no analytics. The site does not set tracking cookies, and it does not ask for your name, school, class, or a child’s answers.</p>
  <p>When you use a tool, the only network requests are for the page itself, and, on the letter tools, for the word-list files. Those files are the same for every visitor. The request does not include the letters or puzzle you typed.</p>
  <p>Share link on the Morse page puts the message after a # in the address. Browsers do not send that part to the server. Copy buttons use the copy feature on your device. Download buttons save a file on your device.</p>
  <p>The letter tools, the cryptogram solver, and the crossword helper hide offensive words. That filtering happens in your browser after the word list has loaded. Maze and word-search pages are for making printed sheets. They do not ask for a name, a school, or anyone’s answers.</p>
  <p>Feedback is an email link to <a href="mailto:${esc(config.feedbackEmail)}">${esc(config.feedbackEmail)}</a>. A message you send by email is just an email. There is no form on this site.</p>
</div>`;
}

function creditsPage() {
  const copyright = readFileSync(new URL("../data/SCOWL-2020.12.07-Copyright.txt", import.meta.url), "utf8");
  const ofl = readFileSync(new URL("../data/OFL-NotoSansSymbols.txt", import.meta.url), "utf8");
  return `<p class="lede">Sources, licenses, and the trademark notice for this site.</p>
<div class="prose">
  <h2>Word list</h2>
  <p>Word list: ENABLE (public domain), compiled by Alan Beale and M. Cooper. The ENABLE master word list, WORD.LST, is herewith formally released into the Public Domain. That sentence is part of the SCOWL copyright file reproduced in full below.</p>
  <p>Everyday-use order comes from SCOWL 2020.12.07 by Kevin Atkinson, levels 10 through 70 (10 is the most common). The list below is the copyright notice and permission text, kept in full.</p>
  <pre class="legal">${esc(copyright)}</pre>
  <h2>Offensive-word filter</h2>
  <p>Offensive-word filter based on LDNOOBW (Shutterstock and contributors), <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>, modified (single words only). Phrases and lines that included spaces, digits, or punctuation were removed, and the remaining lines were lowercased. Source: <a href="https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/tree/5faf2ba42d7b1c0977169ec3611df25a3c08eb13">LDNOOBW commit 5faf2ba</a>.</p>
  <h2>Symbol font</h2>
  <p>The Wingdings translator draws symbols with a subset of Noto Sans Symbols and Noto Sans Symbols 2, kept under the SIL Open Font License 1.1. The subset’s font names are Puzzle Cipher Symbols and Puzzle Cipher Symbols 2. Copyright 2022 The Noto Project Authors (<a href="https://github.com/notofonts/symbols">github.com/notofonts/symbols</a>). Noto is a trademark of Google LLC. The license file is also stored next to the fonts at <a href="/fonts/OFL.txt">/fonts/OFL.txt</a>.</p>
  <pre class="legal">${esc(ofl)}</pre>
  <h2>Trademark</h2>
  <p>${esc(TRADEMARK)}</p>
</div>`;
}

const INFO = [
  {
    path: "/about/",
    title: "About \u2013 Puzzle & Cipher Tools",
    h1: "About",
    description: "What Puzzle & Cipher Tools is, and which tools are on the site.",
    og: "/og/about.png",
    body: aboutPage,
  },
  {
    path: "/privacy/",
    title: "Privacy \u2013 Puzzle & Cipher Tools",
    h1: "Privacy",
    description: "Your letters and puzzles stay in your browser. This site does not upload them.",
    og: "/og/privacy.png",
    body: privacyPage,
  },
  {
    path: "/credits/",
    title: "Credits \u2013 Puzzle & Cipher Tools",
    h1: "Credits",
    description: "Licenses for the word lists, the offensive-word filter, and the symbol fonts.",
    og: "/og/credits.png",
    body: creditsPage,
    symbols: false,
  },
];

export function filePathFor(urlPath) {
  if (urlPath === "/") return "index.html";
  return urlPath.replace(/^\//, "").replace(/\/$/, "") + "/index.html";
}

export function renderSite(config, { noindex = false } = {}) {
  const index = letterIndex();
  const pages = [];
  const bodies = {
    morse: () => morseBody(index),
    anagram: () => lettersBody("anagram", index),
    unscramble: () => lettersBody("unscramble", index),
    sudoku: () => sudokuBody(),
    maze: () => mazeBody(),
    wingdings: () => wingdingsBody(),
    wordsearch: () => wordSearchBody(),
    cryptogram: () => cryptogramBody(),
    crossword: () => crosswordBody(),
  };
  for (const tool of tools) {
    pages.push({
      path: tool.path,
      file: filePathFor(tool.path),
      html: shell(config, tool, bodies[tool.id](), noindex),
    });
  }
  for (const info of INFO) {
    const page = { ...info, script: "" };
    pages.push({
      path: info.path,
      file: filePathFor(info.path),
      html: shell(config, page, info.body(config), noindex),
    });
  }
  const missing = {
    path: "/404.html",
    title: "Page not found \u2013 Puzzle & Cipher Tools",
    h1: "Page not found",
    description: "That page is not on this site.",
    og: "/og/site.png",
    script: "",
  };
  pages.push({
    path: "/404.html",
    file: "404.html",
    html: shell(
      config,
      missing,
      `<p class="lede">That page is not here.</p><p>Try one of the tools:</p>${more("")}`,
      noindex,
    ),
  });
  return pages;
}

export function robotsTxt(config, noindex) {
  if (noindex) return "User-agent: *\nDisallow: /\n";
  return `User-agent: *\nAllow: /\n\nSitemap: ${config.canonicalOrigin.replace(/\/$/, "")}/sitemap.xml\n`;
}

export function sitemapXml(config) {
  const origin = config.canonicalOrigin.replace(/\/$/, "");
  const urls = [
    ...tools.map((tool) => tool.path),
    ...INFO.map((info) => info.path),
  ];
  const body = urls
    .map((path) => `  <url><loc>${esc(origin + path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function headersFile(noindex) {
  const lines = [
    "/*",
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  X-Frame-Options: DENY",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
    "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'",
  ];
  if (noindex) lines.push("  X-Robots-Tag: noindex");
  return lines.join("\n") + "\n";
}

export function symbolsCss() {
  const ranges = JSON.parse(readFileSync(new URL("../fonts/ranges.json", import.meta.url), "utf8"));
  const face = (file, range) => `@font-face {
  font-family: "Puzzle Cipher Symbols";
  src: url("${file}") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: ${range};
}`;
  return `${face("/fonts/puzzle-cipher-symbols.woff2", ranges.one)}
${face("/fonts/puzzle-cipher-symbols-2.woff2", ranges.two)}
`;
}
