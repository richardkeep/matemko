<script setup>
import { Check, Lightbulb } from 'lucide-vue-next'
import { isCorrect } from '../lib/worksheet'
const props = defineProps({ equation: Object, index: Number, answer: [String, Number], disabled: Boolean, checked: Boolean })
const emit = defineEmits(['answer', 'next'])
const parts = ['a', 'b', 'c']
function spokenEquation() { const names = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' }; const e = props.equation; return `${props.index + 1}: ${e.hide === 'a' ? 'blank' : e.a} ${names[e.op]} ${e.hide === 'b' ? 'blank' : e.b} equals ${e.hide === 'c' ? 'blank' : e.c}` }
</script>
<template>
  <article :class="['equation-card', { correct: checked && isCorrect(equation, answer), learning: checked && !isCorrect(equation, answer), filled: String(answer).length > 0 }]">
    <span class="question-number">{{ String(index + 1).padStart(2, '0') }}</span>
    <div class="equation" :aria-label="spokenEquation()">
      <template v-for="(part, partIndex) in parts" :key="part">
        <input v-if="equation.hide === part" :id="`answer-${index}`" class="answer-input" :value="answer" :disabled="disabled" :readonly="checked" @input="emit('answer', $event.target.value)" @keydown.enter.prevent="emit('next')" inputmode="numeric" type="text" maxlength="6" autocomplete="off" placeholder="?" :aria-label="`Missing number for question ${spokenEquation()}`" :enterkeyhint="index === 29 ? 'done' : 'next'" />
        <span v-else class="equation-value">{{ equation[part] }}</span>
        <span v-if="partIndex < 2" :class="['equation-sign', { equals: partIndex === 1 }]" aria-hidden="true">{{ partIndex === 0 ? equation.op : '=' }}</span>
      </template>
    </div>
    <div v-if="checked" class="answer-feedback"><Check v-if="isCorrect(equation, answer)" :size="15" /><Lightbulb v-else :size="15" />{{ isCorrect(equation, answer) ? 'You got it!' : `The missing number is ${equation[equation.hide]}` }}</div>
    <span v-else class="question-spark" aria-hidden="true">{{ String(answer).length ? '✦' : '' }}</span>
  </article>
</template>
