import { button, icon } from "./icons.js";
import { tools } from "./registry.js";

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function howTo(steps) {
  const icons = ["pencil", "bulb", "copy"];
  return `<section class="how"><h2>How to use</h2><ol>${steps
    .map((step, index) => `<li><span class="step-icon">${icon(icons[index])}</span><p>${esc(step)}</p></li>`)
    .join("")}</ol></section>`;
}

function example(intro, before, after) {
  return `<section class="example"><h2>Example</h2><p>${esc(intro)}</p>
<table><thead><tr><th>Before</th><th>After</th></tr></thead>
<tbody><tr><td><pre>${esc(before)}</pre></td><td><pre>${esc(after)}</pre></td></tr></tbody></table></section>`;
}

function faq(items) {
  return `<section class="faq"><h2>FAQ</h2>${items
    .map(([question, answer]) => `<details><summary>${esc(question)}</summary><p>${answer}</p></details>`)
    .join("")}</section>`;
}

function more(current) {
  const cards = tools
    .filter((tool) => tool.path !== current)
    .map((tool) => `<li class="card"><a href="${tool.path}">${esc(tool.name)}</a><p>${esc(tool.blurb)}</p></li>`)
    .join("");
  return `<section class="more"><h2>More puzzle tools</h2><ul class="cards">${cards}</ul></section>`;
}

const WHERE = `<p class="where">Everything runs in your browser; nothing you type is uploaded.</p>`;

export function mazeBody() {
  return `<p class="lede">Make a printable maze with one path from the top-left opening to the bottom-right opening.</p>
<div class="tool-wrap" id="tool">
  ${WHERE}
  <section class="tool" aria-label="Maze Generator">
    <div class="controls">
      <div class="actions">
        <button type="button" class="btn" id="preset-easy"><span class="btn-label">Easy</span></button>
        <button type="button" class="btn" id="preset-medium"><span class="btn-label">Medium</span></button>
        <button type="button" class="btn" id="preset-hard"><span class="btn-label">Hard</span></button>
      </div>
      <div class="choices">
        <label>Width <input id="maze-width" type="number" min="5" max="100" value="10"></label>
        <label>Height <input id="maze-height" type="number" min="5" max="100" value="10"></label>
        <label>Seed <input id="maze-seed" type="number" value="12345"></label>
        <label>Line thickness <input id="maze-thickness" type="number" min="1" max="8" value="2"></label>
      </div>
    </div>
    <p id="maze-status" class="status" role="status">The maze will show up here.</p>
    <canvas id="maze-view" class="maze-canvas" width="320" height="180" aria-label="Maze"></canvas>
    <canvas id="maze-answer" class="maze-canvas answer-only" width="320" height="180" aria-label="Maze answer"></canvas>
    <div class="actions">
      ${button("btn-new", "New maze", "refresh", "primary")}
      ${button("btn-show", "Show solution", "bulb")}
      ${button("btn-print", "Print", "print")}
      ${button("btn-png", "Download PNG", "image")}
      ${button("btn-pdf", "Download PDF", "download")}
    </div>
    <p class="limits">Width and height are 5 to 100 cells. The same seed always makes the same maze. 100 by 100 is the largest.</p>
  </section>
</div>
${howTo([
  'Set Width, Height, and Seed, or press "Easy", "Medium", or "Hard".',
  'Press "New maze" for a different maze. Press "Show solution" to see the path.',
  'Press "Print" for the maze and the answer, or "Download PNG" or "Download PDF" to save a file.',
])}
${example(
  "A teacher, Riley, needs a 10 by 10 maze for class and writes down seed 12345 so the same sheet can be printed again.",
  "10 by 10, seed 12345",
  "One path from the top-left opening to the bottom-right opening.",
)}
${faq([
  ["Why does the same seed look the same later?", "The maze is built from that seed, not from a fresh random draw. Type the same width, height, and seed to get the same maze."],
  ["Where do I start?", "Enter at the opening in the top-left cell. Leave through the opening in the bottom-right cell. There is only one path."],
  ["Can I print the answer too?", "Yes. Press Print. The maze is on the first page and the answer path is on the next page, without the site header."],
  ["What if I type a size that is too big?", "Use a width and height from 5 to 100. Press Easy, Medium, or Hard to fill in a size that works."],
])}
${more("/maze-generator/")}`;
}

