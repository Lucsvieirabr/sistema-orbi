import re
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from datetime import date

from app.extractors.base import ExtractedDocument
from app.layout import TextLine, Word
from app.parsing.descriptions import card_description, is_non_transaction, statement_description
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
from app.parsing.profile import DocumentProfile, build_profile
from app.parsing.tokens import SEPARATORS, AmountToken, DateToken, is_time, normalize_key, read_amounts, read_date

ROLE_DATE = "date"
ROLE_DESCRIPTION = "description"
ROLE_DOCUMENT = "document"
ROLE_AMOUNT = "amount"
ROLE_DEBIT = "debit"
ROLE_CREDIT = "credit"
ROLE_BALANCE = "balance"

NUMERIC_ROLES = frozenset({ROLE_AMOUNT, ROLE_DEBIT, ROLE_CREDIT, ROLE_BALANCE})
VALUE_ROLES = frozenset({ROLE_AMOUNT, ROLE_DEBIT, ROLE_CREDIT})
EXCLUDED_FROM_DESCRIPTION = frozenset({ROLE_DATE, ROLE_DOCUMENT})

HEADER_ROLES: dict[str, str] = {
    **dict.fromkeys(("data", "dt", "date", "dia"), ROLE_DATE),
    **dict.fromkeys(
        (
            "historico", "descricao", "lancamento", "lancamentos", "detalhes", "detalhe",
            "movimentacao", "movimentacoes", "transacao", "transacoes", "estabelecimento",
        ),
        ROLE_DESCRIPTION,
    ),
    **dict.fromkeys(("documento", "doc", "docto", "dcto", "nr"), ROLE_DOCUMENT),
    **dict.fromkeys(("debito", "debitos", "saida", "saidas"), ROLE_DEBIT),
    **dict.fromkeys(("credito", "creditos", "entrada", "entradas"), ROLE_CREDIT),
    **dict.fromkeys(("valor", "valores", "montante", "quantia", "amount", "value"), ROLE_AMOUNT),
    **dict.fromkeys(("saldo", "saldos", "balance"), ROLE_BALANCE),
}

_STATEMENT_INCOME = re.compile(
    r"\b(?:recebid[oa]s?|recebimento|credito|cred|deposito|salario|rendimentos?|estorno|resgate|"
    r"devolucao|reembolso|proventos?|dividendos?)\b"
)
_CARD_INCOME = re.compile(
    r"^(?:pagamento\s+(?:recebido|efetuado)|estorno|credito\s+de|devolucao|reembolso)"
)
_HEADER_PUNCTUATION = "().:/*"
_REFERENCE_NUMBER = re.compile(r"^[\d./-]+$")
_MAX_CONTINUATION_LINES = 2


@dataclass(frozen=True)
class _Column:
    role: str
    x0: float
    x1: float

    def distance(self, x: float) -> float:
        if self.x0 <= x <= self.x1:
            return 0.0
        return min(abs(x - self.x0), abs(x - self.x1))


@dataclass(frozen=True)
class _Header:
    columns: tuple[_Column, ...]

    def role_at(self, x: float, roles: frozenset[str]) -> str | None:
        candidates = [column for column in self.columns if column.role in roles]
        if not candidates:
            return None
        return min(candidates, key=lambda column: column.distance(x)).role

    def covers(self, word: Word, roles: frozenset[str]) -> bool:
        center = (word.x0 + word.x1) / 2
        return any(
            column.x0 - word.height <= center <= column.x1 + word.height
            for column in self.columns
            if column.role in roles
        )

    @property
    def has_value_columns(self) -> bool:
        return any(column.role in VALUE_ROLES for column in self.columns)


@dataclass(frozen=True)
class _Row:
    page: int
    words: tuple[Word, ...]
    date: DateToken | None
    amounts: tuple[AmountToken, ...]

    @property
    def line(self) -> TextLine:
        return TextLine(self.words)


@dataclass
class _Pending:
    date: date
    texts: list[str]
    page: int
    bottom: float


@dataclass
class _Draft:
    date: date
    texts: list[str]
    amount: AmountToken
    role: str | None
    page: int
    bottom: float
    description_x0: float
    continuations: int = 0


@dataclass
class _Collected:
    drafts: list[_Draft] = field(default_factory=list)
    skipped: int = 0
    header_found: bool = False


def _header_key(text: str) -> str:
    return normalize_key(text).strip(_HEADER_PUNCTUATION)


