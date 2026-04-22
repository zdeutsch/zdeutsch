#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from pypdf import PdfReader


HEADING_RE = re.compile(r"^(?:[\u2022\-\*]\s*)?(.+?)\s*:\s*([0-9]{1,12})\s*$")
PART_RE = re.compile(r"^Telc\s+H[öo]rverstehen\s+Teil\s*([123])\b", re.IGNORECASE)
STATEMENT_START_PATTERNS = [
    re.compile(r"^(\d{2})\)\s*(.*)$"),
    re.compile(r"^(\d{2})\s*[\-–]\s*(.*)$"),
    re.compile(r"^(\d{2})\.\s*(.*)$"),
    re.compile(r"^(\d{2})\s+(.*)$"),
]

PART_KEY_BY_NUMBER = {
    1: "teil-1",
    2: "teil-2",
    3: "teil-3",
}


def normalize_text(value: str) -> str:
    text = (
        value.replace("\r", "\n")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
    )
    return re.sub(r"\s+", " ", text).strip()


def clean_title(value: str) -> str:
    title = re.sub(r"^[\u2022\-\*]+\s*", "", value).strip()
    title = re.sub(r"[\u0600-\u06FF]+", " ", title)
    title = normalize_text(title)
    title = re.sub(r"\s*[:\-]+\s*$", "", title).strip()
    return title or "Untitled"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "topic"


def statement_numbers_for_part(part_number: int) -> range:
    if part_number == 1:
        return range(41, 46)
    if part_number == 2:
        return range(46, 56)
    if part_number == 3:
        return range(56, 61)
    raise ValueError(f"Unsupported part number: {part_number}")


def local_statement_number(part_number: int, absolute_number: int) -> int:
    if part_number == 1:
        return absolute_number - 40
    if part_number == 2:
        return absolute_number - 45
    if part_number == 3:
        return absolute_number - 55
    raise ValueError(f"Unsupported part number: {part_number}")


def decode_code_numbers(code: str, part_number: int) -> Set[int]:
    values: List[int] = []
    index = 0
    while index < len(code):
        char = code[index]
        if part_number == 2 and char == "1" and index + 1 < len(code) and code[index + 1] == "0":
            values.append(10)
            index += 2
            continue
        if char == "0":
            values.append(10 if part_number == 2 else 0)
        elif char.isdigit():
            values.append(int(char))
        index += 1

    max_local_number = 10 if part_number == 2 else 5
    valid = set(range(1, max_local_number + 1))
    return {number for number in values if number in valid}


def is_excluded_heading(title: str) -> bool:
    lowered = title.lower()
    return any(
        marker in lowered
        for marker in (
            "teil 1 codes",
            "teil 2 codes",
            "teil 3 codes",
            "lösung",
            "mehr infos",
        )
    )


def find_part_marker(lines: List[str], start_index: int) -> Tuple[Optional[int], Optional[int]]:
    upper_bound = min(start_index + 20, len(lines))
    for index in range(start_index + 1, upper_bound):
        match = PART_RE.search(lines[index])
        if match:
            return int(match.group(1)), index
    return None, None


def parse_statements(lines: List[str], start_index: int, part_number: int) -> Tuple[Dict[int, str], int]:
    expected_numbers = set(statement_numbers_for_part(part_number))
    statements: Dict[int, str] = {}
    current_number: Optional[int] = None
    current_chunks: List[str] = []

    index = start_index
    while index < len(lines):
        line = lines[index].strip()

        heading_match = HEADING_RE.match(line)
        if heading_match:
            next_part_number, _ = find_part_marker(lines, index)
            if next_part_number is not None:
                break

        statement_opened = False
        for pattern in STATEMENT_START_PATTERNS:
            number_match = pattern.match(line)
            if not number_match:
                continue
            absolute_number = int(number_match.group(1))
            if absolute_number not in expected_numbers:
                continue

            if current_number is not None:
                statements[current_number] = normalize_text(" ".join(current_chunks))

            current_number = absolute_number
            rest = normalize_text(number_match.group(2))
            current_chunks = [rest] if rest else []
            statement_opened = True
            break

        if statement_opened:
            index += 1
            continue

        if current_number is not None and line and not re.search(r"[\u0600-\u06FF]", line):
            current_chunks.append(line)
        index += 1

    if current_number is not None:
        statements[current_number] = normalize_text(" ".join(current_chunks))

    return statements, index


