import io
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import pdfplumber
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

_FONT_CANDIDATES = (
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/TTF/DejaVuSans.ttf"),
    Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
)


def _font() -> str:
    for candidate in _FONT_CANDIDATES:
        if candidate.exists():
            if "DejaVuSans" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("DejaVuSans", str(candidate)))
            return "DejaVuSans"
    return "Helvetica"


UNICODE_FONT = _font() != "Helvetica"
MINUS = "−" if UNICODE_FONT else "-"
BULLETS = "••••" if UNICODE_FONT else "****"


@dataclass(frozen=True)
class Cell:
    text: str
    x: float
    align: str = "left"


Row = Sequence[Cell]


def build_pdf(
    pages: Sequence[Sequence[Row]],
    font_size: float = 9,
    leading: float = 15,
    image_pages: Sequence[Image.Image] = (),
) -> bytes:
    buffer = io.BytesIO()
    document = canvas.Canvas(buffer, pagesize=A4)
    font = _font()
    width, height = A4

    for rows in pages:
        document.setFont(font, font_size)
        y = height - 50
        for row in rows:
            for cell in row:
                if cell.align == "right":
                    document.drawRightString(cell.x, y, cell.text)
                else:
                    document.drawString(cell.x, y, cell.text)
            y -= leading
        document.showPage()

    for image in image_pages:
        document.drawImage(ImageReader(image), 0, 0, width=width, height=height)
        document.showPage()

    document.save()
    return buffer.getvalue()


def text_rows(*lines: str, x: float = 40) -> list[Row]:
    return [[Cell(line, x)] for line in lines]


def rasterize(pdf_bytes: bytes, resolution: int = 200) -> list[Image.Image]:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return [page.to_image(resolution=resolution).original.convert("RGB") for page in pdf.pages]


def image_only_pdf(pdf_bytes: bytes, resolution: int = 200) -> bytes:
    images = rasterize(pdf_bytes, resolution)
    buffer = io.BytesIO()
    images[0].save(buffer, format="PDF", save_all=True, append_images=images[1:], resolution=resolution)
    return buffer.getvalue()


def png_bytes(pdf_bytes: bytes, resolution: int = 200) -> bytes:
    buffer = io.BytesIO()
    rasterize(pdf_bytes, resolution)[0].save(buffer, format="PNG")
    return buffer.getvalue()


def nubank_invoice() -> bytes:
    header = text_rows(
        "Olá, Lucas. Esta é a sua fatura de agosto",
        "FATURA 06 AGO 2026",
        "Data de vencimento: 06 AGO 2026",
        "Pagamento mínimo R$ 150,00",
        "TRANSAÇÕES DE 29 JUN A 30 JUL",
    )
    entries = [
        ("29 JUN", f"{BULLETS} 0040 Komprao Koch Atacadis", "R$ 60,37"),
        ("29 JUN", f"{BULLETS} 0040 C A Modas - Parcela 3/3", "R$ 59,99"),
        ("02 JUL", 'IOF de "Cursor, Ai Powered Ide"', "R$ 3,94"),
        ("04 JUL", "Pagamento em 04 JUL", f"{MINUS}R$ 2.678,34"),
        ("15 JUL", f"{BULLETS} 0040 Cei - Parcela 2/6", "R$ 106,93"),
        ("15 JUL", f"{BULLETS} 0040 Cei - Parcela 2/6", "R$ 106,93"),
        ("20 JUL", f"{BULLETS} 0040 Limite convertido em saldo", "R$ 10,00"),
    ]
    rows = header + [
        [Cell(day, 40), Cell(description, 100), Cell(value, 550, "right")]
        for day, description, value in entries
    ]
    rows += text_rows("Total a pagar R$ 1.234,56", "Pagamentos e Financiamentos")
    return build_pdf([rows])


def year_crossing_invoice() -> bytes:
    rows = text_rows(
        "Resumo da fatura",
        "Data de vencimento: 05 FEV 2027",
        "Pagamento mínimo R$ 50,00",
        "TRANSAÇÕES DE 28 DEZ A 27 JAN",
    )
    rows += [
        [Cell("28 DEZ", 40), Cell(f"{BULLETS} 1234 Presente Natal", 100), Cell("R$ 80,00", 550, "right")],
        [Cell("30 DEZ", 40), Cell(f"{BULLETS} 1234 Mercado Central", 100), Cell("R$ 45,10", 550, "right")],
        [Cell("10 JAN", 40), Cell(f"{BULLETS} 1234 Farmacia Vida", 100), Cell("R$ 22,00", 550, "right")],
    ]
    return build_pdf([rows])


