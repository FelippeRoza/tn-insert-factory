# tn-insert-factory

Generate PDF inserts for traveler's notebooks. Start with simple layouts (dotted grid, ruled lines, square grid) and print them at home on A4 paper.

## Setup

```bash
npm install
```

## Usage

```bash
npm run generate -- [options]
```

### Options

| Option | Default | Description |
|---|---|---|
| `-l, --layout <type>` | `dotted` | `dotted`, `lines`, `grid`, `blank` |
| `-s, --size <name>` | `passport` | `passport` (89×124mm), `standard` (110×210mm), `a5` (148×210mm) |
| `-p, --pages <n>` | `8` | Number of pages — must be a multiple of 8 (passport) or 4 (standard/a5) when using `--print` |
| `--spacing <mm>` | `5` | Dot/grid/line spacing in mm |
| `--margin <mm>` | `8` | Margin on each side in mm |
| `--print` | — | Also generate an A4 print-ready PDF with booklet imposition |
| `-o, --output <file>` | `insert.pdf` | Output filename |

### Examples

```bash
# 8-page dotted insert, passport size
npm run generate

# 16-page ruled lines, 6mm spacing, with print layout
npm run generate -- --layout lines --pages 16 --spacing 6 --print

# Square grid, custom spacing and margin
npm run generate -- --layout grid --spacing 4 --margin 10 --output grid-insert.pdf
```

## Printing at home (A4, double-sided)

When you pass `--print`, a second file `*-print.pdf` is generated alongside the regular one. Pages are reordered (booklet imposition) so that after folding everything reads in sequence.

The imposition strategy is chosen automatically based on page size:

### Passport (portrait 4-up, 8 pages per A4 sheet)

Pages are arranged 2×2 on each A4 face. Each sheet is cut into two halves which become two separate signatures.

1. **Print** double-sided, flip on the **long edge**
2. **Cut** each sheet horizontally at the center (dashed line)
3. **Fold** each half along its vertical center
4. **Nest** the folded pieces (innermost pages go deepest)
5. **Saddle-stitch** through the spine
6. **Trim** to the crop marks (89×124mm)

### Standard / A5 (landscape 2-up, 4 pages per A4 sheet)

Pages are arranged side by side on A4 in landscape. Each sheet is one signature.

1. **Print** double-sided, flip on the **long edge**
2. **Fold** each sheet along its vertical center (dashed line)
3. **Nest** the folded sheets
4. **Saddle-stitch** through the spine
5. **Trim** to the crop marks
