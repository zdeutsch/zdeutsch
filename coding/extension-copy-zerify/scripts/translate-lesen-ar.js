#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'site', 'database', 'lesen.json');
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const BATCH_SIZE = Number.parseInt(process.env.TRANSLATE_BATCH_SIZE || '24', 10);
const MAX_BATCH_CHARS = Number.parseInt(process.env.TRANSLATE_MAX_BATCH_CHARS || '9000', 10);
const MAX_RETRIES = Number.parseInt(process.env.TRANSLATE_MAX_RETRIES || '5', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.TRANSLATE_REQUEST_TIMEOUT_MS || '120000', 10);
const CONCURRENCY = Number.parseInt(process.env.TRANSLATE_CONCURRENCY || '3', 10);
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asTrimmedString(value) {
  return String(value || '').trim();
}

function collectTargets(db) {
  const targets = [];

  for (const [levelKey, level] of Object.entries(db.levels || {})) {
    for (const [themeKey, theme] of Object.entries(level.themes || {})) {
      for (const [versionKey, version] of Object.entries(theme.versions || {})) {
        const base = `levels.${levelKey}.themes.${themeKey}.versions.${versionKey}.lesen.parts`;
        const parts = version?.lesen?.parts || {};

        const teil1 = parts['teil-1']?.content;
        if (teil1) {
          (teil1.texts || []).forEach((item, index) => {
            const source = asTrimmedString(item.text);
            if (source && !asTrimmedString(item.translated)) {
              targets.push({
                source,
                label: `${base}.teil-1.content.texts[${index}].translated`,
                apply: (value) => {
                  item.translated = value;
                }
              });
            }
          });

          (teil1.headlines || []).forEach((item, index) => {
            const source = asTrimmedString(item.text);
            if (source && !asTrimmedString(item.translated)) {
              targets.push({
                source,
                label: `${base}.teil-1.content.headlines[${index}].translated`,
                apply: (value) => {
                  item.translated = value;
                }
              });
            }
          });
        }

        const teil2 = parts['teil-2']?.content;
        if (teil2?.passage) {
          const paragraphs = Array.isArray(teil2.passage.paragraphs) ? teil2.passage.paragraphs : [];
          if (!Array.isArray(teil2.passage.translated)) {
            teil2.passage.translated = [];
          }

          paragraphs.forEach((paragraph, index) => {
            const source = asTrimmedString(paragraph);
            const existing = asTrimmedString(teil2.passage.translated[index]);
            if (source && !existing) {
              targets.push({
                source,
                label: `${base}.teil-2.content.passage.translated[${index}]`,
                apply: (value) => {
                  teil2.passage.translated[index] = value;
                }
              });
            }
          });
        }

        const teil3 = parts['teil-3']?.content;
        if (teil3) {
          (teil3.situations || []).forEach((item, index) => {
            const source = asTrimmedString(item.text);
            if (source && !asTrimmedString(item.translated)) {
              targets.push({
                source,
                label: `${base}.teil-3.content.situations[${index}].translated`,
                apply: (value) => {
                  item.translated = value;
                }
              });
            }
          });

          (teil3.ads || []).forEach((item, index) => {
            const source = asTrimmedString(item.text);
            if (source && !asTrimmedString(item.translated)) {
              targets.push({
                source,
                label: `${base}.teil-3.content.ads[${index}].translated`,
                apply: (value) => {
                  item.translated = value;
                }
              });
            }
          });
        }

        const sprach1 = parts['sprachbausteine-1']?.content;
        if (sprach1) {
          const source = asTrimmedString(sprach1.text);
          if (source && !asTrimmedString(sprach1.translated)) {
            targets.push({
              source,
              label: `${base}.sprachbausteine-1.content.translated`,
              apply: (value) => {
                sprach1.translated = value;
              }
            });
          }
        }

        const sprach2 = parts['sprachbausteine-2']?.content;
        if (sprach2) {
          const source = asTrimmedString(sprach2.text);
          if (source && !asTrimmedString(sprach2.translated)) {
            targets.push({
              source,
              label: `${base}.sprachbausteine-2.content.translated`,
              apply: (value) => {
                sprach2.translated = value;
              }
            });
          }
        }
      }
    }
  }

  return targets;
}

function makeBatches(items, size, maxChars) {
  const batches = [];
  let current = [];
  let currentChars = 0;

  items.forEach((item) => {
    const itemChars = item.length;
    const hitItemLimit = current.length >= size;
    const hitCharLimit = current.length > 0 && currentChars + itemChars > maxChars;

    if (hitItemLimit || hitCharLimit) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(item);
    currentChars += itemChars;
  });

  if (current.length) {
    batches.push(current);
  }
  return batches;
}

function sanitizeTranslation(value, fallback) {
  const translated = String(value || '').trim();
  return translated || fallback;
}

