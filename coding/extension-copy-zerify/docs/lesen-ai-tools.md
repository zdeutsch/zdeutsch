# Lesen AI tools (5 October 2026)

The React editor uses two independent actions for Lesen Teil 1–3. `Mit KI analysieren` calls `POST /api/lesen/analyze-answer` and updates only the justification. `Schlüsselwörter markieren` calls `POST /api/lesen/highlight-answer` and replaces only highlights, clearing the legacy broad keyword fallback. Existing explanation text is preserved. Results merge into the current draft, and stale responses after source or answer changes are rejected. Changes still require the normal save and publish actions.

Generated highlights use exact source offsets, two to three words or a very short expression per mark (at most three words), two marks per source and four marks overall. Keywords must link both sides of the answer. Invalid output is retried once; errors preserve existing annotations. Manual highlighting remains available.

The shared model catalogue now includes GPT-6.1 Sol, GPT-6 Luna, GPT-6 Sol and GPT-5.6 Luna. The configured/default model and saved selections remain unchanged. The existing API key was checked against the OpenAI models endpoint before deployment.

Run `node --test test/lesenAiTools.test.js test/lesenAiService.test.js test/lesenDashboardAi.test.js test/contributionAiService.test.js test/lesenService.test.js` and `npm run build`. The isolated browser harness is `/Users/mac/Desktop/coding/reading/scripts/check_admin_ai_tools.cjs`. Deployment and verification records are in `/Users/mac/Desktop/coding/reading/tmp/admin-ai-tools`. The initial split-tool deployment did not bulk change annotations. The 2–3 word update and its deployment records are in `/Users/mac/Desktop/coding/reading/tmp/admin-ai-short-expressions`.

## Bulk short highlights

`scripts/bulk-lesen-keywords.cjs` uses the same context builder, keyword instructions, source-range mapper and linked-answer checks as the individual admin tool. It explicitly uses `gpt-6.1-sol` with the configured server token. Only B1 Teil 2–3 and B2 Teil 1–3 are eligible, across every theme and version. B1 Teil 1 is excluded by code, including manual annotations and explanations.

Generation batches independent answer contexts, deduplicates identical contexts and stores validated results in a resumable checkpoint. Every expression must contain two or three words (a one-word source is the sole exception), at most two marks per source and four overall. The AI compares distractors, preserves decisive negations/numbers and quotes exact words without crossing hard line breaks. X answers get only one or two short unmet requirements marked in the situation; no advertisement or answer is invented. Failed outputs are retried and logged locally; nothing is applied if an answer is still missing.

Run from the admin project on the server, without copying the token elsewhere:

```sh
node scripts/bulk-lesen-keywords.cjs --input /absolute/path/lesen.before.json --checkpoint /absolute/path/checkpoint --inventory
node scripts/bulk-lesen-keywords.cjs --input /absolute/path/lesen.before.json --checkpoint /absolute/path/checkpoint --env /opt/zdeutsch/admin/shared/.env --concurrency 4
node scripts/bulk-lesen-keywords.cjs --input /absolute/path/lesen.before.json --checkpoint /absolute/path/checkpoint --apply --data /absolute/path/live/database/lesen.json
```

Keep a separate backup of the live data before generation. Applying reads fresh data, rejects source/answer/highlight changes made during generation, and preserves unrelated edits, including newer justifications and B1 Teil 1 edits. It writes only eligible `highlights` and clears their legacy `keywords` fallback. A second full-data comparison proves all other fields and protected parts are unchanged. The write is atomic, preserves ownership and takes another backup immediately before applying. Publish the resulting Lesen JSON through the normal data repository and compiled-data sync after reviewing it. Request metadata and token counts are retained in `requests.jsonl`; the token and HTTP authorization headers are never recorded.

Validate the workflow with `node --test test/bulkLesenKeywords.test.js test/lesenAiTools.test.js test/lesenAiService.test.js`. This bulk operation's backup/checkpoints are under `/opt/zdeutsch/admin-backups/20261005-bulk-lesen-keywords` and `/opt/zdeutsch/admin-staging/20261005-bulk-lesen-keywords`.

The authorized bulk run on 5 October completed 1,425 answers across 209 parts, with 1,137 distinct contexts and 3,810 exact highlight spans. Of these, 3,807 contain two or three words; three are complete one-word answer options. All 29 B1 Teil 1 parts (145 answers) are byte-equivalent as parsed JSON to the backup, including their manual annotations. Answers, explanations, translations and source text were preserved. A newer B2 save was detected before applying, backed up, and used as the fresh input after confirming its source context was unchanged.

GPT-6.1 Sol made 212 API requests, using 1,778,269 input tokens and 179,056 output tokens (1,957,325 total); validated duplicate contexts were reused. The data was published as private data commit `2f72d4c`. Thirty-five focused unit tests passed. The isolated student rendering check (`/Users/mac/Desktop/coding/reading/scripts/check_bulk_lesen_highlights.cjs`) passed for both levels and all three Lesen parts, including preserved manual B1 Teil 1 highlights, with no JavaScript errors and the existing blue highlight style. An older broad dropdown harness encountered a tab covered by a fixed header in its scroll test; the focused annotation check uses direct part entry and does not assert that unrelated navigation issue is resolved.

The live mirror and all 76 compiled theme payloads were checked against the published admin dataset. Data release `2f72d4c5c104-308426f50465` is active, both services are healthy, and the landing page responds with HTTP 200. Local audit reports are in `/Users/mac/Desktop/coding/reading/tmp/bulk-lesen-keywords`.
