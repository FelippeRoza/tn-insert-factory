import { rgb } from "pdf-lib";
import { LayoutFn, centerGrid } from "./base";
import { mmToPt } from "../sizes";

// Checkbox square on the left of each line; spacing controls row density.
export const todoList: LayoutFn = (page, widthMm, heightMm, { spacingMm, marginMm, color, lineWidthPt }) => {
  const lineColor = rgb(...color);
  const { startMm, count } = centerGrid(heightMm, marginMm, spacingMm);

  // Checkbox is 45% of row height, capped at 2.6 mm so it stays legible on passport size.
  const checkSizePt = mmToPt(Math.min(spacingMm * 0.45, 2.6));
  const gapPt = mmToPt(0.8);
  const leftPt = mmToPt(marginMm);
  const rightPt = mmToPt(widthMm - marginMm);

  for (let i = 0; i < count; i++) {
    const y = mmToPt(startMm + i * spacingMm);

    // Square outline centered in the row space between this line and the one above.
    const rowCenterPt = y + mmToPt(spacingMm / 2);
    page.drawRectangle({
      x: leftPt,
      y: rowCenterPt - checkSizePt / 2,
      width: checkSizePt,
      height: checkSizePt,
      borderColor: lineColor,
      borderWidth: lineWidthPt * 1.2,
    });

    // Writing line starting just after the checkbox.
    page.drawLine({
      start: { x: leftPt + checkSizePt + gapPt, y },
      end: { x: rightPt, y },
      thickness: lineWidthPt,
      color: lineColor,
    });
  }
};
