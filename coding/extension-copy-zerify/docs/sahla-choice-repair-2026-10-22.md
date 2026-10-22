# Sahla choice repair — 22 October 2026

Applied to the ZDeutsch database. This report records the original choice-repair batch; subsequent content corrections are documented in `content-repair-2026-10-22.md`.

## Results

- Restored TAMARA / Jakob, Lesen Teil 3, advert G from the Sahla export: **Ferienwhg. u. Häuser an der Nordsee**. Updated its Arabic translation and the advert highlights for situation 16. Advert F and all answer letters remain unchanged.
- Restored **81 missing word choices** across 15 Sprachbausteine Teil 2 versions.
- Repaired Batata's malformed `wordBank`, which contained `[object Object]` instead of usable entries; its existing 15 visible choices remain unchanged.
- Replaced Andreas Version 2's unrelated word bank with the matching Sahla **Jan** bank. The passage and all ten saved answers match that source variant.
- Restored the missing **deine** distractor in Keine Zeit, Sprachbausteine Teil 1, gap 21. The old list was `dein, dein, deinen`; the repaired list is `dein, deine, deinen`. Source: Sahla **Liebe Lara**.
- Aligned choice casing with the existing stored answers in Caroline (one word) and Iris (four words). The answer keys were preserved.
- Updated 16 name-index fingerprints so existing search aliases remain bound after the choice changes.

No grammar passage, answer key, theme name, version order or C1 UI setting was changed. Existing translations, explanations and highlights were preserved except the incorrect TAMARA G translation and its now-invalid advert highlights.

## Restored incomplete word banks

| Level | Theme / version | Before | After | Sahla source |
|---|---|---:|---:|---|
| B1 | Rita | 10 | 15 | Rita |
| B1 | Vera / default | 10 | 15 | Vera |
| B1 | Paul | 10 | 15 | Paul |
| B1 | Miroslav / default | 10 | 15 | Miroslav |
| B1 | Miroslav / Version 2 | 0 | 15 | Miroslav 2. |
| B1 | Sonja | 10 | 15 | Sonja |
| B1 | Nadja / Claudia | 10 | 15 | Nadja / Claudia |
| B1 | Viktor | 10 | 15 | Viktor |
| B1 | Moritz | 10 | 15 | Moritz |
| B1 | Petra | 10 | 15 | Petra |
| B1 | Tamara / Jakob | 10 | 15 | Sonja — same current text/key variant |
| B1 | Nicole | 10 | 15 | Nicole |
| B1 | Thomas / Anna / default | 10 | 15 | Thomas / Anna |
| B1 | Sophie | 10 | 15 | Sophie |
| B2 | Licht | 14 | 15 | Sicherer Schulweg |

Licht's missing word was **LÖSUNGEN**, already present in its answer key. ZDeutsch's existing spelling **STATT** was retained instead of importing Sahla's typo `ststt`.

TAMARA's existing grammar text uses **ALS, WICHTIGEN, STATT**. Sahla's TAMARA record uses different gap positions and **BEIM, WEGEN, VON**. This repair uses Sahla's matching **Sonja** choices, preserving the current ZDeutsch passage and corrections.

## Verification

- Audited **169 grammar exercise versions**: 86 Sprachbausteine Teil 1 and 83 Sprachbausteine Teil 2.
- All **83 Teil 2 versions** now contain 15 distinct visible choices.
- Verified all **19 repaired Teil 2 word banks** in the actual reading UI: 15 rendered choices in each.
- Verified TAMARA's seaside advert in the UI.
- **27 focused tests passed**, covering exact correction preservation, variant matching, word banks, search aliases, native manager saves, paired gap answers, backup integrity and repeatable execution.
- Re-running the repair reports zero remaining changes.

## Cases without a matching Sahla source

These imported exercises were left for source review rather than inventing distractors:

1. **B2 Liebe Karin** (`telc-b2-g1-24/default`), Sprachbausteine Teil 1, gap 24: the imported source has `anderen, anderen, andere` — only two distinct choices. Sahla's records also called Liebe Karin contain different exercises.
2. **B1 DIE PERFEKTE BEWERBUNG** (`thomas-anna/telc-b1-267`), Sprachbausteine Teil 2: 15 choices exist, but the stored answer **GERNE** for gap 40 is absent. No matching Sahla exercise was found. Its existing key also reuses WENN and BEI, so the original exercise needs a separate correction review.

An additional existing issue observed during the audit: Alicia Version 1, Sprachbausteine Teil 1, stores duplicate sets of blank identifiers (`Lücke 21` and `21`, etc.). Its three choices are present; this identifier issue was not changed by the choice repair.

## Source, files and recovery

Source archive: `sahla-all-content-2026-10-21.zip`, `sahla-content/data.json`.

Archive SHA-256: `81156b034b51fa25c1a778af8337a899bdb2985e278c903361ff24381d92a85c`.

Changed application files:

- `site/database/lesen.json`
- `site/database/exercise-names.b1.json`
- `site/database/exercise-names.b2.json`

The reviewed source fixtures and importer are in `scripts/data/sahla-choice-repair-2026-10-22.json`, `scripts/data/sahla-choice-extra-repair-2026-10-22.json` and `scripts/repair-sahla-choices.cjs`. The importer checks the reviewed text and correction keys before a pending repair and refuses to overwrite unexpected edits.

Exact original file backups and the first repair report are in `output/sahla-choice-repair-2026-10-22/backup/`. The second pass has its own backup and report in `additional-backup/`. The first `backup/lesen.json` is the complete database before any repair in this task.

Browser verification: `output/sahla-choice-repair-2026-10-22/browser-choice-checks.json` and the TAMARA screenshots in the same folder.
