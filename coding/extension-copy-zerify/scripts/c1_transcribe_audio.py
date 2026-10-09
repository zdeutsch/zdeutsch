#!/usr/bin/env python3
"""Transcribe C1 Hochschule audio with OpenAI without exposing credentials."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() not in os.environ:
            os.environ[key.strip()] = value.strip().strip('"').strip("'")


def multipart(fields: dict[str, str], file_path: Path) -> tuple[bytes, str]:
    boundary = f"----zdeutsch-{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )
    mime_type = mimetypes.guess_type(file_path.name)[0] or "audio/mpeg"
    chunks.extend(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'.encode(),
            f"Content-Type: {mime_type}\r\n\r\n".encode(),
            file_path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    return b"".join(chunks), boundary


def transcribe(source: Path, seconds: int, model: str, cache_dir: Path) -> dict:
    digest = hashlib.sha256(source.read_bytes() + f"{seconds}:{model}".encode()).hexdigest()
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{digest}.json"
    if cache_path.is_file():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    with tempfile.TemporaryDirectory(prefix="zdeutsch-c1-audio-") as temp_dir:
        snippet = Path(temp_dir) / "snippet.mp3"
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                "-t", str(seconds), "-ac", "1", "-ar", "16000", "-codec:a", "libmp3lame", "-q:a", "5", str(snippet),
            ],
            check=True,
        )
        body, boundary = multipart(
            {
                "model": model,
                "language": "de",
                "response_format": "json",
                "prompt": "TELC Deutsch C1 Hochschule Hörverstehen. Transkribiere Eigennamen und das vorgestellte Thema genau.",
            },
            snippet,
        )
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        request = urllib.request.Request(
            "https://api.openai.com/v1/audio/transcriptions",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )
        if os.environ.get("OPENAI_ORG"):
            request.add_header("OpenAI-Organization", os.environ["OPENAI_ORG"])
        if os.environ.get("OPENAI_PROJECT"):
            request.add_header("OpenAI-Project", os.environ["OPENAI_PROJECT"])
        try:
            with urllib.request.urlopen(request, timeout=900) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"OpenAI transcription failed ({error.code}): {details[:2000]}") from error
    cache_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--seconds", type=int, default=120)
    parser.add_argument("--model", default="gpt-4o-mini-transcribe")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    load_env(ROOT / ".env")
    result = transcribe(
        args.audio.expanduser().resolve(),
        args.seconds,
        args.model,
        ROOT / "tmp" / "audio" / "c1-ai" / "cache",
    )
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
        print(json.dumps({"output": str(args.output)}, ensure_ascii=False))
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
