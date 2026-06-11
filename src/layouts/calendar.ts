import { rgb, StandardFonts } from "pdf-lib";
import { LayoutFn } from "./base";
import { mmToPt } from "../sizes";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Single-letter day headers: M T W T F S S (Monday-first)
const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

// One month per page. `pageIndex` advances the month; `startYear`/`startMonth`
// set the origin (defaults to the current month if omitted).
export const calendar: LayoutFn = (page, widthMm, heightMm, options) => {
  const { marginMm, color, lineWidthPt, pageIndex = 0 } = options;
  const now = new Date();
  const originYear = options.startYear ?? now.getFullYear();
  const originMonth = options.startMonth ?? now.getMonth();

  const font = page.doc.embedStandardFont(StandardFonts.Helvetica);
  const lineColor = rgb(...color);

  // Which month does this page represent?
  const totalMonths = originMonth + pageIndex;
  const year = originYear + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Convert JS Sunday=0 to Monday-first offset (0=Mon … 6=Sun)
  const firstDow = (firstDay.getDay() + 6) % 7;

  // ── Layout metrics ──────────────────────────────────────────────────────────
  const headerHmm = 9;
  const dayRowHmm = 5;
  const usableWmm = widthMm - 2 * marginMm;
  const usableHmm = heightMm - 2 * marginMm;
  const gridHmm = usableHmm - headerHmm - dayRowHmm;
  const cellWmm = usableWmm / 7;
  const cellHmm = gridHmm / 6;

  // Font sizes scale with cell dimensions; caps prevent huge text on A5.
  const headerSize = Math.min(mmToPt(headerHmm * 0.6), 11);
  const dayNameSize = Math.min(mmToPt(dayRowHmm * 0.55), 7);
  const dayNumSize = Math.min(mmToPt(cellHmm * 0.3), 8);

  // ── Y anchors (PDF origin = bottom-left) ───────────────────────────────────
  const marginPt = mmToPt(marginMm);
  const topY = mmToPt(heightMm - marginMm);
  const headerBottomY = topY - mmToPt(headerHmm);
  const dayRowBottomY = headerBottomY - mmToPt(dayRowHmm);

  // ── Month / year header ────────────────────────────────────────────────────
  const headerText = `${MONTH_NAMES[month]} ${year}`;
  const headerTextW = font.widthOfTextAtSize(headerText, headerSize);
  page.drawText(headerText, {
    x: marginPt + mmToPt(usableWmm) / 2 - headerTextW / 2,
    y: headerBottomY + (mmToPt(headerHmm) - headerSize) / 2,
    font,
    size: headerSize,
    color: lineColor,
  });

  // ── Day-of-week initials ───────────────────────────────────────────────────
  for (let d = 0; d < 7; d++) {
    const text = DAY_INITIALS[d];
    const cellLeftX = marginPt + mmToPt(d * cellWmm);
    const textW = font.widthOfTextAtSize(text, dayNameSize);
    page.drawText(text, {
      x: cellLeftX + mmToPt(cellWmm) / 2 - textW / 2,
      y: dayRowBottomY + (mmToPt(dayRowHmm) - dayNameSize) / 2,
      font,
      size: dayNameSize,
      color: lineColor,
    });
  }

  // ── Grid lines ─────────────────────────────────────────────────────────────
  const gridRightX = marginPt + mmToPt(usableWmm);
  const gridBottomY = mmToPt(marginMm);

  for (let row = 0; row <= 6; row++) {
    const y = dayRowBottomY - mmToPt(row * cellHmm);
    page.drawLine({ start: { x: marginPt, y }, end: { x: gridRightX, y }, thickness: lineWidthPt, color: lineColor });
  }

  for (let col = 0; col <= 7; col++) {
    const x = marginPt + mmToPt(col * cellWmm);
    page.drawLine({ start: { x, y: dayRowBottomY }, end: { x, y: gridBottomY }, thickness: lineWidthPt, color: lineColor });
  }

  // ── Day numbers ────────────────────────────────────────────────────────────
  let dayNum = 1;
  for (let row = 0; row < 6 && dayNum <= daysInMonth; row++) {
    for (let col = 0; col < 7 && dayNum <= daysInMonth; col++) {
      if (row === 0 && col < firstDow) continue;
      const cellTopY = dayRowBottomY - mmToPt(row * cellHmm);
      page.drawText(String(dayNum), {
        x: marginPt + mmToPt(col * cellWmm) + mmToPt(1),
        y: cellTopY - dayNumSize - mmToPt(1),
        font,
        size: dayNumSize,
        color: lineColor,
      });
      dayNum++;
    }
  }
};
