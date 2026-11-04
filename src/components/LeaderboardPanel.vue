<script setup>
import { computed, onMounted, ref } from 'vue'
import { Trophy, RefreshCw, Search, Medal, Globe2, Timer, ChevronDown, History } from 'lucide-vue-next'
import SumsList from './SumsList.vue'
import { countryLabel, formatDuration, modeLabel } from '../lib/worksheet'
const emit = defineEmits(['history'])
const attempts = ref([]); const loading = ref(false); const error = ref(''); const search = ref(''); const expanded = ref(false)
const filtered = computed(() => attempts.value.map((attempt, index) => ({ ...attempt, rank: index + 1 })).filter(attempt => attempt.name.toLowerCase().includes(search.value.toLowerCase())))
const visible = computed(() => expanded.value || search.value ? filtered.value : filtered.value.slice(0, 10))
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try { const response = await fetch('/api/attempts', { signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error(); const data = await response.json(); if (!Array.isArray(data)) throw new Error(); attempts.value = data }
  catch { error.value = "The star board is having a little rest. Try again in a moment." }
  finally { loading.value = false }
}
onMounted(load)
const openId = ref(null)
const toggleSums = id => { openId.value = openId.value === id ? null : id }
const finishedAt = value => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>
<template>
  <section class="leaderboard-view" aria-labelledby="board-title">
    <div class="board-intro"><div><span class="eyebrow"><span class="tiny-star">✦</span> EVERY LITTLE WIN COUNTS</span><h1 id="board-title">Our star board<span class="heading-dot">.</span></h1><p>A big round of applause for our maths explorers!</p></div><div class="trophy-art" aria-hidden="true"><Trophy :size="74" :stroke-width="1.5" /><span>✦</span><i>✧</i></div></div>
    <div class="board-toolbar"><label class="board-search"><Search :size="19" /><input v-model="search" aria-label="Find an explorer" placeholder="Find an explorer…" /></label><button class="button secondary" @click="load" :disabled="loading"><RefreshCw :size="17" :class="{ spinning: loading }" />Refresh</button></div>
    <div class="board-card">
      <div class="board-card-heading"><h2><Medal :size="23" /> Top explorers</h2><span>Best score · then most correct · then fastest</span></div>
      <div v-if="loading && !attempts.length" class="empty-board" role="status"><span class="loading-dots">•••</span><h3>Gathering our stars…</h3></div>
      <div v-else-if="error" class="empty-board" role="alert"><Globe2 :size="36" /><h3>Let's try that again</h3><p>{{ error }}</p><button class="button primary" @click="load">Try again</button></div>
      <div v-else-if="!visible.length" class="empty-board"><Trophy :size="46" /><h3>{{ search ? 'No explorer found just yet' : 'Your first adventure starts here' }}</h3><p>{{ search ? 'Try another name.' : 'Finish a round and be one of our first stars!' }}</p></div>
      <div v-else class="board-table-wrap"><table class="board-table"><thead><tr><th>Place</th><th>Explorer</th><th>Adventure</th><th>Score</th><th><span class="sr-only">Time</span><Timer :size="16" /></th></tr></thead><tbody><template v-for="attempt in visible" :key="attempt.id ?? `${attempt.rank}-${attempt.endedAt}-${attempt.name}`"><tr><td><span :class="['rank', `rank-${attempt.rank}`]">{{ attempt.rank <= 3 ? ['🥇', '🥈', '🥉'][attempt.rank - 1] : String(attempt.rank).padStart(2, '0') }}</span></td><td><div class="explorer-cell"><span class="explorer-avatar" :class="`avatar-${attempt.rank % 4}`">{{ attempt.name.charAt(0).toUpperCase() }}</span><div><strong>{{ attempt.name }}</strong><small><span>{{ countryLabel(attempt.country).flag }}</span> {{ countryLabel(attempt.country).name }} · {{ finishedAt(attempt.endedAt) }}</small><button v-if="attempt.mine" class="sums-toggle" :aria-expanded="openId === attempt.id" @click="toggleSums(attempt.id)">{{ openId === attempt.id ? 'Hide my sums' : 'See my sums' }} <ChevronDown :size="15" :class="{ flipped: openId === attempt.id }" /></button></div></div></td><td><span v-if="modeLabel(attempt.mode)" class="board-mode">{{ modeLabel(attempt.mode) }}</span><span v-else class="board-ops">{{ attempt.ops.join(' ') }}</span><small class="adventure-limit"><template v-if="!modeLabel(attempt.mode)">Numbers to {{ attempt.max }}</template><span v-if="attempt.timeLimitMs" class="round-timed"><Timer :size="13" />{{ attempt.timeLimitMs / 60000 }} min</span></small></td><td><strong class="board-percentage">{{ Math.round(attempt.right / attempt.total * 100) }}<small>%</small></strong><span class="board-score">{{ attempt.right }} / {{ attempt.total }} correct</span></td><td class="time-cell">{{ formatDuration(attempt.endedAt - attempt.startedAt) }}</td></tr><tr v-if="attempt.mine && openId === attempt.id" class="sums-row"><td colspan="5"><SumsList :problems="attempt.problems" /></td></tr></template></tbody></table></div>
      <button v-if="!search && filtered.length > 10" class="show-all-button" @click="expanded = !expanded">{{ expanded ? 'Show top 10' : `See all ${attempts.length} explorers` }} <ChevronDown :size="17" :class="{ flipped: expanded }" /></button>
    </div>
    <button class="board-history-link" @click="emit('history')"><History :size="17" />Not on the board? See all your rounds and sums</button>
    <p class="board-kind-note">✦ Every explorer learns at their own pace. Trying is what makes you a star.</p>
  </section>
</template>
