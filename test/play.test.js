import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateMaze } from "../src/lib/maze.js";
import { mazeDocument, mazePdf } from "../src/lib/pdf.js";

function assertXref(bytes) {
  const latin = bytes.toString("latin1");
  const start = Number(latin.match(/startxref\s+(\d+)/)[1]);
  assert.equal(bytes.subarray(start, start + 4).toString("latin1"), "xref");
  const lines = latin.slice(start).split("\n");
  const count = Number(lines[1].split(" ")[1]);
  for (let i = 0; i < count; i++) {
    const entry = lines[2 + i];
    if (entry[17] !== "n") continue;
    const pos = Number(entry.slice(0, 10));
    const head = bytes.subarray(pos, pos + 16).toString("latin1");
    assert.equal(head.startsWith(`${i} 0 obj`), true, `object ${i} at ${pos} saw ${JSON.stringify(head)}`);
  }
}

test("maze pdf page 1 shows the title and the size", () => {
  const maze = generateMaze(40, 40, 1);
  const page = mazePdf(maze, { title: "Class 4", size: "40 \u00d7 40" });
  const answer = mazePdf(maze, { title: "Answer", showSolution: true });
  assert.match(page.stream, /\(Class 4\)/);
  assert.match(page.stream, /40 \\327 40/);
  assert.match(answer.stream, /\(Answer\)/);
  assert.equal(answer.stream.includes("\\327"), false);
  const file = mazeDocument(maze, "Class 4");
  assert.match(file, /\(Class 4\)/);
  assert.match(file, /40 \\327 40/);
  assert.match(file, /\(Answer\)/);
  assert.match(mazeDocument(maze, "  "), /\(Maze\)/);
  const bytes = Buffer.from(file, "utf8");
  assertXref(bytes);
  const dir = mkdtempSync(join(tmpdir(), "maze-pdf-"));
  const pdfPath = join(dir, "maze.pdf");
  writeFileSync(pdfPath, bytes);
  const text = spawnSync("pdftotext", ["-f", "1", "-l", "1", pdfPath, "-"], { encoding: "utf8" });
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /40 \u00d7 40/);
});