export function wordSearchBody() {
  const dirs = [
    ["E", "→"],
    ["S", "↓"],
    ["SE", "↘"],
    ["NE", "↗"],
    ["W", "←"],
    ["N", "↑"],
    ["NW", "↖"],
    ["SW", "↙"],
  ];
  const checks = dirs
    .map(
      ([name, arrow], index) =>
        `<label><input type="checkbox" id="dir-${name}"${index < 4 ? " checked" : ""}> ${arrow}</label>`,
    )
    .join("");
  return `<p class="subtitle">Free word search maker</p>
<p class="lede">Turn your word list into a printable word search, with a separate answer page.</p>
<div class="tool-wrap" id="tool">
  ${WHERE}
  <section class="tool" aria-label="Word Search Generator">
    <div class="controls">
      <label for="ws-title">Title, optional</label>
      <input id="ws-title" type="text" autocomplete="off">
      <label for="ws-words">Words</label>
      <textarea id="ws-words" rows="3" spellcheck="false" placeholder="One word on each line, or separated by commas"></textarea>
    </div>
    <p id="ws-status" class="status" role="status">Your word search will show up here.</p>
    <div id="ws-puzzle" class="sheet">Your word search will show up here.</div>
    <div class="controls">
      <div class="choices">
        <label>Grid size <input id="ws-size" type="number" min="8" max="25" value="15"></label>
        <label>Seed <input id="ws-seed" type="number" value="1"></label>
        <label>Letters <select id="ws-case"><option value="upper">Upper case</option><option value="lower">Lower case</option></select></label>
      </div>
      <div class="choices" aria-label="Directions">${checks}</div>
    </div>
    <div class="actions">
      ${button("btn-new", "New puzzle", "refresh", "primary")}
      ${button("btn-show", "Show answer", "bulb")}
      ${button("btn-print", "Print", "print")}
      ${button("btn-png", "Download PNG", "image")}
      ${button("btn-pdf", "Download PDF", "download")}
    </div>
    <div id="ws-list"></div>
    <div id="ws-answer" class="sheet answer-only"></div>
    <p class="fine">Spaces, hyphens, and numbers are removed before a word is placed. The list under the grid keeps the words as you typed them. Each placed word appears once.</p>
    <p class="limits">Up to 40 words. Each word is 2 to 25 letters after cleaning, and no longer than the grid. A word that does not fit after 300 tries is skipped, and the reason is listed.</p>
  </section>
</div>
${howTo([
  'Type words into "Words", one on each line or separated by commas.',
  'Leave →, ↓, ↘, and ↗ checked, or add the other directions, then press "New puzzle".',
  'Press "Print" for the puzzle and the answer, or "Download PNG" or "Download PDF" to save a file.',
])}
${example(
  "A teacher pastes cat, dog, elephant, zebra, lion, hippo, ice cream, T-Rex into a 12 by 12 grid.",
  "ice cream, T-Rex",
  "ICECREAM and TREX are placed. The word list still shows ice cream and T-Rex.",
)}
${faq([
  ["What happens to ice cream and T-Rex?", "Spaces, hyphens, and other marks are removed, so those become ICECREAM and TREX in the grid. The list under the puzzle still shows the words you typed."],
  ["Why was a word left out?", "It is longer than the grid, or it did not fit after 300 tries. The note names the word and tells you to make the grid bigger or remove it."],
  ["Can two words share a letter?", "Yes, when the shared square is the same letter. Each of your words still appears only once in the whole grid."],
  ["Does the answer print on the same page?", "Press Print. The puzzle is first and the answer grid, with boxes around the words, starts on the next page."],
])}
${more("/word-search-generator/")}`;
}

