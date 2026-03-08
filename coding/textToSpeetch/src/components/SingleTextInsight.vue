<template>
  <div class="single-text-insight">
    <section class="card">
      <div class="card-header">
        <div>
          <h3>{{ title }}</h3>
          <span style="color: var(--text-muted)">{{ words }} words • ~{{ readingTime }} min read</span>
        </div>
        <div>
          <button class="primary small" @click="openSidebar">Add Note</button>
        </div>
      </div>
      <div
        id="text-content"
        ref="contentEl"
        @mouseup="captureSelection"
        @keyup="captureSelection"
        :style="{ lineHeight: 1.8, fontSize: '1.05rem' }"
      >
        <p v-for="(p, i) in paragraphs" :key="i" style="margin:0 0 1rem 0">{{ p }}</p>
      </div>
    </section>

    <aside class="notes-sidebar" :class="{ open: sidebarOpen }" aria-label="Notes">
      <div class="notes-sidebar__header">
        <div class="notes-sidebar__controls">
          <h3 class="notes-sidebar__title">Notes</h3>
          <button class="ghost small" type="button" @click="sidebarOpen = false">Close</button>
        </div>
        <hr />

        <div v-if="quote" class="notes-form">
          <div style="font-size:0.9rem;color:var(--text-muted)">Selected text</div>
          <div class="note-item__quote" style="margin-bottom:8px">{{ quote }}</div>
          <label>
            <span style="color:var(--text-muted);font-size:0.9rem">Your note</span>
            <textarea
              id="notes-create-text"
              v-model="draft"
              rows="3"
              placeholder="Add a note…"
            />
          </label>
          <div class="notes-actions">
            <button class="primary small" :disabled="!draft.trim()" @click="saveNew">Save</button>
          </div>
        </div>

        <div class="notes-tools">
          <input id="notes-search" type="search" placeholder="Search notes…" v-model="search" />
          <select id="notes-sort" v-model="sort">
            <option value="new">Newest</option>
            <option value="old">Oldest</option>
          </select>
        </div>
      </div>

      <div class="notes-sidebar__body">
        <div v-if="filteredNotes.length === 0" style="color: var(--text-muted)">No notes yet</div>
        <div v-else class="notes-list">
          <div class="note-item" v-for="n in filteredNotes" :key="n.id">
            <div class="note-item__quote">{{ n.quote }}</div>
            <template v-if="editingId === n.id">
              <textarea id="notes-edit-text" v-model="editText" rows="3" />
              <div class="notes-actions">
                <button class="primary small" @click="commitEdit(n)">Save</button>
                <button class="ghost small" @click="cancelEdit">Cancel</button>
              </div>
            </template>
            <template v-else>
              <div class="note-item__text">{{ n.text }}</div>
              <div class="notes-actions">
                <button class="ghost small" @click="startEdit(n)">Edit</button>
                <button class="ghost danger small" @click="removeNote(n.id)">Delete</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </aside>
    <div id="notes-backdrop" class="notes-backdrop" :class="{ open: sidebarOpen }" @click="sidebarOpen = false"></div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
  text: { type: String, required: true },
  title: { type: String, default: 'Text Insight' },
  sidebarInitiallyOpen: { type: Boolean, default: true },
});
const emit = defineEmits(['request-open-sidebar']);

const contentEl = ref(null);
const quote = ref('');
const draft = ref('');
const search = ref('');
const sort = ref('new');
const sidebarOpen = ref(props.sidebarInitiallyOpen);
const notes = ref([]);
const editingId = ref(null);
const editText = ref('');

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return String(h >>> 0);
}
function wordCount(s) {
  const m = s.trim().match(/[\p{L}\p{N}'’-]+/gu);
  return m ? m.length : 0;
}
function readingTimeMinutes(s) {
  const w = wordCount(s);
  return Math.max(1, Math.round(w / 200));
}
function nowISO() { return new Date().toISOString(); }

const textId = computed(() => hashString(props.text));
const storageKey = computed(() => `notes:${textId.value}`);

onMounted(() => {
  // load notes for current text
  try {
    const raw = localStorage.getItem(storageKey.value);
    notes.value = raw ? JSON.parse(raw) : [];
  } catch (e) {
    notes.value = [];
  }
});

watch([notes, storageKey], () => {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(notes.value));
  } catch {}
});

const words = computed(() => wordCount(props.text));
const readingTime = computed(() => readingTimeMinutes(props.text));
const paragraphs = computed(() => props.text.split(/\n\s*\n/g));

function openSidebar() {
  sidebarOpen.value = true;
  emit('request-open-sidebar');
}

function captureSelection() {
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!contentEl.value || !contentEl.value.contains(range.commonAncestorContainer)) return;
  const t = sel.toString().trim();
  quote.value = t || '';
}

function saveNew() {
  if (!quote.value || !draft.value.trim()) return;
  const n = {
    id: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`,
    quote: quote.value,
    text: draft.value.trim(),
    createdAt: nowISO(),
  };
  notes.value = [n, ...notes.value];
  draft.value = '';
  quote.value = '';
}

function startEdit(n) {
  editingId.value = n.id;
  editText.value = n.text || '';
}
function cancelEdit() {
  editingId.value = null;
  editText.value = '';
}
function commitEdit(n) {
  const updated = { ...n, text: editText.value, updatedAt: nowISO() };
  notes.value = notes.value.map((x) => (x.id === n.id ? updated : x));
  cancelEdit();
}
function removeNote(id) {
  notes.value = notes.value.filter((n) => n.id !== id);
}

const filteredNotes = computed(() => {
  const q = search.value.trim().toLowerCase();
  let list = !q
    ? notes.value
    : notes.value.filter(
        (n) =>
          (n.text && String(n.text).toLowerCase().includes(q)) ||
          (n.quote && String(n.quote).toLowerCase().includes(q))
      );
  if (sort.value === 'new') list = [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (sort.value === 'old') list = [...list].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return list;
});
</script>

<style scoped>
/* Component-relational hooks only; visual design comes from app.css */
.single-text-insight { display: contents; }
</style>

