import html
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from app.errors import DocumentError
from app.extractors.base import DocumentExtractor, DocumentSource, ExtractedDocument
from app.parsing.descriptions import card_description, statement_description
from app.parsing.models import (
    CREDIT,
    DEBIT,
    EXPENSE,
    INCOME,
    DocumentKind,
    ParseDiagnostics,
    ParsedTransaction,
    ParseOutcome,
    ParseStrategy,
    transaction_id,
)
from app.parsing.tokens import CENT

_TAG = re.compile(r"<(/?)([A-Za-z0-9_.]+)>([^<]*)")
_XML_ENCODING = re.compile(rb"<\?xml[^>]*encoding=[\"']([A-Za-z0-9_\-]+)[\"']", re.IGNORECASE)
_SGML_CHARSET = re.compile(rb"CHARSET:\s*([A-Za-z0-9_\-]+)", re.IGNORECASE)
_SGML_ENCODING = re.compile(rb"ENCODING:\s*([A-Za-z0-9_\-]+)", re.IGNORECASE)
_POSTED_DATE = re.compile(r"^(\d{4})(\d{2})(\d{2})")
_DEBIT_TYPES = frozenset({"DEBIT", "PAYMENT", "FEE", "SRVCHG", "ATM", "POS", "CHECK", "DIRECTDEBIT", "CASH"})


@dataclass
class _Node:
    name: str
    text: str | None = None
    children: list["_Node"] = field(default_factory=list)

    def walk(self) -> Iterator["_Node"]:
        yield self
        for child in self.children:
            yield from child.walk()

    def find(self, name: str) -> "_Node | None":
        return next((node for node in self.walk() if node.name == name), None)

    def find_all(self, name: str) -> list["_Node"]:
        return [node for node in self.walk() if node.name == name]

    def value(self, name: str) -> str | None:
        node = self.find(name)
        return node.text if node and node.text else None


def _decode(data: bytes) -> str:
    head = data[:1024]
    declared = _XML_ENCODING.search(head) or _SGML_CHARSET.search(head)
    candidates: list[str] = []

    if declared:
        label = declared[1].decode("ascii").lower()
        candidates.append("cp1252" if label in {"1252", "iso-8859-1", "latin1", "latin-1"} else label)
    elif (encoding := _SGML_ENCODING.search(head)) and encoding[1].decode("ascii").upper().startswith("UTF"):
        candidates.append("utf-8")

    candidates.extend(("utf-8", "cp1252"))

    for encoding in candidates:
        try:
            return data.decode(encoding).lstrip("\ufeff")
        except (LookupError, UnicodeDecodeError):
            continue
    return data.decode("cp1252", errors="replace")


def _parse_tree(body: str) -> _Node:
    root = _Node("ROOT")
    stack = [root]

    for closing, raw_name, raw_text in _TAG.findall(body):
        name = raw_name.upper()
        if closing:
            for depth in range(len(stack) - 1, 0, -1):
                if stack[depth].name == name:
                    del stack[depth:]
                    break
            continue

        text = html.unescape(raw_text).strip()
        node = _Node(name, text or None)
        stack[-1].children.append(node)
        if not text:
            stack.append(node)

    return root