def parse_blocks_from_pdf(pdf_path: Path) -> List[Dict]:
    reader = PdfReader(str(pdf_path))
    blocks: List[Dict] = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").replace("\r", "\n")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        index = 0

        while index < len(lines):
            heading_match = HEADING_RE.match(lines[index])
            if not heading_match:
                index += 1
                continue

            raw_title = normalize_text(heading_match.group(1))
            if is_excluded_heading(raw_title):
                index += 1
                continue

            code = heading_match.group(2)
            part_number, part_line_index = find_part_marker(lines, index)
            if part_number is None or part_line_index is None:
                index += 1
                continue

            statements, next_index = parse_statements(lines, part_line_index + 1, part_number)
            if len(statements) >= 3:
                blocks.append(
                    {
                        "page": page_number,
                        "part": part_number,
                        "title": clean_title(raw_title),
                        "code": code,
                        "statements": statements,
                    }
                )
                index = next_index
            else:
                index += 1

    return blocks


def build_topics_by_part(blocks: List[Dict]) -> Dict[str, List[Dict]]:
    topics_by_part = {
        "teil-1": [],
        "teil-2": [],
        "teil-3": [],
    }
    counters = {
        "teil-1": 0,
        "teil-2": 0,
        "teil-3": 0,
    }

    for block in blocks:
        part_number = block["part"]
        part_key = PART_KEY_BY_NUMBER[part_number]
        counters[part_key] += 1
        topic_index = counters[part_key]

        title = block["title"]
        code = str(block["code"])
        page_number = block["page"]
        slug = slugify(title)
        topic_id = f"b2-{part_key}-topic-{topic_index}-{slug}"
        correct_numbers = decode_code_numbers(code, part_number)

        statements = []
        for absolute_number in statement_numbers_for_part(part_number):
            number = local_statement_number(part_number, absolute_number)
            statements.append(
                {
                    "id": f"{topic_id}-s{number}",
                    "number": number,
                    "text": block["statements"].get(absolute_number, ""),
                    "correct": number in correct_numbers,
                }
            )

        topics_by_part[part_key].append(
            {
                "id": topic_id,
                "title": title,
                "tag": f"PDF page {page_number}, code {code}",
                "statements": statements,
            }
        )

    return topics_by_part


def update_database(db_path: Path, topics_by_part: Dict[str, List[Dict]]) -> None:
    data = json.loads(db_path.read_text(encoding="utf-8"))
    levels = data.get("levels", {})
    b2 = levels.get("b2")
    if not isinstance(b2, dict):
        raise RuntimeError("Missing levels.b2 in database JSON.")

    theme_order = b2.get("themeOrder", [])
    if not theme_order:
        raise RuntimeError("Missing levels.b2.themeOrder in database JSON.")

    theme_key = theme_order[0]
    themes = b2.get("themes", {})
    theme = themes.get(theme_key)
    if not isinstance(theme, dict):
        raise RuntimeError(f"Missing levels.b2.themes.{theme_key} in database JSON.")

    horen_root = theme.setdefault("hören", {})
    parts = horen_root.setdefault("parts", {})
    for part_key in ("teil-1", "teil-2", "teil-3"):
        part = parts.setdefault(part_key, {})
        content = part.setdefault("content", {})
        content["topics"] = topics_by_part.get(part_key, [])

    db_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract TELC B2 Hören topics from PDF and update b2 topics in horen-codes.json."
    )
    parser.add_argument("--pdf", required=True, help="Input PDF path")
    parser.add_argument(
        "--db",
        default="site/database/horen-codes.json",
        help="Path to horen-codes.json",
    )
    parser.add_argument(
        "--export",
        default="",
        help="Optional path to write raw extracted blocks as JSON.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and print stats only, do not modify database file.",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf).expanduser().resolve()
    db_path = Path(args.db).expanduser().resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    if not db_path.exists():
        raise FileNotFoundError(f"Database JSON not found: {db_path}")

    blocks = parse_blocks_from_pdf(pdf_path)
    topics_by_part = build_topics_by_part(blocks)

    print(f"Parsed blocks: {len(blocks)}")
    for part_key in ("teil-1", "teil-2", "teil-3"):
        print(f"{part_key}: {len(topics_by_part[part_key])} topics")

    if args.export:
        export_path = Path(args.export).expanduser().resolve()
        export_path.write_text(
            json.dumps(blocks, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Exported raw blocks: {export_path}")

    if args.dry_run:
        return

    update_database(db_path, topics_by_part)
    print(f"Updated database: {db_path}")


if __name__ == "__main__":
    main()
