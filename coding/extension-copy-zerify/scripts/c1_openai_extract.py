#!/usr/bin/env python3
"""Extract structured C1 Hochschule content from selected PDF pages with OpenAI.

This helper intentionally caches every response by source hash, page selection,
prompt, schema and model. It never logs the API key and sends source files with
``store: false``.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from pypdf import PdfReader, PdfWriter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE = ROOT / "tmp" / "pdfs" / "c1-ai" / "cache"


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def parse_pages(value: str, page_count: int) -> list[int]:
    """Return unique zero-based page indexes from a 1-based range string."""
    result: list[int] = []
    for fragment in value.split(","):
        fragment = fragment.strip()
        if not fragment:
            continue
        if "-" in fragment:
            start_raw, end_raw = fragment.split("-", 1)
            start, end = int(start_raw), int(end_raw)
        else:
            start = end = int(fragment)
        if start < 1 or end < start or end > page_count:
            raise ValueError(f"Invalid page range {fragment!r}; document has {page_count} pages")
        for number in range(start, end + 1):
            index = number - 1
            if index not in result:
                result.append(index)
    if not result:
        raise ValueError("No pages selected")
    return result


def selected_pdf(source: Path, pages: list[int]) -> bytes:
    reader = PdfReader(source)
    writer = PdfWriter()
    for index in pages:
        writer.add_page(reader.pages[index])
    import io

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def response_text(payload: dict[str, Any]) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                return content["text"]
    raise RuntimeError(f"OpenAI response did not contain output text (status={payload.get('status')})")


def call_openai(
    *,
    pdf_bytes: bytes,
    filename: str,
    prompt: str,
    schema: dict[str, Any],
    model: str,
    cache_dir: Path,
    cache_material: bytes,
) -> dict[str, Any]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha256(cache_material).hexdigest()
    cache_path = cache_dir / f"{cache_key}.json"
    if cache_path.is_file():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    body = {
        "model": model,
        "store": False,
        "reasoning": {"effort": "high"},
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "filename": filename,
                        "file_data": "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode("ascii"),
                    },
                    {"type": "input_text", "text": prompt},
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "c1_hochschule_extraction",
                "strict": True,
                "schema": schema,
            }
        },
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    organization = os.environ.get("OPENAI_ORG")
    project = os.environ.get("OPENAI_PROJECT")
    if organization:
        request.add_header("OpenAI-Organization", organization)
    if project:
        request.add_header("OpenAI-Project", project)
    try:
        with urllib.request.urlopen(request, timeout=900) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed ({error.code}): {details[:2000]}") from error

    parsed = json.loads(response_text(payload))
    cache_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--pages", required=True, help="1-based pages, e.g. 1-5,9")
    parser.add_argument("--prompt-file", type=Path, required=True)
    parser.add_argument("--schema-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default=os.environ.get("OPENAI_C1_MODEL", "gpt-5.4-mini"))
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    args = parser.parse_args()

    load_env(ROOT / ".env")
    source = args.pdf.expanduser().resolve()
    reader = PdfReader(source)
    pages = parse_pages(args.pages, len(reader.pages))
    prompt = args.prompt_file.read_text(encoding="utf-8")
    schema = json.loads(args.schema_file.read_text(encoding="utf-8"))
    pdf_bytes = selected_pdf(source, pages)
    material = b"\0".join(
        [
            source.read_bytes(),
            args.pages.encode(),
            prompt.encode(),
            json.dumps(schema, sort_keys=True).encode(),
            args.model.encode(),
        ]
    )
    result = call_openai(
        pdf_bytes=pdf_bytes,
        filename=f"{source.stem}-pages-{args.pages.replace(',', '_')}.pdf",
        prompt=prompt,
        schema=schema,
        model=args.model,
        cache_dir=args.cache_dir.resolve(),
        cache_material=material,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "items": len(result.get("themes", []))}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
