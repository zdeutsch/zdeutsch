# B1/B2 content corrections — 22 October 2026

Applied **22 targeted repairs** to the ZDeutsch reading database. This report records the reviewed content changes and their validation; deployment is handled separately from this repair batch.

## Applied changes

| Thema / version | Correction |
|---|---|
| B2 Bäder; B2 Autos; B1 Laura | Added the missing X / Keine passende Anzeige choice. Existing answer letters remain unchanged. |
| B1 Alicia, Version 2 (`version-1`) | Reduced twenty duplicate blank rows to ten numeric IDs. Removed “Here you go:” from the passage and regenerated matching segments. |
| B2 Liebe Karin (`telc-b2-g1-24`) | Gap 24 now offers `anderen / anderem / andere`. `anderen` remains the correct answer. This is an editorial distractor correction; the Sahla records with this name contain different passages. |
| B1 Vera (`telc-b1-265`) | Repaired the imported exercise's malformed phrases and repeated bank words. Gaps 31–34 are now MEHRMALS / DREIMAL / UND / ALLE. Adjusted “und zwar” and “Darin sind alle Lehrmaterialien enthalten” without changing their meaning. Fifteen bank words, ten distinct required answers. |
| B1 Thomas / Anna (`telc-b1-267`) | Corrected `bei [[33]] Sie` → `bei dem Sie`, `WERDEN Sie gute Chancen` → `HABEN Sie gute Chancen`, distinguished WENN and FALLS, and included GERNE. Fifteen bank words, ten distinct required answers. |
| B1 Karla | Gap 22 is now **ohne**, matching Sahla and the stored accusative plural Motorräder. Updated the Arabic phrase and derived answer segments. |
| B1 Tamara / Jakob; B1 Sonja | Corrected **eine Zeitschrift**, **Ratschläge**, and sentence capitalization. Preserved the current ALS / WICHTIGEN / STATT variant, numbering, word banks and keys. |
| B1 Corina | Gap 39 now uses **ÜBER**, matching the same lottery passage in Caroline and both matching Sahla sources. |
| B1 Caroline, default root projection | Updated the stale root copy to agree with the already-correct active lottery exercise. |
| B2 Mobarmijine; B2 Tanzkurs (`version-1`) | Situation 20 now matches advert **G**, which discusses mountaineering accidents and rescue services. Matches Insel and Sahla Aflam. Added relevant valid advert highlights. |
| B2 Teleshopping (`teleshopping-alt`) | Restored Sahla's **EHER** at gap 31 and **SOGAR** at gap 38. Both are distinct existing choices. |
| B1 Paul; B1 Tamara / Jakob; B1 Jennifer | Repaired the shared Popper passage's OCR damage, incomplete grammatical links and punctuation. Preserved the questions, choices, answer letters, names and existing numerical information. Synchronized full text, paragraphs, affected Arabic wording and passage highlight offsets. This is an editorial restoration of the existing material, not a verbatim Sahla import; Sahla shares the damaged German text. |
| B2 Jens; B1 Nicole; B1 Caroline, Version 4 (`version-3`) | Synchronized derived segment answers with primary keys. Also normalized Caroline's `Lücke 21` IDs to numeric IDs so the visible gaps and choices use the same identifiers. Nicole's stale root key now agrees with its active version. |
| B1 Mara, Standard (`mara-alt/default`) | Removed only the completely empty Sprachbausteine 1 placeholder and its tab. Sahla explicitly marks it unavailable and contains no questions. All three real reading parts and the other Mara version remain intact. |

The original Vera/Thomas imports contained these errors. Their cached source records and historical `provenance.sourceIssues` are preserved. Their review notes describe the editorial repair; these changes are not attributed to a matching Sahla exercise.

## Preserved data and visibility

- All theme names, aliases, default versions, version orders and theme orders are preserved.
- Seven B1 name-index fingerprints were refreshed so aliases remain attached after content edits. No names were renamed or removed.
- Only `site/database/lesen.json` and `site/database/exercise-names.b1.json` changed. The other ten top-level JSON database files are unchanged.
- No reader layout changes were required. The repaired data uses the existing native reader.
- C1 Hochschule remains hidden.

## Verification

- **29 focused tests pass**, including backups, guarded patches, repeatability, answer availability, unique word use, gap identifiers, aliases, primary/derived key consistency and highlight positions.
- Verified **ten views in the actual reader**, including Alicia, Caroline, Vera, Thomas/Anna, Mara, Bäder, Autos, Laura, Tamara/Jakob and Paul.
- The follow-up audit covers **418 remaining reading/grammar parts** and reports **zero remaining high- or medium-priority findings from the audit checks**. This does not certify every sentence or answer in the entire database.
- Re-running the repair reports zero changes.

## Still requiring review

- **Praktikum / Praktikanten** and **Herr Bachinger / Buch schreiben** listening corrections require comparing the recordings before choosing a key.
- **Kindertelefon question 8** has overlapping plausible options; retained the current key. **Alex und Cora heading 2** has an existing reasoned override, which was preserved.
- Forty-five translation gap-marker differences are alignment warnings, not confirmed incorrect translations. They were not mechanically rewritten.
- Paired-gap representations, Löwe's explicitly shorter format, and eight explicitly code-only listening topics are supported formats or source limitations, not confirmed errors.

## Recovery and evidence

- Exact pre-change bytes and the repair journal: `output/content-repair-2026-10-22/backup/`.
- Applied and repeat-run reports: `applied-report.json` and `rerun-report.json` in that output folder.
- Before/after audit: `before-audit.json` and `after-audit/content-findings.json`.
- Browser evidence: `browser-checks.json` and `alicia-fixed.png`.
- Final preservation/check summary: `verification.json`.
- Reviewed patch fixture: `scripts/data/content-repair-2026-10-22.json`.
- Guarded repair runner: `scripts/repair-content.cjs`. It rejects unexpected edits to reviewed fields and requires a backup directory for writes.

The plan preparer is pinned to the exact reviewed pre-change database hash and refuses to regenerate the batch from later, corrected content.
