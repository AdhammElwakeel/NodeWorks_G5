import fitz  # PyMuPDF
from typing import Union

# If extracted text is shorter than this we assume the PDF is image-based
# and try the richer extraction strategies below.
_MIN_USEFUL_CHARS = 100


def _open_doc(file_input: Union[str, bytes]) -> fitz.Document:
    if isinstance(file_input, str):
        return fitz.open(file_input)
    return fitz.open(stream=file_input, filetype="pdf")


def _clean(text: str) -> str:
    """Remove non-printable characters while keeping whitespace."""
    return "".join(ch for ch in text if ch.isprintable() or ch in "\n\t ")


def _strategy_text(doc: fitz.Document) -> str:
    """
    Strategy 1 (fastest): standard PyMuPDF text extraction.
    Works perfectly for digitally-created PDFs. Fails silently when the
    PDF stores the name (or the whole CV) as a rasterised image.
    """
    parts = []
    for page in doc:
        parts.append(page.get_text())
    return _clean("\n".join(parts))


def _strategy_blocks(doc: fitz.Document) -> str:
    """
    Strategy 2: block-level extraction with layout sorting.
    Preserves reading order better for multi-column CVs, and sometimes
    recovers text that get_text() misses due to unusual font encodings.
    Each block is (x0, y0, x1, y1, text, block_no, block_type).
    """
    parts = []
    for page in doc:
        blocks = page.get_text("blocks")
        # Sort top-to-bottom, then left-to-right
        blocks.sort(key=lambda b: (round(b[1] / 20), b[0]))
        for b in blocks:
            if b[6] == 0:  # type 0 = text block (type 1 = image)
                parts.append(b[4].strip())
    return _clean("\n".join(parts))


def _strategy_dict(doc: fitz.Document) -> str:
    """
    Strategy 3: span-level extraction.
    Iterates every text span on every page, capturing text that block-mode
    sometimes skips (e.g. text inside drawing objects or form fields).
    """
    parts = []
    for page in doc:
        page_dict = page.get_text("dict")
        for block in page_dict.get("blocks", []):
            for line in block.get("lines", []):
                line_text = " ".join(
                    span["text"] for span in line.get("spans", []) if span.get("text")
                )
                if line_text.strip():
                    parts.append(line_text)
    return _clean("\n".join(parts))


def _strategy_ocr(doc: fitz.Document) -> str:
    """
    Strategy 4 (slowest, last resort): render each page to a pixmap and
    run Tesseract OCR via PyMuPDF's built-in bridge.
    Required when the CV is a scanned image or when the name/header is
    embedded as a graphic (common in designer-style CVs like Farah's).

    Falls back gracefully if Tesseract is not installed — returns empty
    string so the caller can proceed with whatever text it already has.
    """
    try:
        parts = []
        for page in doc:
            # Render at 2× resolution for better OCR accuracy
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            # get_textpage_ocr requires Tesseract to be on PATH
            tp = page.get_textpage_ocr(flags=fitz.TEXT_PRESERVE_WHITESPACE, dpi=200)
            parts.append(fitz.utils.get_text(page, "text", textpage=tp))
        return _clean("\n".join(parts))
    except Exception:
        return ""


def _strategy_metadata(doc: fitz.Document) -> str:
    """
    Bonus: pull PDF metadata (Author, Title, Subject).
    Often contains the candidate's name when the CV was exported from Word
    or a CV builder. Prepended to the extracted text as a hint for the LLM.
    """
    meta = doc.metadata or {}
    hints = []
    for key in ("author", "title", "subject"):
        val = meta.get(key, "").strip()
        if val and val.lower() not in ("", "none", "unknown", "untitled"):
            hints.append(f"[PDF metadata — {key}]: {val}")
    return "\n".join(hints)


def extract_text_from_pdf(file_input: Union[str, bytes]) -> str:
    """
    Multi-strategy PDF text extraction.

    Tries four strategies in order of speed, stopping as soon as one
    yields enough text.  This handles:
      • Digitally-created PDFs       → Strategy 1 (instant)
      • Multi-column / complex layout → Strategy 2-3 (fast)
      • Designer CVs with image names → Strategy 3 often recovers body;
                                         Strategy 4 (OCR) recovers the header
      • Fully scanned PDFs            → Strategy 4

    The LLM receives a metadata preamble (author/title from PDF properties)
    before the body text, giving it a name hint even when OCR is imperfect.
    """
    try:
        doc = _open_doc(file_input)
    except Exception as e:
        return f"Error reading PDF: {str(e)}"

    try:
        metadata_hint = _strategy_metadata(doc)

        # --- Strategy 1: standard text ---
        text = _strategy_text(doc)
        if len(text.strip()) >= _MIN_USEFUL_CHARS:
            print(f"   📄 PDF extraction: strategy 1 (standard text) — {len(text)} chars")
            return (metadata_hint + "\n\n" + text).strip()

        # --- Strategy 2: block layout ---
        text = _strategy_blocks(doc)
        if len(text.strip()) >= _MIN_USEFUL_CHARS:
            print(f"   📄 PDF extraction: strategy 2 (blocks) — {len(text)} chars")
            return (metadata_hint + "\n\n" + text).strip()

        # --- Strategy 3: span-level ---
        text = _strategy_dict(doc)
        if len(text.strip()) >= _MIN_USEFUL_CHARS:
            print(f"   📄 PDF extraction: strategy 3 (spans) — {len(text)} chars")
            return (metadata_hint + "\n\n" + text).strip()

        # --- Strategy 4: OCR (last resort) ---
        print("   📄 PDF extraction: falling back to OCR (image-based PDF detected)")
        ocr_text = _strategy_ocr(doc)
        combined = (metadata_hint + "\n\n" + ocr_text).strip()

        if len(combined) < _MIN_USEFUL_CHARS:
            # OCR also failed (Tesseract not installed, or truly blank PDF)
            print("   ⚠️  OCR returned very little text. "
                  "Install Tesseract for better image-PDF support.")
            # Still return whatever we scraped — better than nothing
        else:
            print(f"   📄 PDF extraction: strategy 4 (OCR) — {len(combined)} chars")

        return combined if combined else "Error reading PDF: no text could be extracted"

    except Exception as e:
        return f"Error reading PDF: {str(e)}"
    finally:
        doc.close()