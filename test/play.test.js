import assert from "node:assert/strict";
import test from "node:test";
import { generateMaze } from "../src/lib/maze.js";
import { mazeDocument, mazePdf } from "../src/lib/pdf.js";

test("maze pdf page 1 shows the title and the size", () => {
  const maze = generateMaze(40, 40, 1);
  const page = mazePdf(maze, { title: "Class 4", size: "40 \u00d7 40" });
  const answer = mazePdf(maze, { title: "Answer", showSolution: true });
  assert.match(page.stream, /\(Class 4\)/);
  assert.match(page.stream, /\(40 \u00d7 40\)/);
  assert.match(answer.stream, /\(Answer\)/);
  assert.equal(answer.stream.includes("40 \u00d7 40"), false);
  const file = mazeDocument(maze, "Class 4");
  assert.match(file, /\(Class 4\)/);
  assert.match(file, /\(40 \u00d7 40\)/);
  assert.match(file, /\(Answer\)/);
  assert.match(mazeDocument(maze, "  "), /\(Maze\)/);
});
