from dataclasses import dataclass

from app.config import Settings
from app.errors import DocumentError
from app.extractors.base import DocumentSource, ExtractedDocument
from app.extractors.native_pdf import NativePdfExtractor
from app.extractors.ocr import TesseractOcr
from app.extractors.ofx import OfxExtractor
from app.extractors.scanned_pdf import ScannedPdfExtractor
from app.parsing.models import ParseOutcome
from app.parsing.statement_parser import StatementParser
from app.sniffing import FileKind, sniff

_BLANK_PAGE_CHARS = 20


@dataclass(frozen=True)
class ExtractionReport:
    document: ExtractedDocument
    outcome: ParseOutcome


class ExtractionPipeline:
    def __init__(self, settings: Settings) -> None:
        self._min_text_chars = settings.min_text_chars
        self._ocr = TesseractOcr(settings.ocr_languages, settings.ocr_psm, settings.ocr_page_timeout)
        self._ofx = OfxExtractor()
        self._native_pdf = NativePdfExtractor(settings.max_pages)
        self._scanned_pdf = ScannedPdfExtractor(self._ocr, settings.ocr_max_pages, settings.ocr_dpi)
        self._parser = StatementParser()

    @property
    def ocr_available(self) -> bool:
        return self._ocr.available

    def run(self, data: bytes) -> ExtractionReport:
        document = self._extract(data)
        outcome = document.structured or self._parser.parse(document)
        return ExtractionReport(document, outcome)

    def _extract(self, data: bytes) -> ExtractedDocument:
        kind = sniff(data)
        if kind is FileKind.OFX:
            return self._ofx.extract(data)
        if kind is FileKind.PDF:
            return self._extract_pdf(data)
        if kind is FileKind.IMAGE:
            return self._require_text(self._scanned_pdf.extract_image(data))
        raise DocumentError(
            "UNSUPPORTED_FORMAT", "Formato não suportado. Envie PDF, OFX ou imagem (JPG/PNG).", 415
        )

    def _extract_pdf(self, data: bytes) -> ExtractedDocument:
        native = self._native_pdf.extract(data)

        if native.characters < self._min_text_chars:
            return self._require_text(self._scanned_pdf.extract_pdf(data))

        blank_pages = [page.number for page in native.pages if page.characters < _BLANK_PAGE_CHARS]
        if not blank_pages or not self._ocr.available:
            return native

        scanned = self._scanned_pdf.extract_pdf(data, blank_pages)
        if not any(page.lines for page in scanned.pages):
            return native
        return native.with_pages_replaced(scanned, DocumentSource.PDF_OCR)

    def _require_text(self, document: ExtractedDocument) -> ExtractedDocument:
        if document.characters < self._min_text_chars:
            raise DocumentError(
                "NO_TEXT",
                "Não foi possível ler texto no documento. Envie o arquivo original do banco ou uma imagem nítida.",
                422,
            )
        return document