def statement_with_balance() -> bytes:
    header = text_rows(
        "Banco Exemplo S.A. - Extrato de conta corrente",
        "Agência 1234 Conta 56789-0",
        "Período: 01/07/2026 a 31/07/2026",
    )
    columns = [Cell("Data", 40), Cell("Lançamento", 100), Cell("Valor (R$)", 440, "right"), Cell("Saldo (R$)", 540, "right")]
    body: list[Row] = [
        [Cell("01/07", 40), Cell("SALDO ANTERIOR", 100), Cell("1.000,00", 540, "right")],
        [Cell("02/07", 40), Cell("PIX TRANSF JOAO SILVA", 100), Cell("-150,00", 440, "right")],
        [Cell("PIX RECEBIDO MARIA SOUZA", 100), Cell("300,00", 440, "right"), Cell("1.150,00", 540, "right")],
        [Cell("05/07", 40), Cell("PAG BOLETO ENEL DISTRIBUICAO", 100), Cell("-89,90", 440, "right"), Cell("1.060,10", 540, "right")],
        [Cell("10/07", 40), Cell("SALARIO EMPRESA X LTDA", 100), Cell("5.000,00", 440, "right"), Cell("6.060,10", 540, "right")],
        [Cell("12/07", 40), Cell("COMPRA CARTAO DEB", 100)],
        [Cell("PADARIA BOM PAO", 100), Cell("-12,50", 440, "right")],
        [Cell("SALDO DO DIA", 100), Cell("6.047,60", 540, "right")],
    ]
    page_two: list[Row] = [
        columns,
        [Cell("TARIFA PACOTE SERVICOS", 100), Cell("-35,00", 440, "right"), Cell("6.012,60", 540, "right")],
        [Cell("15/07", 40), Cell("PIX ENVIADO ACADEMIA FIT", 100), Cell("-99,00", 440, "right"), Cell("5.913,60", 540, "right")],
        [Cell("REF MENSALIDADE JULHO", 100)],
        [Cell("Total de lançamentos", 40), Cell("5.913,60", 540, "right")],
    ]
    return build_pdf([header + [columns] + body, page_two])


def mixed_statement() -> bytes:
    rows = text_rows("Banco Exemplo S.A. - Extrato de conta corrente", "Agência 1234 Conta 56789-0")
    rows.append([Cell("Data", 40), Cell("Lançamento", 100), Cell("Valor (R$)", 440, "right"), Cell("Saldo (R$)", 540, "right")])
    rows.append([Cell("02/07/2026", 40), Cell("PIX TRANSF JOAO SILVA", 100), Cell("-150,00", 440, "right")])
    scanned = rasterize(debit_credit_statement())[0]
    return build_pdf([rows], image_pages=[scanned])


def debit_credit_statement() -> bytes:
    rows = text_rows("EXTRATO DE CONTA CORRENTE", "Saldo anterior 2.000,00")
    rows.append(
        [
            Cell("Data", 40), Cell("Histórico", 95), Cell("Documento", 300),
            Cell("Débito", 410, "right"), Cell("Crédito", 480, "right"), Cell("Saldo", 550, "right"),
        ]
    )
    rows += [
        [Cell("03/08/2026", 40), Cell("TED RECEBIDA CLIENTE ABC", 95), Cell("778812", 300), Cell("1.500,00", 480, "right"), Cell("3.500,00", 550, "right")],
        [Cell("04/08/2026", 40), Cell("DEBITO AUTOMATICO VIVO", 95), Cell("000451", 300), Cell("129,99", 410, "right"), Cell("3.370,01", 550, "right")],
        [Cell("05/08/2026", 40), Cell("ESTORNO TARIFA", 95), Cell("000452", 300), Cell("12,00", 480, "right"), Cell("3.382,01", 550, "right")],
    ]
    return build_pdf([rows])


