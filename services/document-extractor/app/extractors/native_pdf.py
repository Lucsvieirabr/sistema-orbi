import logging

from pdfplumber.page import Page

from app.extractors.base import DocumentExtractor, DocumentSource, ExtractedDocument
from app.extractors.pdf_document import open_pdf
from app.layout import PageText, Word, build_lines

logger = logging.getLogger(__name__)

_UNMAPPED_GLYPH = "(cid:"
_UNMAPPED_RATIO_LIMIT = 0.3


class NativePdfExtractor(DocumentExtractor):
    def __init__(self, max_pages: int) -> None:
        self._max_pages = max_pages

    def extract(self, data: bytes) -> ExtractedDocument:
        warnings: list[str] = []

        with open_pdf(data) as pdf:
            total_pages = len(pdf.pages)
            limit = min(total_pages, self._max_pages)
            if total_pages > limit:
                warnings.append("PAGE_LIMIT_REACHED")

            pages = [self._read_page(pdf.pages[index], index + 1, warnings) for index in range(limit)]

        return ExtractedDocument.from_pages(DocumentSource.PDF_NATIVE, pages, total_pages, warnings)

    def _read_page(self, page: Page, number: int, warnings: list[str]) -> PageText:
        try:
            words = self._words(page)
        except Exception:
            logger.warning("página %s ilegível pela camada de texto", number, exc_info=True)
            warnings.append(f"PAGE_UNREADABLE:{number}")
            words = []

        return PageText(number=number, width=float(page.width), lines=build_lines(words))

    def _words(self, page: Page) -> list[Word]:
        raw_words = page.dedupe_chars(tolerance=1).extract_words(
            x_tolerance=3,
            y_tolerance=3,
            keep_blank_chars=False,
            use_text_flow=False,
            extra_attrs=["upright"],
        )

        words = [
            Word(
                text=item["text"].strip(),
                x0=float(item["x0"]),
                x1=float(item["x1"]),
                top=float(item["top"]),
                bottom=float(item["bottom"]),
            )
            for item in raw_words
            if item.get("upright", True) and item["text"].strip()
        ]

        unmapped = sum(1 for word in words if _UNMAPPED_GLYPH in word.text)
        if words and unmapped / len(words) > _UNMAPPED_RATIO_LIMIT:
            return []
        return words
