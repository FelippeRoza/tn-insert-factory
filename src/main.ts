import { PDFDocument } from "pdf-lib";
import { SIZES, mmToPt } from "./sizes";
import { DEFAULT_OPTIONS, LayoutFn } from "./layouts/base";
import * as layouts from "./layouts/index";
import { createPrintPdf, getStrategy, pagesPerSheet, GuideOptions } from "./imposition";

const LAYOUTS: Record<string, LayoutFn> = layouts;

const form = document.getElementById("form") as HTMLFormElement;
const btn = document.getElementById("btn") as HTMLButtonElement;
const errorEl = document.getElementById("error") as HTMLParagraphElement;
const previewFrame = document.getElementById("preview-frame") as HTMLIFrameElement;
const previewEmpty = document.getElementById("preview-empty") as HTMLDivElement;
const previewLabel = document.getElementById("preview-label") as HTMLSpanElement;
const previewInfoBox = document.getElementById("info-preview") as HTMLDivElement;
const previewInfoToggle = document.getElementById("preview-info-toggle") as HTMLButtonElement;
const downloadBtn = document.getElementById("download-preview") as HTMLButtonElement;
const layoutSelect = document.getElementById("layout") as HTMLSelectElement;
const calendarFields = document.getElementById("calendar-fields") as HTMLDivElement;
const spacingRow = document.getElementById("spacing-row") as HTMLDivElement;
const calYearInput = document.getElementById("cal-year") as HTMLInputElement;
const calMonthSelect = document.getElementById("cal-month") as HTMLSelectElement;
const printCheckbox = document.getElementById("print") as HTMLInputElement;
const guideOptions = document.getElementById("guide-options") as HTMLDivElement;
const showCutLineCheckbox = document.getElementById("show-cut-line") as HTMLInputElement;
const showFoldLineCheckbox = document.getElementById("show-fold-line") as HTMLInputElement;

let currentPreviewUrl: string | null = null;

// Color swatches
const colorHiddenInput = document.getElementById("color") as HTMLInputElement;
const colorCustomPicker = document.getElementById("color-custom") as HTMLInputElement;
const swatches = document.querySelectorAll<HTMLButtonElement>(".swatch[data-color]");

function selectSwatch(hex: string, activeSwatch?: HTMLButtonElement) {
  swatches.forEach((s) => s.classList.remove("selected"));
  if (activeSwatch) activeSwatch.classList.add("selected");
  colorHiddenInput.value = hex;
}

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => selectSwatch(swatch.dataset.color!, swatch));
});

colorCustomPicker.addEventListener("input", () => {
  swatches.forEach((s) => s.classList.remove("selected"));
  colorHiddenInput.value = colorCustomPicker.value;
});

// Initialise calendar year to current year.
calYearInput.value = String(new Date().getFullYear());
// Initialise calendar month to current month.
calMonthSelect.value = String(new Date().getMonth());

function applyLayoutUI(layoutKey: string) {
  const isCalendar = layoutKey === "calendar";
  calendarFields.style.display = isCalendar ? "block" : "none";
  spacingRow.style.display = isCalendar ? "none" : "grid";
}

// Sync on load and on change.
applyLayoutUI(layoutSelect.value);
layoutSelect.addEventListener("change", () => applyLayoutUI(layoutSelect.value));

function applyPrintUI() {
  guideOptions.style.display = printCheckbox.checked ? "flex" : "none";
}

applyPrintUI();
printCheckbox.addEventListener("change", applyPrintUI);

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

// Toggle info boxes
document.querySelectorAll<HTMLButtonElement>(".info-toggle").forEach((toggle) => {
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    const target = document.getElementById(toggle.dataset.target!);
    if (!target) return;
    const open = target.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
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
  previewFrame.style.display = "block";
  previewEmpty.style.display = "none";
  previewInfoToggle.style.display = "inline-flex";
  downloadBtn.style.display = "block";

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
    const colorHex = data.get("color") as string;
    const startYear = parseInt(data.get("cal-year") as string, 10);
    const startMonth = parseInt(data.get("cal-month") as string, 10);
    const options = {
      ...DEFAULT_OPTIONS,
      spacingMm,
      marginMm,
      color: hexToRgb(colorHex),
      startYear: isNaN(startYear) ? new Date().getFullYear() : startYear,
      startMonth: isNaN(startMonth) ? new Date().getMonth() : startMonth,
    };
    const widthPt = mmToPt(size.widthMm);
    const heightPt = mmToPt(size.heightMm);

    const contentDoc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      const page = contentDoc.addPage([widthPt, heightPt]);
      layoutFn(page, size.widthMm, size.heightMm, { ...options, pageIndex: i });
    }

    const insertBytes = await contentDoc.save();
    let previewBytes = insertBytes;

    if (printMode) {
      const guides: GuideOptions = {
        showCutLine: showCutLineCheckbox.checked,
        showFoldLine: showFoldLineCheckbox.checked,
      };
      previewBytes = await createPrintPdf(contentDoc, size.widthMm, size.heightMm, guides);
    }

    showPreview(previewBytes, printMode);
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
});
