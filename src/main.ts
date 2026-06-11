import { PDFDocument } from "pdf-lib";
import { SIZES, mmToPt } from "./sizes";
import { DEFAULT_OPTIONS, LayoutFn } from "./layouts/base";
import * as layouts from "./layouts/index";
import { createPrintPdf, getStrategy, pagesPerSheet } from "./imposition";

const LAYOUTS: Record<string, LayoutFn> = layouts;

const form = document.getElementById("form") as HTMLFormElement;
const btn = document.getElementById("btn") as HTMLButtonElement;
const errorEl = document.getElementById("error") as HTMLParagraphElement;
const previewSection = document.getElementById("preview") as HTMLDivElement;
const previewFrame = document.getElementById("preview-frame") as HTMLIFrameElement;
const previewLabel = document.getElementById("preview-label") as HTMLSpanElement;
const previewInfoBox = document.getElementById("info-preview") as HTMLDivElement;
const downloadBtn = document.getElementById("download-preview") as HTMLButtonElement;

let currentInsertBytes: Uint8Array | null = null;
let currentPrintBytes: Uint8Array | null = null;
let currentPreviewUrl: string | null = null;

// Toggle info boxes
document.querySelectorAll<HTMLButtonElement>(".info-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target!);
    if (!target) return;
    const open = target.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
});

function showError(msg: string) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

function clearError() {
  errorEl.style.display = "none";
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showPreview(bytes: Uint8Array, printMode: boolean) {
  if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
  const blob = new Blob([bytes], { type: "application/pdf" });
  currentPreviewUrl = URL.createObjectURL(blob);
  previewFrame.src = currentPreviewUrl;

  if (printMode) {
    previewLabel.textContent = "Print-ready (A4)";
    previewInfoBox.textContent =
      "Showing the A4 print sheet with pages arranged for double-sided booklet printing. " +
      "Dashed lines are fold guides; solid lines are cut marks.";
    downloadBtn.onclick = () => triggerDownload(bytes, "insert-print.pdf");
  } else {
    previewLabel.textContent = "Standard insert";
    previewInfoBox.textContent =
      "Showing the insert at its actual notebook size — one page per view. " +
      "Ready to print as-is if your printer supports the page size, " +
      "or enable Print-ready to get an A4 booklet layout instead.";
    downloadBtn.onclick = () => triggerDownload(bytes, "insert.pdf");
  }

  previewSection.style.display = "block";
  previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const data = new FormData(form);
  const sizeKey = data.get("size") as string;
  const layoutKey = data.get("layout") as string;
  const pageCount = parseInt(data.get("pages") as string, 10);
  const spacingMm = parseFloat(data.get("spacing") as string);
  const marginMm = parseFloat(data.get("margin") as string);
  const printMode = (form.querySelector("#print") as HTMLInputElement).checked;

  const size = SIZES[sizeKey];
  const layoutFn = LAYOUTS[layoutKey];

  if (isNaN(pageCount) || pageCount < 1) {
    showError("Pages must be a positive integer.");
    return;
  }

  if (printMode) {
    let strategy;
    try {
      strategy = getStrategy(size.widthMm, size.heightMm);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
      return;
    }
    const multiple = pagesPerSheet(strategy);
    if (pageCount % multiple !== 0) {
      const suggested = Math.ceil(pageCount / multiple) * multiple;
      showError(
        `For print mode with ${size.name}, pages must be a multiple of ${multiple}. Try ${suggested}.`
      );
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = "Generating…";

  try {
    const options = { ...DEFAULT_OPTIONS, spacingMm, marginMm };
    const widthPt = mmToPt(size.widthMm);
    const heightPt = mmToPt(size.heightMm);

    const contentDoc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      const page = contentDoc.addPage([widthPt, heightPt]);
      layoutFn(page, size.widthMm, size.heightMm, options);
    }

    currentInsertBytes = await contentDoc.save();
    currentPrintBytes = null;

    if (printMode) {
      currentPrintBytes = await createPrintPdf(contentDoc, size.widthMm, size.heightMm);
    }

    showPreview(printMode ? currentPrintBytes! : currentInsertBytes, printMode);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
});
