<script setup>
import { onMounted, ref } from 'vue'
import AuthPanel from './components/AuthPanel.vue'
import PracticeApp from './PracticeApp.vue'
const user = ref(null)
const loading = ref(true)
const error = ref('')
async function restore() {
  loading.value = true; error.value = ''
  try { const r = await fetch('/api/auth/me', { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(); user.value = (await r.json()).user }
  catch { error.value = 'We could not connect to Easy Math. Please try again.' }
  finally { loading.value = false }
}
function signedIn(value) { user.value = value }
function signedOut() { user.value = null }
onMounted(restore)
</script>
<template>
  <main v-if="loading || error" class="auth-page"><section class="auth-card auth-status" aria-live="polite"><span class="auth-spark" aria-hidden="true">✦</span><h1>Easy Math</h1><p>{{ error || 'Getting your adventure ready…' }}</p><button v-if="error" class="button primary" @click="restore">Try again</button></section></main>
  <PracticeApp v-else-if="user" :key="user.id" :user="user" @signed-out="signedOut" />
  <AuthPanel v-else @signed-in="signedIn" />
</template>
