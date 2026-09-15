import re
from collections.abc import Collection
from dataclasses import dataclass

from app.parsing.tokens import MINUS_CLASS, fold, normalize_key

_BANK_PREFIXES = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"^CARTAO\s+(?:DE\s+)?DEBITO\s*[-—]?\s*",
        r"^CARTAO\s+(?:DE\s+)?CREDITO\s*[-—]?\s*",
        r"^COMPRA\s+(?:COM\s+)?CARTAO(?:\s+(?:DE\s+)?(?:DEBITO|DEB|CREDITO|CRED)\b)?\s*[-—]?\s*",
        r"^PAGAMENTO\s+(?:COM\s+)?CARTAO\s*[-—]?\s*",
        r"^PIX\s+(?:RECEBIDO|ENVIADO|TRANSFERENCIA)\s*[-—]?\s*",
        r"^TED(?:INTERNET)?\b\s*[-—]?\s*",
        r"^DOC\b\s*[-—]?\s*",
        r"^TRANSFERENCIA\s+(?:ENVIADA|RECEBIDA)?\s*[-—]?\s*",
        r"^DEBITO\s+(?:AUTOMATICO|PRESTACAO|HAB)\s*[-—]?\s*",
        r"^DEB\s+AUT\s*[-—]?\s*",
        r"^PAGAMENTO\s+(?:DE\s+)?(?:BOLETO|CONTA|FATURA)\s*[-—]?\s*",
        r"^PAG\s+(?:BOLETO|BOL)\b\s*[-—]?\s*",
        r"^SUBADQ\s+",
    )
)
_BANK_SUFFIXES = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"(?:\s+|\s*-\s*)BR\s*-?\s*[A-Z]\s*$",
        r"\s+BR\s+R\s*$",
        r"\s*-\s*BRASIL\s*$",
        r"\s*-\s*BRA\s*$",
        r"\s*-\s*[A-Z]{2}\s*-\s*[A-Z]{1,2}\s*$",
    )
)
_INNER_SUBADQ = re.compile(r"\s*-\s*SUBADQ\s+", re.IGNORECASE)
_MASKED_DOCUMENT = re.compile(r"[-—]\s*[*\d,./]{5,}")
_STARRED_DOCUMENT = re.compile(r"\*{3,}[\d,./]+\*{3,}")
_GLUED_DASH = re.compile(r"[-—]([A-Z])")
_NON_WORD = re.compile(r"[^A-Za-z0-9_\s\-/]")
_SPACES = re.compile(r"\s+")

_CARD_MASK = re.compile(r"(?:[•·∙●*]{2,}|\.{3,})\s*(\d{3,4})\b")
_DEGRADED_MASK = re.compile(r"^(?:[^\w\s]|[eoOc¢°®©])*\s*(\d{4})\s+(?=\S)")
_LEADING_NOISE = re.compile(r'^[^\w"]+')
_CNPJ_PREFIX = re.compile(r"^\d{2}\.\d{3}\.\d{3}(?:/\d{4}-\d{2})?\s+")
_PARCELA_SUFFIX = re.compile(rf"\s*[{MINUS_CLASS}]?\s*parcela\s+(\d{{1,2}})\s*/\s*(\d{{1,2}})\s*$", re.IGNORECASE)
_PARC_SUFFIX = re.compile(r"\s+parc(?:ela)?\.?\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$", re.IGNORECASE)
_FRACTION_SUFFIX = re.compile(r"\s+(\d{1,2})/(\d{1,2})\s*$")
_TRAILING_DASH = re.compile(rf"\s*[{MINUS_CLASS}]\s*$")

