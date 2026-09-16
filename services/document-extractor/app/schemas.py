from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.parsing.models import ParsedTransaction
from app.pipeline import ExtractionReport


class TransactionPayload(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    date: str
    description: str
    value: float
    type: Literal["income", "expense"]
    payment_method: Literal["debit", "credit"] | None = None
    installments: int | None = None
    installment_number: int | None = None
    card_last4: str | None = None

    @classmethod
    def from_transaction(cls, transaction: ParsedTransaction) -> "TransactionPayload":
        return cls(
            id=transaction.id,
            date=transaction.date.isoformat(),
            description=transaction.description[:300],
            value=float(transaction.value),
            type=transaction.type,
            payment_method=transaction.payment_method,
            installments=transaction.installments,
            installment_number=transaction.installment_number,
            card_last4=transaction.card_last4,
        )


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class DiagnosticsPayload(_CamelModel):
    strategy: Literal["columns", "lines", "ofx"]
    total_lines: int
    candidate_lines: int
    matched_lines: int
    skipped_lines: int
    transactions: int


class ExtractionPayload(_CamelModel):
    source: Literal["pdf_native", "pdf_ocr", "image_ocr", "ofx"]
    document_kind: Literal["card_invoice", "bank_statement"]
    pages: int
    characters: int
    lines: int
    transactions: list[TransactionPayload]
    diagnostics: DiagnosticsPayload
    warnings: list[str]


def build_payload(report: ExtractionReport) -> dict:
    document, outcome = report.document, report.outcome
    diagnostics = outcome.diagnostics

    payload = ExtractionPayload(
        source=document.source.value,
        document_kind=diagnostics.document_kind.value,
        pages=document.total_pages,
        characters=document.characters,
        lines=document.line_count,
        transactions=[TransactionPayload.from_transaction(item) for item in outcome.transactions],
        diagnostics=DiagnosticsPayload(
            strategy=diagnostics.strategy.value,
            total_lines=diagnostics.total_lines,
            candidate_lines=diagnostics.candidate_lines,
            matched_lines=diagnostics.matched_lines,
            skipped_lines=diagnostics.skipped_lines,
            transactions=len(outcome.transactions),
        ),
        warnings=list(document.warnings),
    )
    return payload.model_dump(mode="json", by_alias=True, exclude_none=True)
