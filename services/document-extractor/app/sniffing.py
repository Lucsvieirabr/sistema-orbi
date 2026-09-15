import re
from enum import Enum

_OFX_MARKER = re.compile(rb"OFXHEADER|<OFX>|<\?OFX", re.IGNORECASE)
_IMAGE_SIGNATURES = (
    b"\x89PNG\r\n\x1a\n",
    b"\xff\xd8\xff",
    b"II*\x00",
    b"MM\x00*",
    b"BM",
    b"GIF87a",
    b"GIF89a",
)


class FileKind(str, Enum):
    PDF = "pdf"
    OFX = "ofx"
    IMAGE = "image"
    UNKNOWN = "unknown"


def sniff(data: bytes) -> FileKind:
    head = data[:4096]
    if b"%PDF-" in head[:1024]:
        return FileKind.PDF
    if head.startswith(_IMAGE_SIGNATURES) or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"):
        return FileKind.IMAGE
    if _OFX_MARKER.search(head):
        return FileKind.OFX
    return FileKind.UNKNOWN