def _detect_header(row: _Row) -> _Header | None:
    if row.date or row.amounts:
        return None

    columns: list[_Column] = []
    for word in row.words:
        role = HEADER_ROLES.get(_header_key(word.text))
        near_previous = bool(columns) and word.x0 - columns[-1].x1 <= word.height * 2
        if role and not (near_previous and columns[-1].role == role):
            columns.append(_Column(role, word.x0, word.x1))
        elif near_previous:
            columns[-1] = _Column(columns[-1].role, columns[-1].x0, word.x1)

    roles = {column.role for column in columns}
    if ROLE_DATE in roles and roles & VALUE_ROLES and len(columns) >= 3:
        return _Header(tuple(columns))
    return None


def _split_segments(words: tuple[Word, ...]) -> Iterator[tuple[Word, ...]]:
    texts = [word.text for word in words]
    cuts = [0]
    for amount in read_amounts(words):
        index = amount.end
        while index < len(words) and texts[index] in SEPARATORS:
            index += 1
        if 0 < index < len(words) and index > cuts[-1] and read_date(texts, index):
            cuts.append(index)
    cuts.append(len(words))
    for start, end in zip(cuts, cuts[1:]):
        if end > start:
            yield words[start:end]


def _rows(document: ExtractedDocument) -> Iterator[_Row]:
    for page in document.pages:
        for line in page.lines:
            for segment in _split_segments(line.words):
                texts = [word.text for word in segment]
                date_token = read_date(texts)
                amounts = read_amounts(segment)
                if date_token:
                    amounts = [amount for amount in amounts if amount.start >= date_token.size]
                yield _Row(page.number, segment, date_token, tuple(amounts))


def _vertically_close(page: int, bottom: float, row: _Row) -> bool:
    line = row.line
    return page == row.page and -line.height * 0.5 <= line.top - bottom <= line.height * 1.2


