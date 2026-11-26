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
