import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import { mmToPt } from "./sizes";

const A4_W = 210; // mm (portrait)
const A4_H = 297; // mm (portrait)

// Two imposition strategies:
//
// portrait4up — for small pages (e.g. passport 89×124mm).
//   Fits 4 pages per A4 face in a 2×2 grid; 8 pages per sheet.
//   Workflow: print double-sided, cut horizontally at center, fold each half.
//
// landscape2up — for larger pages (e.g. standard 110×210mm, A5 148×210mm).
//   A4 rotated landscape, 2 pages side by side per face; 4 pages per sheet.
//   Workflow: print double-sided, fold the full sheet.
export type Strategy = "portrait4up" | "landscape2up";

export function getStrategy(widthMm: number, heightMm: number): Strategy {
  if (widthMm <= A4_W / 2 && heightMm <= A4_H / 2) return "portrait4up";
  if (2 * widthMm <= A4_H && heightMm <= A4_W) return "landscape2up";
  throw new Error(
    `Size ${widthMm}x${heightMm}mm does not fit any supported A4 imposition layout.`
  );
}

export function pagesPerSheet(strategy: Strategy): number {
  return strategy === "portrait4up" ? 8 : 4;
}

// Booklet imposition page order.
//
// Signature s (1-indexed) of an N-page booklet contains:
//   cover page  = 2s − 1
//   inner-right = 2s
//   inner-left  = N − 2s + 1
//   back page   = N − 2s + 2
//
// portrait4up:  A4 sheet a carries signatures (2a−1) and (2a), top/bottom halves.
//   front: [TL=back(2a−1), TR=cover(2a−1), BL=back(2a), BR=cover(2a)]
//   back:  [TL=inner-R(2a−1), TR=inner-L(2a−1), BL=inner-R(2a), BR=inner-L(2a)]
//
// landscape2up: A4 sheet a IS signature a.
//   front: [L=back(a), R=cover(a)]
//   back:  [L=inner-R(a), R=inner-L(a)]

type Sheet4Up = {
  strategy: "portrait4up";
  front: [number, number, number, number]; // tl, tr, bl, br
  back: [number, number, number, number];
};

type Sheet2Up = {
  strategy: "landscape2up";
  front: [number, number]; // left, right
  back: [number, number];
};

function get4UpSheets(n: number): Sheet4Up[] {
  return Array.from({ length: n / 8 }, (_, i) => {
    const a = i + 1;
    return {
      strategy: "portrait4up",
      front: [n - 4 * a + 4, 4 * a - 3, n - 4 * a + 2, 4 * a - 1],
      back: [4 * a - 2, n - 4 * a + 3, 4 * a, n - 4 * a + 1],
    };
  });
}

function get2UpSheets(n: number): Sheet2Up[] {
  return Array.from({ length: n / 4 }, (_, i) => {
    const a = i + 1;
    return {
      strategy: "landscape2up",
      front: [n - 2 * a + 2, 2 * a - 1],
      back: [2 * a, n - 2 * a + 1],
    };
  });
}

// ─── Crop marks ─────────────────────────────────────────────────────────────

function drawPageCropMarks(
  page: PDFPage,
  pageXPt: number,
  pageYPt: number,
  pageWPt: number,
  pageHPt: number
): void {
  const gray = rgb(0.55, 0.55, 0.55);
  const tick = mmToPt(4);
  const gap = mmToPt(1.5);
  const thin = 0.25;

  const corners = [
    { cx: pageXPt,           cy: pageYPt,           hDir: -1, vDir: -1 },
    { cx: pageXPt + pageWPt, cy: pageYPt,           hDir:  1, vDir: -1 },
    { cx: pageXPt,           cy: pageYPt + pageHPt, hDir: -1, vDir:  1 },
    { cx: pageXPt + pageWPt, cy: pageYPt + pageHPt, hDir:  1, vDir:  1 },
  ];

  for (const { cx, cy, hDir, vDir } of corners) {
    page.drawLine({ start: { x: cx + hDir * gap, y: cy }, end: { x: cx + hDir * (gap + tick), y: cy }, thickness: thin, color: gray });
    page.drawLine({ start: { x: cx, y: cy + vDir * gap }, end: { x: cx, y: cy + vDir * (gap + tick) }, thickness: thin, color: gray });
  }
}

// ─── Portrait 4-up ──────────────────────────────────────────────────────────

