"""Read-only content comparison of the archived telc.site B1 quizzes."""
import collections
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/b1-legacy-integration"
SOURCE = OUT / "source"
PARTS = {"LesenTeil1": "teil-1", "LesenTeil2": "teil-2", "LesenTeil3": "teil-3", "SprachbausteineTeil1": "sprachbausteine-1", "SprachbausteineTeil2": "sprachbausteine-2"}


def norm(value):
    value = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    value = re.sub(r"\[\[\s*\d+\s*\]\]|\(\d+\)\s*_+", " gap ", value)
    value = unicodedata.normalize("NFKD", value).replace("ß", "ss")
    return " ".join(re.findall(r"[\w]+", "".join(c for c in value.lower() if not unicodedata.combining(c))))


def numbered(value):
    return re.sub(r"^\s*\d+\s*[.)]\s*", "", str(value or ""))


def grams(value):
    tokens = norm(value).split()
    return set(zip(tokens, tokens[1:], tokens[2:]))


def similarity(a, b):
    ga, gb = grams(a), grams(b)
    return 2 * len(ga & gb) / (len(ga) + len(gb)) if ga or gb else 0


def strings(values):
    return [v if isinstance(v, str) else v.get("text", v.get("value", "")) for v in (values or [])]


def native_signature(content, part):
    if part == "teil-1": return strings(content.get("texts")), strings(content.get("headlines"))
    if part == "teil-2":
        passage = content.get("passage", {})
        return [passage.get("text") or "\n".join(strings(passage.get("paragraphs")))], [numbered(q.get("prompt")) for q in content.get("questions", [])] + [x for q in content.get("questions", []) for x in strings(q.get("options"))]
    if part == "teil-3": return strings(content.get("ads")), strings(content.get("situations"))
    if part.startswith("sprach"):
        body = content.get("text") or "".join(s.get("value", " gap ") for s in content.get("segments", []))
        options = [str(x) for b in content.get("blanks", []) for x in b.get("options", [])] if part.endswith("1") else strings(content.get("wordBank") or content.get("options"))
        return [body], options
    return [numbered(s.get("text")) for s in content.get("statements", [])], []


def old_signature(source, part):
    qs = source.get("questions", [])
    if part == "teil-1": return [numbered(q["text"]) for q in qs], source.get("dragOptions", [])
    if part == "teil-2": return [source.get("passage", "")], [numbered(q["text"]) for q in qs] + [o for q in qs for o in q.get("options", [])]
    if part == "teil-3": return [q["text"] for q in qs], source.get("dragOptions", [])
    if part.startswith("sprach"): return [source.get("clozeText", "")], [o for q in qs for o in q.get("options", [])] if part.endswith("1") else source.get("dragOptions", [])
    return [numbered(q["text"]) for q in qs], []


def main():
    db = {f: json.loads((ROOT / "site/database" / f).read_text()) for f in ["lesen.json", "horen-codes.json", "horen-audio.json"]}
    current = []
    for tk, theme in db["lesen.json"]["levels"]["b1"]["themes"].items():
        for vk, version in theme["versions"].items():
            for pk, part in version["lesen"]["parts"].items():
                units, options = native_signature(part["content"], pk)
                current.append({"target": {"file": "lesen.json", "level": "b1", "kind": "part", "themeKey": tk, "versionKey": vk, "partKey": pk}, "title": theme["title"], "version": version.get("label"), "units": units, "options": options})
    for file in ["horen-codes.json", "horen-audio.json"]:
        for tk, theme in db[file]["levels"]["b1"]["themes"].items():
            for pk, part in theme["hören"]["parts"].items():
                for topic in part["content"].get("topics", []):
                    units, options = native_signature(topic, "horen")
                    current.append({"target": {"file": file, "level": "b1", "kind": "topic", "themeKey": tk, "partKey": pk, "topicId": topic["id"]}, "title": topic["title"], "units": units, "options": options})
    rows = []
    for entry in json.loads((SOURCE / "b1-entries.json").read_text()):
        source = json.loads((SOURCE / (entry["id"] + ".json")).read_text())
        if entry["category"] == "Hören":
            groups = []
            for q in source["questions"]:
                title = q.get("sectionTitle", "")
                if not groups or groups[-1][0] != title: groups.append((title, []))
                groups[-1][1].append(q)
            sources = [(title, "teil-" + entry["title"][-1], {"questions": qs}, "#q" + str(qs[0]["id"]) + "-" + str(qs[-1]["id"])) for title, qs in groups]
        else: sources = [(entry["title"], PARTS[entry["category"]], source, "")]
        for title, part, subset, suffix in sources:
            units, options = old_signature(subset, "horen" if suffix else part)
            candidates = []
            for record in current:
                if record["target"]["partKey"] != part or bool(suffix) != (record["target"]["kind"] == "topic"): continue
                body = similarity("\n".join(units), "\n".join(record["units"]))
                option_score = similarity("\n".join(sorted(options)), "\n".join(sorted(record["options"]))) if options else 1
                candidates.append({"target": record["target"], "title": record["title"], "version": record.get("version"), "bodySimilarity": round(body, 4), "optionsSimilarity": round(option_score, 4), "score": round(body * .85 + option_score * .15, 4)})
            candidates.sort(key=lambda x: x["score"], reverse=True)
            best = candidates[:3]
            rows.append({"sourceId": entry["id"], "sourceReference": entry["id"] + suffix, "menuTitle": title, "sourceTitle": source["title"], "category": entry["category"], "partKey": part, "questionIds": [q["id"] for q in subset.get("questions", [])], "sourceFingerprint": hashlib.sha256(json.dumps(subset, ensure_ascii=False, sort_keys=True).encode()).hexdigest(), "candidates": best})
    OUT.mkdir(exist_ok=True, parents=True)
    (OUT / "audit-candidates.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    print("Old exercise groups:", len(rows), collections.Counter(r["category"] for r in rows))
    for row in rows:
        best = row["candidates"][0]
        print(row["sourceReference"], row["partKey"], row["menuTitle"], "=>", best["title"], best["target"].get("versionKey", best["target"].get("topicId")), best["bodySimilarity"], best["optionsSimilarity"])


if __name__ == "__main__": main()
