import io
import logging
from collections.abc import Collection

import pytesseract
from PIL import Image, ImageSequence, UnidentifiedImageError
from pdfplumber.page import Page

from app.errors import DocumentError
from app.extractors.base import DocumentExtractor, DocumentSource, ExtractedDocument
from app.extractors.ocr import TesseractOcr
from app.extractors.pdf_document import open_pdf
from app.layout import PageText, build_lines
from app.sniffing import FileKind, sniff

logger = logging.getLogger(__name__)

Image.MAX_IMAGE_PIXELS = 60_000_000

_MAX_RENDER_EDGE_PX = 5000
_POINTS_PER_INCH = 72


class ScannedPdfExtractor(DocumentExtractor):
    def __init__(self, ocr: TesseractOcr, max_pages: int, dpi: int) -> None:
        self._ocr = ocr
        self._max_pages = max_pages
        self._dpi = dpi

    def extract(self, data: bytes) -> ExtractedDocument:
        if sniff(data) is FileKind.PDF:
            return self.extract_pdf(data)
        return self.extract_image(data)

    def extract_pdf(self, data: bytes, page_numbers: Collection[int] | None = None) -> ExtractedDocument:
        self._ocr.require()
        warnings: list[str] = []

        with open_pdf(data) as pdf:
            total_pages = len(pdf.pages)
            requested = sorted(set(page_numbers)) if page_numbers else list(range(1, total_pages + 1))
            selected = [number for number in requested if 1 <= number <= total_pages][: self._max_pages]
            if len(requested) > len(selected):
                warnings.append("OCR_PAGE_LIMIT_REACHED")

            pages = [
                self._recognize(number, self._render(pdf.pages[number - 1]), warnings)
                for number in selected
            ]

        return ExtractedDocument.from_pages(DocumentSource.PDF_OCR, pages, total_pages, warnings)

    def extract_image(self, data: bytes) -> ExtractedDocument:
        self._ocr.require()
        warnings: list[str] = []

        try:
            with Image.open(io.BytesIO(data)) as image:
                total_frames = getattr(image, "n_frames", 1)
                frames = [
                    frame.copy()
                    for _, frame in zip(range(self._max_pages), ImageSequence.Iterator(image))
                ]
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as error:
            raise DocumentError("IMAGE_INVALID", "A imagem não pôde ser aberta.", 422) from error

        if total_frames > len(frames):
            warnings.append("OCR_PAGE_LIMIT_REACHED")

        pages = [self._recognize(index + 1, frame, warnings) for index, frame in enumerate(frames)]
        return ExtractedDocument.from_pages(DocumentSource.IMAGE_OCR, pages, total_frames, warnings)

    def _render(self, page: Page) -> Image.Image:
        longest_edge_points = max(float(page.width), float(page.height), 1.0)
        resolution = min(self._dpi, int(_MAX_RENDER_EDGE_PX * _POINTS_PER_INCH / longest_edge_points))
        return page.to_image(resolution=max(resolution, 72)).original

    def _recognize(self, number: int, image: Image.Image, warnings: list[str]) -> PageText:
        width = float(image.width)
        try:
            words = self._ocr.read_words(image)
        except (RuntimeError, pytesseract.TesseractError):
            logger.warning("OCR falhou na página %s", number, exc_info=True)
            warnings.append(f"OCR_PAGE_FAILED:{number}")
            words = []
        finally:
            image.close()

        return PageText(number=number, width=width, lines=build_lines(words), ocr=True)
