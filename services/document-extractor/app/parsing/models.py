from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import Enum

INCOME = "income"
EXPENSE = "expense"
DEBIT = "debit"
CREDIT = "credit"


class DocumentKind(str, Enum):
    CARD_INVOICE = "card_invoice"
    BANK_STATEMENT = "bank_statement"


class ParseStrategy(str, Enum):
    COLUMNS = "columns"
    LINES = "lines"
    OFX = "ofx"


@dataclass(frozen=True)
class ParsedTransaction:
    id: str
    date: date
    description: str
    value: Decimal
    type: str
    payment_method: str | None = None
    installments: int | None = None
    installment_number: int | None = None
    card_last4: str | None = None


@dataclass(frozen=True)
class ParseDiagnostics:
    document_kind: DocumentKind
    strategy: ParseStrategy
    total_lines: int
    candidate_lines: int
    matched_lines: int
    skipped_lines: int


@dataclass(frozen=True)
class ParseOutcome:
    transactions: tuple[ParsedTransaction, ...]
    diagnostics: ParseDiagnostics


def transaction_id(day: date, index: int) -> str:
    return f"TXN-{day:%Y%m%d}-{index:03d}"
