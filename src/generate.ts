import { program } from "commander";
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { SIZES, mmToPt } from "./sizes";
import { DEFAULT_OPTIONS, LayoutFn } from "./layouts/base";
import * as layouts from "./layouts/index";
import { createPrintPdf, getStrategy, pagesPerSheet } from "./imposition";

const LAYOUTS: Record<string, LayoutFn> = layouts;

program
  .name("tn-insert-factory")
  .description("Generate PDF inserts for traveler's notebooks")
  .option("-l, --layout <type>", `Layout (${Object.keys(LAYOUTS).join(", ")})`, "dotted")
  .option("-s, --size <name>", `Notebook size (${Object.keys(SIZES).join(", ")})`, "passport")
  .option("-p, --pages <n>", "Number of pages", "8")
  .option("--spacing <mm>", "Grid/dot/line spacing in mm", "5")
  .option("--margin <mm>", "Page margin in mm", "8")
  .option("--print", "Also generate an A4 print-ready PDF with booklet imposition")
  .option("-o, --output <file>", "Output PDF filename", "insert.pdf")
  .parse();

const opts = program.opts();

async function main() {
  const size = SIZES[opts.size];
  if (!size) {
    console.error(`Unknown size: "${opts.size}". Available: ${Object.keys(SIZES).join(", ")}`);
    process.exit(1);
  }

  const layoutFn = LAYOUTS[opts.layout];
  if (!layoutFn) {
    console.error(`Unknown layout: "${opts.layout}". Available: ${Object.keys(LAYOUTS).join(", ")}`);
    process.exit(1);
  }

  const pageCount = parseInt(opts.pages, 10);
  if (isNaN(pageCount) || pageCount < 1) {
    console.error("--pages must be a positive integer");
    process.exit(1);
  }

  if (opts.print) {
    let strategy;
    try {
      strategy = getStrategy(size.widthMm, size.heightMm);
    } catch (err) {
      console.error(`✗ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    const multiple = pagesPerSheet(strategy);
    if (pageCount % multiple !== 0) {
      console.error(
        `--pages must be a multiple of ${multiple} for ${size.name} size (got ${pageCount}). ` +
          `Try ${Math.ceil(pageCount / multiple) * multiple}.`
      );
      process.exit(1);
    }
  }

  const options = {
    ...DEFAULT_OPTIONS,
    spacingMm: parseFloat(opts.spacing),
    marginMm: parseFloat(opts.margin),
  };

  const widthPt = mmToPt(size.widthMm);
  const heightPt = mmToPt(size.heightMm);

  const contentDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = contentDoc.addPage([widthPt, heightPt]);
    layoutFn(page, size.widthMm, size.heightMm, options);
  }

  const contentBytes = await contentDoc.save();
  await fs.writeFile(opts.output, contentBytes);
  console.log(`✓ ${opts.output}  (${pageCount} pages · ${size.name} · ${opts.layout})`);

  if (opts.print) {
    const ext = path.extname(opts.output);
    const base = opts.output.slice(0, -ext.length || undefined);
    const printPath = `${base}-print${ext}`;
    try {
      const printBytes = await createPrintPdf(contentDoc, size.widthMm, size.heightMm);
      await fs.writeFile(printPath, printBytes);
      const strategy = getStrategy(size.widthMm, size.heightMm);
      console.log(`${printPath}  (A4 print-ready, double-sided, booklet order)`);
      console.log("");
      console.log("  Printing instructions:");
      console.log("  1. Print double-sided, flip on long edge");
      if (strategy === "portrait4up") {
        console.log("  2. Cut each sheet horizontally at the center (solid line)");
        console.log("  3. Fold each half along its vertical center");
        console.log("  4. Nest and saddle-stitch the folded pieces");
        console.log(`  5. Trim edges to the crop marks (${size.widthMm} x ${size.heightMm} mm)`);
      } else {
        console.log("  2. Fold each sheet along its vertical center (dashed line)");
        console.log("  3. Nest and saddle-stitch the folded sheets");
        console.log(`  4. Trim edges to the crop marks (${size.widthMm} x ${size.heightMm} mm)`);
      }
    } catch (err) {
      console.error(`Could not generate print PDF: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
