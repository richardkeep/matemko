<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, MailCheck, Sparkles } from 'lucide-vue-next'
import MathMascot from './MathMascot.vue'
const props = defineProps({ resetToken: { type: String, default: '' } })
const emit = defineEmits(['signed-in', 'cancel-reset'])
const mode = ref(props.resetToken ? 'reset' : 'login'); const busy = ref(false); const error = ref(''); const visible = ref(false); const sent = ref(false)
const name = ref(''); const email = ref(''); const password = ref(''); const dateOfBirth = ref('')
const signup = computed(() => mode.value === 'register')
const needsPassword = computed(() => mode.value !== 'forgot')
const today = new Date().toISOString().slice(0, 10)
const TITLES = {
  login: ['👋', 'Welcome back, explorer!', 'Your next little win is waiting for you.', 'Let’s play'],
  register: ['🌱', 'Hello, new explorer!', 'Let’s make a little space for your big ideas.', 'Start my adventure'],
  forgot: ['🔑', 'Forgot your password?', 'Enter your email and we’ll send a link to choose a new one.', 'Send me a link'],
  reset: ['✨', 'Choose a new password', 'Pick something you’ll remember. This signs you out on other devices.', 'Save and play'],
}
const title = computed(() => TITLES[mode.value])
function switchMode(value) { mode.value = value; error.value = ''; password.value = ''; visible.value = false; sent.value = false }
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  const body = mode.value === 'reset' ? { token: props.resetToken, password: password.value } : mode.value === 'forgot' ? { email: email.value } : { name: name.value, email: email.value, password: password.value, dateOfBirth: dateOfBirth.value }
  try {
    const r = await fetch(`/api/auth/${mode.value}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Please try again.')
    password.value = ''
    if (mode.value === 'forgot') sent.value = true
    else emit('signed-in', data.user)
  } catch (e) { error.value = e.name === 'TimeoutError' ? 'The connection timed out. Please try again.' : e.message === 'Failed to fetch' ? 'Check your connection and try again.' : e.message }
  finally { busy.value = false }
}
</script>
<template>
  <main class="auth-page">
    <div class="auth-layout">
      <section class="auth-welcome"><a href="/" class="brand" aria-label="Easy Math home"><span class="brand-mark" aria-hidden="true">✦</span><span>Easy Math<span class="brand-dot">.</span></span></a><span class="eyebrow"><Sparkles :size="17" /> LITTLE SUMS. BIG ADVENTURES.</span><h1>A little practice.<br>A lot of <em>possibility.</em></h1><p>Find missing numbers, earn stars and grow your confidence. Your next adventure starts here.</p><MathMascot /><div class="auth-perks"><span>⭐ Collect stars</span><span>🎒 Earn stickers</span><span>🌱 Learn at your pace</span></div></section>
      <section class="auth-card" aria-labelledby="auth-title">
        <div v-if="mode === 'login' || mode === 'register'" class="auth-tabs" aria-label="Account options"><button type="button" :class="{ active: !signup }" :disabled="busy" :aria-pressed="!signup" @click="switchMode('login')">Sign in</button><button type="button" :class="{ active: signup }" :disabled="busy" :aria-pressed="signup" @click="switchMode('register')">Create account</button></div>
        <button v-else-if="mode === 'forgot'" type="button" class="auth-back" :disabled="busy" @click="switchMode('login')"><ArrowLeft :size="17" />Back to sign in</button>
        <span class="auth-spark" aria-hidden="true">{{ title[0] }}</span><h2 id="auth-title">{{ title[1] }}</h2><p class="auth-subtitle">{{ title[2] }}</p>
        <div v-if="sent" class="auth-sent" role="status"><MailCheck :size="28" /><p><strong>Check your inbox.</strong> If an account uses <b>{{ email }}</b>, a reset link is on its way. It works for one hour.</p><button type="button" class="button secondary" @click="switchMode('login')">Back to sign in</button></div>
        <form v-else @submit.prevent="submit">
          <fieldset :disabled="busy">
            <label v-if="signup" for="account-name">Name<input id="account-name" v-model="name" name="name" autocomplete="name" maxlength="80" required placeholder="Your name" /></label>
            <label v-if="mode !== 'reset'" for="account-email">Email<input id="account-email" v-model="email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com" inputmode="email" autocapitalize="none" spellcheck="false" /></label>
            <label v-if="needsPassword" for="account-password">{{ mode === 'reset' ? 'New password' : 'Password' }}<span class="auth-password"><input id="account-password" v-model="password" name="password" :type="visible ? 'text' : 'password'" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :minlength="mode === 'login' ? 1 : 10" maxlength="128" required :aria-describedby="mode === 'login' ? undefined : 'password-help'" placeholder="Your password" /><button type="button" :aria-label="visible ? 'Hide password' : 'Show password'" @click="visible = !visible"><EyeOff v-if="visible" :size="20" /><Eye v-else :size="20" /></button></span></label>
            <small v-if="mode === 'register' || mode === 'reset'" id="password-help">Use at least 10 characters.</small>
            <button v-if="mode === 'login'" type="button" class="auth-link" @click="switchMode('forgot')">Forgot your password?</button>
            <label v-if="signup" for="account-dob">Date of birth<input id="account-dob" v-model="dateOfBirth" name="dateOfBirth" type="date" min="1900-01-01" :max="today" autocomplete="bday" required /></label>
            <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
            <button class="button primary auth-submit" type="submit">{{ busy ? 'One little moment…' : title[3] }}<ArrowRight :size="20" /></button>
            <button v-if="mode === 'reset'" type="button" class="auth-link auth-cancel" @click="emit('cancel-reset')">Cancel</button>
          </fieldset>
        </form>
        <p v-if="mode === 'login' || mode === 'register'" class="auth-privacy"><LockKeyhole :size="15" /><span>Your name and score appear on the star board. Your email and birthday stay private.</span></p><p v-if="signup" class="auth-parent">Young explorers can ask a parent or guardian to help create their account.</p>
      </section>
    </div>
  </main>
</template>
