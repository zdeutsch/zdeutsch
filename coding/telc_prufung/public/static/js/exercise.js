import { t } from './i18n.js';
import { formatExerciseTypeLabel } from '../services/examCatalog.js';
import { fetchExercise } from '../services/exerciseService.js';

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login';
}

const exerciseId = window.location.pathname.split('/').filter(Boolean).pop();
const container = document.getElementById('exerciseContainer');
const loading = document.getElementById('exerciseLoading');
const titleEl = document.getElementById('exerciseTitle');
const descriptionEl = document.getElementById('exerciseDescription');
const instructionsEl = document.getElementById('exerciseInstructions');
const structureEl = document.getElementById('exerciseStructure');
const headingsSection = document.getElementById('exerciseHeadingsSection');
const headingsTitleEl = document.getElementById('exerciseHeadingsTitle');
const headingsHintEl = document.getElementById('exerciseHeadingsHint');
const headingsEl = document.getElementById('exerciseHeadings');
const textsSection = document.getElementById('exerciseTextsSection');
const textsTitleEl = document.getElementById('exerciseTextsTitle');
const textsHintEl = document.getElementById('exerciseTextsHint');
const textsEl = document.getElementById('exerciseTexts');
const checkBtn = document.getElementById('checkAnswers');
const resetBtn = document.getElementById('resetSelections');
const resultPanel = document.getElementById('resultPanel');

const storageKey = `exerciseAnswers-${exerciseId}`;

let exerciseData = null;
let controller = null;

if (checkBtn) checkBtn.disabled = true;

const refs = {
  headingsSection,
  headingsTitleEl,
  headingsHintEl,
  headingsEl,
  textsSection,
  textsTitleEl,
  textsHintEl,
  textsEl,
  checkBtn,
  resetBtn,
  resultPanel
};

const setBaseInfo = (exercise) => {
  titleEl.textContent = exercise.name;
  descriptionEl.textContent = exercise.description || '';
  const instructions = exercise.content?.instructions?.trim();
  if (instructions) {
    instructionsEl.textContent = instructions;
    instructionsEl.classList.remove('d-none');
  } else {
    instructionsEl.textContent = '';
    instructionsEl.classList.add('d-none');
  }
  updateStructureLabel(exercise);
};

const updateStructureLabel = (exercise) => {
  if (!structureEl) return;
  const structureLabel = formatExerciseTypeLabel(exercise, document.documentElement.lang || 'en');
  if (structureLabel) {
    structureEl.textContent = `${t('exercise.typeSummaryPrefix')} ${structureLabel}`;
    structureEl.classList.remove('d-none');
  } else {
    structureEl.textContent = '';
    structureEl.classList.add('d-none');
  }
};

const hideMatchingSections = () => {
  if (headingsSection) headingsSection.classList.add('d-none');
  if (textsSection) textsSection.classList.add('d-none');
};

const TYPE_MODULE_MAP = {
  // Lesen
  TELC_B2_SCHRIFTLICHE_PRÜFUNG_LESERVERSTEHEN: '/static/js/templates/telc-b2/lesen/learn.js',
  // Fallback for seed using ASCII "PRUEFUNG" spelling
  TELC_B2_SCHRIFTLICHE_PRUEFUNG_LESERVERSTEHEN: '/static/js/templates/telc-b2/lesen/learn.js',
  TELC_B2_SCHRIFTLICHE_PRÜFUNG_LESERVERSTEHEN_TEIL_2:
    '/static/js/templates/telc-b2/lesen-teil2/learn.js',
  TELC_B2_SCHRIFTLICHE_PRÜFUNG_LESERVERSTEHEN_TEIL_3:
    '/static/js/templates/telc-b2/lesen-teil3/learn.js',

  // Sprachbausteine
  'TELC_B2_SCHRIFTLICHE_PRÜFUNG_SPRACHBAUSTEINE@TEIL1':
    '/static/js/templates/telc-b2/sprachbausteine-teil1/learn.js',
  'TELC_B2_SCHRIFTLICHE_PRÜFUNG_SPRACHBAUSTEINE@TEIL2':
    '/static/js/templates/telc-b2/sprachbausteine-teil2/learn.js',
  'TELC_B2_SCHRIFTLICHE_PRÜFUNG_SPRACHBAUSTEINE@TEIL3':
    '/static/js/templates/telc-b2/sprachbausteine-teil3/learn.js'
};

const initializeController = async (exercise) => {
  const scriptPath = TYPE_MODULE_MAP[exercise.type];
  if (scriptPath) {
    try {
      const cacheBust = (window.__APP_BUILD__ || Date.now()).toString();
      const importUrl = `${scriptPath}${scriptPath.includes('?') ? '&' : '?'}v=${cacheBust}`;
      const module = await import(importUrl);
      const initializer = module.default || module.init || module.initialize;
      if (typeof initializer === 'function') {
        // Hide generic matching sections for non-matching templates
        if (String(exercise.type).includes('SPRACHBAUSTEINE@')) {
          hideMatchingSections();
        }
        const maybeController = initializer({ exercise, exerciseId, storageKey, refs });
        if (maybeController) {
          controller = await maybeController;
          return;
        }
        console.warn('Initializer returned no controller; falling back to shared matching.', scriptPath);
      }
    } catch (err) {
      console.error('Failed to load exercise template module:', scriptPath, err);
    }
  }
  const fallbackModule = await import('./exercises/shared/matching.js');
  controller = fallbackModule.createMatchingController({
    exercise,
    storageKey,
    refs,
    allowNoMatch: false
  });
};

const loadExercise = async () => {
  try {
    const exercise = await fetchExercise(exerciseId);
    if (!exercise) {
      loading.innerHTML = `<p class="text-danger">${t('exercise.error')}</p>`;
      return;
    }
    exerciseData = exercise;
    setBaseInfo(exercise);
    await initializeController(exercise);
    container.classList.remove('d-none');
    loading.classList.add('d-none');
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      document.cookie = 'token=; path=/; max-age=0';
      window.location.href = '/login';
      return;
    }
    loading.innerHTML = `<p class="text-danger">${error.message || t('exercise.error')}</p>`;
  }
};

if (checkBtn) {
  checkBtn.addEventListener('click', () => {
    if (controller?.evaluate) {
      controller.evaluate();
    }
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (controller?.reset) {
      controller.reset();
    }
  });
}

document.addEventListener('language:change', () => {
  if (!exerciseData) return;
  updateStructureLabel(exerciseData);
  if (controller?.rerender) {
    controller.rerender();
  }
});

loadExercise();