def caixa_statement() -> bytes:
    rows = text_rows("Extrato por período", "Conta corrente 0001")
    rows += [
        [Cell("02/07/2026 - 14:32:11", 40), Cell("000123 PIX ENVIADO FULANO", 170), Cell("150,00 D", 550, "right")],
        [Cell("03/07/2026 - 09:10:00", 40), Cell("000124 CRED PIX CICLANO", 170), Cell("80,00 C", 550, "right")],
        [Cell("04/07/2026 - 18:00:00", 40), Cell("000125 SALDO DIA", 170), Cell("930,00 C", 550, "right")],
    ]
    return build_pdf([rows])


def two_column_card_invoice() -> bytes:
    rows = text_rows(
        "Cartão Exemplo Platinum - Resumo da fatura",
        "Vencimento: 10/08/2026",
        "Total desta fatura R$ 197,80",
        "Pagamento mínimo R$ 30,00",
        "Lançamentos: compras e saques",
    )
    rows += [
        [Cell("15/07", 40), Cell("MERCADO LIVRE 02/10", 80), Cell("150,00", 280, "right"), Cell("16/07", 310), Cell("UBER TRIP", 350), Cell("23,90", 550, "right")],
        [Cell("18/07", 40), Cell("PADARIA REAL", 80), Cell("23,90", 280, "right"), Cell("20/07", 310), Cell("PAGAMENTO EFETUADO", 350), Cell("-500,00", 550, "right")],
    ]
    return build_pdf([rows])


SGML_OFX = (
    "OFXHEADER:100\r\nDATA:OFXSGML\r\nVERSION:102\r\nSECURITY:NONE\r\nENCODING:USASCII\r\n"
    "CHARSET:1252\r\nCOMPRESSION:NONE\r\nOLDFILEUID:NONE\r\nNEWFILEUID:NONE\r\n\r\n"
    "<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20260731120000"
    "<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0"
    "<SEVERITY>INFO</STATUS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>0341<ACCTID>12345-6"
    "<ACCTTYPE>CHECKING</BANKACCTFROM><BANKTRANLIST><DTSTART>20260701<DTEND>20260731\r\n"
    "<STMTTRN>\r\n<TRNTYPE>DEBIT\r\n<DTPOSTED>20260702100000[-3:BRT]\r\n<TRNAMT>-150,00\r\n"
    "<FITID>A1\r\n<MEMO>PIX ENVIADO João Açougue\r\n</STMTTRN>\r\n"
    "<STMTTRN>\r\n<TRNTYPE>CREDIT\r\n<DTPOSTED>20260705\r\n<TRNAMT>2500.00\r\n"
    "<FITID>A2\r\n<NAME>EMPRESA X\r\n<MEMO>SALARIO\r\n</STMTTRN>\r\n"
    "<STMTTRN>\r\n<TRNTYPE>DEBIT\r\n<DTPOSTED>20260705\r\n<TRNAMT>-39.90\r\n"
    "<FITID>A3\r\n<MEMO>\r\n<NAME>NETFLIX.COM\r\n</STMTTRN>\r\n"
    "<STMTTRN>\r\n<TRNTYPE>DEBIT\r\n<DTPOSTED>20260705\r\n<TRNAMT>-39.90\r\n"
    "<FITID>A3\r\n<MEMO>\r\n<NAME>NETFLIX.COM\r\n</STMTTRN>\r\n"
    "</BANKTRANLIST><LEDGERBAL><BALAMT>1000.00<DTASOF>20260731</LEDGERBAL></STMTRS>"
    "</STMTTRNRS></BANKMSGSRSV1></OFX>"
).encode("cp1252")

XML_CARD_OFX = (
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'
    '<?OFX OFXHEADER="200" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>\n'
    "<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><TRNUID>1</TRNUID><CCSTMTRS><CURDEF>BRL</CURDEF>"
    "<CCACCTFROM><ACCTID>5162********9876</ACCTID></CCACCTFROM><BANKTRANLIST>"
    "<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260712000000[-3:BRT]</DTPOSTED><TRNAMT>-320.00</TRNAMT>"
    "<FITID>c1</FITID><MEMO>LOJA ELETRO PARC 02/05</MEMO></STMTTRN>"
    "<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260715</DTPOSTED><TRNAMT>1200.00</TRNAMT>"
    "<FITID>c2</FITID><MEMO>Pagamento recebido &amp; processado</MEMO></STMTTRN>"
    "</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>"
).encode("utf-8")
