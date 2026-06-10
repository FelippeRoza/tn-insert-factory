export const MM_TO_PT = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export interface NotebookSize {
  name: string;
  widthMm: number;
  heightMm: number;
}

export const SIZES: Record<string, NotebookSize> = {
  passport: { name: "Passport", widthMm: 89, heightMm: 124 },
  standard: { name: "Standard", widthMm: 110, heightMm: 210 },
  a5: { name: "A5", widthMm: 148, heightMm: 210 },
};
