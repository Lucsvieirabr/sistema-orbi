import os
from dataclasses import dataclass

MIN_TOKEN_LENGTH = 32


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw else default


@dataclass(frozen=True)
class Settings:
    service_token: str
    max_bytes: int = 15 * 1024 * 1024
    max_pages: int = 60
    ocr_max_pages: int = 20
    ocr_dpi: int = 300
    ocr_languages: str = "por+eng"
    ocr_psm: int = 6
    ocr_page_timeout: int = 60
    min_text_chars: int = 80
    max_concurrency: int = 2

    @classmethod
    def from_env(cls) -> "Settings":
        token = os.environ.get("EXTRACTOR_SERVICE_TOKEN", "").strip()
        if len(token) < MIN_TOKEN_LENGTH:
            raise RuntimeError(
                f"EXTRACTOR_SERVICE_TOKEN ausente ou menor que {MIN_TOKEN_LENGTH} caracteres."
            )
        return cls(
            service_token=token,
            max_bytes=_int_env("EXTRACTOR_MAX_BYTES", cls.max_bytes),
            max_pages=_int_env("EXTRACTOR_MAX_PAGES", cls.max_pages),
            ocr_max_pages=_int_env("EXTRACTOR_OCR_MAX_PAGES", cls.ocr_max_pages),
            ocr_dpi=_int_env("EXTRACTOR_OCR_DPI", cls.ocr_dpi),
            ocr_languages=os.environ.get("EXTRACTOR_OCR_LANGUAGES", "").strip() or cls.ocr_languages,
            ocr_psm=_int_env("EXTRACTOR_OCR_PSM", cls.ocr_psm),
            ocr_page_timeout=_int_env("EXTRACTOR_OCR_PAGE_TIMEOUT", cls.ocr_page_timeout),
            min_text_chars=_int_env("EXTRACTOR_MIN_TEXT_CHARS", cls.min_text_chars),
            max_concurrency=_int_env("EXTRACTOR_MAX_CONCURRENCY", cls.max_concurrency),
        )
