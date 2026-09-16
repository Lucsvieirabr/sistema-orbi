import logging
import math
import threading

import pytesseract
from PIL import Image, ImageOps

from app.errors import DocumentError
from app.layout import Word

logger = logging.getLogger(__name__)

_MIN_OCR_WIDTH = 1600
_MAX_UPSCALE = 3


class TesseractOcr:
    def __init__(self, languages: str, psm: int, page_timeout: int) -> None:
        self._requested = [language for language in languages.split("+") if language]
        self._psm = psm
        self._page_timeout = page_timeout
        self._languages: str | None = None
        self._resolved = False
        self._lock = threading.Lock()

    @property
    def languages(self) -> str | None:
        with self._lock:
            if not self._resolved:
                self._languages = self._resolve_languages()
                self._resolved = True
            return self._languages

    @property
    def available(self) -> bool:
        return self.languages is not None

    def require(self) -> str:
        languages = self.languages
        if languages is None:
            raise DocumentError(
                "OCR_UNAVAILABLE", "Leitura de documentos digitalizados indisponível no momento.", 503
            )
        return languages

    def read_words(self, image: Image.Image) -> list[Word]:
        languages = self.require()
        prepared, scale = self._prepare(image)
        data = pytesseract.image_to_data(
            prepared,
            lang=languages,
            config=f"--psm {self._psm} -c preserve_interword_spaces=1",
            output_type=pytesseract.Output.DICT,
            timeout=self._page_timeout,
        )

        words: list[Word] = []
        for index, raw_text in enumerate(data["text"]):
            text = raw_text.strip()
            if not text or float(data["conf"][index]) < 0:
                continue
            left = data["left"][index] / scale
            top = data["top"][index] / scale
            words.append(
                Word(
                    text=text,
                    x0=left,
                    x1=left + data["width"][index] / scale,
                    top=top,
                    bottom=top + data["height"][index] / scale,
                )
            )
        return words

    def _prepare(self, image: Image.Image) -> tuple[Image.Image, float]:
        prepared = ImageOps.exif_transpose(image).convert("L")
        scale = 1.0
        if prepared.width < _MIN_OCR_WIDTH:
            scale = float(min(_MAX_UPSCALE, math.ceil(_MIN_OCR_WIDTH / max(prepared.width, 1))))
            prepared = prepared.resize(
                (int(prepared.width * scale), int(prepared.height * scale)), Image.Resampling.LANCZOS
            )
        return ImageOps.autocontrast(prepared), scale

    def _resolve_languages(self) -> str | None:
        try:
            installed = set(pytesseract.get_languages(config=""))
        except (pytesseract.TesseractNotFoundError, pytesseract.TesseractError, OSError):
            logger.error("tesseract não encontrado no ambiente")
            return None

        chosen = [language for language in self._requested if language in installed]
        if not chosen:
            logger.error("nenhum idioma de OCR instalado entre %s", self._requested)
            return None
        return "+".join(chosen)
