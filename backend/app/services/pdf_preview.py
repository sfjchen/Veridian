import fitz

MAX_PREVIEW_FILE_SIZE = 12 * 1024 * 1024
PREVIEW_MAX_DIMENSION = 1400
PDF_SIGNATURE = b"%PDF-"


def _is_pdf_bytes(content: bytes) -> bool:
    return content.startswith(PDF_SIGNATURE)


def render_pdf_first_page_png(pdf_bytes: bytes) -> bytes:
    if not pdf_bytes:
        raise ValueError("Empty file")
    if len(pdf_bytes) > MAX_PREVIEW_FILE_SIZE:
        raise ValueError("File exceeds 12MB limit")
    if not _is_pdf_bytes(pdf_bytes):
        raise ValueError("File must be a PDF")

    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if document.page_count == 0:
            raise ValueError("PDF has no pages")

        page = document.load_page(0)
        rect = page.rect
        longest_side = max(rect.width, rect.height, 1.0)
        scale = min(PREVIEW_MAX_DIMENSION / longest_side, 2.0)
        matrix = fitz.Matrix(scale, scale)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        return pixmap.tobytes("png")
    finally:
        document.close()
