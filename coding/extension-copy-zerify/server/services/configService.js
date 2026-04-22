const fs = require("fs/promises");
const path = require("path");
const { readJsonByKey, writeJsonByKey } = require("../repositories/jsonRepository");
const { SITE_DIR } = require("../config/constants");
const { assertPlainObject, assertArray, assertString, isPlainObject } = require("../utils/validators");
const AppError = require("../utils/appError");

const BANNER_SLOT_KEYS = Object.freeze(["top", "bottom"]);
const BANNER_DEVICE_KEYS = Object.freeze(["desktop", "mobile"]);
const BANNER_UPLOAD_DIR = path.join(SITE_DIR, "assets", "ads", "banners");
const DEFAULT_BOTTOM_BANNER_INTERVAL_HOURS = 3;
const DEFAULT_HOMEPAGE_PROMO_CONFIG = Object.freeze({
  enabled: true
});
const BANNER_MIME_TO_EXT = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
});

function normalizeIntervalHours(value, fallback = DEFAULT_BOTTOM_BANNER_INTERVAL_HOURS) {
  const raw = String(value ?? "").trim();
  const candidate = raw === "" ? Number.NaN : Number(raw);
  if (Number.isFinite(candidate) && candidate >= 0) {
    return candidate;
  }
  const base = Number(fallback);
  if (Number.isFinite(base) && base >= 0) {
    return base;
  }
  return DEFAULT_BOTTOM_BANNER_INTERVAL_HOURS;
}

function normalizeBannerSlot(slotKey, slot, fallback = {}) {
  const source = isPlainObject(slot) ? slot : {};
  const base = isPlainObject(fallback) ? fallback : {};
  const enabled = typeof source.enabled === "boolean"
    ? source.enabled
    : Boolean(base.enabled);
  const desktopImage = typeof source.desktopImage === "string"
    ? source.desktopImage.trim()
    : typeof base.desktopImage === "string"
      ? base.desktopImage.trim()
      : "";
  const mobileImage = typeof source.mobileImage === "string"
    ? source.mobileImage.trim()
    : typeof base.mobileImage === "string"
      ? base.mobileImage.trim()
      : "";
  const clickUrl = typeof source.clickUrl === "string"
    ? source.clickUrl.trim()
    : typeof base.clickUrl === "string"
      ? base.clickUrl.trim()
      : "";
  const normalized = {
    enabled,
    desktopImage,
    mobileImage,
    clickUrl
  };
  if (slotKey === "bottom") {
    normalized.displayIntervalHours = normalizeIntervalHours(
      source.displayIntervalHours,
      base.displayIntervalHours
    );
  }

  return normalized;
}

function normalizeAdsConfig(ads, fallbackAds = {}) {
  const source = isPlainObject(ads) ? ads : {};
  const fallback = isPlainObject(fallbackAds) ? fallbackAds : {};

  return {
    top: normalizeBannerSlot("top", source.top, fallback.top),
    bottom: normalizeBannerSlot("bottom", source.bottom, fallback.bottom)
  };
}

function normalizeHomepagePromoConfig(value, fallback = DEFAULT_HOMEPAGE_PROMO_CONFIG) {
  const source = isPlainObject(value) ? value : {};
  const base = isPlainObject(fallback) ? fallback : DEFAULT_HOMEPAGE_PROMO_CONFIG;
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : Boolean(base.enabled)
  };
}

function normalizeModule(module, index) {
  assertPlainObject(module, `Module at index ${index} must be an object`);
  assertString(module.name, `Module at index ${index} needs a valid name`);
  assertString(module.dataFile, `Module ${module.name} needs a valid dataFile`);

  const timer = {
    enabled: Boolean(module.timer?.enabled),
    durationMinutes: Number.isFinite(module.timer?.durationMinutes)
      ? Number(module.timer.durationMinutes)
      : 0
  };

  const passPercentRaw = module.scoreConfig?.passPercent;
  const passPercent = Number.isFinite(passPercentRaw)
    ? Math.max(0, Math.min(100, Number(passPercentRaw)))
    : 60;

  const scoreParts = module.scoreConfig?.parts && typeof module.scoreConfig.parts === "object"
    ? module.scoreConfig.parts
    : {};

  return {
    name: module.name.trim(),
    dataFile: module.dataFile.trim(),
    timer,
    scoreConfig: {
      passPercent,
      parts: scoreParts
    }
  };
}

