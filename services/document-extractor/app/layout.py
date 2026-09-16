from collections.abc import Iterable
from dataclasses import dataclass
from statistics import median


@dataclass(frozen=True)
class Word:
    text: str
    x0: float
    x1: float
    top: float
    bottom: float

    @property
    def height(self) -> float:
        return max(self.bottom - self.top, 0.1)

    @property
    def middle(self) -> float:
        return (self.top + self.bottom) / 2

    @property
    def width(self) -> float:
        return max(self.x1 - self.x0, 0.0)


@dataclass(frozen=True)
class TextLine:
    words: tuple[Word, ...]

    @property
    def text(self) -> str:
        return " ".join(word.text for word in self.words)

    @property
    def top(self) -> float:
        return min(word.top for word in self.words)

    @property
    def bottom(self) -> float:
        return max(word.bottom for word in self.words)

    @property
    def x0(self) -> float:
        return self.words[0].x0

    @property
    def x1(self) -> float:
        return self.words[-1].x1

    @property
    def height(self) -> float:
        return median(word.height for word in self.words)

    @property
    def char_width(self) -> float:
        characters = sum(len(word.text) for word in self.words)
        width = sum(word.width for word in self.words)
        return width / characters if characters and width else self.height * 0.5


@dataclass(frozen=True)
class PageText:
    number: int
    width: float
    lines: tuple[TextLine, ...]
    ocr: bool = False

    @property
    def characters(self) -> int:
        return sum(len(line.text) for line in self.lines)


def build_lines(words: Iterable[Word]) -> tuple[TextLine, ...]:
    ordered = sorted(words, key=lambda word: (word.middle, word.x0))
    if not ordered:
        return ()

    tolerance = median(word.height for word in ordered) * 0.5
    groups: list[list[Word]] = []
    anchor = 0.0

    for word in ordered:
        if groups and abs(word.middle - anchor) <= tolerance:
            groups[-1].append(word)
            anchor = sum(item.middle for item in groups[-1]) / len(groups[-1])
        else:
            groups.append([word])
            anchor = word.middle

    lines = [TextLine(tuple(sorted(group, key=lambda word: word.x0))) for group in groups]
    return tuple(sorted(lines, key=lambda line: (line.top, line.x0)))
