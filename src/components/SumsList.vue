<script setup>
import { Check, Lightbulb } from 'lucide-vue-next'
import { isCorrect } from '../lib/worksheet'
defineProps({ problems: { type: Array, default: null } })
</script>
<template>
  <ol v-if="problems" class="sums-list"><li v-for="(problem, index) in problems" :key="index" :class="isCorrect(problem, problem.answer) ? 'correct' : 'learning'"><span class="sum-number">{{ String(index + 1).padStart(2, '0') }}</span><span class="sum-equation"><template v-for="(part, partIndex) in ['a', 'b', 'c']" :key="part"><b v-if="problem.hide === part" class="sum-answer">{{ problem.answer || '–' }}</b><span v-else>{{ problem[part] }}</span><span v-if="partIndex < 2" class="sum-sign">{{ partIndex === 0 ? problem.op : '=' }}</span></template></span><span class="sum-feedback"><template v-if="isCorrect(problem, problem.answer)"><Check :size="15" />Right</template><template v-else><Lightbulb :size="15" />{{ problem.answer ? 'It was' : 'Skipped ·' }} {{ problem[problem.hide] }}</template></span></li></ol>
  <p v-else class="sums-missing">The sums for this round weren't saved. Rounds finished from now on will show them here.</p>
</template>