_NON_TRANSACTION = tuple(
    re.compile(pattern)
    for pattern in (
        r"^total\b",
        r"^subtotal",
        r"^saldo\b",
        r"^s\s?a\s?l\s?d\s?o\b",
        r"^conversao\s*[:=]",
        r"^pagamentos?\s+e\s+financiamentos",
        r"^fatura\s+anterior",
        r"^pagamento\s+minimo",
        r"^limite\s+(?:total|dispon|adicional|utilizado|da\s+conta)",
        r"^iof\s+de\s+compras\s+internacionais",
        r"^encargos",
        r"^juros\s+(?:rotativo|de\s+parcelamento|e\s+mora)",
        r"^valor\s+(?:de\s+entrada|da\s+parcela|maximo|total)",
        r"^parcelar\s+em",
        r"^cet\b",
        r"^(?:brl|usd|eur)\s+[\d.,]+\s*=",
        r"^fechamento\s+da\s+proxima",
        r"^proximas\s+faturas",
        r"^resumo\b",
        r"^\d{1,3}\s+de\s+\d{1,3}$",
    )
)


def is_non_transaction(text: str) -> bool:
    key = normalize_key(text)
    return any(pattern.search(key) for pattern in _NON_TRANSACTION)


def _strip_bank_noise(text: str) -> str:
    cleaned = text
    for pattern in _BANK_PREFIXES:
        cleaned = pattern.sub("", cleaned, count=1)
    cleaned = _INNER_SUBADQ.sub(" ", cleaned, count=1)
    for pattern in _BANK_SUFFIXES:
        cleaned = pattern.sub("", cleaned, count=1)
    cleaned = _MASKED_DOCUMENT.sub(" ", cleaned)
    cleaned = _STARRED_DOCUMENT.sub(" ", cleaned)
    cleaned = cleaned.replace("$**", "")
    cleaned = _GLUED_DASH.sub(r" \1", cleaned)
    cleaned = _SPACES.sub(" ", cleaned)
    cleaned = re.sub(r"^[-—]\s*", "", cleaned)
    cleaned = re.sub(r"\s*[-—]$", "", cleaned)
    cleaned = re.sub(r"\s*-\s*", " ", cleaned)
    return cleaned.strip()


def _ascii_text(text: str) -> str:
    folded = fold(text.replace("�", ""))
    return _SPACES.sub(" ", _NON_WORD.sub(" ", folded)).strip()


def statement_description(raw: str) -> str:
    cleaned = _ascii_text(_strip_bank_noise(raw))
    return cleaned if len(cleaned) >= 3 else _ascii_text(raw)


@dataclass(frozen=True)
class CardDescription:
    text: str
    card_last4: str | None
    installments: int | None
    installment_number: int | None


def _installment(match: re.Match[str] | None) -> tuple[int, int] | None:
    if not match:
        return None
    current, total = int(match[1]), int(match[2])
    if 0 < current <= total and 1 < total <= 99:
        return current, total
    return None


def card_description(raw: str, known_last4: Collection[str]) -> CardDescription:
    description = _SPACES.sub(" ", raw).strip()
    card_last4: str | None = None

    mask = _CARD_MASK.search(description)
    if mask:
        card_last4 = mask[1] if len(mask[1]) == 4 else None
        description = _CARD_MASK.sub(" ", description)
    else:
        degraded = _DEGRADED_MASK.match(description)
        if degraded and degraded[1] in known_last4:
            card_last4 = degraded[1]
            description = description[degraded.end():]

    description = _LEADING_NOISE.sub("", description)
    description = _CNPJ_PREFIX.sub("", description)
    description = _SPACES.sub(" ", description).strip()

    installment = None
    for pattern in (_PARCELA_SUFFIX, _PARC_SUFFIX, _FRACTION_SUFFIX):
        match = pattern.search(description)
        installment = _installment(match)
        if installment:
            description = description[: match.start()].strip()
            break

    description = _TRAILING_DASH.sub("", description).strip()

    return CardDescription(
        text=description,
        card_last4=card_last4,
        installments=installment[1] if installment else None,
        installment_number=installment[0] if installment else None,
    )
