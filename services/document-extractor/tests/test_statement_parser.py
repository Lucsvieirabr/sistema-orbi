import unittest

from app.extractors.base import DocumentSource
from app.parsing.models import DocumentKind, ParseStrategy
from tests import builders
from tests.support import pipeline, summary


class CardInvoiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pipeline = pipeline()

    def test_nubank_layout(self) -> None:
        report = self.pipeline.run(builders.nubank_invoice())
        outcome = report.outcome

        self.assertIs(DocumentSource.PDF_NATIVE, report.document.source)
        self.assertIs(DocumentKind.CARD_INVOICE, outcome.diagnostics.document_kind)
        self.assertEqual(
            [
                ("2026-06-29", "Komprao Koch Atacadis", "60.37", "expense"),
                ("2026-06-29", "C A Modas", "59.99", "expense"),
                ("2026-07-02", 'IOF de "Cursor, Ai Powered Ide"', "3.94", "expense"),
                ("2026-07-04", "Pagamento em 04 JUL", "2678.34", "income"),
                ("2026-07-15", "Cei", "106.93", "expense"),
                ("2026-07-15", "Cei", "106.93", "expense"),
                ("2026-07-20", "Limite convertido em saldo", "10.00", "expense"),
            ],
            summary(outcome),
        )
        modas = outcome.transactions[1]
        self.assertEqual((3, 3, "0040", "credit"), (modas.installment_number, modas.installments, modas.card_last4, modas.payment_method))

    def test_period_crossing_year(self) -> None:
        outcome = self.pipeline.run(builders.year_crossing_invoice()).outcome
        self.assertEqual(["2026-12-28", "2026-12-30", "2027-01-10"], [row[0] for row in summary(outcome)])

    def test_side_by_side_columns(self) -> None:
        outcome = self.pipeline.run(builders.two_column_card_invoice()).outcome
        self.assertEqual(
            [
                ("2026-07-15", "MERCADO LIVRE", "150.00", "expense"),
                ("2026-07-16", "UBER TRIP", "23.90", "expense"),
                ("2026-07-18", "PADARIA REAL", "23.90", "expense"),
                ("2026-07-20", "PAGAMENTO EFETUADO", "500.00", "income"),
            ],
            summary(outcome),
        )
        self.assertEqual((2, 10), (outcome.transactions[0].installment_number, outcome.transactions[0].installments))


class BankStatementTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pipeline = pipeline()

    def test_balance_column_inherited_dates_and_wrapped_descriptions(self) -> None:
        outcome = self.pipeline.run(builders.statement_with_balance()).outcome

        self.assertIs(DocumentKind.BANK_STATEMENT, outcome.diagnostics.document_kind)
        self.assertIs(ParseStrategy.COLUMNS, outcome.diagnostics.strategy)
        self.assertEqual(
            [
                ("2026-07-02", "PIX TRANSF JOAO SILVA", "150.00", "expense"),
                ("2026-07-02", "MARIA SOUZA", "300.00", "income"),
                ("2026-07-05", "ENEL DISTRIBUICAO", "89.90", "expense"),
                ("2026-07-10", "SALARIO EMPRESA X LTDA", "5000.00", "income"),
                ("2026-07-12", "PADARIA BOM PAO", "12.50", "expense"),
                ("2026-07-12", "TARIFA PACOTE SERVICOS", "35.00", "expense"),
                ("2026-07-15", "ACADEMIA FIT REF MENSALIDADE JULHO", "99.00", "expense"),
            ],
            summary(outcome),
        )
        self.assertTrue(all(item.payment_method == "debit" for item in outcome.transactions if item.type == "expense"))

    def test_debit_and_credit_columns(self) -> None:
        outcome = self.pipeline.run(builders.debit_credit_statement()).outcome
        self.assertEqual(
            [
                ("2026-08-03", "RECEBIDA CLIENTE ABC", "1500.00", "income"),
                ("2026-08-04", "VIVO", "129.99", "expense"),
                ("2026-08-05", "ESTORNO TARIFA", "12.00", "income"),
            ],
            summary(outcome),
        )

    def test_debit_credit_suffix_with_time_and_document_number(self) -> None:
        outcome = self.pipeline.run(builders.caixa_statement()).outcome
        self.assertEqual(
            [
                ("2026-07-02", "FULANO", "150.00", "expense"),
                ("2026-07-03", "CRED PIX CICLANO", "80.00", "income"),
            ],
            summary(outcome),
        )


if __name__ == "__main__":
    unittest.main()
