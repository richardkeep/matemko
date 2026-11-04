<script setup>
import { onMounted, ref } from 'vue'
import AuthPanel from './components/AuthPanel.vue'
import PracticeApp from './PracticeApp.vue'
const user = ref(null)
const loading = ref(true)
const error = ref('')
const resetToken = ref('')
// Password reset links arrive as /#reset=<token>; read them once and clear the address bar
function readLink() {
  const match = /^#(reset)=([a-f0-9]{64})$/.exec(window.location.hash)
  if (match) history.replaceState(null, '', window.location.pathname + window.location.search)
  return match ? { kind: match[1], token: match[2] } : null
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
  return link
}
onMounted(async () => {
  await followLink()
  await restore()
  // A reset link opened in a tab where Easy Math is already open only changes the hash
  window.addEventListener('hashchange', followLink)
})
</script>
<template>
  <main v-if="loading || error" class="auth-page"><section class="auth-card auth-status" aria-live="polite"><span class="auth-spark" aria-hidden="true">✦</span><h1>Easy Math</h1><p>{{ error || 'Getting your adventure ready…' }}</p><button v-if="error" class="button primary" @click="restore">Try again</button></section></main>
  <AuthPanel v-else-if="resetToken" :reset-token="resetToken" @signed-in="signedIn" @cancel-reset="resetToken = ''" />
  <PracticeApp v-else-if="user" :key="user.id" :user="user" @signed-out="signedOut" />
  <AuthPanel v-else @signed-in="signedIn" />
</template>
