from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import dataclass, replace
from enum import Enum

from app.layout import PageText
from app.parsing.models import ParseOutcome


class DocumentSource(str, Enum):
    PDF_NATIVE = "pdf_native"
    PDF_OCR = "pdf_ocr"
    IMAGE_OCR = "image_ocr"
    OFX = "ofx"


@dataclass(frozen=True)
class ExtractedDocument:
    source: DocumentSource
    total_pages: int
    pages: tuple[PageText, ...] = ()
    warnings: tuple[str, ...] = ()
    structured: ParseOutcome | None = None
    characters: int = 0
    line_count: int = 0

    @classmethod
    def from_pages(
        cls,
        source: DocumentSource,
        pages: Iterable[PageText],
        total_pages: int,
        warnings: Iterable[str] = (),
    ) -> "ExtractedDocument":
        ordered = tuple(sorted(pages, key=lambda page: page.number))
        return cls(
            source=source,
            total_pages=total_pages,
            pages=ordered,
            warnings=tuple(warnings),
            characters=sum(page.characters for page in ordered),
            line_count=sum(len(page.lines) for page in ordered),
        )

    def with_pages_replaced(self, other: "ExtractedDocument", source: DocumentSource) -> "ExtractedDocument":
        replacements = {page.number: page for page in other.pages if page.lines}
        merged = [replacements.get(page.number, page) for page in self.pages]
        rebuilt = ExtractedDocument.from_pages(
            source,
            merged,
            self.total_pages,
            (*self.warnings, *other.warnings),
        )
        return replace(rebuilt, structured=self.structured)


class DocumentExtractor(ABC):
    @abstractmethod
    def extract(self, data: bytes) -> ExtractedDocument:
        raise NotImplementedError
