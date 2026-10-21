# B2 imported exercises and alternative names

This document describes the earlier telc.site batch. The 18 subsequent Sahla reading additions use native `sourceImport` metadata and the same reading UI; see [Sahla B2 reading import](sahla-b2-reading-import.md) for their destinations, provenance and incomplete-text handling.

The shared catalogue also supports B1 following its separate integration. `baseEntries`, `mergedExercises` and `combinedNames` enumerate both levels by default; pass `{ levels: ["b2"] }` to restrict a caller to B2. The manager API accepts a `level` query parameter and retains B2 as its default. B2 native data and sidecars were preserved during the B1 merge. See `docs/b1-legacy-integration.md` for the B1 destinations and word-bank handling.

The 31 previously standalone additions are now stored in the existing module databases. Their original texts, question identities, names and provenance are preserved. No original exercise or correction was replaced.

- `site/database/lesen.json`: two new partial Themen (**Liebe Karin**, `telc-b2-g1-24`, and **Liebe Sandra – Helgoland**, `telc-b2-g1-37`), containing only Sprachbausteine Teil 1. Four distinct letters are partial versions of their related Themen: **Liebe Lara → Keine Zeit** (`keine-zeit/telc-b2-g1-19`), **Frau Goronsksa → Benzin** (`benzin/telc-b2-g1-23`), **Liebe Clara → Licht** (`licht/telc-b2-g1-28`), and **Jens → Jens (alt)** (`jens-alt/telc-b2-g1-33`). Existing versions and their defaults remain unchanged; missing parts are not copied or fabricated.
- `site/database/horen-codes.json`: 24 additional topics in **Hören Codes B2** (`horen-b2`): eight in Teil 2 and sixteen in Teil 3, containing 160 statements. They are appended, preserving existing topic and statement identities.
- `site/database/shreiben.json`: **Unsere Nachbarschaft vernetzt sich**, appended at index 29 (`task-30`). Existing task indexes and drafts remain unchanged.
- Each imported record has `legacyImport` metadata with its stable source ID, alternative names, provenance, visibility and review status. Exercise content exists only in its native record.
- `site/database/exercise-additions.b2.json`: its `exercises` array is now empty. A `migrated` manifest records all 31 source IDs and native destinations, without duplicating their content.
- `site/database/exercise-names.b2.json`: names scoped to 427 existing exercise locations. Existing titles, corrections, default versions and progress keys remain unchanged. Names for complete Themen can also be added in the manager.

The exact pre-merge bytes of the four modified databases and the full destination report are in `output/b2-theme-merge-2026-10-11/`.

## Learner navigation

Open the B2 library and choose a module. Reading has tabs for **Themen**, **Teil 1–3**, and **Sprachbausteine 1–2**. The **Themen** tab retains the original groups and order, including incomplete groups, and labels their available parts. The two new partial Themen appear at the end. Part tabs include the imported native records once. Searching either view also finds alternative names.

Themen cards show a title, their available parts, the number of versions when there is more than one, and one main action. Zero-percent results and progress bars are omitted until a real attempt exists. Partial-topic titles show their part information in the subtitle instead of repeating it inside the title. Download and share remain available through the **⋯** actions menu. Exercise cards retain task counts, audio availability and expandable alternative names/locations. No whole-Thema score is presented as an individual-part score. On mobile, **Ändern** expands the level/module controls; desktop keeps those controls visible.

Clicking a Thema with one visible version opens `lesen.html` directly, including partial Themen. A Thema with multiple visible versions opens a modal popup over the current library. Each choice shows its available parts, the **Neu** badge for imported versions and any real previous result. Choosing a version uses its existing native URL and progress identity. Escape, the close button or clicking the backdrop dismisses the popup and restores focus to the originating card. Keyboard focus stays within the popup. Search and scroll position remain available when returning from practice; older saved version-selection stages resolve to the library instead of a separate version page.

The **Neu** badge identifies only the 31 imported additions using their `legacyImport` metadata. It appears on their exercise cards, the two new partial Themen, imported version cards and imported practice headers. Existing parent Themen and original versions keep their existing identity and receive no new badge. **Nicht begonnen** is a separate practice status for exercises without a saved attempt.

An existing exercise opens its original practice page with the selected Teil, topic or writing task. Its existing correction and progress identity remain authoritative. Equivalent copies can list several Thema/version locations rather than choosing an ambiguous destination automatically.

Imported Lesen exercises render directly in `lesen.html`, using the same text panel, interactive gaps, answer panel, settings, timer and part navigation as every other Thema. Their native versions contain only available parts. Old `einzeluebung.html?exercise=<stable-source-id>` links redirect to the native Thema/version/part URL. Listening and writing imports continue to use their review-aware individual practice view.

