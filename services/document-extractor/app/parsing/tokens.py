import re
import unicodedata
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from app.layout import Word

MINUS_CHARS = "-−–—"
MINUS_CLASS = r"\-−–—"
CENT = Decimal("0.01")

MONTH_ABBREVIATIONS: dict[str, int] = {
    "jan": 1, "fev": 2, "feb": 2, "mar": 3, "abr": 4, "apr": 4, "mai": 5, "may": 5,
    "jun": 6, "jul": 7, "ago": 8, "aug": 8, "set": 9, "sep": 9, "out": 10, "oct": 10,
    "nov": 11, "dez": 12, "dec": 12,
}
MONTH_NAMES: dict[str, int] = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}

SEPARATORS = frozenset({"-", "–", "—", "|", "•", "·"})

_NUMERIC_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?$")
_DOTTED_DATE = re.compile(r"^(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})$")
_ISO_DATE = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")
_SLASH_MONTH_DATE = re.compile(r"^(\d{1,2})[/\-]([A-Za-z]{3})(?:[/\-](\d{4}|\d{2}))?$")
_GLUED_DAY_MONTH = re.compile(r"^([0-9Oo]{1,2})[.,]?([A-Za-z]{3})\.?$")
_DAY = re.compile(r"^([0-9Oo]{1,2})[.,]?$")
_YEAR = re.compile(r"^(\d{4})$")
_TIME = re.compile(r"^\d{1,2}:\d{2}(?::\d{2})?$")
_AMOUNT = re.compile(
    rf"^(?P<open>\()?(?P<lead>[+{MINUS_CLASS}])?(?:R\$)?(?P<inner>[+{MINUS_CLASS}])?"
    rf"(?P<number>\d{{1,3}}(?:\.\d{{3}})+,\d{{2}}|\d+,\d{{2}})"
    rf"(?P<trail>[+{MINUS_CLASS}])?(?P<close>\))?(?P<dc>[CD])?$"
)
_SIGNED_CURRENCY = re.compile(rf"^([+{MINUS_CLASS}])R\$$")
_SIGN_WORDS = {"+": "plus", "(+)": "plus", "(-)": "minus", **{char: "minus" for char in MINUS_CHARS}}
_DC_WORDS = {"D": "debit", "C": "credit"}


def fold(text: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", text) if not unicodedata.combining(char)
    )


def normalize_key(text: str) -> str:
    return fold(text).lower().strip()


def month_from(token: str) -> int | None:
    cleaned = normalize_key(token).strip(".,")
    if len(cleaned) == 3:
        return MONTH_ABBREVIATIONS.get(cleaned)
    return MONTH_NAMES.get(cleaned)


def is_time(text: str) -> bool:
    return bool(_TIME.match(text))


def to_decimal(number: str) -> Decimal:
    return Decimal(number.replace(".", "").replace(",", ".")).quantize(CENT, ROUND_HALF_UP)


@dataclass(frozen=True)
class DateToken:
    day: int
    month: int
    year: int | None
    size: int

    def resolve(self, year_for: Callable[[int], int]) -> date | None:
        year = self.year if self.year is not None else year_for(self.month)
        try:
            return date(year, self.month, self.day)
        except ValueError:
            return None


def _full_year(raw: str | None) -> int | None:
    if raw is None:
        return None
    value = int(raw)
    return value + 2000 if value < 100 else value


def _ocr_digits(raw: str) -> int:
    return int(raw.replace("O", "0").replace("o", "0"))


def _date_token(day: int, month: int, year: int | None, size: int) -> DateToken | None:
    if not (1 <= day <= 31 and 1 <= month <= 12):
        return None
    if year is not None and not (1990 <= year <= 2100):
        return None
    return DateToken(day, month, year, size)


def _with_optional_year(day: int, month: int, size: int, texts: Sequence[str], start: int) -> DateToken | None:
    index = start + size
    if index < len(texts):
        match = _YEAR.match(texts[index])
        if match:
            token = _date_token(day, month, int(match[1]), size + 1)
            if token:
                return token
    return _date_token(day, month, None, size)


def read_date(texts: Sequence[str], start: int = 0) -> DateToken | None:
    if start >= len(texts):
        return None

    first = texts[start]

    if match := _NUMERIC_DATE.match(first):
        return _date_token(int(match[1]), int(match[2]), _full_year(match[3]), 1)
    if match := _DOTTED_DATE.match(first):
        return _date_token(int(match[1]), int(match[2]), int(match[3]), 1)
    if match := _ISO_DATE.match(first):
        return _date_token(int(match[3]), int(match[2]), int(match[1]), 1)
    if (match := _SLASH_MONTH_DATE.match(first)) and (month := month_from(match[2])):
        return _date_token(int(match[1]), month, _full_year(match[3]), 1)
    if (match := _GLUED_DAY_MONTH.match(first)) and (month := month_from(match[2])):
        return _with_optional_year(_ocr_digits(match[1]), month, 1, texts, start)

    following = texts[start + 1] if start + 1 < len(texts) else None
    if following is not None and (match := _DAY.match(first)) and (month := month_from(following)):
        return _with_optional_year(_ocr_digits(match[1]), month, 2, texts, start)

    return None


@dataclass(frozen=True)
class AmountToken:
    value: Decimal
    marker: str | None
    start: int
    end: int
    x0: float
    x1: float

    @property
    def center(self) -> float:
        return (self.x0 + self.x1) / 2


def _marker_of(match: re.Match[str]) -> str | None:
    if match["open"] and match["close"]:
        return "minus"
    for group in ("lead", "inner", "trail"):
        symbol = match[group]
        if symbol:
            return "plus" if symbol == "+" else "minus"
    if match["dc"]:
        return _DC_WORDS[match["dc"]]
    return None


def _touching(left: Word, right: Word) -> bool:
    return right.x0 - left.x1 <= max(left.height, right.height) * 0.8


def read_amounts(words: Sequence[Word]) -> list[AmountToken]:
    tokens: list[AmountToken] = []
    floor = 0
    index = 0

    while index < len(words):
        match = _AMOUNT.match(words[index].text)
        if not match:
            index += 1
            continue

        marker = _marker_of(match)
        start, end = index, index + 1

        if start > floor:
            previous = words[start - 1].text
            signed = _SIGNED_CURRENCY.match(previous)
            if previous == "R$":
                start -= 1
            elif signed:
                start -= 1
                marker = marker or ("plus" if signed[1] == "+" else "minus")

        if start > floor and marker is None:
            previous = words[start - 1]
            if previous.text in _SIGN_WORDS and _touching(previous, words[start]):
                start -= 1
                marker = _SIGN_WORDS[previous.text]

        if end < len(words) and marker is None:
            following = words[end]
            if following.text in _DC_WORDS:
                marker = _DC_WORDS[following.text]
                end += 1
            elif following.text in _SIGN_WORDS and _touching(words[end - 1], following):
                marker = _SIGN_WORDS[following.text]
                end += 1

        tokens.append(
            AmountToken(
                value=to_decimal(match["number"]),
                marker=marker,
                start=start,
                end=end,
                x0=words[start].x0,
                x1=words[end - 1].x1,
            )
        )
        floor = end
        index = end

    return tokens