def _amount(raw: str | None) -> Decimal | None:
    if not raw:
        return None
    cleaned = raw.strip().replace(" ", "")
    if "," in cleaned and "." in cleaned:
        decimal_separator = "," if cleaned.rfind(",") > cleaned.rfind(".") else "."
        thousands = "." if decimal_separator == "," else ","
        cleaned = cleaned.replace(thousands, "").replace(decimal_separator, ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        return Decimal(cleaned).quantize(CENT, ROUND_HALF_UP)
    except InvalidOperation:
        return None


def _posted(raw: str | None) -> date | None:
    match = _POSTED_DATE.match(raw or "")
    if not match:
        return None
    try:
        return date(int(match[1]), int(match[2]), int(match[3]))
    except ValueError:
        return None


def _raw_description(entry: _Node) -> str:
    name = (entry.value("NAME") or "").strip()
    memo = (entry.value("MEMO") or "").strip()
    if name and memo and name.lower() not in memo.lower() and memo.lower() not in name.lower():
        return f"{name} {memo}"
    return memo or name


class OfxExtractor(DocumentExtractor):
    def extract(self, data: bytes) -> ExtractedDocument:
        text = _decode(data)
        start = text.upper().find("<OFX>")
        if start < 0:
            raise DocumentError("OFX_INVALID", "O arquivo OFX não possui o bloco <OFX>.", 422)

        root = _parse_tree(text[start:])
        entries = root.find_all("STMTTRN")
        if root.find("STMTRS") is None and root.find("CCSTMTRS") is None:
            raise DocumentError("OFX_INVALID", "O arquivo OFX não contém um extrato.", 422)

        kind = DocumentKind.CARD_INVOICE if root.find("CCSTMTRS") is not None else DocumentKind.BANK_STATEMENT
        outcome = self._outcome(root, entries, kind, text.count("\n") + 1)

        return ExtractedDocument(
            source=DocumentSource.OFX,
            total_pages=1,
            structured=outcome,
            characters=len(text),
            line_count=outcome.diagnostics.total_lines,
        )

    def _outcome(self, root: _Node, entries: list[_Node], kind: DocumentKind, total_lines: int) -> ParseOutcome:
        account = root.find("CCACCTFROM")
        account_digits = re.sub(r"\D", "", (account.value("ACCTID") or "") if account else "")
        account_last4 = account_digits[-4:] if len(account_digits) >= 4 else None

        parsed = [(entry, _amount(entry.value("TRNAMT")), _posted(entry.value("DTPOSTED"))) for entry in entries]
        unsigned = all(amount is None or amount >= 0 for _, amount, _ in parsed)

        transactions: list[ParsedTransaction] = []
        seen: set[tuple[str, date, Decimal, str]] = set()
        skipped = 0

        for entry, amount, posted in parsed:
            raw = _raw_description(entry)
            if amount is None or amount == 0 or posted is None or not raw:
                skipped += 1
                continue
            fit_id = entry.value("FITID")
            identity = (fit_id, posted, amount, raw) if fit_id else None
            if identity and identity in seen:
                skipped += 1
                continue
            if identity:
                seen.add(identity)

            transaction_type = self._type(amount, (entry.value("TRNTYPE") or "").upper(), unsigned)
            index = len(transactions) + 1

            if kind is DocumentKind.CARD_INVOICE:
                card = card_description(raw, frozenset({account_last4} if account_last4 else ()))
                if len(card.text) < 2:
                    skipped += 1
                    continue
                transactions.append(
                    ParsedTransaction(
                        id=transaction_id(posted, index),
                        date=posted,
                        description=card.text,
                        value=abs(amount),
                        type=transaction_type,
                        payment_method=CREDIT,
                        installments=card.installments,
                        installment_number=card.installment_number,
                        card_last4=card.card_last4 or account_last4,
                    )
                )
                continue

            description = statement_description(raw)
            if len(description) < 2:
                skipped += 1
                continue
            transactions.append(
                ParsedTransaction(
                    id=transaction_id(posted, index),
                    date=posted,
                    description=description,
                    value=abs(amount),
                    type=transaction_type,
                    payment_method=DEBIT if transaction_type == EXPENSE else None,
                )
            )

        diagnostics = ParseDiagnostics(
            document_kind=kind,
            strategy=ParseStrategy.OFX,
            total_lines=total_lines,
            candidate_lines=len(entries),
            matched_lines=len(transactions),
            skipped_lines=skipped,
        )
        return ParseOutcome(tuple(transactions), diagnostics)

    @staticmethod
    def _type(amount: Decimal, transaction_type: str, unsigned: bool) -> str:
        if unsigned:
            return EXPENSE if transaction_type in _DEBIT_TYPES else INCOME
        return EXPENSE if amount < 0 else INCOME
