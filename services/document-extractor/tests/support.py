import shutil

from app.config import Settings
from app.pipeline import ExtractionPipeline

TEST_TOKEN = "t" * 40


def settings(**overrides) -> Settings:
    return Settings(service_token=TEST_TOKEN, **overrides)


def pipeline(**overrides) -> ExtractionPipeline:
    return ExtractionPipeline(settings(**overrides))


def tesseract_installed() -> bool:
    return shutil.which("tesseract") is not None


def summary(outcome) -> list[tuple[str, str, str, str]]:
    return [
        (item.date.isoformat(), item.description, f"{item.value:.2f}", item.type)
        for item in outcome.transactions
    ]