function quadrantOrigin(
  pos: "tl" | "tr" | "bl" | "br",
  pageWPt: number,
  pageHPt: number
): { x: number; y: number } {
  const halfW = mmToPt(A4_W) / 2;
  const halfH = mmToPt(A4_H) / 2;
  const ox = (halfW - pageWPt) / 2;
  const oy = (halfH - pageHPt) / 2;
  switch (pos) {
    case "tl": return { x: ox, y: halfH + oy };
    case "tr": return { x: halfW + ox, y: halfH + oy };
    case "bl": return { x: ox, y: oy };
    case "br": return { x: halfW + ox, y: oy };
  }
}

async function create4UpPdf(
  contentDoc: PDFDocument,
  widthMm: number,
  heightMm: number
): Promise<Uint8Array> {
  const pageCount = contentDoc.getPageCount();
  const sheets = get4UpSheets(pageCount);
  const a4Doc = await PDFDocument.create();
  const a4WPt = mmToPt(A4_W);
  const a4HPt = mmToPt(A4_H);
  const pageWPt = mmToPt(widthMm);
  const pageHPt = mmToPt(heightMm);
  const embedded = await Promise.all(contentDoc.getPages().map((p) => a4Doc.embedPage(p)));
  const positions = ["tl", "tr", "bl", "br"] as const;

  for (const { front, back } of sheets) {
    for (const pageNums of [front, back]) {
      const a4Page = a4Doc.addPage([a4WPt, a4HPt]);

      // Dashed cut line across horizontal center
      a4Page.drawLine({
        start: { x: 0, y: a4HPt / 2 },
        end: { x: a4WPt, y: a4HPt / 2 },
        thickness: 0.25,
        color: rgb(0.55, 0.55, 0.55),
        dashArray: [3, 3],
      });

      for (let i = 0; i < 4; i++) {
        const { x, y } = quadrantOrigin(positions[i], pageWPt, pageHPt);
        a4Page.drawPage(embedded[pageNums[i] - 1], { x, y, width: pageWPt, height: pageHPt });
        drawPageCropMarks(a4Page, x, y, pageWPt, pageHPt);
      }
    }
  }

  return a4Doc.save();
}

// ─── Landscape 2-up ─────────────────────────────────────────────────────────

async function create2UpPdf(
  contentDoc: PDFDocument,
  widthMm: number,
  heightMm: number
): Promise<Uint8Array> {
  const pageCount = contentDoc.getPageCount();
  const sheets = get2UpSheets(pageCount);
  const a4Doc = await PDFDocument.create();
  // Landscape: swap A4 dimensions
  const canvasWPt = mmToPt(A4_H);
  const canvasHPt = mmToPt(A4_W);
  const pageWPt = mmToPt(widthMm);
  const pageHPt = mmToPt(heightMm);
  const offsetX = (canvasWPt - 2 * pageWPt) / 2;
  const offsetY = (canvasHPt - pageHPt) / 2;
  const embedded = await Promise.all(contentDoc.getPages().map((p) => a4Doc.embedPage(p)));

  for (const { front, back } of sheets) {
    for (const [leftNum, rightNum] of [front, back]) {
      const a4Page = a4Doc.addPage([canvasWPt, canvasHPt]);

      // Dashed fold line at horizontal center
      a4Page.drawLine({
        start: { x: canvasWPt / 2, y: 0 },
        end: { x: canvasWPt / 2, y: canvasHPt },
        thickness: 0.25,
        color: rgb(0.55, 0.55, 0.55),
        dashArray: [3, 3],
      });

      const leftX = offsetX;
      const rightX = offsetX + pageWPt;

      a4Page.drawPage(embedded[leftNum - 1], { x: leftX, y: offsetY, width: pageWPt, height: pageHPt });
      drawPageCropMarks(a4Page, leftX, offsetY, pageWPt, pageHPt);

      a4Page.drawPage(embedded[rightNum - 1], { x: rightX, y: offsetY, width: pageWPt, height: pageHPt });
      drawPageCropMarks(a4Page, rightX, offsetY, pageWPt, pageHPt);
    }
  }

  return a4Doc.save();
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function createPrintPdf(
  contentDoc: PDFDocument,
  widthMm: number,
  heightMm: number
): Promise<Uint8Array> {
  const strategy = getStrategy(widthMm, heightMm);
  return strategy === "portrait4up"
    ? create4UpPdf(contentDoc, widthMm, heightMm)
    : create2UpPdf(contentDoc, widthMm, heightMm);
}
