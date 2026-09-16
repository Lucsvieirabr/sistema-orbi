import unittest
from decimal import Decimal

from app.layout import Word
from app.parsing.tokens import read_amounts, read_date


def words(*texts: str) -> list[Word]:
    result, x = [], 0.0
    for text in texts:
        width = len(text) * 5.0
        result.append(Word(text, x, x + width, 0.0, 9.0))
        x += width + 3.0
    return result


class ReadDateTest(unittest.TestCase):
    def test_numeric_formats(self) -> None:
        self.assertEqual((2, 7, None, 1), astuple(read_date(["02/07", "PIX"])))
        self.assertEqual((2, 7, 2026, 1), astuple(read_date(["02/07/2026"])))
        self.assertEqual((2, 7, 2026, 1), astuple(read_date(["02/07/26"])))
        self.assertEqual((2, 7, 2026, 1), astuple(read_date(["02.07.2026"])))
        self.assertEqual((2, 7, 2026, 1), astuple(read_date(["2026-07-02"])))
        self.assertEqual((2, 7, None, 1), astuple(read_date(["02/jul"])))

    def test_month_abbreviations_and_ocr_noise(self) -> None:
        self.assertEqual((29, 6, None, 2), astuple(read_date(["29", "JUN", "Loja"])))
        self.assertEqual((29, 6, None, 1), astuple(read_date(["29,JUN", "Loja"])))
        self.assertEqual((1, 7, None, 1), astuple(read_date(["O1JUL", "Loja"])))
        self.assertEqual((6, 8, 2026, 3), astuple(read_date(["06", "AGO", "2026"])))
        self.assertEqual((29, 6, None, 2), astuple(read_date(["29", "JUN", "0040", "Cursor"])))

    def test_rejects_non_dates(self) -> None:
        self.assertIsNone(read_date(["150,00"]))
        self.assertIsNone(read_date(["32/01"]))
        self.assertIsNone(read_date(["12", "MARCOS"]))
        self.assertIsNone(read_date([]))


class ReadAmountsTest(unittest.TestCase):
    def test_brazilian_numbers(self) -> None:
        amounts = read_amounts(words("R$", "1.234,56", "60,37"))
        self.assertEqual([Decimal("1234.56"), Decimal("60.37")], [a.value for a in amounts])
        self.assertEqual((0, 2), (amounts[0].start, amounts[0].end))

    def test_markers(self) -> None:
        cases = {
            ("−R$", "2.678,34"): "minus",
            ("-150,00",): "minus",
            ("150,00-",): "minus",
            ("(150,00)",): "minus",
            ("150,00", "D"): "debit",
            ("80,00C",): "credit",
            ("+80,00",): "plus",
            ("R$", "10,00"): None,
        }
        for texts, marker in cases.items():
            with self.subTest(texts=texts):
                self.assertEqual(marker, read_amounts(words(*texts))[0].marker)

    def test_ignores_numbers_without_cents(self) -> None:
        self.assertEqual([], read_amounts(words("000123", "02/07", "2026", "12.345")))


def astuple(token):
    return (token.day, token.month, token.year, token.size)


if __name__ == "__main__":
    unittest.main()
