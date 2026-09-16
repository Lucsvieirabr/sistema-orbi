import unittest

from starlette.testclient import TestClient

from app.main import create_app
from tests import builders
from tests.support import TEST_TOKEN, settings

AUTH = {"Authorization": f"Bearer {TEST_TOKEN}", "Content-Type": "application/octet-stream"}


class ApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(create_app(settings(max_bytes=512 * 1024)), raise_server_exceptions=False)

    def test_health(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(200, response.status_code)
        self.assertEqual("ok", response.json()["status"])

    def test_requires_service_token(self) -> None:
        response = self.client.post("/v1/extract", content=builders.SGML_OFX, headers={"Authorization": "Bearer errado"})
        self.assertEqual((401, "UNAUTHORIZED"), (response.status_code, response.json()["code"]))

    def test_rejects_large_body(self) -> None:
        response = self.client.post("/v1/extract", content=b"%PDF-" + b"0" * (600 * 1024), headers=AUTH)
        self.assertEqual((413, "FILE_TOO_LARGE"), (response.status_code, response.json()["code"]))

    def test_rejects_empty_body(self) -> None:
        response = self.client.post("/v1/extract", content=b"", headers=AUTH)
        self.assertEqual((400, "EMPTY_FILE"), (response.status_code, response.json()["code"]))

    def test_unsupported_format(self) -> None:
        response = self.client.post("/v1/extract", content=b"texto qualquer", headers=AUTH)
        self.assertEqual((415, "UNSUPPORTED_FORMAT"), (response.status_code, response.json()["code"]))

    def test_extracts_pdf_contract(self) -> None:
        response = self.client.post("/v1/extract", content=builders.nubank_invoice(), headers=AUTH)
        body = response.json()

        self.assertEqual(200, response.status_code)
        self.assertEqual("no-store", response.headers["cache-control"])
        self.assertEqual(
            {"source", "documentKind", "pages", "characters", "lines", "transactions", "diagnostics", "warnings"},
            set(body),
        )
        self.assertEqual("card_invoice", body["documentKind"])
        self.assertEqual(
            {"id": "TXN-20260629-002", "date": "2026-06-29", "description": "C A Modas", "value": 59.99,
             "type": "expense", "payment_method": "credit", "installments": 3, "installment_number": 3,
             "card_last4": "0040"},
            body["transactions"][1],
        )
        self.assertEqual(
            {"strategy", "totalLines", "candidateLines", "matchedLines", "skippedLines", "transactions"},
            set(body["diagnostics"]),
        )

    def test_extracts_ofx(self) -> None:
        response = self.client.post("/v1/extract", content=builders.SGML_OFX, headers=AUTH)
        body = response.json()
        self.assertEqual(("ofx", 3), (body["source"], len(body["transactions"])))
        self.assertNotIn("payment_method", body["transactions"][1])


if __name__ == "__main__":
    unittest.main()
