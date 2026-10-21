# Sahla B2 reading additions — 21 October 2026

The 18 reading/grammar parts explicitly approved after the ZIP comparison are appended to `site/database/lesen.json`. Each is a new partial Thema with a single `default` version containing only its available part. Existing Themen, version defaults, part contents, keys and order are preserved, and B1 is unchanged. Actual B2 totals are now 71 Themen, 88 versions and 267 parts; the previously stale cached totals were recomputed.

The pinned original records are in `scripts/data/sahla-b2-reading-2026-10-21.json`. They come from the supplied `sahla-all-content-2026-10-21.zip`, SHA-256 `81156b034b51fa25c1a778af8337a899bdb2985e278c903361ff24381d92a85c`. No source URLs are fetched by the importer.

| Part | New Thema keys (prefix `sahla-b2-`) |
|---|---|
| Lesen 1 | `wohnen`, `lebensmodelle`, `gesundheit-symptomen`, `das-alte-leben` |
| Lesen 2 | `kreuzfahrttourismus`, `lebenslanges-lernen` |
| Lesen 3 | `geschaeftsreisen`, `geschenk-fuer-ihren-zehnjaehrigen`, `ein-austauschjahr` |
| Sprachbausteine 1 | `liebe-anna-neu`, `hey-jan`, `hallo-jakob` |
| Sprachbausteine 2 | `die-katzen`, `die-rueckkehr-des-nachtzugs`, `die-reise-im-schlafwagen`, `garten-in-der-stadt`, `hobby-und-charakter`, `sprachwandel` |

## Native data and keys

Reading uses the existing `texts/headlines/answers`, `passage/questions`, and `situations/ads/answers` shapes. Grammar uses `text`, `segments`, `blanks`, `answers`, plus per-gap options or a word bank. Headline/ad IDs are uppercase to match the renderer; the usual X choice means no matching advertisement. Source gap IDs are mapped to 21–30 or 31–40; `sourceQuestionId` retains the old IDs. The two occurrences of Hey Jan gap 8 remain two occurrences of native gap 28, allowing the existing paired-option renderer to show both halves.

Source texts, option words and keys are not rewritten. Available translations, explanations, summaries and keywords are retained on their corresponding items. The complete original source fields remain pinned separately, including original spelling, notes and annotations. New keys pass structural option-membership checks but retain `review.answerStatus: "unverified"`; this import does not establish their pedagogical correctness.

Garten in der Stadt explicitly reports an incomplete ending in its source. Its available text and keys are retained, but `sourceImport.review.contentStatus: "incomplete"` disables grading and numerical results. The practice page explains this limitation. No missing continuation was invented.

## Metadata and navigation

These additions use `content.sourceImport` for stable source identity, names, source collection/record/pointer, source/ZIP hashes and review notes. They are ordinary native exercises, using normal Thema/version/part navigation, native progress and the normal Lesen editor. They are not standalone `exercise-additions` records and are not added to the older legacy additions manager.

The older `legacyImport` records and their separate saved progress retain their existing behavior. Shared library search reads aliases from either metadata object. Only imported/new records receive Neu on their Thema card, part card and practice header. A single-version Thema opens directly in `lesen.html`.

`ZDeutschExercises.hasAnswerKey` now also checks the three native reading shapes. `ZDeutschLesenImports.canScore` uses it for `sourceImport` records and blocks incomplete source texts. Existing original records keep their grading behavior. All 594 existing fingerprint-guarded alias mappings remain valid.

## Repeating and verifying

```sh
node scripts/import-sahla-b2-reading.cjs --dry-run
node scripts/import-sahla-b2-reading.cjs --backup-dir /absolute/path/to/unused-backup
node --test test/sahlaReadingImport.test.js test/lesenImportState.test.js test/b1LegacyIntegration.test.js test/exerciseIntegration.test.js test/exerciseThemeMerge.test.js test/sprachbausteineUtils.test.js
npm run check
npm run build
```

Rerunning adds nothing and preserves later edits and corrected keys. Changed source fingerprints or occupied destinations stop the import for review. A normalized native content check also prevents adding an equivalent exercise already stored elsewhere.

The live import backed up exact previous database bytes before an atomic replacement with a concurrent-change check. Its report and preservation evidence are in `output/sahla-b2-import-2026-10-21/`. All 53 pre-existing B2 Themen and all other 56 current JSON files were verified unchanged. The earlier comparison report remains a historical pre-import snapshot.
