import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from app.parsing.models import DocumentKind
from app.parsing.tokens import MINUS_CLASS, month_from, normalize_key

_NUMERIC_DATE_EXPR = r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})"
_NAMED_DATE_EXPR = r"(\d{1,2})(?:\s+|/|-)([a-z]{3,9})\.?(?:\s+|/|-)(\d{4})"
_SHORT_DATE_EXPR = r"(\d{1,2})(?:/|-|\s+)([a-z]{3}|\d{1,2})\.?(?:(?:/|-|\s+)\d{4}|/\d{2})?"
_DATE_EXPRESSIONS = (_NUMERIC_DATE_EXPR, _NAMED_DATE_EXPR)

_DUE_DATE = tuple(
    re.compile(prefix + expression)
    for expression in _DATE_EXPRESSIONS
    for prefix in (
        r"(?:data\s+d[eo]\s+vencimento|vencimento(?:\s+da\s+fatura)?|vence\s+em)\s*:?\s*",
        r"\bfatura\s+",
    )
)
_PERIOD = re.compile(
    rf"(?:transacoes\s+de|lancamentos\s+de|periodo(?:\s+vigente|\s+de\s+referencia)?\s*:?\s*(?:de\s+)?)"
    rf"\s*{_SHORT_DATE_EXPR}\s*(?:a|ate|-)\s*{_SHORT_DATE_EXPR}"
)
_FULL_DATES = tuple(re.compile(rf"\b{expression}\b") for expression in _DATE_EXPRESSIONS)

_CARD_SIGNALS = tuple(
    re.compile(pattern)
    for pattern in (
        r"pagamento\s+minimo",
        r"total\s+(?:da|desta)\s+fatura",
        r"vencimento\s+da\s+fatura|data\s+d[eo]\s+vencimento",
        r"limite\s+(?:total|de\s+credito|disponivel\s+para\s+compras)",
        r"melhor\s+dia\s+(?:de|para)\s+compra|fechamento\s+da\s+fatura",
        r"resumo\s+da\s+fatura|fatura\s+do\s+cartao",
    )
)
_STATEMENT_SIGNALS = tuple(
    re.compile(pattern)
    for pattern in (
        r"\bextrato\b",
        r"saldo\s+anterior",
        r"conta\s+corrente|conta\s+pagamento|conta\s+poupanca",
        r"\bag(?:encia)?\b\.?\s*:?\s*\d",
        r"saldo\s+(?:do\s+dia|final|em\s+conta|disponivel)",
    )
)
_INVOICE_LINE = re.compile(
    rf"^\d{{1,2}}[\s.,]*([a-z]{{3}})\.?\s+.+\s+[{MINUS_CLASS}]?\s*r\$\s*\d"
)
_INTACT_MASK = re.compile(r"[•·∙●*]{2,}\s*(\d{4})\b")
_AFTER_DATE_DIGITS = re.compile(r"^\d{1,2}[\s.,]*([a-z]{3})\.?\s+(?:[^\w\s]|[eoc¢°®©])*\s*(\d{4})\s+\S")


@dataclass(frozen=True)
class DocumentProfile:
    kind: DocumentKind
    reference: date
    period_months: tuple[int, int] | None
    card_last4: frozenset[str]

    def year_for(self, month: int) -> int:
        reference_year, reference_month = self.reference.year, self.reference.month

        if self.period_months:
            start_month, end_month = self.period_months
            end_year = reference_year - 1 if end_month > reference_month else reference_year
            start_year = end_year - 1 if start_month > end_month else end_year
            if start_year != end_year and month >= start_month:
                return start_year
            return end_year

        return reference_year - 1 if month > reference_month else reference_year


def _month_part(raw: str) -> int | None:
    if raw.isdigit():
        value = int(raw)
        return value if 1 <= value <= 12 else None
    return month_from(raw)


def _as_date(day: str, month: str, year: str) -> date | None:
    month_number = _month_part(month)
    if month_number is None:
        return None
    try:
        return date(int(year), month_number, int(day))
    except ValueError:
        return None


def _due_date(text: str) -> date | None:
    for pattern in _DUE_DATE:
        for match in pattern.finditer(text):
            parsed = _as_date(match[1], match[2], match[3])
            if parsed:
                return parsed
    return None


def _latest_date(text: str, today: date) -> date | None:
    limit = today + timedelta(days=366)
    found = [
        parsed
        for pattern in _FULL_DATES
        for match in pattern.finditer(text)
        if (parsed := _as_date(match[1], match[2], match[3])) and parsed <= limit
    ]
    return max(found) if found else None


def _period_months(text: str) -> tuple[int, int] | None:
    match = _PERIOD.search(text)
    if not match:
        return None
    start, end = _month_part(match[2]), _month_part(match[4])
    return (start, end) if start and end else None


def _collect_card_last4(lines: Sequence[str]) -> frozenset[str]:
    found = {match[1] for line in lines for match in _INTACT_MASK.finditer(line)}
    repeated = Counter(
        match[2]
        for line in lines
        if (match := _AFTER_DATE_DIGITS.match(normalize_key(line))) and month_from(match[1])
    )
    found.update(digits for digits, count in repeated.items() if count >= 3)
    return frozenset(found)


def _detect_kind(text: str, lines: Sequence[str]) -> DocumentKind:
    card_score = sum(1 for pattern in _CARD_SIGNALS if pattern.search(text))
    statement_score = sum(1 for pattern in _STATEMENT_SIGNALS if pattern.search(text))
    invoice_lines = sum(
        1
        for line in lines
        if (match := _INVOICE_LINE.match(normalize_key(line))) and month_from(match[1])
    )
    masks = sum(len(_INTACT_MASK.findall(line)) for line in lines)
    strong = invoice_lines >= 3 or masks >= 3

    if (strong and card_score >= statement_score) or (card_score >= 2 and card_score > statement_score):
        return DocumentKind.CARD_INVOICE
    return DocumentKind.BANK_STATEMENT


def build_profile(lines: Sequence[str], today: date | None = None) -> DocumentProfile:
    today = today or date.today()
    text = normalize_key("\n".join(lines))
    kind = _detect_kind(text, lines)

    due = _due_date(text) if kind is DocumentKind.CARD_INVOICE else None
    reference = due or _latest_date(text, today) or today

    return DocumentProfile(
        kind=kind,
        reference=reference,
        period_months=_period_months(text),
        card_last4=_collect_card_last4(lines) if kind is DocumentKind.CARD_INVOICE else frozenset(),
    )
