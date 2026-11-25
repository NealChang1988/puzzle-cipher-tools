/**
 * Small PDF writer for one or more black-and-white pages.
 * Output is a normal PDF 1.4 file that opens in common viewers.
 */

export function buildPdf(pages) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const pageIds = [];
  for (const page of pages) {
    const stream = page.stream;
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(
      `<< /Type /Page /Parent PAGES /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }
  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    const body = objects[i].replaceAll("PAGES", `${pagesId} 0 R`);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function escapePdf(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function textPage({ title, lines, width = 612, height = 792 }) {
  const commands = ["0.05 w", "0 0 0 RG", "0 0 0 rg"];
  let y = height - 54;
  commands.push("BT", "/F1 16 Tf", `48 ${y} Td`, `(${escapePdf(title)}) Tj`, "ET");
  y -= 28;
  for (const line of lines) {
    if (y < 48) break;
    commands.push("BT", "/F1 11 Tf", `48 ${y} Td`, `(${escapePdf(line)}) Tj`, "ET");
    y -= 14;
  }
  return { width, height, stream: commands.join("\n") };
}

export function mazePdf(maze, { title = "Maze", showSolution = false } = {}) {
  const width = 612;
  const height = 792;
  const margin = 48;
  const cell = Math.min((width - margin * 2) / maze.width, (height - margin * 2 - 36) / maze.height);
  const ox = margin;
  const oy = margin;
  const commands = ["1 w", "0 0 0 RG"];
  commands.push("BT", "/F1 16 Tf", `48 ${height - 36} Td`, `(${escapePdf(title)}) Tj`, "ET");
  const top = oy + maze.height * cell;
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const bits = maze.open[y][x];
      const x0 = ox + x * cell;
      const y0 = top - (y + 1) * cell;
      if (!(bits & 1)) commands.push(`${x0} ${y0 + cell} m ${x0 + cell} ${y0 + cell} l S`);
      if (!(bits & 2)) commands.push(`${x0 + cell} ${y0} m ${x0 + cell} ${y0 + cell} l S`);
      if (!(bits & 4)) commands.push(`${x0} ${y0} m ${x0 + cell} ${y0} l S`);
      if (!(bits & 8)) commands.push(`${x0} ${y0} m ${x0} ${y0 + cell} l S`);
    }
  }
  if (showSolution && maze.solution?.length) {
    commands.push("1.5 w", "0.6 0.15 0.05 RG");
    const points = maze.solution.map(([x, y]) => {
      const px = ox + (x + 0.5) * cell;
      const py = top - (y + 0.5) * cell;
      return `${px} ${py}`;
    });
    commands.push(`${points[0]} m`);
    for (const point of points.slice(1)) commands.push(`${point} l`);
    commands.push("S");
  }
  return { width, height, stream: commands.join("\n") };
}

export function mazeDocument(maze) {
  return buildPdf([
    mazePdf(maze, { title: `Maze ${maze.width}x${maze.height}`, showSolution: false }),
    mazePdf(maze, { title: "Answer", showSolution: true }),
  ]);
}

export function wordSearchPdf(puzzle, { title = "Word search", answer = false } = {}) {
  const width = 612;
  const height = 792;
  const commands = ["BT", "/F1 16 Tf", `48 ${height - 40} Td`, `(${escapePdf(answer ? `${title} answer` : title || "Word search")}) Tj`, "ET"];
  const side = puzzle.grid.length;
  const cell = Math.min(18, (width - 96) / side);
  const ox = 48;
  const top = height - 70;
  commands.push("BT", `/F1 ${Math.max(8, cell - 4)} Tf`);
  for (let y = 0; y < side; y++) {
    const row = puzzle.grid[y].join(cell > 14 ? " " : "");
    commands.push(`1 0 0 1 ${ox} ${top - y * cell} Tm`, `(${escapePdf(row)}) Tj`);
  }
  commands.push("ET");
  let y = top - side * cell - 20;
  commands.push("BT", "/F1 11 Tf");
  const labels = puzzle.placed.map((item) => item.original || item.letters);
  commands.push(`1 0 0 1 48 ${y} Tm`, `(${escapePdf(labels.join("  "))}) Tj`, "ET");
  return { width, height, stream: commands.join("\n") };
}

export function wordSearchDocument(puzzle, title) {
  return buildPdf([
    wordSearchPdf(puzzle, { title, answer: false }),
    wordSearchPdf(puzzle, { title, answer: true }),
  ]);
}
