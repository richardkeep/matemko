<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Activity, RefreshCw, Globe2, Users, CalendarDays, Trophy, Radio } from 'lucide-vue-next'
import { countryLabel } from '../lib/worksheet'
// Platform admin only: the server returns 404 to everyone else, and this tab is only shown to admins.
const data = ref(null); const loading = ref(false); const error = ref(''); const now = ref(Date.now())
const ACTIVITY = { practice: 'Playing', history: 'Looking at My rounds', leaderboard: 'On the star board', family: 'On the Family page', admin: 'Admin' }
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try { const r = await fetch('/api/admin/online', { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(); data.value = await r.json(); now.value = Date.now() }
  catch { error.value = 'We could not load who is online. Try again in a moment.' }
  finally { loading.value = false }
}
const refresh = setInterval(load, 20000)
const tick = setInterval(() => { now.value = Date.now() }, 5000)
onMounted(load)
onBeforeUnmount(() => { clearInterval(refresh); clearInterval(tick) })
const ago = ms => { const s = Math.max(0, Math.round((now.value - ms) / 1000)); return s < 15 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)} min ago` }
const tiles = computed(() => data.value ? [
  { icon: Radio, value: data.value.counts.online, label: 'online now' },
  { icon: Activity, value: data.value.counts.activeToday, label: 'active in the last 24 h' },
  { icon: CalendarDays, value: data.value.counts.activeWeek, label: 'active in the last 7 days' },
  { icon: Users, value: data.value.counts.learners, label: 'accounts' },
  { icon: Trophy, value: data.value.counts.roundsToday, label: 'rounds in the last 24 h' },
] : [])
</script>
<template>
  <section class="leaderboard-view admin-view" aria-labelledby="admin-title">
    <div class="board-intro"><div><span class="eyebrow"><span class="tiny-star">✦</span> PLATFORM ADMIN</span><h1 id="admin-title">Who's online<span class="heading-dot">.</span></h1><p>Learners with Easy Math open in the last two minutes. Updates every 20 seconds.</p></div><div class="trophy-art" aria-hidden="true"><Radio :size="74" :stroke-width="1.5" /><span>✦</span><i>✧</i></div></div>
    <div v-if="tiles.length" class="history-stats admin-stats"><div v-for="tile in tiles" :key="tile.label"><strong><component :is="tile.icon" :size="20" />{{ tile.value }}</strong><span>{{ tile.label }}</span></div></div>
    <div class="board-card">
      <div class="board-card-heading"><h2><Radio :size="23" /> Online now</h2><button class="button secondary" @click="load" :disabled="loading"><RefreshCw :size="17" :class="{ spinning: loading }" />Refresh</button></div>
      <div v-if="!data && !error" class="empty-board" role="status"><span class="loading-dots">•••</span></div>
      <div v-else-if="error" class="empty-board" role="alert"><Globe2 :size="36" /><h3>Let's try that again</h3><p>{{ error }}</p><button class="button primary" @click="load">Try again</button></div>
      <div v-else-if="!data.online.length" class="empty-board"><Users :size="46" /><h3>Nobody is online right now</h3></div>
      <div v-else class="board-table-wrap"><table class="board-table admin-table"><thead><tr><th>Learner</th><th>Doing</th><th>Rounds today</th><th>Last seen</th></tr></thead><tbody><tr v-for="(person, index) in data.online" :key="`${person.name}-${index}`"><td><div class="explorer-cell"><span class="explorer-avatar" :class="`avatar-${index % 4}`">{{ person.name.charAt(0).toUpperCase() }}</span><div><strong>{{ person.name }}</strong><small><span>{{ countryLabel(person.country).flag }}</span> {{ countryLabel(person.country).name }}</small><span :class="['admin-activity', 'admin-phone-only', { live: person.inRound }]"><i aria-hidden="true"></i>{{ person.inRound ? 'In a round' : ACTIVITY[person.activity] }} · {{ ago(person.lastSeen) }}</span></div></div></td><td><span :class="['admin-activity', { live: person.inRound }]"><i aria-hidden="true"></i>{{ person.inRound ? 'In a round' : ACTIVITY[person.activity] }}</span></td><td class="time-cell">{{ person.roundsToday }}</td><td class="time-cell">{{ ago(person.lastSeen) }}</td></tr></tbody></table></div>
    </div>
    <p class="board-kind-note">Only platform admins can see this page. Emails and birthdays are never shown here.</p>
  </section>
</template>
