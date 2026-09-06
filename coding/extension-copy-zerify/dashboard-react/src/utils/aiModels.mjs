export const fallbackAiModels = [
  { id: "gpt-6-astra", label: "GPT-6 Astra", description: "Höchste Genauigkeit für schwierige und mehrdeutige Prüfungsfragen.", recommended: true },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Ausgewogene Genauigkeit und Geschwindigkeit." },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", description: "Zuverlässige Prüfung mit kompakter Begründung." },
  { id: "gpt-5.5", label: "GPT-5.5", description: "Bewährte Alternative für einfachere Prüfungen." }
];

export const AI_MODEL_STORAGE_KEY = "zdeutsch.lesenAiModel";
const LEGACY_STORAGE_KEY = "zdeutsch.contributionAiModel";

export function getStoredAiModel(storage = globalThis?.localStorage) {
  if (!storage) return "";
  return storage.getItem(AI_MODEL_STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY) || "";
}

export function storeAiModel(model, storage = globalThis?.localStorage) {
  if (!storage) return;
  storage.setItem(AI_MODEL_STORAGE_KEY, String(model || ""));
}

export function resolveAiModel(config, storedModel = "") {
  const models = config?.models?.length ? config.models : fallbackAiModels;
  const defaultModel = config?.defaultModel || models.find((model) => model.recommended)?.id || models[0].id;
  const selectedModel = models.some((model) => model.id === storedModel) ? storedModel : defaultModel;
  return {
    models,
    selectedModel,
    selectedModelInfo: models.find((model) => model.id === selectedModel) || models[0]
  };
}
