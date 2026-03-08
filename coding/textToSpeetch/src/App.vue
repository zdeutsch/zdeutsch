<template>
  <div class="app-shell sidebar-hidden">
    <main>
      <header class="layout-header">
        <div class="layout-title">
          <h2>Single Text</h2>
          <p style="color: var(--text-muted)">Vue version of the text card + notes</p>
        </div>
        <div class="header-actions">
          <button class="ghost small" @click="toggleNotes">
            {{ notesOpen ? 'Hide Notes' : 'Show Notes' }}
          </button>
        </div>
      </header>

      <SingleTextInsight
        :text="initialText"
        title="Text Insight"
        :sidebar-initially-open="notesOpen"
        @request-open-sidebar="notesOpen = true"
      />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import SingleTextInsight from './components/SingleTextInsight.vue';

function getInitialText() {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('text');
  if (t && t.trim().length > 0) return t;
  return (
    'Knowledge is a treasure, but practice is the key to it.\n\n' +
    'This demo shows a single text card on the left and a notes sidebar on the right. Select any text in the card, then click "Add Note" to capture the quote and write your thoughts.'
  );
}

const initialText = getInitialText();
const notesOpen = ref(true);

function toggleNotes() {
  notesOpen.value = !notesOpen.value;
}
</script>

<style>
/* This file intentionally relies on public/app.css for styles */
</style>

