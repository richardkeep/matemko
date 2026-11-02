import { computed, onBeforeUnmount, ref } from 'vue'
import { generateWorksheet, isCorrect } from '../lib/worksheet'
export function useWorksheet(user) {
  const name = ref(user.name); const max = ref(50); const count = ref(10); const ops = ref(['+', '−', '×', '÷'])
  const equations = ref([]); const answers = ref([]); const checked = ref(false); const startedAt = ref(null); const endedAt = ref(null); const now = ref(0)
  const result = ref(null); const saveState = ref(''); const saveError = ref(''); let pendingAttempt = null; let round = 0
  const answered = computed(() => answers.value.filter(answer => String(answer).trim() !== '').length)
  const inProgress = computed(() => !checked.value && answered.value > 0)
  const locked = computed(() => inProgress.value || saveState.value === 'saving')
  const elapsed = computed(() => startedAt.value === null ? 0 : (endedAt.value ?? now.value) - startedAt.value)
  const timer = setInterval(() => { if (inProgress.value) now.value = performance.now() }, 1000)
  function generate() {
    if (locked.value) return false
    equations.value = generateWorksheet({ max: max.value, count: count.value, ops: ops.value })
    answers.value = equations.value.map(() => ''); checked.value = false; startedAt.value = null; endedAt.value = null; now.value = 0; result.value = null; saveState.value = ''; saveError.value = ''; pendingAttempt = null; round++
    return true
  }
  function setAnswer(index, answer) {
    if (checked.value || !name.value.trim()) return
    answers.value[index] = String(answer).replace(/[^0-9]/g, '').slice(0, 6)
    if (answered.value > 0 && startedAt.value === null) { startedAt.value = performance.now(); now.value = startedAt.value }
    if (answered.value === 0) { startedAt.value = null; now.value = 0 }
  }
  function toggleOperation(op) {
    if (locked.value) return
    if (ops.value.includes(op)) { if (ops.value.length > 1) ops.value = ops.value.filter(item => item !== op) }
    else ops.value = ['+', '−', '×', '÷'].filter(item => ops.value.includes(item) || item === op)
  }
  async function save() {
    if (!pendingAttempt || saveState.value === 'saving' || saveState.value === 'saved') return
    const currentRound = round; const payload = pendingAttempt
    saveState.value = 'saving'; saveError.value = ''
    try {
      const response = await fetch('/api/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error('Your result could not be saved. Please try again.')
      if (currentRound === round) saveState.value = 'saved'
    } catch (error) {
      if (currentRound === round) { saveState.value = 'error'; saveError.value = error.name === 'TimeoutError' ? 'The connection timed out. You can retry saving your result.' : 'Your result is safe on this screen. Reconnect and try saving again.' }
    }
  }
  function check() {
    if (checked.value || !name.value.trim() || !answered.value) return
    endedAt.value = performance.now()
    const right = equations.value.filter((equation, index) => isCorrect(equation, answers.value[index])).length
    result.value = { right, total: equations.value.length, percent: Math.round(right / equations.value.length * 100), durationMs: Math.max(0, Math.round(elapsed.value)) }
    checked.value = true
    pendingAttempt = { name: name.value.trim(), max: max.value, ops: [...new Set(equations.value.map(equation => equation.op))], right, total: equations.value.length, durationMs: Math.min(86400000, result.value.durationMs), problems: equations.value.map((equation, index) => ({ ...equation, answer: String(answers.value[index]).trim() })) }
    void save()
  }
  const beforeUnload = event => { if (inProgress.value) event.preventDefault() }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => { clearInterval(timer); window.removeEventListener('beforeunload', beforeUnload) })
  generate()
  return { name, max, count, ops, equations, answers, answered, checked, result, saveState, saveError, inProgress, locked, elapsed, generate, toggleOperation, setAnswer, check, save }
}