async function translateBatch(apiKey, orgId, sourceTexts, batchIndex, totalBatches) {
  const endpoint = 'https://api.openai.com/v1/chat/completions';
  const indexedInput = sourceTexts.map((text, index) => ({ id: index, text }));

  const payload = {
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a professional German to Arabic translator for language-learning exercises. Keep placeholders like [[1]], numbers, punctuation, and line breaks intact. Return only valid JSON.'
      },
      {
        role: 'user',
        content:
          `Translate each German text to Arabic.\n` +
          `Return JSON with key "translations".\n` +
          `"translations" may be either:\n` +
          `1) an object with numeric keys matching input ids, or\n` +
          `2) an array where index matches input id.\n` +
          `Do not include any extra prose.\n` +
          `Input:\n${JSON.stringify(indexedInput)}`
      }
    ]
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    };
    if (orgId) {
      headers['OpenAI-Organization'] = orgId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response = null;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      const waitMs = Math.min(1000 * (2 ** (attempt - 1)), 15000);
      clearTimeout(timeoutId);

      if (attempt === MAX_RETRIES) {
        throw new Error(
          timedOut
            ? `OpenAI API timeout after ${REQUEST_TIMEOUT_MS}ms in batch ${batchIndex + 1}/${totalBatches}`
            : `OpenAI API network error in batch ${batchIndex + 1}/${totalBatches}: ${error.message}`
        );
      }

      console.warn(
        `[retry] batch ${batchIndex + 1}/${totalBatches}, attempt ${attempt}/${MAX_RETRIES}, ` +
        `${timedOut ? 'timeout' : 'network error'}, waiting ${waitMs}ms`
      );
      await sleep(waitMs);
      continue;
    }
    clearTimeout(timeoutId);

    if (response.ok) {
      try {
        const result = await response.json();
        const content = result?.choices?.[0]?.message?.content;
        let parsed = null;

        if (typeof content === 'string') {
          parsed = JSON.parse(content);
        } else if (Array.isArray(content)) {
          const joined = content.map((part) => part?.text || '').join('');
          parsed = JSON.parse(joined);
        }

        const rawTranslations = parsed?.translations;
        if (!parsed || rawTranslations === undefined || rawTranslations === null) {
          throw new Error('Missing "translations" key');
        }

        const ordered = new Array(sourceTexts.length).fill('');
        if (Array.isArray(rawTranslations)) {
          rawTranslations.forEach((value, index) => {
            if (index < ordered.length) {
              ordered[index] = String(value || '');
            }
          });
        } else if (typeof rawTranslations === 'object') {
          Object.entries(rawTranslations).forEach(([key, value]) => {
            const index = Number.parseInt(key, 10);
            if (Number.isInteger(index) && index >= 0 && index < ordered.length) {
              ordered[index] = String(value || '');
            }
          });
        } else {
          throw new Error('"translations" is neither array nor object');
        }

        return ordered.map((value, index) => sanitizeTranslation(value, sourceTexts[index]));
      } catch (parseError) {
        const waitMs = Math.min(1000 * (2 ** (attempt - 1)), 15000);
        if (attempt === MAX_RETRIES) {
          throw new Error(
            `Invalid translation payload in batch ${batchIndex + 1}/${totalBatches}: ${parseError.message}`
          );
        }
        console.warn(
          `[retry] batch ${batchIndex + 1}/${totalBatches}, attempt ${attempt}/${MAX_RETRIES}, ` +
          `parse error, waiting ${waitMs}ms`
        );
        await sleep(waitMs);
        continue;
      }
    }

    const body = await response.text();
    const status = response.status;
    const retryable = status === 408 || status === 409 || status === 429 || (status >= 500 && status < 600);
    const waitMs = Math.min(1000 * (2 ** (attempt - 1)), 15000);

    if (!retryable || attempt === MAX_RETRIES) {
      throw new Error(`OpenAI API error ${status}: ${body.slice(0, 400)}`);
    }

    console.warn(`[retry] batch ${batchIndex + 1}/${totalBatches}, attempt ${attempt}/${MAX_RETRIES}, waiting ${waitMs}ms`);
    await sleep(waitMs);
  }

  throw new Error(`Failed to translate batch ${batchIndex + 1}/${totalBatches}`);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const orgId = process.env.OPENAI_ORG || '';

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY in environment.');
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(raw);

  const targets = collectTargets(db);
  const uniqueSources = Array.from(new Set(targets.map((item) => item.source)));

  console.log(`[info] targets needing translation: ${targets.length}`);
  console.log(`[info] unique source texts: ${uniqueSources.length}`);
  console.log(`[info] model=${MODEL}, batchSize=${BATCH_SIZE}, maxBatchChars=${MAX_BATCH_CHARS}, concurrency=${CONCURRENCY}`);

  if (!targets.length) {
    console.log('[info] Nothing to translate.');
    return;
  }

  const translationMap = new Map();
  const batches = makeBatches(uniqueSources, Math.max(1, BATCH_SIZE), Math.max(1000, MAX_BATCH_CHARS));

  let nextBatchIndex = 0;
  const workerCount = Math.max(1, Math.min(CONCURRENCY, batches.length));
  const workers = Array.from({ length: workerCount }, async (_, workerNumber) => {
    while (true) {
      const currentIndex = nextBatchIndex;
      nextBatchIndex += 1;
      if (currentIndex >= batches.length) {
        return;
      }

      const sourceBatch = batches[currentIndex];
      console.log(`[translate][w${workerNumber + 1}] batch ${currentIndex + 1}/${batches.length} (${sourceBatch.length} texts)`);
      const translatedBatch = await translateBatch(apiKey, orgId, sourceBatch, currentIndex, batches.length);

      sourceBatch.forEach((source, index) => {
        translationMap.set(source, sanitizeTranslation(translatedBatch[index], source));
      });

      await sleep(100);
    }
  });

  await Promise.all(workers);

  let applied = 0;
  targets.forEach((target) => {
    const translated = translationMap.get(target.source);
    if (translated) {
      target.apply(translated);
      applied += 1;
    }
  });

  console.log(`[info] applied translations: ${applied}/${targets.length}`);

  if (DRY_RUN) {
    console.log('[info] Dry run mode enabled. No file written.');
    return;
  }

  fs.writeFileSync(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  console.log(`[done] Updated ${DB_PATH}`);
}

main().catch((error) => {
  console.error(`[error] ${error.message}`);
  process.exit(1);
});
