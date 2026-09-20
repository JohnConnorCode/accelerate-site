import type { ReadinessReport } from "@/lib/ai-readiness";

type Page = { commands: string[] };
const WIDTH = 612;
const HEIGHT = 792;
const MARGIN = 48;

function safe(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function pdfText(value: string) {
  return safe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, max = 82) {
  const words = safe(value).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    if ((line ? line.length + 1 : 0) + word.length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function text(
  commands: string[],
  x: number,
  y: number,
  value: string,
  size = 10,
  color = "0.1 0.1 0.1",
) {
  commands.push(`${color} rg BT /F1 ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
}

function buildPages(report: ReadinessReport) {
  const newPage = (): Page => ({
    commands: [
      "0.05 0.05 0.05 rg 0 0 612 792 re f",
      "0.98 0.98 0.97 rg 0 0 612 620 re f",
      "0.98 0.98 0.97 rg BT /F1 9 Tf 48 748 Td (ACCELERATE) Tj ET",
      "0.78 0.78 0.74 rg BT /F1 7 Tf 442 748 Td (AI READINESS ACTION PLAN) Tj ET",
    ],
  });
  const pages: Page[] = [newPage()];
  let page = pages[0]!;
  let y = HEIGHT - 64;
  const ensure = (height: number) => {
    if (y - height < 54) {
      page = newPage();
      pages.push(page);
      y = HEIGHT - 64;
    }
  };
  const heading = (value: string) => {
    ensure(34);
    text(page.commands, MARGIN, y, value, 19, "0.05 0.05 0.05");
    y -= 30;
  };
  const paragraph = (value: string, size = 10, leading = 15) => {
    for (const line of wrap(value, size <= 10 ? 88 : 70)) {
      ensure(leading);
      text(page.commands, MARGIN, y, line, size, "0.28 0.28 0.26");
      y -= leading;
    }
    y -= 5;
  };
  const rule = () => {
    ensure(14);
    page.commands.push(`0.86 0.86 0.83 RG 0.7 w ${MARGIN} ${y} m ${WIDTH - MARGIN} ${y} l S`);
    y -= 16;
  };

  text(page.commands, MARGIN, y, "Your next useful move is clearer now.", 28, "0.05 0.05 0.05");
  y -= 42;
  paragraph(report.summary, 12, 18);
  page.commands.push("0.78 0.62 0.22 rg 48 545 120 4 re f");
  text(
    page.commands,
    MARGIN,
    510,
    report.score === null ? "READINESS SCORE  -" : `READINESS SCORE  ${report.score}/100`,
    13,
    "0.05 0.05 0.05",
  );
  text(
    page.commands,
    MARGIN,
    486,
    `${report.scoreLabel}  |  ${report.coverage}% answer coverage`,
    10,
    "0.28 0.28 0.26",
  );
  y = 438;
  heading("Your five readiness dimensions");
  for (const dimension of report.dimensionScores) {
    ensure(32);
    text(
      page.commands,
      MARGIN,
      y,
      `${dimension.label}  ${dimension.score === null ? "-" : `${dimension.score}/100`}`,
      10,
      "0.1 0.1 0.1",
    );
    page.commands.push(
      `0.84 0.84 0.81 rg ${MARGIN} ${y - 12} 300 5 re f`,
      `0.05 0.05 0.05 rg ${MARGIN} ${y - 12} ${Math.max(0, Math.min(300, (dimension.score ?? dimension.coverage) * 3))} 5 re f`,
    );
    y -= 29;
  }
  rule();
  heading("Where to start");
  for (const [index, recommendation] of report.recommendations.entries()) {
    ensure(80);
    text(page.commands, MARGIN, y, `${index + 1}. ${recommendation.title}`, 13, "0.05 0.05 0.05");
    y -= 19;
    paragraph(recommendation.summary, 10, 15);
    paragraph(
      `Why it fits: ${recommendation.why} Start with: ${recommendation.effort} Measure: ${recommendation.metric}.`,
      10,
      15,
    );
    y -= 5;
  }
  rule();
  heading("First pilot");
  paragraph(
    `${report.pilot.title}. Baseline: ${report.pilot.baseline}. ${report.pilot.owner} ${report.pilot.review}`,
    10,
    15,
  );
  rule();
  heading("30-day action plan");
  for (const step of report.actionPlan) {
    ensure(46);
    text(page.commands, MARGIN, y, `${step.week}  ${step.title}`, 11, "0.05 0.05 0.05");
    y -= 17;
    paragraph(step.detail, 10, 15);
  }
  ensure(24);
  text(
    page.commands,
    MARGIN,
    42,
    "Scores describe readiness signals, not a guarantee of savings or revenue.",
    8,
    "0.45 0.45 0.42",
  );
  return pages;
}

export function createAIReadinessPdf(report: ReadinessReport) {
  const pages = buildPages(report);
  const objects: string[] = [];
  const add = (value: string) => {
    objects.push(value);
    return objects.length;
  };
  const catalog = add("");
  const pagesObject = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageObjects: number[] = [];
  for (const page of pages) {
    const stream = page.commands.join("\n");
    const content = add(
      `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    );
    pageObjects.push(
      add(
        `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
  objects[pagesObject - 1] =
    `<< /Type /Pages /Kids [${pageObjects.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`;
  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "binary"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output, "binary");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "binary");
}
