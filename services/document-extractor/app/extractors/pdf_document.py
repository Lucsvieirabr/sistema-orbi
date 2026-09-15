import io
from collections.abc import Iterator
from contextlib import contextmanager

import pdfplumber
from pdfminer.pdfdocument import PDFPasswordIncorrect
from pdfplumber.utils.exceptions import PdfminerException

from app.errors import DocumentError


@contextmanager
def open_pdf(data: bytes) -> Iterator[pdfplumber.PDF]:
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
        page_count = len(pdf.pages)
    except PdfminerException as error:
        cause = error.args[0] if error.args else None
        if isinstance(cause, PDFPasswordIncorrect):
            raise DocumentError(
                "PDF_PROTECTED", "O PDF está protegido por senha.", 422
            ) from error
        raise DocumentError("PDF_INVALID", "O PDF está corrompido ou não pôde ser aberto.", 422) from error
    except Exception as error:
        raise DocumentError("PDF_INVALID", "O PDF está corrompido ou não pôde ser aberto.", 422) from error

    if page_count == 0:
        pdf.close()
        raise DocumentError("PDF_INVALID", "O PDF não possui páginas.", 422)

    try:
        yield pdf
    finally:
        pdf.close()
