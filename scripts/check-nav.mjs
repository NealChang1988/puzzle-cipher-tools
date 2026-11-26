/**
 * Real Chrome check for the tool nav.
 * Desktop (1024, 1280, 1440): the plain nav shows all 9 links inside the viewport.
 * Phone (375): the Tools menu starts closed, then opens and shows all 9.
 *
 * Run: node scripts/check-nav.mjs
 * npm test runs this after the unit tests. Needs google-chrome on PATH.
 */
import { spawn } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMaze } from "../src/lib/maze.js";
import { build } from "./build.js";

const dist = build({ distDir: fileURLToPath(new URL("../dist", import.meta.url)) });
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let path = normalize(join(dist, decodeURIComponent(url.pathname)));
  if (!path.startsWith(dist)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    if (statSync(path).isDirectory()) path = join(path, "index.html");
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("missing");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const chrome = spawn(
  process.env.CHROME_PATH || "google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--remote-debugging-port=9333",
    `--user-data-dir=/tmp/pct-nav-${process.pid}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function waitForChrome() {
  for (let i = 0; i < 40; i++) {
    try {
      return await fetch("http://127.0.0.1:9333/json/version").then((res) => res.json());
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error("Chrome did not start");
}

const version = await waitForChrome();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
function send(method, params = {}, sessionId) {
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const problems = [];
const lines = [];
try {
  const target = await send("Target.createTarget", { url: "about:blank" });
  const attached = await send("Target.attachToTarget", { targetId: target.result.targetId, flatten: true });
  const sessionId = attached.result.sessionId;
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Input.enable", {}, sessionId);
  const measure = `(() => {
    const nav = document.querySelector(selector);
    const style = getComputedStyle(nav);
    const links = [...nav.querySelectorAll("a")].map((link) => {
      const box = link.getBoundingClientRect();
      return { name: link.textContent.trim(), left: box.left, right: box.right, top: box.top, width: box.width, height: box.height };
    });
    return {
      overflowX: style.overflowX,
      display: style.display,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      viewW: innerWidth,
      viewH: innerHeight,
      links,
    };
  })()`;

  for (const width of [1024, 1280, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/` }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const value = (
      await send(
        "Runtime.evaluate",
        { expression: measure.replace("selector", JSON.stringify(".desktop-nav")), returnByValue: true },
        sessionId,
      )
    ).result.result.value;
    const clipped = value.links.filter(
      (link) => link.width < 2 || link.height < 2 || link.left < -1 || link.right > value.viewW + 1 || link.top < -1 || link.top > value.viewH,
    );
    const scroll = value.overflowX === "auto" || value.overflowX === "scroll" || value.scrollW > value.clientW + 1;
    const row = `${width}: ${value.links.length} desktop links, overflow ${value.overflowX}, clipped ${clipped.length}`;
    lines.push(row);
    console.log(row);
    if (value.links.length !== 9 || value.display === "none" || clipped.length || scroll) {
      problems.push({ width, display: value.display, overflowX: value.overflowX, scrollW: value.scrollW, names: value.links.map((link) => link.name), clipped });
    }
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 667, deviceScaleFactor: 1, mobile: true }, sessionId);
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/` }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 400));
  await send("Runtime.evaluate", { expression: "document.querySelector('.tool-menu').open = true", returnByValue: true }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const phone = (
    await send(
      "Runtime.evaluate",
      { expression: measure.replace("selector", JSON.stringify(".mobile-nav")), returnByValue: true },
      sessionId,
    )
  ).result.result.value;
  const phoneClipped = phone.links.filter((link) => link.width < 2 || link.height < 2 || link.left < -1 || link.right > phone.viewW + 1);
  const phoneRow = `375 menu open: ${phone.links.length} links, overflow ${phone.overflowX}, clipped ${phoneClipped.length}`;
  lines.push(phoneRow);
  console.log(phoneRow);
  if (phone.links.length !== 9 || phoneClipped.length || phone.overflowX === "auto" || phone.overflowX === "scroll") {
    problems.push({ width: 375, overflowX: phone.overflowX, clipped: phoneClipped, names: phone.links.map((link) => link.name) });
  }

  async function pdfPages(paperWidth, paperHeight) {
    const printed = await send(
      "Page.printToPDF",
      {
        paperWidth,
        paperHeight,
        printBackground: true,
        preferCSSPageSize: false,
      },
      sessionId,
    );
    const text = Buffer.from(printed.result.data, "base64").toString("latin1");
    return (text.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  }
  async function settle(expression) {
    const ready = await send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    return ready.result.result.value;
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/maze-generator/` }, sessionId);
  const mazeReady = await settle(`new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const status = document.querySelector("#maze-status");
      if (status && status.textContent.includes("seed")) resolve(true);
      else if (Date.now() - start > 5000) resolve(false);
      else setTimeout(tick, 50);
    };
    tick();
  })`);
  await send("Runtime.evaluate", { expression: "document.getElementById('btn-show').click()", returnByValue: true }, sessionId);
  const mazeShown = await settle(`document.getElementById("maze-answer").classList.contains("answer-only") === false && document.getElementById("maze-answer").classList.contains("print-answer")`);
  const mazeLetter = await pdfPages(8.5, 11);
  const mazeA4 = await pdfPages(8.27, 11.69);
  const mazeRow = `maze print with solution: letter ${mazeLetter}, A4 ${mazeA4}, ready ${mazeReady}, shown ${mazeShown}`;
  lines.push(mazeRow);
  console.log(mazeRow);
  if (!mazeReady || !mazeShown || mazeLetter !== 2 || mazeA4 !== 2) problems.push({ print: "maze", mazeLetter, mazeA4, mazeReady, mazeShown });

  await send("Page.navigate", { url: `http://127.0.0.1:${port}/word-search-generator/` }, sessionId);
  const wordReady = await settle(`new Promise((resolve) => {
    const start = Date.now();
    const words = document.getElementById("ws-words");
    if (words) words.value = "cat, dog, lion";
    const tick = () => {
      document.getElementById("btn-new").click();
      const status = document.getElementById("ws-status").textContent;
      if (status.includes("seed")) resolve(true);
      else if (Date.now() - start > 5000) resolve(false);
      else setTimeout(tick, 150);
    };
    tick();
  })`);
  await send("Runtime.evaluate", { expression: "document.getElementById('btn-show').click()", returnByValue: true }, sessionId);
  const wordShown = await settle(`(() => {
    const answer = document.getElementById("ws-answer");
    return answer.classList.contains("answer-only") === false && answer.classList.contains("print-answer") && /[A-Z]/.test(answer.textContent);
  })()`);
  const wordA4 = await pdfPages(8.27, 11.69);
  const wordRow = `word search print with answer: A4 ${wordA4}, ready ${wordReady}, shown ${wordShown}`;
  lines.push(wordRow);
  console.log(wordRow);
  if (!wordReady || !wordShown || wordA4 !== 2) problems.push({ print: "word-search", wordA4, wordReady, wordShown });

  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/sudoku-solver/` }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const sudoku = await settle(`(() => {
    const ids = ["btn-n1", "btn-n2", "btn-n3", "btn-n4", "btn-n5", "btn-n6", "btn-n7", "btn-n8", "btn-n9", "btn-solve"];
    const bottoms = {};
    for (const id of ids) {
      const box = document.getElementById(id).getBoundingClientRect();
      bottoms[id] = Math.round(box.bottom);
    }
    const max = Math.max(...Object.values(bottoms));
    return { bottoms, max, scroll: window.scrollY };
  })()`);
  const sudokuRow = `sudoku 375x812: number keys and Solve bottom ${sudoku.max}`;
  lines.push(sudokuRow);
  console.log(sudokuRow);
  if (!sudoku || sudoku.scroll !== 0 || sudoku.max > 812) problems.push({ sudoku });

  async function go(url) {
    await send("Page.navigate", { url: `http://127.0.0.1:${port}${url}` }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  async function value(expression) {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.result.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "evaluate failed");
    return result.result.result.value;
  }
  async function mouseDrag(points) {
    const first = points[0];
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: first.x, y: first.y, button: "left", clickCount: 1 }, sessionId);
    for (const point of points.slice(1)) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "left", buttons: 1 }, sessionId);
    }
    const last = points[points.length - 1];
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: last.x, y: last.y, button: "left", clickCount: 1 }, sessionId);
  }
  async function touchDrag(points) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: points[0].x, y: points[0].y, id: 1 }] }, sessionId);
    for (const point of points.slice(1)) {
      await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x, y: point.y, id: 1 }] }, sessionId);
    }
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
  }
  const wordCenters = `(() => {
    const want = word;
    const spans = [...document.querySelectorAll("#ws-puzzle [data-x]")];
    const side = Math.round(Math.sqrt(spans.length));
    const grid = Array.from({ length: side }, () => Array(side).fill(""));
    for (const span of spans) grid[span.dataset.y][span.dataset.x] = span.textContent;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];
    let found = null;
    for (let y = 0; y < side && !found; y++) {
      for (let x = 0; x < side && !found; x++) {
        for (const [dx, dy] of dirs) {
          const pts = [];
          let ok = true;
          for (let i = 0; i < want.length; i++) {
            const cx = x + dx * i;
            const cy = y + dy * i;
            if (cy < 0 || cx < 0 || cy >= side || cx >= side || grid[cy][cx] !== want[i]) {
              ok = false;
              break;
            }
            pts.push([cx, cy]);
          }
          if (ok) found = pts;
        }
      }
    }
    if (!found) return null;
    document.querySelector("#ws-puzzle").scrollIntoView({ block: "center" });
    return found.map(([x, y]) => {
      const span = document.querySelector('#ws-puzzle [data-x="' + x + '"][data-y="' + y + '"]');
      const box = span.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
  })()`;

  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
  const examples = [
    ["/sudoku-solver/", "document.getElementById('paste-input').value.startsWith('530070000') && document.getElementById('cell-0').textContent === '5'"],
    ["/cryptogram-solver/", "document.getElementById('crypto-text').value.startsWith('YGXK')"],
    ["/crossword-solver/", "document.getElementById('cross-pattern').value === 'C?T'"],
    ["/anagram-solver/", "document.getElementById('letters-input').value === 'LISTEN'"],
    ["/unscramble-words/", "document.getElementById('letters-input').value === 'P, L, O, E'"],
    ["/word-search-generator/", "document.getElementById('ws-words').value.includes('ice cream') && !document.getElementById('ws-puzzle').textContent.includes('will show up here')"],
  ];
  for (const [url, check] of examples) {
    await go(url);
    const filled = await value(`new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        document.getElementById("btn-example").click();
        const button = document.getElementById("btn-example").getBoundingClientRect();
        const ok = button.width > 20 && button.height > 20 && (${check});
        if (ok) resolve(true);
        else if (Date.now() - start > 5000) resolve(false);
        else setTimeout(tick, 120);
      };
      tick();
    })`);
    const row = `try example ${url} ${filled}`;
    lines.push(row);
    console.log(row);
    if (!filled) problems.push({ example: url });
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await go("/word-search-generator/");
  const playReady = await value(`new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      document.getElementById("ws-words").value = "CAT, DOG";
      document.getElementById("ws-size").value = "12";
      const seed = document.getElementById("ws-seed");
      seed.value = "1";
      seed.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const status = document.getElementById("ws-status").textContent;
      if (status.includes("seed 1")) resolve(true);
      else if (Date.now() - start > 5000) resolve(false);
      else setTimeout(tick, 120);
    };
    tick();
  })`);
  const cat = await value(wordCenters.replace("word", JSON.stringify("CAT")));
  if (cat) await mouseDrag(cat);
  const catFound = await value(`document.querySelector('#ws-list [data-letters="CAT"]')?.classList.contains("found-word") === true`);
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const dog = await value(wordCenters.replace("word", JSON.stringify("DOG")));
  if (dog) await touchDrag(dog);
  const dogFound = await value(`document.querySelector('#ws-list [data-letters="DOG"]')?.classList.contains("found-word") === true`);
  const wordPlay = `word search drag mouse ${catFound} touch ${dogFound} ready ${playReady}`;
  lines.push(wordPlay);
  console.log(wordPlay);
  if (!playReady || !catFound || !dogFound) problems.push({ wordPlay, cat: !!cat, dog: !!dog });

  async function zebraCorners() {
    return value(`(() => {
      document.querySelector("#ws-puzzle").scrollIntoView({ block: "center" });
      const box = (x, y) => document.querySelector('#ws-puzzle [data-x="' + x + '"][data-y="' + y + '"]').getBoundingClientRect();
      const start = box(2, 8);
      const end = box(6, 4);
      const off = box(3, 8);
      const off2 = box(4, 7);
      return [
        { x: start.left + start.width / 2, y: start.top + start.height / 2 },
        { x: off.left + off.width / 2, y: off.top + 1 },
        { x: off2.left + 1, y: off2.top + off2.height / 2 },
        { x: end.left + end.width / 2, y: end.top + end.height / 2 },
      ];
    })()`);
  }
  async function loadZebra() {
    await go("/word-search-generator/");
    return value(`new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        document.getElementById("btn-example").click();
        const z = document.querySelector('#ws-puzzle [data-x="2"][data-y="8"]');
        if (z && z.textContent === "Z") resolve(true);
        else if (Date.now() - start > 5000) resolve(false);
        else setTimeout(tick, 120);
      };
      tick();
    })`);
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  const zebraReady = await loadZebra();
  const zebraMouse = zebraReady ? await zebraCorners() : null;
  if (zebraMouse) await mouseDrag(zebraMouse);
  const zebraMouseFound = await value(`document.querySelector('#ws-list [data-letters="ZEBRA"]')?.classList.contains("found-word") === true`);
  const zebraTouchReady = await loadZebra();
  const zebraTouch = zebraTouchReady ? await zebraCorners() : null;
  if (zebraTouch) await touchDrag(zebraTouch);
  const zebraTouchFound = await value(`document.querySelector('#ws-list [data-letters="ZEBRA"]')?.classList.contains("found-word") === true`);
  const zebraRow = `word search diagonal mouse ${zebraMouseFound} touch ${zebraTouchFound}`;
  lines.push(zebraRow);
  console.log(zebraRow);
  if (!zebraMouseFound || !zebraTouchFound) problems.push({ zebraRow, zebraReady, zebraTouchReady });

  await go("/cryptogram-solver/");
  const cryptoClear = await value(`new Promise((resolve) => {
    const start = Date.now();
    let started = false;
    const tick = () => {
      const text = document.getElementById("crypto-text");
      const button = document.getElementById("btn-solve");
      const results = document.getElementById("crypto-results");
      if (!text || !button || !results) {
        if (Date.now() - start > 8000) resolve(false);
        else setTimeout(tick, 80);
        return;
      }
      if (results.textContent.includes("THIS IS A TEST")) {
        document.getElementById("btn-example").click();
        const after = document.getElementById("crypto-results").textContent;
        resolve(document.getElementById("crypto-text").value.startsWith("YGXK") && !after.includes("THIS IS A TEST"));
        return;
      }
      if (!started) {
        text.value = "GSRH RH Z GVHG";
        button.click();
        started = true;
      }
      if (Date.now() - start > 8000) resolve(false);
      else setTimeout(tick, 200);
    };
    tick();
  })`);
  const cryptoRow = `cryptogram try example clears ${cryptoClear}`;
  lines.push(cryptoRow);
  console.log(cryptoRow);
  if (!cryptoClear) problems.push({ cryptoClear });

  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await go("/maze-generator/");
  await value(`new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (document.getElementById("maze-status").textContent.includes("seed")) resolve(true);
      else if (Date.now() - start > 5000) resolve(false);
      else setTimeout(tick, 50);
    };
    tick();
  })`);
  await value(`(() => {
    document.getElementById("maze-width").value = "5";
    document.getElementById("maze-height").value = "5";
    document.getElementById("maze-seed").value = "1";
    document.getElementById("maze-seed").dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("maze-view").scrollIntoView({ block: "center" });
    return true;
  })()`);
  const mazeBox = await value(`(() => {
    const canvas = document.getElementById("maze-view");
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height, bw: canvas.width, bh: canvas.height };
  })()`);
  const solution = generateMaze(5, 5, 1).solution;
  const pad = 10;
  const cell = 18;
  const mazePoints = solution.map(([x, y]) => ({
    x: mazeBox.left + (pad + (x + 0.5) * cell) * (mazeBox.width / mazeBox.bw),
    y: mazeBox.top + (pad + (y + 0.5) * cell) * (mazeBox.height / mazeBox.bh),
  }));
  await mouseDrag(mazePoints);
  const mazeExit = await value(`document.getElementById("maze-status").textContent.includes("You reached the exit.")`);
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await value(`document.getElementById("maze-view").scrollIntoView({ block: "center" })`);
  const mazePhone = await value(`(() => {
    const canvas = document.getElementById("maze-view");
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height, bw: canvas.width, bh: canvas.height };
  })()`);
  const phonePoints = solution.map(([x, y]) => ({
    x: mazePhone.left + (pad + (x + 0.5) * cell) * (mazePhone.width / mazePhone.bw),
    y: mazePhone.top + (pad + (y + 0.5) * cell) * (mazePhone.height / mazePhone.bh),
  }));
  await value(`(() => {
    document.getElementById("maze-width").value = "5";
    document.getElementById("maze-height").value = "5";
    document.getElementById("maze-seed").value = "1";
    document.getElementById("maze-seed").dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  const mazePhone2 = await value(`(() => {
    const canvas = document.getElementById("maze-view");
    canvas.scrollIntoView({ block: "center" });
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height, bw: canvas.width, bh: canvas.height };
  })()`);
  const touchPoints = solution.map(([x, y]) => ({
    x: mazePhone2.left + (pad + (x + 0.5) * cell) * (mazePhone2.width / mazePhone2.bw),
    y: mazePhone2.top + (pad + (y + 0.5) * cell) * (mazePhone2.height / mazePhone2.bh),
  }));
  await touchDrag(touchPoints);
  const mazeTouch = await value(`document.getElementById("maze-status").textContent.includes("You reached the exit.")`);
  const mazePlay = `maze path mouse ${mazeExit} touch ${mazeTouch}`;
  lines.push(mazePlay);
  console.log(mazePlay);
  if (!mazeExit || !mazeTouch) problems.push({ mazeExit, mazeTouch, points: mazePoints.length });

  await go("/maze-generator/");
  const seeds = await value(`new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const status = document.getElementById("maze-status").textContent;
      if (!status.includes("seed")) {
        if (Date.now() - start > 5000) resolve(null);
        else setTimeout(tick, 50);
        return;
      }
      const before = document.getElementById("maze-seed").value;
      document.getElementById("preset-easy").click();
      const after = document.getElementById("maze-seed").value;
      const seed = document.getElementById("maze-seed");
      seed.value = "4242";
      seed.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("preset-hard").click();
      resolve({ before, after, kept: seed.value, status: document.getElementById("maze-status").textContent });
    };
    tick();
  })`);
  const seedOk = seeds && seeds.after !== seeds.before && seeds.kept === "4242" && seeds.status.includes("40 by 40") && seeds.status.includes("4242");
  const seedRow = `maze seeds ${seedOk}`;
  lines.push(seedRow);
  console.log(seedRow);
  if (!seedOk) problems.push({ seeds });

  await go("/word-search-generator/");
  const wsSeed = await value(`new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const words = document.getElementById("ws-words");
      const seed = document.getElementById("ws-seed");
      const status = document.getElementById("ws-status").textContent;
      words.value = "CAT";
      if (!(status.includes("seed") && seed.value !== "3")) {
        seed.value = "3";
        document.getElementById("btn-new").click();
        if (Date.now() - start > 5000) resolve({ seed: seed.value, status });
        else setTimeout(tick, 80);
        return;
      }
      seed.value = "4";
      seed.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      resolve({ seed: seed.value, status: document.getElementById("ws-status").textContent });
    };
    tick();
  })`);
  const wsSeedOk = wsSeed.seed === "4" && wsSeed.status.includes("seed 4");
  const wsSeedRow = `word search seeds ${wsSeedOk}`;
  lines.push(wsSeedRow);
  console.log(wsSeedRow);
  if (!wsSeedOk) problems.push({ wsSeed });

  async function printTitle(url, setTitle, expected) {
    await go(url);
    await value(`new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        ${setTitle}
        const title = document.getElementById("print-title");
        if (title && title.textContent === ${JSON.stringify(expected)}) resolve(true);
        else if (Date.now() - start > 5000) resolve(false);
        else setTimeout(tick, 80);
      };
      tick();
    })`);
    await send("Emulation.setEmulatedMedia", { media: "print" }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const printed = await value(`(() => {
      const title = document.getElementById("print-title");
      const h1 = document.querySelector("h1");
      return { text: title ? title.textContent : "", title: title ? getComputedStyle(title).display : "", h1: getComputedStyle(h1).display };
    })()`);
    await send("Emulation.setEmulatedMedia", { media: "screen" }, sessionId);
    return printed;
  }
  const wsPrint = await printTitle(
    "/word-search-generator/",
    `const input = document.getElementById("ws-title"); input.value = "Science Week"; input.dispatchEvent(new Event("input", { bubbles: true }));`,
    "Science Week",
  );
  const mazePrint = await printTitle(
    "/maze-generator/",
    `const input = document.getElementById("maze-title"); input.value = "Class 4"; input.dispatchEvent(new Event("input", { bubbles: true }));`,
    "Class 4",
  );
  const printOk = wsPrint.text === "Science Week" && wsPrint.title !== "none" && wsPrint.h1 === "none" && mazePrint.text === "Class 4" && mazePrint.h1 === "none";
  const printRow = `print titles ${printOk} word ${wsPrint.h1} maze ${mazePrint.h1}`;
  lines.push(printRow);
  console.log(printRow);
  if (!printOk) problems.push({ wsPrint, mazePrint });
} finally {
  ws.close();
  chrome.kill();
  server.close();
}

if (problems.length) {
  console.error(JSON.stringify(problems, null, 2));
  process.exit(1);
}
console.log("nav check passed");
console.log(lines.join("\n"));
