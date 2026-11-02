<script setup>
import { Sparkles, LockKeyhole, ArrowRight } from 'lucide-vue-next'
import { OPERATIONS } from '../lib/worksheet'
defineProps({ name: String, max: Number, count: Number, ops: Array, locked: Boolean })
const emit = defineEmits(['update:max', 'update:count', 'toggle', 'generate'])
</script>
<template>
  <aside class="setup-card">
    <div class="setup-heading"><span class="section-icon"><Sparkles :size="21" /></span><div><h2>Your adventure</h2><p>{{ name }}, let’s choose your next challenge!</p></div></div>
    <fieldset :disabled="locked">
      <div class="field-label operation-label">What shall we practise?</div>
      <div class="operation-grid" role="group" aria-label="Choose maths operations">
        <button v-for="operation in OPERATIONS" :key="operation.value" type="button" :class="['operation-button', operation.color, { selected: ops.includes(operation.value) }]" :aria-pressed="ops.includes(operation.value)" :aria-label="operation.label" @click="emit('toggle', operation.value)"><span class="operation-symbol">{{ operation.value }}</span><span>{{ operation.short }}</span><span class="selected-tick" aria-hidden="true">{{ ops.includes(operation.value) ? '✓' : '+' }}</span></button>
      </div>
      <div class="settings-pair">
        <label for="max-number"><span class="field-label">Biggest number</span><select id="max-number" :value="max" @change="emit('update:max', Number($event.target.value))"><option v-for="value in [10, 20, 50, 100]" :value="value" :key="value">Up to {{ value }}</option></select></label>
        <label for="question-count"><span class="field-label">How many sums?</span><select id="question-count" :value="count" @change="emit('update:count', Number($event.target.value))"><option v-for="value in [5, 10, 15, 20, 30]" :value="value" :key="value">{{ value }} questions</option></select></label>
      </div>
      <button class="button primary generate-button" @click="emit('generate')">Let's go! <ArrowRight :size="20" /></button>
    </fieldset>
    <p class="setup-note"><LockKeyhole v-if="locked" :size="15" /><span v-else aria-hidden="true">💡</span>{{ locked ? 'Finish this round to choose a new adventure.' : 'Tip: find the missing number, wherever it hides!' }}</p>
    <div class="encouragement"><span class="encouragement-flower" aria-hidden="true">✿</span><div><strong>A little practice goes a long way.</strong><p>You don't have to be fast. Just give it a try.</p></div></div>
  </aside>
</template>