Imported answers or writing drafts remain saved under the same `zdeutsch.exercise-additions.v1:<id>` key used before the merge. Lesen reads and writes that key directly, preserving answers across reloads, version switches and old direct links. No existing reading score or writing draft is reused.

At the owner's request, imported keys are used for normal practice checking when an exercise has no existing ZDeutsch counterpart. All six merged grammar exercises already contain ten source answers, and all 24 listening sets contain their source keys. Existing B2 records have complete keys and were not overwritten. The current native record is authoritative, including subsequent manager corrections. Related themes with different exercise texts/options retain their own keys; answers are not copied just because titles or gap numbers match.

The public practice pages use the normal correct/incorrect option styling and score, without the extra “Lösung im alten Bestand” line. Missing or invalid imported keys disable checking. The manager retains the independent review status and original provenance; using a source key does not falsely mark it verified. None of the imported audio links is attached to playback: the recordings still need availability and correspondence checks. The public pages display only reviewed local recordings.

## Manager

Open **Ergänzungen** at `/dashboard/ergaenzungen`.

The **Importierte Übungen** tab edits the merged native records: title, alternative names, visibility, text/questions/options, solutions, and review note. The editor displays their native destination. Changing exercise content resets review status. Marking solutions as checked requires a review note. A reviewed recording must be an existing local file under `assets/audio/` and have its own review note. Original question identities cannot be changed through this editor.

The **Namen und Zuordnungen** tab edits scoped names and optional subtitles. Use the target selector to add names to another Teil or to a **complete Thema**. This does not rename its current title. Every target remains explicit; repeated names can refer to several items.

Mappings are guarded by a content fingerprint that excludes corrections. Updating a correct answer does not remove the names. Replacing the exercise text/options makes the mapping unavailable until it is reviewed. The manager can confirm the revised mapping with a note. Array-based writing and speaking references are also guarded against unnoticed reordering.

The API is behind the existing dashboard authentication. Imported-content edits use the existing native database repository, with atomic writes, serialised mutations and revision checks. Name-index writes retain their sidecar revision checks. Stale edits receive HTTP 409 instead of replacing a newer change. The manager's existing repository publisher includes these database files.

Imported listening sets keep their separate practice progress and review-aware scoring. They do not affect the existing Hören Codes collection score until opened and practised separately.

## Repeating or reviewing the import

The reviewed source plan is `scripts/data/b2-legacy-plan.json`. Source IDs, original listening question blocks and source/target fingerprints are pinned in it. The importer uses public JSON endpoints from `telc.site` by default:

```sh
node scripts/import-b2-legacy.cjs --dry-run
node scripts/import-b2-legacy.cjs
```

An archived folder containing `<quiz-id>.json` files can be supplied instead:

```sh
node scripts/import-b2-legacy.cjs --source-dir /absolute/path/to/source-quizzes
```

An identical rerun recognises the native `legacyImport` records, adds nothing and preserves manager edits, changed keys, visibility and intentionally removed aliases. A manifest entry whose native record is missing requires review; it is not silently recreated. Changed source content or changed target text requires review; it is not overwritten automatically. Original database hashes are checked during the import.

The standalone-to-native migration is also repeatable:

```sh
node scripts/merge-b2-themen.cjs --dry-run
node scripts/merge-b2-themen.cjs --backup-dir /absolute/path/to/new-backup-folder
```

It backs up exact original bytes before writing, checks that the source files have not changed, and stages all outputs. Once the exercises have been merged, rerunning it writes nothing. To undo only this migration immediately, restore the four backed-up JSON files together; do not restore them over subsequent manager edits.

Disable additions in the manager to remove them from the learner view without deleting existing exercises or drafts. A catalogue-loading failure leaves the original Themen library usable.

## Checks

```sh
node --test test/exerciseIntegration.test.js test/exerciseThemeMerge.test.js test/exerciseCatalogMergedService.test.js test/lesenImportState.test.js test/sprachbausteineUtils.test.js
npm run check
npm run build
```

Tests cover import counts, explicit part routing, name ambiguity, content-fingerprint guards, unchanged original records, merge/import idempotence, exact backups, native manager edits, invalid keys and concurrent stale writes. Browser checks cover the library, merged exercise routing, review status and mobile layout.

The old speaking question banks/PDF model dialogues and the other twelve changed reading/writing counterparts are not duplicated as exercises. They remain optional supplementary content outside this import.
