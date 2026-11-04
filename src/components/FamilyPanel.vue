<script setup>
import { onMounted, ref } from 'vue'
import { Users, KeyRound, UserPlus, X, Globe2, Copy, Check } from 'lucide-vue-next'
import RoundList from './RoundList.vue'
import { BADGES, dayKey } from '../lib/progress'
const family = ref({ children: [], guardians: [] }); const loading = ref(false); const error = ref('')
const code = ref(null); const codeBusy = ref(false); const codeError = ref(''); const copied = ref(false)
const entry = ref(''); const linkBusy = ref(false); const linkError = ref(''); const linkDone = ref('')
const post = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(15000) })
const problem = e => e.name === 'TimeoutError' ? 'The connection timed out. Please try again.' : e.message === 'Failed to fetch' ? 'Check your connection and try again.' : e.message
async function load() {
  loading.value = true; error.value = ''
  try { const r = await fetch('/api/family', { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(); family.value = await r.json() }
  catch { error.value = 'We could not load your family just now.' }
  finally { loading.value = false }
}
async function makeCode() {
  codeBusy.value = true; codeError.value = ''; copied.value = false
  try { const r = await post('/api/family/code'); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Please try again.'); code.value = data }
  catch (e) { codeError.value = problem(e) }
  finally { codeBusy.value = false }
}
async function copyCode() { try { await navigator.clipboard.writeText(code.value.code); copied.value = true } catch { /* Code stays visible to read aloud. */ } }
async function link() {
  linkBusy.value = true; linkError.value = ''; linkDone.value = ''
  try { const r = await post('/api/family/link', { code: entry.value }); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Please try again.'); entry.value = ''; linkDone.value = 'Linked! You can now follow their adventures below.'; await load() }
  catch (e) { linkError.value = problem(e) }
  finally { linkBusy.value = false }
}
async function unlink(person, asGuardian) {
  if (!window.confirm(asGuardian ? `Stop following ${person.name}?` : `Stop sharing your rounds with ${person.name}?`)) return
  try { const r = await post('/api/family/unlink', { id: person.id }); if (!r.ok) throw new Error(); await load() }
  catch { error.value = 'We could not remove that link. Please try again.' }
}
const expires = value => new Date(value).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
const stickers = progress => BADGES.filter(badge => badge.test(progress)).length
const today = progress => progress.lastDay === dayKey() ? progress.dailyStars : 0
onMounted(load)
</script>
<template>
  <section class="leaderboard-view family-view" aria-labelledby="family-title">
    <div class="board-intro"><div><span class="eyebrow"><span class="tiny-star">✦</span> LEARNING TOGETHER</span><h1 id="family-title">Family<span class="heading-dot">.</span></h1><p>Share your adventures with a parent, carer or teacher, or follow an explorer you look after.</p></div><div class="trophy-art" aria-hidden="true"><Users :size="74" :stroke-width="1.5" /><span>✦</span><i>✧</i></div></div>
    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
    <div class="family-grid">
      <article class="board-card family-card">
        <div class="board-card-heading"><h2><KeyRound :size="22" /> Share my adventures</h2></div>
        <div class="family-body">
          <p>Make a code and give it to your grown-up. They type it into <b>their</b> Family page to see your rounds, sums and stars. They never see your email or birthday.</p>
          <div v-if="code" class="family-code" aria-live="polite"><strong>{{ code.code }}</strong><button class="icon-button" :aria-label="copied ? 'Copied' : 'Copy code'" @click="copyCode"><Check v-if="copied" :size="18" /><Copy v-else :size="18" /></button><small>Works once, until {{ expires(code.expiresAt) }}.</small></div>
          <button class="button primary" :disabled="codeBusy" @click="makeCode">{{ codeBusy ? 'Making a code…' : code ? 'Make a new code' : 'Make a sharing code' }}</button>
          <p v-if="codeError" class="auth-error" role="alert">{{ codeError }}</p>
          <h3>Who can see my rounds</h3>
          <ul v-if="family.guardians.length" class="family-people"><li v-for="person in family.guardians" :key="person.id"><span class="explorer-avatar avatar-1">{{ person.name.charAt(0).toUpperCase() }}</span><strong>{{ person.name }}</strong><button class="family-remove" :aria-label="`Stop sharing with ${person.name}`" @click="unlink(person, false)"><X :size="16" />Remove</button></li></ul>
          <p v-else class="family-empty">{{ loading ? 'Checking…' : 'Nobody yet.' }}</p>
        </div>
      </article>
      <article class="board-card family-card">
        <div class="board-card-heading"><h2><UserPlus :size="22" /> Follow an explorer</h2></div>
        <form class="family-body" @submit.prevent="link">
          <p>Ask the explorer to make a sharing code on their Family page, then enter it here.</p>
          <label class="family-entry" for="family-code"><span class="field-label">Sharing code</span><input id="family-code" v-model="entry" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH" required /></label>
          <button class="button primary" type="submit" :disabled="linkBusy || !entry.trim()">{{ linkBusy ? 'Linking…' : 'Follow' }}</button>
          <p v-if="linkError" class="auth-error" role="alert">{{ linkError }}</p><p v-if="linkDone" class="auth-success" role="status">{{ linkDone }}</p>
        </form>
      </article>
    </div>
    <div v-if="loading && !family.children.length" class="empty-board" role="status"><span class="loading-dots">•••</span></div>
    <div v-else-if="!family.children.length && !error" class="family-none"><Globe2 :size="20" />Explorers you follow will appear here.</div>
    <article v-for="child in family.children" :key="child.id" class="board-card child-card">
      <div class="board-card-heading"><h2><span class="explorer-avatar avatar-2">{{ child.name.charAt(0).toUpperCase() }}</span> {{ child.name }}</h2><button class="family-remove" @click="unlink(child, true)"><X :size="16" />Stop following</button></div>
      <div class="history-stats child-stats"><div><strong>{{ child.progress.stars }}</strong><span>stars</span></div><div><strong>{{ child.progress.rounds }}</strong><span>rounds</span></div><div><strong>{{ today(child.progress) }} / 5</strong><span>stars today</span></div><div><strong>{{ child.progress.lastDay === dayKey() ? child.progress.streak : 0 }}</strong><span>day streak</span></div><div><strong>{{ stickers(child.progress) }} / {{ BADGES.length }}</strong><span>stickers</span></div></div>
      <RoundList v-if="child.rounds.length" :rounds="child.rounds" />
      <p v-else class="family-empty family-pad">No rounds yet.</p>
    </article>
  </section>
</template>