async function getConfig() {
  return readJsonByKey("config");
}

async function updateConfig(payload) {
  assertPlainObject(payload);
  const current = await getConfig();
  const next = {
    ...current,
    ...payload
  };

  if (payload.modules !== undefined) {
    assertArray(payload.modules, "modules must be an array");
    next.modules = payload.modules.map(normalizeModule);
  }

  if (!Array.isArray(next.modules) || !next.modules.length) {
    throw new AppError("Config must include at least one module", 400);
  }

  if (payload.defaultModule !== undefined) {
    assertString(payload.defaultModule, "defaultModule must be a non-empty string");
    next.defaultModule = payload.defaultModule.trim();
  }

  const moduleNames = new Set(next.modules.map((module) => module.name));
  if (!moduleNames.has(next.defaultModule)) {
    throw new AppError("defaultModule must exist in modules list", 400);
  }

  if (payload.fontScale !== undefined) {
    const value = Number(payload.fontScale);
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError("fontScale must be a positive number", 400);
    }
    next.fontScale = value;
  }

  if (payload.asideWidth !== undefined) {
    next.asideWidth = String(payload.asideWidth).trim();
  }

  if (payload.ads !== undefined) {
    assertPlainObject(payload.ads, "ads must be an object");
    next.ads = normalizeAdsConfig(payload.ads, current.ads);
  } else {
    next.ads = normalizeAdsConfig(current.ads);
  }

  if (payload.homepagePromo !== undefined) {
    assertPlainObject(payload.homepagePromo, "homepagePromo must be an object");
    next.homepagePromo = normalizeHomepagePromoConfig(payload.homepagePromo, current.homepagePromo);
  } else {
    next.homepagePromo = normalizeHomepagePromoConfig(current.homepagePromo);
  }

  delete next.showMeinLangAd;

  await writeJsonByKey("config", next);
  return next;
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new AppError("Invalid image data URL", 400);
  }
  const mimeType = String(match[1] || "").toLowerCase();
  const extension = BANNER_MIME_TO_EXT[mimeType];
  if (!extension) {
    throw new AppError("Unsupported image format. Use PNG, JPG, WEBP, or GIF", 400);
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw new AppError("Uploaded image is empty", 400);
  }
  if (buffer.length > 6 * 1024 * 1024) {
    throw new AppError("Uploaded image is too large (max 6 MB)", 400);
  }
  return { buffer, extension };
}

function sanitizeFileName(value) {
  const trimmed = String(value || "").trim();
  const rawBase = path.basename(trimmed, path.extname(trimmed || ""));
  const sanitized = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return sanitized || "banner";
}

async function uploadBannerImage(payload) {
  assertPlainObject(payload);
  const slot = String(payload.slot || "").trim().toLowerCase();
  const device = String(payload.device || "").trim().toLowerCase();
  if (!BANNER_SLOT_KEYS.includes(slot)) {
    throw new AppError("slot must be one of: top, bottom", 400);
  }
  if (!BANNER_DEVICE_KEYS.includes(device)) {
    throw new AppError("device must be one of: desktop, mobile", 400);
  }

  const { buffer, extension } = parseDataUrl(payload.dataUrl);
  const baseName = sanitizeFileName(payload.fileName);
  const random = Math.random().toString(36).slice(2, 8);
  const fileName = `${slot}-${device}-${Date.now()}-${random}-${baseName}.${extension}`;

  await fs.mkdir(BANNER_UPLOAD_DIR, { recursive: true });
  const absolutePath = path.join(BANNER_UPLOAD_DIR, fileName);
  await fs.writeFile(absolutePath, buffer);

  return {
    slot,
    device,
    relativePath: `assets/ads/banners/${fileName}`
  };
}

module.exports = {
  getConfig,
  updateConfig,
  uploadBannerImage
};
