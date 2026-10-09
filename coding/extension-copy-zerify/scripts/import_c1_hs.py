#!/usr/bin/env python3
"""Build the C1 Hochschule catalog as module -> Teil -> Thema.

The source folder remains authoritative. OpenAI extraction files add exact
visual transcription for scanned pages; the importer always preserves the
original PDFs and audio alongside the structured records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
DEFAULT_SOURCE = Path("/Users/mac/Downloads/C1 Hochschule")
DEFAULT_OUTPUT = SITE / "database" / "c1-hochschule.json"
DEFAULT_ASSETS = SITE / "assets" / "c1-hochschule"
DEFAULT_EXTRACTIONS = ROOT / "tmp" / "pdfs" / "c1-ai"

PDF_DEFINITIONS = {
    "lv1": ("lesen-teil-1", "Lesen Teil 1", "lesen", "teil-1", "sentence_gap_match"),
    "lv2": ("lesen-teil-2", "Lesen Teil 2", "lesen", "teil-2", "paragraph_match"),
    "lv3": ("lesen-teil-3", "Lesen Teil 3", "lesen", "teil-3", "true_false"),
    "sprach": ("sprachbausteine", "Sprachbausteine", "sprachbausteine", "teil-1", "cloze_multiple_choice"),
    "hv1": ("hoeren-teil-1", "Hören Teil 1", "hoeren", "teil-1", "speaker_match"),
    "hv2": ("hoeren-teil-2", "Hören Teil 2", "hoeren", "teil-2", "multiple_choice"),
    "hv3": ("hoeren-teil-3", "Hören Teil 3", "hoeren", "teil-3", "short_text_gap"),
    "schreiben": ("schreiben", "Schriftlicher Ausdruck", "schreiben", "teil-1", "academic_essay"),
    "sprechen": ("sprechen-praesentation", "Sprechen: Präsentation", "sprechen", "teil-1", "presentation"),
    "zitat": ("sprechen-diskussion", "Sprechen: Diskussion", "sprechen", "teil-2", "quotation_discussion"),
}

AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".opus", ".wav", ".ogg", ".webm"}
AUDIO_TITLE_OVERRIDES = {
    "recording-6": "Wohneigentum",
    "sprache-004": "Studienwahl",
    "sprache-006": "Neugier",
    "studengeburen": "Studiengebühren",
    "h1-internet": "Internet",
    "umweltschutz": "Umweltschutz",
    "2-forschung-afrika": "Forschung in Afrika",
    "c1-hs-horen-teil-2": "Bürgerforschung",
    "t2-09-raumfahrt": "Raumfahrt",
    "fischer-unternehmen-horen-teil-2-sameer": "Fischer-Unternehmen",
    "hv2-berufwechseln": "Beruf wechseln",
    "roboter": "Roboter",
    "die-kommunikation-der-pflanzen": "Kommunikation der Pflanzen",
    "astronaut": "Astronaut",
    "garten": "Gärten",
    "entelleganz": "Intelligenz",
    "gesund-durch-jahr-teil-3": "Winterblues – Gesund durchs Jahr",
    "kreativitat": "Kreativität",
    "ubersetzer": "Literarisches Übersetzen",
    "speed-reading": "Speed Reading",
    "3-hochbegabung": "Hochbegabung",
    "benimregeln": "Benimmregeln",
    "hv3-benimmregeln-finja": "Benimmregeln (FINJA)",
    "heterogenitat-in-der-schule-teil3": "Heterogenität in der Schule",
    "c1-gewonheiten-teil-3": "Gewohnheiten",
    "c1-gewonheiten-hs-horen-teil-3": "Gewohnheiten",
}

TRANSCRIPT_FILES = {
    "recording-6": "recording-6.json",
    "sprache-004": "sprache-004-300.json",
    "sprache-006": "sprache-006-300.json",
    "c1-hs-horen-teil-2": "hv2-unknown.json",
    "entelleganz": "intelligenz.json",
    "gesund-durch-jahr-teil-3": "gesund.json",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ascii_slug(value: str, fallback: str = "content") -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value[:100] or fallback


def normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()).strip("-")


def clean_title(value: str, fallback: str) -> str:
    value = re.sub(r"[\u0600-\u06ff]+", " ", unicodedata.normalize("NFKC", value or ""))
    value = re.sub(r"\([^)]*(?:mp3cut|copy)\s*[^)]*\)", " ", value, flags=re.I)
    value = re.sub(r"\b(?:C1|HS|HV[123]|H[oö]ren|Teil\s*[123])\b", " ", value, flags=re.I)
    value = re.sub(r"\s+", " ", value).strip(" -_()")
    return value or fallback


def pdf_kind(path: Path) -> str | None:
    key = normalized(path.stem)
    if re.search(r"(?:^|-)lv-?1(?:-|$)", key): return "lv1"
    if re.search(r"(?:^|-)lv-?2(?:-|$)", key): return "lv2"
    if re.search(r"(?:^|-)lv-?3(?:-|$)", key): return "lv3"
    if re.search(r"(?:^|-)hv-?1(?:-|$)", key): return "hv1"
    if re.search(r"(?:^|-)hv-?2(?:-|$)", key): return "hv2"
    if re.search(r"(?:^|-)hv-?3(?:-|$)", key): return "hv3"
    if "sprachbausteine" in key: return "sprach"
    if "schriftliche-ausdruck" in key: return "schreiben"
    if "zitat" in key: return "zitat"
    if "sprechen" in key or "presentation" in key: return "sprechen"
    return None


def source_audio_part(path: Path) -> str | None:
    parts = {normalized(item) for item in path.parts}
    if "hv1" in parts: return "1"
    if "hv2" in parts: return "2"
    if "hv3" in parts: return "3"
    return None


def audio_identity(path: Path) -> str:
    key = normalized(path.stem)
    key = re.sub(r"(?:-mp3cut-net|-copy|-2)$", "", key)
    return key


def audio_title(path: Path) -> str:
    key = audio_identity(path)
    for match, title in AUDIO_TITLE_OVERRIDES.items():
        if match in key:
            return title
    return clean_title(path.stem, "Hörthema")


def audio_part(path: Path) -> str | None:
    key = audio_identity(path)
    if "hv3-benimmregeln" in key:
        return "3"
    return source_audio_part(path)


def extract_pages(path: Path) -> list[str]:
    pages = []
    for page in PdfReader(path).pages:
        try:
            text = page.extract_text() or ""
        except Exception as error:  # pragma: no cover
            text = f"[Text extraction error: {error}]"
        pages.append(text.replace("\u0000", "").strip())
    return pages


def catalog_shell(stamp: str) -> dict[str, Any]:
    return {
        "schemaVersion": 3,
        "generatedAt": stamp,
        "profile": {
            "id": "telc-c1-hochschule",
            "provider": "telc",
            "level": "c1",
            "variant": "hochschule",
            "title": "TELC Deutsch C1 Hochschule",
            "locale": "de",
            "hierarchy": ["module", "part", "theme"],
            "moduleOrder": ["lesen", "sprachbausteine", "hoeren", "schreiben", "sprechen"],
            "sessionGroups": {
                "lesen-sprache": {
                    "title": "Lesen & Sprachbausteine",
                    "durationMinutes": 90,
                    "modules": ["lesen", "sprachbausteine"],
                }
            },
        },
        "modules": {
            "lesen": {
                "title": "Lesen", "sessionGroup": "lesen-sprache",
                "partOrder": ["teil-1", "teil-2", "teil-3"],
                "parts": {
                    "teil-1": {"title": "Lesen Teil 1", "shortTitle": "Teil 1", "exerciseType": "sentence_gap_match", "themes": []},
                    "teil-2": {"title": "Lesen Teil 2", "shortTitle": "Teil 2", "exerciseType": "paragraph_match", "themes": []},
                    "teil-3": {"title": "Lesen Teil 3", "shortTitle": "Teil 3", "exerciseType": "true_false", "themes": []},
                },
            },
            "sprachbausteine": {
                "title": "Sprachbausteine", "sessionGroup": "lesen-sprache", "partOrder": ["teil-1"],
                "parts": {"teil-1": {"title": "Sprachbausteine", "shortTitle": "Aufgaben", "exerciseType": "cloze_multiple_choice", "themes": []}},
            },
            "hoeren": {
                "title": "Hören", "durationMinutes": 40, "partOrder": ["teil-1", "teil-2", "teil-3"],
                "parts": {
                    "teil-1": {"title": "Hören Teil 1", "shortTitle": "Teil 1", "exerciseType": "speaker_match", "themes": []},
                    "teil-2": {"title": "Hören Teil 2", "shortTitle": "Teil 2", "exerciseType": "multiple_choice", "themes": []},
                    "teil-3": {"title": "Hören Teil 3", "shortTitle": "Teil 3", "exerciseType": "short_text_gap", "themes": []},
                },
            },
            "schreiben": {
                "title": "Schreiben", "durationMinutes": 70, "partOrder": ["teil-1"],
                "parts": {"teil-1": {"title": "Schriftlicher Ausdruck", "shortTitle": "Themen", "exerciseType": "academic_essay", "themes": []}},
            },
            "sprechen": {
                "title": "Sprechen", "durationMinutes": 16, "preparationMinutes": 20,
                "partOrder": ["teil-1", "teil-2"],
                "parts": {
                    "teil-1": {"title": "Präsentation", "shortTitle": "Präsentation", "exerciseType": "presentation", "themes": []},
                    "teil-2": {"title": "Diskussion", "shortTitle": "Diskussion", "exerciseType": "quotation_discussion", "themes": []},
                },
            },
        },
        "sourceDocuments": {},
        "mediaAssets": {},
        "importSummary": {},
    }


def copy_sources(source_root: Path, asset_root: Path, catalog: dict) -> dict[str, dict]:
    result: dict[str, dict] = {}
    destination = asset_root / "sources"
    destination.mkdir(parents=True, exist_ok=True)
    for source in sorted(source_root.rglob("*.pdf")):
        kind = pdf_kind(source)
        if not kind:
            continue
        document_id, title, module, part, _ = PDF_DEFINITIONS[kind]
        data = source.read_bytes()
        checksum = digest(data)
        target = destination / f"{document_id}-{checksum[:12]}.pdf"
        if not target.is_file() or target.stat().st_size != len(data):
            shutil.copyfile(source, target)
        page_texts = extract_pages(source)
        entry = {
            "id": document_id,
            "title": title,
            "module": module,
            "part": part,
            "originalName": source.name,
            "sourceRelativePath": str(source.relative_to(source_root)),
            "path": f"assets/c1-hochschule/sources/{target.name}",
            "sha256": checksum,
            "mimeType": "application/pdf",
            "sizeBytes": len(data),
            "pageCount": len(page_texts),
            "pages": [{"number": index + 1, "text": text, "textAvailable": bool(text)} for index, text in enumerate(page_texts)],
        }
        result[kind] = entry
        catalog["sourceDocuments"][document_id] = entry
    return result


def convert_audio(source: Path, target: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-codec:a", "libmp3lame", "-q:a", "3", str(target)],
        check=True,
    )


def copy_audio(source_root: Path, asset_root: Path, catalog: dict) -> list[dict]:
    destination = asset_root / "audio"
    destination.mkdir(parents=True, exist_ok=True)
    by_digest: dict[str, dict] = {}
    ordered: list[dict] = []
    for source in sorted((item for item in source_root.rglob("*") if item.suffix.lower() in AUDIO_EXTENSIONS), key=lambda item: str(item)):
        part = audio_part(source)
        if not part:
            continue
        data = source.read_bytes()
        checksum = digest(data)
        title = audio_title(source)
        if checksum in by_digest:
            entry = by_digest[checksum]
            entry["aliases"].append(source.name)
            continue
        asset_id = f"audio-{checksum[:16]}"
        suffix = source.suffix.lower()
        stored_suffix = ".mp3" if suffix in {".aac", ".opus"} else suffix
        target = destination / f"{checksum[:16]}-{ascii_slug(title, 'audio')}{stored_suffix}"
        if not target.is_file():
            if suffix in {".aac", ".opus"}:
                convert_audio(source, target)
            else:
                shutil.copyfile(source, target)
        entry = {
            "id": asset_id,
            "title": title,
            "role": "audio",
            "path": f"assets/c1-hochschule/audio/{target.name}",
            "mimeType": "audio/mpeg" if stored_suffix == ".mp3" else "audio/mp4" if stored_suffix == ".m4a" else f"audio/{stored_suffix[1:]}",
            "sizeBytes": target.stat().st_size,
            "sha256": digest(target.read_bytes()),
            "sourceSha256": checksum,
            "originalName": source.name,
            "sourceRelativePath": str(source.relative_to(source_root)),
            "aliases": [],
            "part": f"teil-{part}",
            "identity": audio_identity(source),
        }
        by_digest[checksum] = entry
        catalog["mediaAssets"][asset_id] = {key: value for key, value in entry.items() if key != "identity"}
        ordered.append(entry)
    return ordered


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def extraction_themes(extractions: Path, kind: str) -> tuple[list[dict], list[str]]:
    detailed = load_json(extractions / f"{kind}-exercises.json")
    manifest = load_json(extractions / f"{kind}-themes.json")
    base = list(manifest.get("themes", []))
    exact = list(detailed.get("themes", []))
    if not base:
        base = exact
    if not exact:
        return base, list(manifest.get("notes", []))

    used: set[int] = set()
    for index, item in enumerate(base):
        best_index = None
        source_number = item.get("sourceNumber")
        manual_term = {
            ("lv1", 7): "agypten",
            ("lv1", 11): "box",
        }.get((kind, source_number))
        if manual_term:
            manual_candidates = [
                position for position, value in enumerate(exact)
                if position not in used and manual_term in normalized(value.get("title", ""))
            ]
            if len(manual_candidates) == 1:
                best_index = manual_candidates[0]
        if best_index is None and source_number is not None:
            candidates = [position for position, value in enumerate(exact) if position not in used and value.get("sourceNumber") == source_number]
            if len(candidates) == 1:
                best_index = candidates[0]
        if best_index is None:
            item_normalized = normalized(item.get("title", ""))
            item_words = {word for word in item_normalized.split("-") if len(word) >= 4}
            scored = []
            for position, value in enumerate(exact):
                if position in used:
                    continue
                value_normalized = normalized(value.get("title", ""))
                value_words = {word for word in value_normalized.split("-") if len(word) >= 4}
                score = len(item_words & value_words)
                if item_normalized == value_normalized:
                    score += 10
                elif len(item_normalized) >= 4 and (item_normalized in value_normalized or value_normalized in item_normalized):
                    score += 6
                scored.append((score, position))
            if scored and max(scored)[0] >= 2:
                best_index = max(scored)[1]
        if best_index is None and len(base) == len(exact) and index < len(exact) and index not in used:
            best_index = index
        if best_index is not None:
            overlay = exact[best_index]
            used.add(best_index)
            for key in ("sourcePageStart", "sourcePageEnd", "instructions", "sourceText", "questions", "answerKeyStatus"):
                if overlay.get(key) not in (None, "", []):
                    item[key] = overlay[key]
    for position, item in enumerate(exact):
        if position not in used:
            item_normalized = normalized(item.get("title", ""))
            duplicate = any(
                len(item_normalized) >= 4
                and (
                    item_normalized in normalized(value.get("title", ""))
                    or normalized(value.get("title", "")) in item_normalized
                )
                for value in base
            )
            if not duplicate:
                base.append(item)
    return base, list(dict.fromkeys([*manifest.get("notes", []), *detailed.get("notes", [])]))


def page_match(document: dict, phrases: list[str]) -> tuple[int, int, str]:
    tokens = {token for phrase in phrases for token in normalized(phrase).split("-") if len(token) >= 4}
    best_score, best_index = 0, 0
    pages = document.get("pages", [])
    for index, page in enumerate(pages):
        page_text = page.get("text", "")
        page_norm = normalized(page_text)
        page_tokens = set(page_norm.split("-"))
        score = len(tokens & page_tokens)
        score += max((8 for phrase in phrases if len(phrase) > 5 and normalized(phrase) in page_norm), default=0)
        if score > best_score:
            best_score, best_index = score, index
    if best_score == 0:
        return 1, 1, ""
    end_index = min(len(pages), best_index + 6)
    text = "\n\n".join(page.get("text", "") for page in pages[best_index:end_index] if page.get("text"))
    return best_index + 1, end_index, text


def normalize_questions(values: list[dict]) -> list[dict]:
    result = []
    for index, value in enumerate(values or []):
        result.append(
            {
                "id": f"q-{index + 1}",
                "number": str(value.get("number") or index + 1),
                "prompt": value.get("prompt") or value.get("text") or "",
                "options": value.get("options") or [],
                "answer": value.get("answer") or "",
            }
        )
    return result


def theme_record(kind: str, index: int, item: dict, document: dict, stamp: str) -> dict:
    source_number = item.get("sourceNumber")
    title = re.sub(r"\s+", " ", item.get("title") or f"Thema {index + 1}").strip()
    aliases = [str(value).strip() for value in item.get("aliases", []) if str(value).strip()]
    page_start = item.get("sourcePageStart") or item.get("pageStart")
    page_end = item.get("sourcePageEnd") or item.get("pageEnd")
    matched_text = ""
    if not page_start or not page_end:
        page_start, page_end, matched_text = page_match(document, [title, *aliases, *item.get("answerHints", [])])
    source_text = item.get("sourceText") or matched_text
    record_id = f"c1-{kind}-{source_number if source_number is not None else index + 1:02d}-{index + 1:02d}"
    questions = normalize_questions(item.get("questions", []))
    status = "source_extracted" if source_text or questions else "source_indexed"
    return {
        "id": record_id,
        "slug": ascii_slug(title, record_id),
        "sourceNumber": source_number,
        "title": title,
        "aliases": aliases,
        "status": status,
        "locale": "de",
        "instructions": item.get("instructions") or "Bearbeiten Sie die Aufgabe anhand des Originalmaterials.",
        "source": {
            "documentId": document["id"],
            "pageStart": int(page_start or 1),
            "pageEnd": int(page_end or page_start or 1),
            "extractionMethod": "openai_pdf_vision",
            "confidence": "source_transcription" if source_text else "title_verified",
        },
        "payload": {
            "responseType": PDF_DEFINITIONS[kind][4],
            "sourceText": source_text,
            "questions": questions,
            "answerHints": item.get("answerHints", []),
            "answerKeyStatus": item.get("answerKeyStatus") or ("partial" if item.get("answerHints") else "not_provided"),
        },
        "createdAt": stamp,
        "updatedAt": stamp,
    }


def add_reading_and_language(catalog: dict, documents: dict, extractions: Path, stamp: str) -> dict[str, list[str]]:
    notes = {}
    for kind in ("lv1", "lv2", "lv3", "sprach"):
        document = documents.get(kind)
        if not document:
            continue
        themes, extraction_notes = extraction_themes(extractions, kind)
        module, part = PDF_DEFINITIONS[kind][2:4]
        catalog["modules"][module]["parts"][part]["themes"] = [
            theme_record(kind, index, item, document, stamp) for index, item in enumerate(themes)
        ]
        notes[kind] = extraction_notes
    return notes


def writing_themes(document: dict, stamp: str) -> list[dict]:
    result = []
    counter = 0
    for page in document.get("pages", []):
        text = page.get("text", "")
        headers = list(re.finditer(r"(?im)^\s*Thema\s+([AB12])\s*[:;\-]?\s*(.+)$", text))
        for position, match in enumerate(headers):
            counter += 1
            end = headers[position + 1].start() if position + 1 < len(headers) else len(text)
            body = text[match.start():end].strip()
            title = re.sub(r"\s+", " ", match.group(2)).strip(" -:;")[:140] or f"Schreibthema {counter}"
            result.append(
                {
                    "id": f"c1-schreiben-{counter:03d}", "slug": ascii_slug(title), "sourceNumber": counter,
                    "title": title, "optionLabel": f"Thema {match.group(1)}", "status": "source_extracted", "locale": "de",
                    "instructions": "Wählen Sie eine Aufgabe, berücksichtigen Sie beide Positionen und schreiben Sie mindestens 350 Wörter.",
                    "source": {"documentId": document["id"], "pageStart": page["number"], "pageEnd": page["number"], "extractionMethod": "pdf_text", "confidence": "source_transcription"},
                    "payload": {"responseType": "academic_essay", "minimumWords": 350, "sourceText": body, "questions": [], "answerKeyStatus": "not_applicable"},
                    "createdAt": stamp, "updatedAt": stamp,
                }
            )
    return result


def quote_themes(document: dict, stamp: str) -> list[dict]:
    text = "\n".join(page.get("text", "") for page in document.get("pages", [])[:7])
    matches = re.finditer(r"(?m)^\s*(\d{1,3})\s*[▪•]\s*(.+?)(?=^\s*\d{1,3}\s*[▪•]|\Z)", text, re.S)
    result, seen = [], set()
    for match in matches:
        number = int(match.group(1))
        prompt = re.sub(r"\s+", " ", match.group(2)).strip(' \n\t"︎')
        if number in seen or len(prompt) < 8:
            continue
        seen.add(number)
        result.append(
            {
                "id": f"c1-zitat-{number:03d}", "slug": ascii_slug(prompt, f"zitat-{number}"), "sourceNumber": number,
                "title": f"Zitat {number}", "status": "source_extracted", "locale": "de",
                "instructions": "Interpretieren Sie das Zitat, nehmen Sie Stellung und diskutieren Sie mit Ihrer Partnerin oder Ihrem Partner.",
                "source": {"documentId": document["id"], "pageStart": 1, "pageEnd": 7, "extractionMethod": "pdf_text", "confidence": "source_transcription"},
                "payload": {"responseType": "quotation_discussion", "prompt": prompt, "sourceText": prompt, "questions": [], "answerKeyStatus": "not_applicable"},
                "createdAt": stamp, "updatedAt": stamp,
            }
        )
    return result


def short_presentation_title(item: dict) -> str:
    aliases = [value for value in item.get("aliases", []) if 4 <= len(value) <= 90]
    if aliases:
        return aliases[0]
    title = re.sub(r"\s+", " ", item.get("title", "")).strip()
    return title if len(title) <= 90 else title[:87].rstrip() + "…"


def presentation_themes(document: dict, extractions: Path, stamp: str) -> list[dict]:
    items = load_json(extractions / "sprechen-themes.json").get("themes", [])
    result = []
    for group_start, group_label in zip((0, 40, 80), ("A", "B", "C")):
        group = items[group_start:group_start + 40]
        for offset in range(0, len(group), 2):
            pair = group[offset:offset + 2]
            if len(pair) < 2:
                continue
            number = pair[0].get("sourceNumber") or offset // 2 + 1
            option_titles = [short_presentation_title(item) for item in pair]
            title = f"{option_titles[0]} / {option_titles[1]}"
            page_start, page_end, source_text = page_match(document, [pair[0].get("title", ""), pair[1].get("title", ""), *option_titles])
            result.append(
                {
                    "id": f"c1-praesentation-{group_label.lower()}-{int(number):02d}", "slug": ascii_slug(title),
                    "sourceNumber": int(number), "sourceGroup": group_label, "title": title, "status": "source_extracted", "locale": "de",
                    "instructions": "Wählen Sie Thema A oder B. Präsentieren Sie Ihren Standpunkt, begründen Sie ihn und reagieren Sie auf Anschlussfragen.",
                    "source": {"documentId": document["id"], "pageStart": page_start, "pageEnd": page_end, "extractionMethod": "openai_pdf_vision_and_pdf_text", "confidence": "source_transcription"},
                    "payload": {
                        "responseType": "presentation",
                        "sourceText": source_text,
                        "options": [
                            {"label": "Thema A", "title": option_titles[0], "prompt": pair[0].get("title", ""), "answerHints": pair[0].get("answerHints", [])},
                            {"label": "Thema B", "title": option_titles[1], "prompt": pair[1].get("title", ""), "answerHints": pair[1].get("answerHints", [])},
                        ],
                        "questions": [], "answerKeyStatus": "not_applicable",
                    },
                    "createdAt": stamp, "updatedAt": stamp,
                }
            )
    return result


def load_transcript(identity: str) -> str:
    filename = TRANSCRIPT_FILES.get(identity)
    if not filename:
        return ""
    data = load_json(ROOT / "tmp" / "audio" / "c1-ai" / filename)
    return data.get("text", "")


def hearing_themes(catalog: dict, documents: dict, media: list[dict], stamp: str) -> None:
    hearing_documents = [documents[key] for key in ("hv1", "hv2", "hv3") if key in documents]
    by_part = {"teil-1": [], "teil-2": [], "teil-3": []}
    for asset in media:
        by_part[asset["part"]].append(asset)
    for part_key, assets in by_part.items():
        exercise_type = catalog["modules"]["hoeren"]["parts"][part_key]["exerciseType"]
        records = []
        for index, asset in enumerate(assets):
            transcript = load_transcript(asset["identity"])
            search_phrases = [asset["title"], transcript[:700]]
            best = None
            for document in hearing_documents:
                page_start, page_end, text = page_match(document, search_phrases)
                score = len({token for token in normalized(asset["title"]).split("-") if len(token) >= 4} & set(normalized(text).split("-")))
                candidate = (score, document, page_start, page_end, text)
                if best is None or candidate[0] > best[0]:
                    best = candidate
            _, document, page_start, page_end, source_text = best
            if transcript and len(source_text) < 400:
                source_text = transcript
            records.append(
                {
                    "id": f"c1-hoeren-{part_key}-{index + 1:02d}", "slug": ascii_slug(asset["title"]), "sourceNumber": index + 1,
                    "title": asset["title"], "status": "source_extracted", "locale": "de",
                    "instructions": "Hören Sie die Aufnahme und bearbeiten Sie die Aufgaben dieses Prüfungsteils.",
                    "mediaAssetId": asset["id"],
                    "source": {"documentId": document["id"], "pageStart": page_start, "pageEnd": page_end, "extractionMethod": "audio_and_pdf_text", "confidence": "source_transcription"},
                    "payload": {"responseType": exercise_type, "sourceText": source_text, "transcriptExcerpt": transcript, "questions": [], "answerKeyStatus": "source_document"},
                    "createdAt": stamp, "updatedAt": stamp,
                }
            )
        catalog["modules"]["hoeren"]["parts"][part_key]["themes"] = records


def build(source_root: Path, output: Path, asset_root: Path, extractions: Path) -> dict:
    stamp = now_iso()
    catalog = catalog_shell(stamp)
    documents = copy_sources(source_root, asset_root, catalog)
    media = copy_audio(source_root, asset_root, catalog)
    extraction_notes = add_reading_and_language(catalog, documents, extractions, stamp)
    hearing_themes(catalog, documents, media, stamp)
    if documents.get("schreiben"):
        catalog["modules"]["schreiben"]["parts"]["teil-1"]["themes"] = writing_themes(documents["schreiben"], stamp)
    if documents.get("sprechen"):
        catalog["modules"]["sprechen"]["parts"]["teil-1"]["themes"] = presentation_themes(documents["sprechen"], extractions, stamp)
    if documents.get("zitat"):
        catalog["modules"]["sprechen"]["parts"]["teil-2"]["themes"] = quote_themes(documents["zitat"], stamp)

    by_module = {}
    by_part = {}
    total = 0
    for module_key, module in catalog["modules"].items():
        module_total = 0
        for part_key, part in module.get("parts", {}).items():
            count = len(part.get("themes", []))
            by_part[f"{module_key}.{part_key}"] = count
            module_total += count
        by_module[module_key] = module_total
        total += module_total
    catalog["importSummary"] = {
        "sourceFolder": source_root.name,
        "importedAt": stamp,
        "sourceDocuments": len(catalog["sourceDocuments"]),
        "sourcePages": sum(document["pageCount"] for document in catalog["sourceDocuments"].values()),
        "mediaAssets": len(catalog["mediaAssets"]),
        "themes": total,
        "byModule": by_module,
        "byPart": by_part,
        "extractionNotes": extraction_notes,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return catalog


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--asset-root", type=Path, default=DEFAULT_ASSETS)
    parser.add_argument("--extraction-dir", type=Path, default=DEFAULT_EXTRACTIONS)
    args = parser.parse_args()
    source_root = args.source_dir.expanduser().resolve()
    if not source_root.is_dir():
        raise SystemExit(f"C1 Hochschule source folder not found: {source_root}")
    catalog = build(source_root, args.output.resolve(), args.asset_root.resolve(), args.extraction_dir.resolve())
    print(json.dumps({"output": str(args.output), **catalog["importSummary"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
