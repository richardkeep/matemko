<script setup>
import { onMounted, ref } from 'vue'
import AuthPanel from './components/AuthPanel.vue'
import PracticeApp from './PracticeApp.vue'
const user = ref(null)
const loading = ref(true)
const error = ref('')
const resetToken = ref('')
const notice = ref(null)
// Email links arrive as /#verify=<token> or /#reset=<token>; read them once and clear the address bar
function readLink() {
  const match = /^#(verify|reset)=([a-f0-9]{64})$/.exec(window.location.hash)
  if (match) history.replaceState(null, '', window.location.pathname + window.location.search)
  return match ? { kind: match[1], token: match[2] } : null
}
async function verify(token) {
  try {
    const r = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(15000) })
    const data = await r.json().catch(() => ({}))
    notice.value = r.ok ? { kind: 'success', text: 'Thanks! Your email is confirmed.' } : { kind: 'error', text: data.error || 'We could not confirm your email. Please try again.' }
  } catch { notice.value = { kind: 'error', text: 'We could not confirm your email. Check your connection and open the link again.' } }
}
async function restore() {
  loading.value = true; error.value = ''
  try { const r = await fetch('/api/auth/me', { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(); user.value = (await r.json()).user }
  catch { error.value = 'We could not connect to Easy Math. Please try again.' }
  finally { loading.value = false }
}
function signedIn(value) { user.value = value; resetToken.value = '' }
function signedOut() { user.value = null }
async function followLink() {
  const link = readLink()
  if (link?.kind === 'reset') resetToken.value = link.token
  if (link?.kind === 'verify') await verify(link.token)
  return link
}
onMounted(async () => {
  await followLink()
  await restore()
  // An email link opened in a tab where Easy Math is already open only changes the hash
  // (refresh the user quietly so a round in progress is not thrown away)
  window.addEventListener('hashchange', async () => {
    if ((await followLink())?.kind !== 'verify' || !user.value) return
    try { const r = await fetch('/api/auth/me', { signal: AbortSignal.timeout(15000) }); if (r.ok) user.value = (await r.json()).user || user.value } catch { /* The banner simply stays until next visit. */ }
  })
})
</script>
<template>
  <main v-if="loading || error" class="auth-page"><section class="auth-card auth-status" aria-live="polite"><span class="auth-spark" aria-hidden="true">✦</span><h1>Easy Math</h1><p>{{ error || 'Getting your adventure ready…' }}</p><button v-if="error" class="button primary" @click="restore">Try again</button></section></main>
  <AuthPanel v-else-if="resetToken" :reset-token="resetToken" @signed-in="signedIn" @cancel-reset="resetToken = ''" />
  <PracticeApp v-else-if="user" :key="user.id" :user="user" :notice="notice" @signed-out="signedOut" @user="user = $event" @dismiss-notice="notice = null" />
  <AuthPanel v-else :notice="notice" @signed-in="signedIn" />
</template>
