<script setup>
import { computed, onMounted, ref } from 'vue'
import { History, RefreshCw, Globe2, Sparkles } from 'lucide-vue-next'
import RoundList from './RoundList.vue'
const emit = defineEmits(['play'])
const rounds = ref([]); const loading = ref(false); const error = ref('')
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try { const r = await fetch('/api/attempts/mine', { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(); const data = await r.json(); if (!Array.isArray(data)) throw new Error(); rounds.value = data }
  catch { error.value = 'We could not fetch your rounds just now. Try again in a moment.' }
  finally { loading.value = false }
}
onMounted(load)
const recent = computed(() => rounds.value.slice(0, 10))
const accuracy = computed(() => { const t = recent.value.reduce((sum, r) => sum + r.total, 0); return t ? Math.round(recent.value.reduce((sum, r) => sum + r.right, 0) / t * 100) : 0 })
const best = computed(() => rounds.value.reduce((top, r) => Math.max(top, Math.round(r.right / r.total * 100)), 0))
</script>
<template>
  <section class="leaderboard-view history-view" aria-labelledby="history-title">
    <div class="board-intro"><div><span class="eyebrow"><span class="tiny-star">✦</span> LOOK HOW FAR YOU'VE COME</span><h1 id="history-title">My rounds<span class="heading-dot">.</span></h1><p>Every round you've finished, with each sum you tried.</p></div><div class="trophy-art" aria-hidden="true"><History :size="74" :stroke-width="1.5" /><span>✦</span><i>✧</i></div></div>
    <div v-if="rounds.length" class="history-stats"><div><strong>{{ rounds.length }}{{ rounds.length >= 50 ? '+' : '' }}</strong><span>rounds played</span></div><div><strong>{{ accuracy }}%</strong><span>right in your last {{ recent.length }}</span></div><div><strong>{{ best }}%</strong><span>best round</span></div></div>
    <div class="board-card">
      <div class="board-card-heading"><h2><History :size="23" /> Most recent first</h2><button class="button secondary" @click="load" :disabled="loading"><RefreshCw :size="17" :class="{ spinning: loading }" />Refresh</button></div>
      <div v-if="loading && !rounds.length" class="empty-board" role="status"><span class="loading-dots">•••</span><h3>Finding your rounds…</h3></div>
      <div v-else-if="error" class="empty-board" role="alert"><Globe2 :size="36" /><h3>Let's try that again</h3><p>{{ error }}</p><button class="button primary" @click="load">Try again</button></div>
      <div v-else-if="!rounds.length" class="empty-board"><Sparkles :size="46" /><h3>No rounds yet</h3><p>Finish an adventure and it will appear here.</p><button class="button primary" @click="emit('play')">Let's play</button></div>
      <RoundList v-else :rounds="rounds" sums-label="my sums" />
    </div>
  </section>
</template>
