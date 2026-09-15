import io
import unittest

from reportlab.lib.pagesizes import A4
from reportlab.lib.pdfencrypt import StandardEncryption
from reportlab.pdfgen import canvas

from app.errors import DocumentError
from app.extractors.base import DocumentSource
from tests import builders
from tests.support import pipeline, summary, tesseract_installed


def protected_pdf() -> bytes:
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=A4, encrypt=StandardEncryption("segredo", canPrint=0))
    document.drawString(40, 800, "02/07/2026 PIX 150,00")
    document.save()
    return buffer.getvalue()


def blank_pdf() -> bytes:
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=A4)
    document.showPage()
    document.save()
    return buffer.getvalue()


class PipelineErrorsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pipeline = pipeline()

    def assertCode(self, code: str, data: bytes) -> None:
        with self.assertRaises(DocumentError) as raised:
            self.pipeline.run(data)
        self.assertEqual(code, raised.exception.code)

    def test_protected_pdf(self) -> None:
        self.assertCode("PDF_PROTECTED", protected_pdf())

    def test_corrupted_pdf(self) -> None:
        self.assertCode("PDF_INVALID", b"%PDF-1.7\nnot really a pdf")

    def test_unsupported_format(self) -> None:
        self.assertCode("UNSUPPORTED_FORMAT", b"Data;Descricao;Valor\n02/07/2026;PIX;-150,00")

    def test_invalid_image(self) -> None:
        if not self.pipeline.ocr_available:
            self.skipTest("tesseract indisponível")
        self.assertCode("IMAGE_INVALID", b"\x89PNG\r\n\x1a\ncorrompido")

    def test_blank_pdf_without_text(self) -> None:
        expected = "NO_TEXT" if self.pipeline.ocr_available else "OCR_UNAVAILABLE"
        self.assertCode(expected, blank_pdf())


@unittest.skipUnless(tesseract_installed(), "tesseract indisponível")
class ScannedDocumentsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pipeline = pipeline()

    def test_scanned_pdf_statement(self) -> None:
        report = self.pipeline.run(builders.image_only_pdf(builders.statement_with_balance()))
        rows = summary(report.outcome)

        self.assertIs(DocumentSource.PDF_OCR, report.document.source)
        self.assertEqual(7, len(rows))
        self.assertEqual(
            [("150.00", "expense"), ("300.00", "income"), ("89.90", "expense"), ("5000.00", "income"), ("12.50", "expense"), ("35.00", "expense"), ("99.00", "expense")],
            [(row[2], row[3]) for row in rows],
        )

    def test_invoice_image(self) -> None:
        report = self.pipeline.run(builders.png_bytes(builders.nubank_invoice()))
        rows = summary(report.outcome)

        self.assertIs(DocumentSource.IMAGE_OCR, report.document.source)
        self.assertEqual(["60.37", "59.99", "3.94", "2678.34", "106.93", "106.93", "10.00"], [row[2] for row in rows])
        self.assertEqual("Komprao Koch Atacadis", rows[0][1])
        self.assertEqual("0040", report.outcome.transactions[0].card_last4)

    def test_mixed_pdf_ocr_only_blank_pages(self) -> None:
        report = self.pipeline.run(builders.mixed_statement())
        dates = [row[0] for row in summary(report.outcome)]

        self.assertIs(DocumentSource.PDF_OCR, report.document.source)
        self.assertIn("2026-07-02", dates)
        self.assertIn("2026-08-04", dates)


if __name__ == "__main__":
    unittest.main()