export function cryptogramBody() {
  return `<p class="lede">Find the most likely reading of a letter-substitution puzzle, using ordinary English words.</p>
<div class="tool-wrap" id="tool">
  ${WHERE}
  <section class="tool" aria-label="Cryptogram Solver">
    <label for="crypto-text">Coded text</label>
    <textarea id="crypto-text" rows="4" spellcheck="false" autocomplete="off"></textarea>
    <label for="crypto-known">Known letters, optional</label>
    <input id="crypto-known" type="text" autocomplete="off" placeholder="Q=A">
    <label class="choices"><input type="checkbox" id="crypto-self" checked> A letter is never itself</label>
    <div id="crypto-results" class="results" aria-live="polite">Answers will show up here.</div>
    <p id="crypto-status" class="status" role="status"></p>
    <div class="actions">
      ${button("btn-solve", "Solve", "search", "primary")}
      ${button("btn-letter", "Show one letter", "bulb")}
      ${button("btn-word", "Show one word", "bulb")}
      ${button("btn-copy", "Copy best answer", "copy")}
      ${button("btn-clear", "Clear", "clear")}
    </div>
    <p class="fine">Words come from the ENABLE word list, plus the one-letter words a and i. Not an official tournament word list. Offensive answers are hidden.</p>
    <p class="limits">Up to 1,000 characters. Solving stops after 5 seconds and keeps the best answers found so far. Up to 10 answers are shown.</p>
  </section>
</div>
${howTo([
  'Paste the coded sentence into "Coded text".',
  'Press "Solve". If you already know a letter, type it in "Known letters" as Q=A.',
  'Press "Show one letter" or "Show one word" for a hint, or "Copy best answer" to copy the first answer.',
])}
${example(
  "Sam is stuck on a newspaper cryptogram and pastes the coded line, then checks Q=A.",
  "YGXK LEGKT QFR LTCTF NTQKL QUG GXK YQZITKL WKGXUIZ YGKZI GF ZIOL EGFZOFTFZ Q FTV FQZOGF",
  "FOUR SCORE AND SEVEN YEARS AGO OUR FATHERS BROUGHT FORTH ON THIS CONTINENT A NEW NATION",
)}
${faq([
  ["Why is the first answer the one to read?", "Each possible reading is scored by how common its words are. The most common reading is listed first."],
  ["What does Q=A do?", "It locks the coded letter Q to the real letter A, then solves again. Write several locks separated by commas."],
  ["What if a name is not in the word list?", "The solver only uses ordinary words, plus a and i. Add the letters you already know and press Solve again. Blank letters stay as underscores."],
  ["Why did an answer disappear?", "Offensive answers are hidden. The line above the list says how many were hidden."],
  ["What if it is taking too long?", "Solving stops after 5 seconds and shows the best answers so far. Add a known letter and press Solve again."],
])}
${more("/cryptogram-solver/")}`;
}

export function crosswordBody() {
  let options = "";
  for (let n = 2; n <= 28; n++) options += `<option value="${n}">${n}</option>`;
  return `<p class="lede">This tool finds words that fit the letters you know. It does not read clues.</p>
<div class="tool-wrap" id="tool">
  ${WHERE}
  <section class="tool" aria-label="Crossword Solver">
    <label for="cross-pattern">Pattern</label>
    <input id="cross-pattern" type="text" autocomplete="off" spellcheck="false" placeholder="C?T">
    <label>Length <select id="cross-length">${options}</select></label>
    <div id="cross-boxes" class="boxes" aria-label="Letter boxes"></div>
    <div class="actions">
      ${button("btn-find", "Find words", "search", "primary")}
      ${button("btn-copy", "Copy all", "copy")}
      ${button("btn-more", "Show more", "search").replace('id="btn-more"', 'id="btn-more" hidden')}
      ${button("btn-clear", "Clear", "clear")}
    </div>
    <div id="cross-results" class="results" aria-live="polite">Matching words will show up here.</div>
    <p id="cross-status" class="status" role="status"></p>
    <p class="fine">This tool finds words that fit the letters you know. It does not read clues. Words come from the ENABLE word list. Not an official tournament word list. Offensive words are hidden.</p>
    <p class="limits">2 to 28 letters. For 4 or more letters, at least one letter must be filled in. The list shows 300 words at a time.</p>
  </section>
</div>
${howTo([
  'Type a pattern into "Pattern". Use a letter you know, and ? or _ or . or * for a blank.',
  'Or set "Length" and type into the boxes.',
  'Press "Find words". Click a word to copy it, or press "Copy all". Press "Show more" for the next words.',
])}
${example(
  "Jordan knows a 3-letter answer starts with C and ends with T, and types C?T.",
  "C?T",
  "cat, cot, cut",
)}
${faq([
  ["Does this read the clue sentence?", "No. This tool finds words that fit the letters you know. It does not read clues."],
  ["What can I type for a blank?", "Use ?, _, ., or *. C?T, c_t, and c.t all look for the same three-letter words."],
  ["Why are common words first?", "Everyday words are listed before rare ones. The list is ENABLE, not a tournament list."],
  ["What if nothing is found?", "Change a letter or turn one box into ?. If the pattern is longer than 28 letters, there is no word that long."],
  ["Why is a word missing?", "Offensive words are hidden. The result says how many were hidden."],
])}
${more("/crossword-solver/")}`;
}
