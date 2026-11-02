<script setup>
import { computed, ref } from 'vue'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles } from 'lucide-vue-next'
import MathMascot from './MathMascot.vue'
const emit = defineEmits(['signed-in'])
const mode = ref('login'); const busy = ref(false); const error = ref(''); const visible = ref(false)
const name = ref(''); const email = ref(''); const password = ref(''); const dateOfBirth = ref('')
const signup = computed(() => mode.value === 'register')
const today = new Date().toISOString().slice(0, 10)
function switchMode(value) { mode.value = value; error.value = ''; password.value = ''; visible.value = false }
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    const r = await fetch(`/api/auth/${mode.value}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.value, email: email.value, password: password.value, dateOfBirth: dateOfBirth.value }), signal: AbortSignal.timeout(20000) })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Please try again.')
    password.value = ''; emit('signed-in', data.user)
  } catch (e) { error.value = e.name === 'TimeoutError' ? 'The connection timed out. Please try again.' : e.message === 'Failed to fetch' ? 'Check your connection and try again.' : e.message }
  finally { busy.value = false }
}
</script>
<template>
  <main class="auth-page">
    <div class="auth-layout">
      <section class="auth-welcome"><a href="/" class="brand" aria-label="Easy Math home"><span class="brand-mark" aria-hidden="true">✦</span><span>Easy Math<span class="brand-dot">.</span></span></a><span class="eyebrow"><Sparkles :size="17" /> LITTLE SUMS. BIG ADVENTURES.</span><h1>A little practice.<br>A lot of <em>possibility.</em></h1><p>Find missing numbers, earn stars and grow your confidence. Your next adventure starts here.</p><MathMascot /><div class="auth-perks"><span>⭐ Collect stars</span><span>🎒 Earn stickers</span><span>🌱 Learn at your pace</span></div></section>
      <section class="auth-card" aria-labelledby="auth-title">
        <div class="auth-tabs" aria-label="Account options"><button type="button" :class="{ active: !signup }" :disabled="busy" :aria-pressed="!signup" @click="switchMode('login')">Sign in</button><button type="button" :class="{ active: signup }" :disabled="busy" :aria-pressed="signup" @click="switchMode('register')">Create account</button></div>
        <span class="auth-spark" aria-hidden="true">{{ signup ? '🌱' : '👋' }}</span><h2 id="auth-title">{{ signup ? 'Hello, new explorer!' : 'Welcome back, explorer!' }}</h2><p class="auth-subtitle">{{ signup ? 'Let’s make a little space for your big ideas.' : 'Your next little win is waiting for you.' }}</p>
        <form @submit.prevent="submit">
          <fieldset :disabled="busy">
            <label v-if="signup" for="account-name">Name<input id="account-name" v-model="name" name="name" autocomplete="name" maxlength="80" required placeholder="Your name" /></label>
            <label for="account-email">Email<input id="account-email" v-model="email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com" inputmode="email" autocapitalize="none" spellcheck="false" /></label>
            <label for="account-password">Password<span class="auth-password"><input id="account-password" v-model="password" name="password" :type="visible ? 'text' : 'password'" :autocomplete="signup ? 'new-password' : 'current-password'" :minlength="signup ? 10 : 1" maxlength="128" required :aria-describedby="signup ? 'password-help' : undefined" placeholder="Your password" /><button type="button" :aria-label="visible ? 'Hide password' : 'Show password'" @click="visible = !visible"><EyeOff v-if="visible" :size="20" /><Eye v-else :size="20" /></button></span></label>
            <small v-if="signup" id="password-help">Use at least 10 characters.</small>
            <label v-if="signup" for="account-dob">Date of birth<input id="account-dob" v-model="dateOfBirth" name="dateOfBirth" type="date" min="1900-01-01" :max="today" autocomplete="bday" required /></label>
            <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
            <button class="button primary auth-submit" type="submit">{{ busy ? 'One little moment…' : signup ? 'Start my adventure' : 'Let’s play' }}<ArrowRight :size="20" /></button>
          </fieldset>
        </form>
        <p class="auth-privacy"><LockKeyhole :size="15" /><span>Your email and birthday stay private. Only your explorer nickname and score appear on the star board.</span></p><p v-if="signup" class="auth-parent">Young explorers can ask a parent or guardian to help create their account.</p>
      </section>
    </div>
  </main>
</template>
