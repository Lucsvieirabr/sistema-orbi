import unittest

from app.errors import DocumentError
from app.extractors.ofx import OfxExtractor
from app.parsing.models import DocumentKind
from tests import builders
from tests.support import summary


class OfxExtractorTest(unittest.TestCase):
    def setUp(self) -> None:
        self.extractor = OfxExtractor()

    def test_sgml_bank_statement(self) -> None:
        outcome = self.extractor.extract(builders.SGML_OFX).structured

        self.assertIs(DocumentKind.BANK_STATEMENT, outcome.diagnostics.document_kind)
        self.assertEqual(
            [
                ("2026-07-02", "Joao Acougue", "150.00", "expense"),
                ("2026-07-05", "EMPRESA X SALARIO", "2500.00", "income"),
                ("2026-07-05", "NETFLIX COM", "39.90", "expense"),
            ],
            summary(outcome),
        )
        self.assertEqual(1, outcome.diagnostics.skipped_lines)

    def test_xml_credit_card(self) -> None:
        outcome = self.extractor.extract(builders.XML_CARD_OFX).structured
        purchase, payment = outcome.transactions

        self.assertIs(DocumentKind.CARD_INVOICE, outcome.diagnostics.document_kind)
        self.assertEqual(("LOJA ELETRO", "expense", 2, 5, "9876"), (purchase.description, purchase.type, purchase.installment_number, purchase.installments, purchase.card_last4))
        self.assertEqual(("Pagamento recebido & processado", "income"), (payment.description, payment.type))
        self.assertTrue(all(item.payment_method == "credit" for item in outcome.transactions))

    def test_rejects_file_without_statement(self) -> None:
        with self.assertRaises(DocumentError) as raised:
            self.extractor.extract(b"OFXHEADER:100\n<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>")
        self.assertEqual("OFX_INVALID", raised.exception.code)


if __name__ == "__main__":
    unittest.main()
