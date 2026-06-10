import { rgb } from "pdf-lib";
import { LayoutFn, centerGrid } from "./base";
import { mmToPt } from "../sizes";

export const dotted: LayoutFn = (page, widthMm, heightMm, { spacingMm, marginMm, color }) => {
  const dotColor = rgb(...color);
  const cols = centerGrid(widthMm, marginMm, spacingMm);
  const rows = centerGrid(heightMm, marginMm, spacingMm);

  for (let c = 0; c < cols.count; c++) {
    const x = mmToPt(cols.startMm + c * spacingMm);
    for (let r = 0; r < rows.count; r++) {
      const y = mmToPt(rows.startMm + r * spacingMm);
      page.drawCircle({ x, y, size: 0.5, color: dotColor });
    }
  }
};
