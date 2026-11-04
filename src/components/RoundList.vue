<script setup>
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import SumsList from './SumsList.vue'
import { formatDuration, modeLabel } from '../lib/worksheet'
defineProps({ rounds: { type: Array, required: true }, sumsLabel: { type: String, default: 'sums' } })
const openId = ref(null)
const toggle = id => { openId.value = openId.value === id ? null : id }
const when = value => new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const percent = round => Math.round(round.right / round.total * 100)
</script>
<template>
  <ul class="round-list">
    <li v-for="round in rounds" :key="round.id" class="round-item">
      <div class="round-summary">
        <span :class="['round-score', percent(round) >= 90 ? 'great' : percent(round) >= 60 ? 'good' : 'growing']">{{ percent(round) }}<small>%</small></span>
        <div class="round-meta"><strong>{{ modeLabel(round.mode) || round.ops.join(' ') }}<span v-if="!modeLabel(round.mode)" class="round-limit"> · to {{ round.max }}</span></strong><small>{{ when(round.endedAt) }} · {{ round.right }} / {{ round.total }} correct · {{ formatDuration(round.endedAt - round.startedAt) }}</small></div>
        <button class="sums-toggle" :aria-expanded="openId === round.id" @click="toggle(round.id)">{{ openId === round.id ? `Hide ${sumsLabel}` : `See ${sumsLabel}` }} <ChevronDown :size="15" :class="{ flipped: openId === round.id }" /></button>
      </div>
      <SumsList v-if="openId === round.id" :problems="round.problems" />
    </li>
  </ul>
</template>
