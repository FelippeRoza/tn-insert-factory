import { PDFPage } from "pdf-lib";

export interface LayoutOptions {
  spacingMm: number;
  marginMm: number;
  color: [number, number, number];
  lineWidthPt: number;
}

export const DEFAULT_OPTIONS: LayoutOptions = {
  spacingMm: 5,
  marginMm: 8,
  color: [0.7, 0.7, 0.7],
  lineWidthPt: 0.3,
};

export type LayoutFn = (
  page: PDFPage,
  widthMm: number,
  heightMm: number,
  options: LayoutOptions
) => void;

// Centers a grid within the page so both margins are equal even when
// the page dimension doesn't divide evenly by spacingMm.
export function centerGrid(
  totalMm: number,
  marginMm: number,
  spacingMm: number
): { startMm: number; count: number } {
  const usable = totalMm - 2 * marginMm;
  const count = Math.floor(usable / spacingMm) + 1;
  const span = (count - 1) * spacingMm;
  const leftover = usable - span;
  return { startMm: marginMm + leftover / 2, count };
}
