import { rgb } from "pdf-lib";
import { LayoutFn, centerGrid } from "./base";
import { mmToPt } from "../sizes";

export const lines: LayoutFn = (page, widthMm, heightMm, { spacingMm, marginMm, color, lineWidthPt }) => {
  const lineColor = rgb(...color);
  const { startMm, count } = centerGrid(heightMm, marginMm, spacingMm);
  const x1 = mmToPt(marginMm);
  const x2 = mmToPt(widthMm - marginMm);

  for (let i = 0; i < count; i++) {
    const y = mmToPt(startMm + i * spacingMm);
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: lineWidthPt, color: lineColor });
  }
};
