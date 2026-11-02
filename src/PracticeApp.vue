<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowRight, Check, ChevronRight, CircleHelp, Printer, Sparkles, Star, Timer, Trophy, RotateCcw, X, CheckCircle2, CloudUpload, ShieldCheck, Heart } from 'lucide-vue-next'
import AppDialog from './components/AppDialog.vue'
import MathMascot from './components/MathMascot.vue'
import PracticeSetup from './components/PracticeSetup.vue'
import EquationCard from './components/EquationCard.vue'
import LeaderboardPanel from './components/LeaderboardPanel.vue'
import ExplorerProgress from './components/ExplorerProgress.vue'
import { BADGES, readProgress, recordProgress, storeProgress, starsFor } from './lib/progress'
import { useWorksheet } from './composables/useWorksheet'
import { formatDuration } from './lib/worksheet'
const props = defineProps({ user: { type: Object, required: true } })
const emit = defineEmits(['signed-out'])
const signingOut = ref(false); const signOutError = ref('')
async function signOut() {
  if (signingOut.value || (inProgress.value && !window.confirm('Leave this unfinished adventure and sign out?'))) return
  signingOut.value = true; signOutError.value = ''
  try { const r = await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(); emit('signed-out') }
  catch { signOutError.value = 'Could not sign out. Please try again.' }
  finally { signingOut.value = false }
}
const { name, max, count, ops, equations, answers, answered, checked, result, saveState, saveError, inProgress, locked, elapsed, generate, toggleOperation, setAnswer, check, save } = useWorksheet(props.user)
const progress = ref(readProgress('account:' + props.user.id)); const newBadges = ref([]); const showStickers = ref(false); const mystery = ref(false)
watch(name, value => { progress.value = readProgress('account:' + props.user.id); newBadges.value = [] })
watch(result, value => {
  if (!value) return
  const oldIds = new Set(BADGES.filter(badge => badge.test(progress.value)).map(badge => badge.id))
  progress.value = recordProgress(progress.value, value, equations.value.map(equation => equation.op))
  newBadges.value = BADGES.filter(badge => badge.test(progress.value) && !oldIds.has(badge.id))
  storeProgress('account:' + props.user.id, progress.value)
})
watch([max, count, ops], () => { if (!locked.value) generate() })
const view = ref('practice'); const needsName = ref(false); const showSkipped = ref(false); const showHelp = ref(false); const roundNumber = ref(1)
const unanswered = computed(() => equations.value.length - answered.value)
const worksheetPages = computed(() => Array.from({ length: Math.ceil(equations.value.length / 30) }, (_, index) => ({ start: index * 30, equations: equations.value.slice(index * 30, index * 30 + 30) })))
watch(name, value => { if (value.trim()) needsName.value = false })
function focusName() { needsName.value = true; document.getElementById('explorer-name')?.focus() }
async function newRound() {
  mystery.value = false
  if (!name.value.trim()) { focusName(); return }
  if (generate()) { roundNumber.value++; await nextTick(); document.getElementById('answer-0')?.focus() }
}
async function nextAnswer(index) { await nextTick(); const next = document.getElementById(`answer-${index + 1}`); if (next) next.focus(); else document.getElementById('check-answers')?.focus() }
async function continueExploring() { showSkipped.value = false; await nextTick(); document.getElementById(`answer-${answers.value.findIndex(answer => !String(answer).trim())}`)?.focus() }
function requestCheck() { if (!name.value.trim()) { focusName(); return }; if (unanswered.value) showSkipped.value = true; else finishRound() }
async function finishRound() { showSkipped.value = false; check(); await nextTick(); document.getElementById('round-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
async function surpriseRound() {
  if (locked.value) return
  if (!name.value.trim()) { focusName(); return }
  max.value = [10, 20, 50][Math.floor(Math.random() * 3)]; count.value = 5
  ops.value = [['+'], ['−'], ['×'], ['÷'], ['+', '−']][Math.floor(Math.random() * 5)]
  await nextTick(); await newRound(); mystery.value = true
}
function printWorksheet() { window.print() }
const message = computed(() => !result.value ? '' : result.value.percent === 100 ? "Wow! You're a maths superstar!" : result.value.percent >= 70 ? 'Look at you go, clever explorer!' : 'A little braver. A little brighter!')
</script>
<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="#" @click.prevent="view = 'practice'" aria-label="Easy Math home"><span class="brand-mark" aria-hidden="true">✦</span><span>Easy Math<span class="brand-dot">.</span></span></a>
      <nav class="main-nav" aria-label="Main navigation"><button :class="{ active: view === 'practice' }" @click="view = 'practice'" :aria-current="view === 'practice' ? 'page' : undefined"><Sparkles :size="18" />Let's play</button><button :class="{ active: view === 'leaderboard' }" @click="view = 'leaderboard'" :aria-current="view === 'leaderboard' ? 'page' : undefined"><Trophy :size="18" />Star board</button></nav>
      <button class="account-signout" :disabled="signingOut" @click="signOut">{{ signingOut ? 'Signing out…' : 'Sign out' }}</button>
      <button class="help-button" @click="showHelp = true" aria-label="How to play"><CircleHelp :size="20" /><span>How to play</span></button>
    </header>
    <main class="main-content">
      <p v-if="signOutError" class="auth-error" role="alert">{{ signOutError }}</p>
      <template v-if="view === 'practice'">
        <section class="welcome-banner"><div class="welcome-copy"><span class="eyebrow"><span class="tiny-star">✦</span> BIG FUN. LITTLE SUMS.</span><h1>Ready, maths<br>explorer<span class="heading-dot">?</span></h1><p>Find the missing numbers. Collect little wins.<br class="desktop-break"> Watch your confidence grow.</p></div><MathMascot /><div class="welcome-note"><span class="note-star">✦</span><strong>You've got this!</strong><span>One little sum at a time.</span></div></section>
        <div class="practice-layout">
          <div class="setup-column"><PracticeSetup v-model:name="name" v-model:max="max" v-model:count="count" :ops="ops" :locked="locked" :needs-name="needsName" @toggle="toggleOperation" @generate="newRound" /><button class="surprise-button" :disabled="locked" @click="surpriseRound"><span>🎲</span><span><strong>Surprise me!</strong><small>A five-question mystery mission</small></span><ArrowRight :size="19" /></button><ExplorerProgress :progress="progress" :name="name" @stickers="showStickers = true" /></div>
          <section class="practice-workspace" aria-labelledby="worksheet-title">
            <div v-if="result" class="celebration-confetti" aria-hidden="true"><span v-for="index in 12" :key="`${roundNumber}-${index}`" :style="{ '--i': index }">{{ ['✦','●','★','◆'][index % 4] }}</span></div><div v-if="result" id="round-result" class="round-result" tabindex="-1" aria-live="polite"><span class="result-star" aria-hidden="true">{{ result.percent === 100 ? '🌟' : '⭐' }}</span><div class="result-copy"><span class="eyebrow">GIVE YOURSELF A HIGH FIVE</span><h2>{{ message }}</h2><div class="earned-round-stars" :aria-label="`${starsFor(result)} stars earned`"><span v-for="star in 3" :key="star" :class="{ earned: star <= starsFor(result) }" aria-hidden="true">★</span><b>+{{ starsFor(result) }} {{ starsFor(result) === 1 ? 'star' : 'stars' }}!</b></div><p>You found {{ result.right }} of {{ result.total }} missing numbers in {{ formatDuration(result.durationMs) }}.</p><small v-if="saveState === 'saving'" class="save-note"><CloudUpload :size="14" />Saving your star…</small><small v-else-if="saveState === 'saved'" class="save-note"><CheckCircle2 :size="14" />Your result is on the star board!</small><div v-else-if="saveState === 'error'" class="save-error"><span>{{ saveError }}</span><button @click="save">Try saving again</button></div></div><div v-if="newBadges.length" class="new-badges"><span v-for="badge in newBadges" :key="badge.id">{{ badge.emoji }} New sticker: {{ badge.name }}</span></div><div class="score-orbit"><strong>{{ result.percent }}<span>%</span></strong><small>Brilliant effort!</small></div></div>
            <div class="worksheet-card">
              <div class="worksheet-toolbar"><div><span class="eyebrow">{{ checked ? 'ADVENTURE COMPLETE' : mystery ? 'MYSTERY MISSION · FIVE LITTLE SUMS' : 'YOUR LITTLE BRAIN STRETCH' }}</span><h2 id="worksheet-title">{{ name.trim() ? `${name.trim()}'s adventure` : 'Your maths adventure' }}<span class="round-tag">#{{ String(roundNumber).padStart(2, '0') }}</span></h2></div><button class="icon-button" @click="printWorksheet" aria-label="Print worksheet" title="Print worksheet"><Printer :size="20" /></button></div>
              <div class="progress-toolbar"><div class="progress-label"><span :class="['status-dot', { running: inProgress, complete: checked }]"></span><span>{{ checked ? 'All checked. Great exploring!' : `${answered} of ${equations.length} answered` }}</span></div><div class="timer"><Timer :size="17" /><span>{{ formatDuration(elapsed) }}</span></div></div>
              <div class="progress-track" role="progressbar" :aria-valuenow="answered" :aria-valuemax="equations.length" aria-valuemin="0" aria-label="Questions answered"><span :style="{ width: `${answered / equations.length * 100}%` }"></span></div>
              <div v-if="!name.trim()" class="name-nudge"><span aria-hidden="true">👋</span> Hello, explorer! Pick a nickname to unlock your adventure.</div>
              <div class="question-area">
                <div v-for="page in worksheetPages" :key="page.start" class="worksheet-page"><div class="print-heading"><strong>Easy Math · Maths adventure</strong><span>Name: {{ name }} &nbsp; Date: __________</span></div><div class="question-grid"><EquationCard v-for="(equation, localIndex) in page.equations" :key="`${roundNumber}-${page.start + localIndex}`" :equation="equation" :index="page.start + localIndex" :answer="answers[page.start + localIndex]" :disabled="!name.trim()" :checked="checked" @answer="setAnswer(page.start + localIndex, $event)" @next="nextAnswer(page.start + localIndex)" /></div></div>
              </div>
              <div class="worksheet-actions"><span class="worksheet-hint"><span aria-hidden="true">{{ checked ? '🌱' : '✧' }}</span>{{ checked ? 'Every try helps your brain grow.' : 'Take your time. You can do it!' }}</span><button v-if="!checked" id="check-answers" class="button primary check-button" :disabled="!answered || !name.trim()" @click="requestCheck">Check my answers <Check :size="20" /></button><button v-else class="button primary check-button" :disabled="saveState === 'saving'" @click="newRound">Another adventure <ArrowRight :size="20" /></button></div>
            </div>
            <div class="below-worksheet"><span><ShieldCheck :size="15" />No rush. No pressure. Just practice.</span><button @click="view = 'leaderboard'"><Trophy :size="16" /> Visit the star board <ChevronRight :size="15" /></button></div>
          </section>
        </div>
      </template>
      <LeaderboardPanel v-else />
    </main>
    <footer class="site-footer"><span class="footer-brand">Easy Math<span>✦</span><small>Little sums. Lovely possibilities.</small></span><span>Made for curious little minds <Heart :size="13" /></span><a href="https://github.com/cannonsh/matemko" target="_blank" rel="noopener noreferrer">Inspired by Lovro Papež <span>↗</span></a></footer>
    <AppDialog v-model="showSkipped" class="app-dialog" @keydown.esc="showSkipped = false" aria-modal="true" aria-labelledby="skipped-title"><div class="dialog-scrim" @click="showSkipped = false"></div><div class="dialog-body"><span class="dialog-symbol">🧩</span><h2 id="skipped-title">A few numbers are still hiding!</h2><p>You have {{ unanswered }} unanswered {{ unanswered === 1 ? 'question' : 'questions' }}. Would you like to give them a try first?</p><div class="dialog-actions"><button class="button primary" autofocus @click="continueExploring">Keep exploring</button><button class="button secondary" @click="finishRound">Check anyway</button></div></div></AppDialog>
    <AppDialog v-model="showStickers" class="app-dialog" @keydown.esc="showStickers = false" aria-modal="true" aria-labelledby="sticker-title"><div class="dialog-scrim" @click="showStickers = false"></div><div class="dialog-body stickers-dialog"><button class="dialog-close icon-button" @click="showStickers = false" aria-label="Close sticker book"><X :size="21" /></button><span class="dialog-symbol">🎒</span><span class="eyebrow">LITTLE WINS TO KEEP</span><h2 id="sticker-title">{{ name.trim() ? `${name.trim()}'s sticker book` : 'Your sticker book' }}</h2><p>Every adventure brings a new discovery.</p><div class="sticker-grid"><article v-for="badge in BADGES" :key="badge.id" :class="{ unlocked: badge.test(progress) }"><span>{{ badge.test(progress) ? badge.emoji : '🔒' }}</span><h3>{{ badge.name }}</h3><p>{{ badge.description }}</p><small>{{ badge.test(progress) ? 'You earned this!' : 'Ready to discover' }}</small></article></div><div class="sticker-totals"><span>⭐ {{ progress.stars }} stars</span><span>🚀 {{ progress.rounds }} {{ progress.rounds === 1 ? 'adventure' : 'adventures' }}</span></div></div></AppDialog>
    <AppDialog v-model="showHelp" class="app-dialog" @keydown.esc="showHelp = false" aria-modal="true" aria-labelledby="help-title"><div class="dialog-scrim" @click="showHelp = false"></div><div class="dialog-body help-dialog"><button class="dialog-close icon-button" @click="showHelp = false" aria-label="Close help"><X :size="21" /></button><span class="dialog-symbol">✨</span><h2 id="help-title">Let's find those numbers!</h2><ol class="help-steps"><li><span>1</span><div><strong>Make it yours</strong><p>Choose a nickname, your favourite operations, and how many sums to try.</p></div></li><li><span>2</span><div><strong>Find what's hiding</strong><p>A number is missing from each sum. Pop it in the box! Press Enter to move to the next one.</p></div></li><li><span>3</span><div><strong>Celebrate your progress</strong><p>Check your answers, learn from the ones you missed, and see your result on the star board.</p></div></li></ol><button class="button primary" @click="showHelp = false">I've got it! <Sparkles :size="18" /></button></div></AppDialog>
  </div>
</template>
