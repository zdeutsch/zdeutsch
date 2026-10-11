# B1 legacy integration

The public telc.site B1 catalogue was compared on 2026-10-11: 88 catalogue entries represent 124 exercise groups (85 Lesen/Sprachbausteine exercises and 39 listening groups). There are 121 matches in B1, one match already in B2, and two missing word-bank exercises. Matching uses the actual texts/questions/options and explicit locations, not only names. Older source differences do not replace current corrections.

## Native storage

Both additions are partial versions in `site/database/lesen.json`:

| Old source | Title | Thema key | Version key | Part |
|---|---|---|---|---|
| 265 | WIR SIND FÜR SIE DA! | `vera` | `telc-b1-265` | `sprachbausteine-2` |
| 267 | DIE PERFEKTE BEWERBUNG | `thomas-anna` | `telc-b1-267` | `sprachbausteine-2` |

Each version contains only Sprachbausteine 2. Existing default versions, all 35 original B1 versions and all B2 content were preserved. B1 still has 26 Themen, now containing 37 versions and 152 parts; the aggregate counters were updated. Other existing database files, including B2 sidecars, were not changed.

The new content uses the normal word-bank structure: `text` with `[[31]]`–`[[40]]`, `segments`, `options`, `wordBank`, `blanks` and `answers`. `sourceQuestionId` retains old IDs 1–10. `legacyImport` contains stable IDs `legacy:telc:b1:265` and `legacy:telc:b1:267`, names, visibility, source provenance, source issues and independent review status. There is no separate duplicate payload.

`site/database/exercise-names.b1.json` stores aliases for 167 existing B1 locations from 171 source-to-target mappings, with the same schema and content-fingerprint guards as B2. `site/database/exercise-additions.b1.json` has `schemaVersion: 1`, an empty `exercises` array and a two-entry `migrated` manifest.

Old JAKOB2 / Liebe Lara (source 284) already exists in B2 → Keine Zeit → default → Sprachbausteine 1. It was reported as found outside B1 and was not duplicated, reclassified or used to overwrite existing B2 corrections. The old B1 catalogue exposes no writing or speaking category, so no unlisted content was fabricated or imported.

## Answers

The original keys are preserved but unusable in the normal one-word-once format. Source 265 reuses DREI and AUCH. Source 267 reuses WENN and BEI, and GERNE is absent from its word bank. Practice is available, but checking and numerical results are disabled. The result page reports answered gaps only. These exercises retain `review.answerStatus: "unverified"`.

Corrections to native `answers` remain authoritative. Word-bank checking requires every gap to have an available, distinct answer with the same case as the displayed bank. Grading becomes available when the current key is usable; an independent verified review still requires a note. `applyMergedExercise` synchronises answers with the derived segments and existing blank-answer fields. Do not invent missing words or overwrite corrected keys from the source on a repeat import.

## Shared code and agent adaptation

The catalogue now supports B1 and B2. `baseEntries`, `mergedExercises` and `combinedNames` default to both levels. Pass `{ levels: ["b1"] }` or `{ levels: ["b2"] }` when a caller needs one level. `resolveTarget` checks `target.level`. `mergedExercise` derives its level from the target, rather than hardcoding B2. Existing B2 runtime payloads keep their previous shape; word-bank exercises additionally expose `options` and `wordBank`.

`load("b1")` and `load("b2")` read their respective sidecars. `loadAll()` combines the catalogues for shared learner navigation. Filter names by `target.level`, including on the native Lesen page, to avoid accidentally attaching names from another level to matching theme/version keys.

The manager's Ergänzungen page has a B1/B2 selector. Its API uses `?level=b1` or `?level=b2` on catalogue, targets, addition updates and name updates. Omission retains the existing B2 default. Writes use the correct level's sidecar repository or native record, with existing revision/concurrency protection. Name targets from another level are rejected. Reviewed word-bank keys must be usable; historical invalid keys can remain unverified for practice.

Imported progress remains `zdeutsch.exercise-additions.v1:<legacyImport.id>`. Normal original progress keys stay unchanged. Only imported versions/exercises receive Neu. B1 uses the same part tabs and version popup as B2, and both additions render in `lesen.html`.

## Repeating the merge and validation

Pinned source snapshots for the two additions are in `scripts/data/b1-legacy-sources/`; the reviewed plan is `scripts/data/b1-legacy-plan.json`.

```sh
node scripts/merge-b1-legacy.cjs --source-dir scripts/data/b1-legacy-sources --dry-run
node scripts/merge-b1-legacy.cjs --source-dir scripts/data/b1-legacy-sources --backup-dir /absolute/path/to/new-backup
node --test test/b1LegacyIntegration.test.js test/exerciseCatalogMergedService.test.js test/exerciseIntegration.test.js test/exerciseThemeMerge.test.js test/lesenImportState.test.js test/themeVersionGrouping.test.js test/sprachbausteineUtils.test.js
npm run check
npm run build
```

Reruns add zero records and write nothing, preserving edits, visibility, corrected keys and intentionally removed names. Changed source content, changed referenced content or a missing migrated record requires review. The merger backs up exact bytes, stages outputs and checks for concurrent changes before replacing a file.

The full 124-group comparison with every source and destination is `output/b1-legacy-integration/b1-comparison-report.md`. Exact pre-merge backups and preservation evidence are in the same output directory. Do not restore those snapshots over later manager corrections.
