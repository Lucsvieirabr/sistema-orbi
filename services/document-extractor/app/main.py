import asyncio
import hmac
import logging
import time

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.config import Settings
from app.errors import DocumentError
from app.pipeline import ExtractionPipeline
from app.schemas import build_payload

logger = logging.getLogger("document_extractor")

_NO_STORE = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}


def _error_response(error: DocumentError) -> JSONResponse:
    return JSONResponse({"error": error.message, "code": error.code}, status_code=error.status, headers=_NO_STORE)


async def _read_body(request: Request, limit: int) -> bytes:
    too_large = DocumentError("FILE_TOO_LARGE", f"O arquivo excede {limit // (1024 * 1024)}MB.", 413)

    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > limit:
        raise too_large

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise too_large

    if not body:
        raise DocumentError("EMPTY_FILE", "O arquivo está vazio.", 400)
    return bytes(body)


def create_app(settings: Settings | None = None, pipeline: ExtractionPipeline | None = None) -> Starlette:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    settings = settings or Settings.from_env()
    pipeline = pipeline or ExtractionPipeline(settings)
    slots = asyncio.Semaphore(settings.max_concurrency)
    expected_authorization = f"Bearer {settings.service_token}".encode()

    async def health(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "ocr": pipeline.ocr_available}, headers=_NO_STORE)

    async def extract(request: Request) -> JSONResponse:
        provided = request.headers.get("authorization", "").encode()
        if not hmac.compare_digest(provided, expected_authorization):
            raise DocumentError("UNAUTHORIZED", "Não autorizado.", 401)

        data = await _read_body(request, settings.max_bytes)
        started = time.perf_counter()

        async with slots:
            report = await run_in_threadpool(pipeline.run, data)

        logger.info(
            "extração concluída source=%s kind=%s pages=%s transactions=%s skipped=%s duration_ms=%d",
            report.document.source.value,
            report.outcome.diagnostics.document_kind.value,
            report.document.total_pages,
            len(report.outcome.transactions),
            report.outcome.diagnostics.skipped_lines,
            (time.perf_counter() - started) * 1000,
        )
        return JSONResponse(build_payload(report), headers=_NO_STORE)

    async def handle_document_error(_: Request, error: DocumentError) -> JSONResponse:
        if error.status >= 500:
            logger.error("falha de extração code=%s", error.code)
        return _error_response(error)

    async def handle_unexpected_error(_: Request, error: Exception) -> JSONResponse:
        logger.error("falha inesperada na extração", exc_info=error)
        return _error_response(DocumentError("INTERNAL_ERROR", "Erro interno do extrator.", 500))

    return Starlette(
        routes=[
            Route("/health", health, methods=["GET"]),
            Route("/v1/extract", extract, methods=["POST"]),
        ],
        exception_handlers={
            DocumentError: handle_document_error,
            Exception: handle_unexpected_error,
        },
    )
