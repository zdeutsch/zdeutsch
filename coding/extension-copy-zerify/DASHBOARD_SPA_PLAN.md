# ZDeutsch dashboard SPA plan

## Product goal

Build one fast React workspace for understanding and editing the exam library. The first screen should answer three questions immediately:

1. What content exists?
2. What is incomplete or risky?
3. Where should the editor work next?

The current JSON files and SQLite tables remain the source of truth. This project will not rename fields, move records, create migrations, or change database structure.

## Database findings

Snapshot analyzed on 2026-09-06:

| Area | Current shape | Volume | Important finding |
| --- | --- | ---: | --- |
| Configuration | `config.json` with modules, timers, scoring, promotions, and ads | 3 active modules | Configuration is small and suited to a guarded settings form. |
| Lesen | `levels -> themes -> versions -> lesen -> parts` | 92 themes, 93 versions, 3,041 answer mappings | 384 of 465 expected sections exist (82.6%). B2 contains 77 of the 81 missing sections. |
| Lesen translations | Item-level `translated` fields | 2,437 of 4,370 tracked items | Current tracked translation coverage is 55.8%. |
| Lesen teaching insight | Optional `reason`, `keywords`, and `highlights` on answers | 1 explanation, 0 keywords, 3 highlights | These fields are structurally supported but largely unpopulated, so they should be shown as enrichment rather than required validity. |
| Hören | `levels -> themes -> hören -> parts -> content.topics -> statements` | 127 topics, 850 statements | All topic and statement IDs are present and unique. There are 401 true and 449 false statements; 8 topics have comments. |
| Schreiben | `levels -> tasks` | 56 tasks | All 56 records contain the four existing required fields. The misspelled source key `istructions` is part of the live contract and must remain unchanged behind an adapter. |
| Mündlich | Separate `levels -> parts` hierarchy | B1 is populated; B2 can be created deliberately as an empty three-part exam | The React manager separates B1/B2, never reuses B1 content for B2, and keeps revision-conflict protection. |
| Sharing | SQLite tables `share_users` and `share_referrals` | Small live dataset | Access must stay behind the existing authenticated aggregate endpoint; the SPA should never query the SQLite file directly. |

The large `lesen.json` file is roughly 9 MB. The dashboard should request compact summaries for navigation and load one selected editor context at a time. It should not fetch the complete raw file into the browser for routine screens.

## Technical direction

Use the stack already installed in the repository:

- React 19 for the UI and reusable editors.
- Vite 7 for development and production bundles.
- React Router 7 for real SPA routes and URL-persisted selection.
- TanStack React Query 5 for API cache, loading/error states, invalidation, and mutations.
- Lucide React for a consistent icon vocabulary.

Add packages only when a migrated workflow needs them. The likely additions are React Hook Form plus Zod for complex editor validation, and a lightweight toast primitive for mutation feedback. Do not add a chart library until the backend contains historical data; current snapshot metrics are clearer as bars, counts, and comparison rows.

## Information architecture

| Route | Purpose | Data source |
| --- | --- | --- |
| `/dashboard` | Library health, coverage, priorities, and source-file status | `GET /api/overview`, `GET /api/health` |
| `/dashboard/lesen` | Searchable B1/B2 theme library | Existing Lesen summary endpoints |
| `/dashboard/lesen/:partKey` | Focused reading and language-building editor | Existing editor-context and part endpoints |
| `/dashboard/horen` | Topic/statement library and editor | Existing Hören endpoints |
| `/dashboard/schreiben` | Task library and markdown editor | Existing Schreiben endpoints |
| `/dashboard/sprechen` | All three oral-exam parts | Dedicated adapter over the existing `mundlich.json` structure |
| `/dashboard/beitraege` | Contribution review queue | Existing contribution endpoints |
| `/dashboard/einstellungen` | Modules, timers, scores, promotion, and ads | Existing configuration endpoints |
| `/dashboard/sharing` | Authenticated referral aggregates | Existing share admin endpoints |

The navigation keeps the most frequent actions visible and uses the URL for level/theme/version/part selection. Former legacy URLs redirect to their matching React routes so users cannot accidentally fall back into the old dashboard.

## Component model

- `AdminLayout`: persistent navigation, mobile drawer, repository status, and publish controls.
- `PageHeader` and shared states: consistent titles, actions, loading, empty, error, and stale-data handling.
- `LibraryPulse`: high-level content volume and coverage without misleading trend charts.
- `ModuleRow`: direct module entry point with meaningful readiness context.
- `PriorityQueue`: computed, actionable gaps such as missing sections and untranslated items.
- `LevelComparison`: B1/B2 inventory comparison.
- `EntityLibrary`: reusable search/filter/list shell for themes, topics, tasks, and reviews.
- `EditorContextBar`: level/theme/version/part selection stored in the URL.
- Field-specific editors: preserve each database shape behind explicit serialization adapters.

## Data-safety rules

1. Never write to `site/database` from UI code. All mutations go through the existing service endpoints.
2. Preserve source keys exactly, including `hören` and `istructions`; translate them only in view-model adapters.
3. Keep the Lesen revision token on saves and surface HTTP 409 as a reload-required conflict state.
4. Do not expose the generic full-file replacement endpoint as a normal dashboard action.
5. Keep repository publish/discard controls separate from form saves and require confirmation for destructive actions.
6. Record database checksums before and after dashboard-only work to prove that no data file changed.
7. Add contract tests for every summary/adapter before migrating its write UI.

## Delivery phases

### Phase 1 — foundation and truthful overview (completed)

- Replace the generic card dashboard with the new control-room shell.
- Add read-only server-side analytics to the existing overview response.
- Show actual part coverage, translations, Hören ID health, and Schreiben completeness.
- Preserve the working Lesen editor while exposing all five parts per theme.

### Phase 2 — core content migration (completed)

- Move Hören, Schreiben, and Sprechen into React routes.
- Introduce shared libraries, filter bars, editor panels, and form validation.
- Add unsaved-change guards and consistent success/error feedback.
- Add reversible theme/part visibility controls based on the existing order arrays, theme-level moves, and guarded Lesen part creation/deletion without a schema migration.

### Phase 3 — operations migration (in progress)

- Move contributions and configuration into the SPA. (Completed.)
- Add an authenticated sharing analytics route. (Completed.)
- Remove legacy-page links and redirect former entry URLs into the SPA. (Completed.)

### Phase 4 — hardening

- Keyboard and screen-reader pass, 200% text zoom, and responsive testing.
- API contract tests, stale-revision tests, and mutation regression tests.
- Bundle analysis and route-level lazy loading for editors.
- Final removal of unused Bootstrap dashboard assets after the React routes are verified.

## Phase 1 acceptance criteria

- The dashboard opens directly on useful data rather than a marketing or empty state.
- Counts are computed from the current database on every overview request.
- No database file or SQLite schema is modified.
- Loading, API error, empty, desktop, tablet, and mobile layouts remain usable.
- Existing editor and repository workflows remain reachable during migration.
