<script setup>
import { Sparkles, LockKeyhole, ArrowRight } from 'lucide-vue-next'
import { OPERATIONS, TABLES, BOND_TARGETS, TIME_LIMITS } from '../lib/worksheet'
defineProps({ name: String, max: Number, count: Number, ops: Array, locked: Boolean, mode: String, table: Number, bondTarget: Number, timeLimit: Number, trickyState: String })
const emit = defineEmits(['update:max', 'update:count', 'update:mode', 'update:table', 'update:bondTarget', 'update:timeLimit', 'toggle', 'generate'])
const MODES = [
  { value: 'mix', emoji: '🎨', label: 'Mix it up' },
  { value: 'table', emoji: '✖️', label: 'Times tables' },
  { value: 'bonds', emoji: '🔗', label: 'Number bonds' },
  { value: 'mistakes', emoji: '🧩', label: 'Tricky sums' },
]
</script>
<template>
  <aside class="setup-card">
    <div class="setup-heading"><span class="section-icon"><Sparkles :size="21" /></span><div><h2>Your adventure</h2><p>{{ name }}, let’s choose your next challenge!</p></div></div>
    <fieldset :disabled="locked">
      <div class="field-label operation-label">What kind of adventure?</div>
      <div class="mode-grid" role="group" aria-label="Choose a kind of practice">
        <button v-for="item in MODES" :key="item.value" type="button" :class="['mode-button', { selected: mode === item.value }]" :aria-pressed="mode === item.value" @click="emit('update:mode', item.value)"><span aria-hidden="true">{{ item.emoji }}</span>{{ item.label }}</button>
      </div>
      <template v-if="mode === 'mix'">
        <div class="field-label operation-label">What shall we practise?</div>
        <div class="operation-grid" role="group" aria-label="Choose maths operations">
          <button v-for="operation in OPERATIONS" :key="operation.value" type="button" :class="['operation-button', operation.color, { selected: ops.includes(operation.value) }]" :aria-pressed="ops.includes(operation.value)" :aria-label="operation.label" @click="emit('toggle', operation.value)"><span class="operation-symbol">{{ operation.value }}</span><span>{{ operation.short }}</span><span class="selected-tick" aria-hidden="true">{{ ops.includes(operation.value) ? '✓' : '+' }}</span></button>
        </div>
      </template>
      <p v-else-if="mode === 'mistakes'" class="mode-note" aria-live="polite">{{ trickyState === 'loading' ? 'Finding your tricky sums…' : trickyState === 'error' ? 'We could not fetch your tricky sums. Check your connection.' : 'Sums you missed or skipped last time. Get one right and it leaves the list!' }}</p>
      <div class="settings-pair">
        <label v-if="mode === 'mix'" for="max-number"><span class="field-label">Biggest number</span><select id="max-number" :value="max" @change="emit('update:max', Number($event.target.value))"><option v-for="value in [10, 20, 50, 100]" :value="value" :key="value">Up to {{ value }}</option></select></label>
        <label v-else-if="mode === 'table'" for="times-table"><span class="field-label">Times table</span><select id="times-table" :value="table" @change="emit('update:table', Number($event.target.value))"><option v-for="value in TABLES" :value="value" :key="value">{{ value }} times</option></select></label>
        <label v-else-if="mode === 'bonds'" for="bond-target"><span class="field-label">Make…</span><select id="bond-target" :value="bondTarget" @change="emit('update:bondTarget', Number($event.target.value))"><option v-for="value in BOND_TARGETS" :value="value" :key="value">{{ value }}</option></select></label>
        <label for="question-count"><span class="field-label">How many sums?</span><select id="question-count" :value="count" @change="emit('update:count', Number($event.target.value))"><option v-for="value in [5, 10, 15, 20, 30]" :value="value" :key="value">{{ mode === 'mistakes' ? 'Up to ' : '' }}{{ value }} questions</option></select></label>
        <label for="time-limit"><span class="field-label">Beat the clock?</span><select id="time-limit" :value="timeLimit" @change="emit('update:timeLimit', Number($event.target.value))"><option :value="0">No timer</option><option v-for="value in TIME_LIMITS" :value="value" :key="value">{{ value / 60000 }} {{ value === 60000 ? 'minute' : 'minutes' }}</option></select></label>
      </div>
      <button class="button primary generate-button" @click="emit('generate')">Let's go! <ArrowRight :size="20" /></button>
    </fieldset>
    <p class="setup-note"><LockKeyhole v-if="locked" :size="15" /><span v-else aria-hidden="true">💡</span>{{ locked ? 'Finish this round to choose a new adventure.' : timeLimit ? 'The clock starts when you type your first answer.' : 'Tip: find the missing number, wherever it hides!' }}</p>
    <div class="encouragement"><span class="encouragement-flower" aria-hidden="true">✿</span><div><strong>A little practice goes a long way.</strong><p>You don't have to be fast. Just give it a try.</p></div></div>
  </aside>
</template>
