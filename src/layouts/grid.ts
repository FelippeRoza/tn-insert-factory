import { rgb } from "pdf-lib";
import { LayoutFn, centerGrid } from "./base";
import { mmToPt } from "../sizes";

export const grid: LayoutFn = (page, widthMm, heightMm, { spacingMm, marginMm, color, lineWidthPt }) => {
  const lineColor = rgb(...color);
  const cols = centerGrid(widthMm, marginMm, spacingMm);
  const rows = centerGrid(heightMm, marginMm, spacingMm);

  const x1 = mmToPt(cols.startMm);
  const x2 = mmToPt(cols.startMm + (cols.count - 1) * spacingMm);
  const y1 = mmToPt(rows.startMm);
  const y2 = mmToPt(rows.startMm + (rows.count - 1) * spacingMm);

  for (let r = 0; r < rows.count; r++) {
    const y = mmToPt(rows.startMm + r * spacingMm);
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: lineWidthPt, color: lineColor });
  }
  for (let c = 0; c < cols.count; c++) {
    const x = mmToPt(cols.startMm + c * spacingMm);
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: lineWidthPt, color: lineColor });
  }
};