class StatementParser:
    def parse(self, document: ExtractedDocument, today: date | None = None) -> ParseOutcome:
        texts = [line.text for page in document.pages for line in page.lines]
        profile = build_profile(texts, today)
        rows = list(_rows(document))
        collected = self._collect(rows, profile)

        explicit_debits = any(draft.amount.marker in ("minus", "debit") for draft in collected.drafts)
        transactions: list[ParsedTransaction] = []
        skipped = collected.skipped

        for draft in collected.drafts:
            transaction = self._finalize(draft, profile, explicit_debits, len(transactions) + 1)
            if transaction:
                transactions.append(transaction)
            else:
                skipped += 1

        diagnostics = ParseDiagnostics(
            document_kind=profile.kind,
            strategy=ParseStrategy.COLUMNS if collected.header_found else ParseStrategy.LINES,
            total_lines=len(texts),
            candidate_lines=sum(1 for row in rows if row.date),
            matched_lines=len(collected.drafts),
            skipped_lines=skipped,
        )
        return ParseOutcome(tuple(transactions), diagnostics)

    def _collect(self, rows: Sequence[_Row], profile: DocumentProfile) -> _Collected:
        collected = _Collected()
        header: _Header | None = None
        last_date: date | None = None
        pending: _Pending | None = None
        amount_edges: list[float] = []

        for row in rows:
            detected = _detect_header(row)
            if detected:
                header = detected
                collected.header_found = True
                pending = None
                continue

            if row.date:
                resolved = row.date.resolve(profile.year_for)
                if resolved is None:
                    collected.skipped += 1
                    continue
                last_date = resolved
                body = self._description_texts(row, row.date.size, header)
                if not row.amounts:
                    pending = _Pending(resolved, body, row.page, row.line.bottom)
                    continue
                draft = self._draft(row, resolved, body, header, profile)
                pending = None
            elif row.amounts:
                prefix: list[str] = []
                if pending and _vertically_close(pending.page, pending.bottom, row):
                    draft_date, prefix = pending.date, pending.texts
                elif (
                    profile.kind is DocumentKind.BANK_STATEMENT
                    and last_date is not None
                    and self._aligned(row, amount_edges)
                ):
                    draft_date = last_date
                else:
                    collected.skipped += 1
                    pending = None
                    continue
                body = prefix + self._description_texts(row, 0, header)
                draft = self._draft(row, draft_date, body, header, profile)
                pending = None
            else:
                if pending and _vertically_close(pending.page, pending.bottom, row):
                    pending.texts.extend(word.text for word in row.words)
                    pending.bottom = row.line.bottom
                elif collected.drafts:
                    self._append_continuation(collected.drafts[-1], row)
                continue

            if draft is None:
                collected.skipped += 1
                continue

            collected.drafts.append(draft)
            amount_edges.append(draft.amount.x1)

        return collected

    def _description_texts(self, row: _Row, start: int, header: _Header | None) -> list[str]:
        end = row.amounts[0].start if row.amounts else len(row.words)
        texts = [
            word.text
            for word in row.words[start:end]
            if not (header and _REFERENCE_NUMBER.match(word.text) and header.covers(word, EXCLUDED_FROM_DESCRIPTION))
        ]

        while texts and (is_time(texts[0]) or texts[0] in SEPARATORS):
            texts.pop(0)
        if header is None and len(texts) > 1 and texts[0].isdigit() and len(texts[0]) >= 3:
            texts.pop(0)
            while texts and (is_time(texts[0]) or texts[0] in SEPARATORS):
                texts.pop(0)
        return texts

    def _draft(
        self,
        row: _Row,
        draft_date: date,
        texts: list[str],
        header: _Header | None,
        profile: DocumentProfile,
    ) -> _Draft | None:
        chosen = self._choose_amount(row.amounts, header, profile)
        if chosen is None:
            return None

        amount, role = chosen
        description_start = row.date.size if row.date else 0
        anchor = row.words[description_start] if description_start < len(row.words) else row.words[0]

        return _Draft(
            date=draft_date,
            texts=list(texts),
            amount=amount,
            role=role,
            page=row.page,
            bottom=row.line.bottom,
            description_x0=anchor.x0,
        )

    def _choose_amount(
        self,
        amounts: Sequence[AmountToken],
        header: _Header | None,
        profile: DocumentProfile,
    ) -> tuple[AmountToken, str | None] | None:
        if not amounts:
            return None

        if header and header.has_value_columns:
            assigned = [(amount, header.role_at(amount.center, NUMERIC_ROLES)) for amount in amounts]
            values = [(amount, role) for amount, role in assigned if role in VALUE_ROLES]
            if values:
                return values[0]
            if all(role == ROLE_BALANCE for _, role in assigned):
                return None

        if profile.kind is DocumentKind.CARD_INVOICE:
            return amounts[-1], None
        if len(amounts) <= 2:
            return amounts[0], None
        return amounts[-2], None

    def _aligned(self, row: _Row, edges: Sequence[float]) -> bool:
        if not edges:
            return False
        tolerance = row.line.char_width * 3
        return any(
            abs(amount.x1 - edge) <= tolerance for amount in row.amounts for edge in edges[-30:]
        )

    def _append_continuation(self, draft: _Draft, row: _Row) -> None:
        line = row.line
        if draft.continuations >= _MAX_CONTINUATION_LINES:
            return
        if not _vertically_close(draft.page, draft.bottom, row):
            return
        if line.x0 < draft.description_x0 - line.char_width * 1.5:
            return
        if line.x1 >= draft.amount.x0:
            return
        if is_non_transaction(line.text):
            return
        draft.texts.extend(word.text for word in row.words)
        draft.bottom = line.bottom
        draft.continuations += 1

    def _finalize(
        self,
        draft: _Draft,
        profile: DocumentProfile,
        explicit_debits: bool,
        index: int,
    ) -> ParsedTransaction | None:
        raw = " ".join(draft.texts).strip()
        if not raw or is_non_transaction(raw) or draft.amount.value <= 0:
            return None

        if profile.kind is DocumentKind.CARD_INVOICE:
            card = card_description(raw, profile.card_last4)
            if len(card.text) < 2 or is_non_transaction(card.text):
                return None
            income = draft.amount.marker in ("minus", "credit") or (
                draft.amount.marker is None and bool(_CARD_INCOME.search(normalize_key(card.text)))
            )
            return ParsedTransaction(
                id=transaction_id(draft.date, index),
                date=draft.date,
                description=card.text,
                value=draft.amount.value,
                type=INCOME if income else EXPENSE,
                payment_method=CREDIT,
                installments=card.installments,
                installment_number=card.installment_number,
                card_last4=card.card_last4,
            )

        description = statement_description(raw)
        if len(description) < 2 or is_non_transaction(description):
            return None

        kind = self._statement_type(draft, description, explicit_debits)
        return ParsedTransaction(
            id=transaction_id(draft.date, index),
            date=draft.date,
            description=description,
            value=draft.amount.value,
            type=kind,
            payment_method=DEBIT if kind == EXPENSE else None,
        )

    def _statement_type(self, draft: _Draft, description: str, explicit_debits: bool) -> str:
        if draft.role == ROLE_DEBIT:
            return EXPENSE
        if draft.role == ROLE_CREDIT:
            return INCOME
        if draft.amount.marker in ("minus", "debit"):
            return EXPENSE
        if draft.amount.marker in ("plus", "credit"):
            return INCOME
        if explicit_debits:
            return INCOME
        return INCOME if _STATEMENT_INCOME.search(normalize_key(description)) else EXPENSE
