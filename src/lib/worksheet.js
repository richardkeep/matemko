export const OPERATIONS = [
  { value: '+', label: 'Addition', short: 'Add', color: 'green' },
  { value: '−', label: 'Subtraction', short: 'Subtract', color: 'blue' },
  { value: '×', label: 'Multiplication', short: 'Multiply', color: 'orange' },
  { value: '÷', label: 'Division', short: 'Divide', color: 'purple' },
]
const randomInt = (min, max, random) => Math.floor(random() * (max - min + 1)) + min
const pick = (items, random) => items[Math.floor(random() * items.length)]
export function makeEquation(op, max, random = Math.random) {
  const rnd = (a, b) => randomInt(a, b, random)
  const factor = Math.max(10, Math.round(Math.sqrt(max)))
  const lo = max >= 4 ? 2 : 1
  if (op === '+') { const a = rnd(0, max); const b = rnd(0, max - a); return { a, op, b, c: a + b } }
  if (op === '−') { const a = rnd(0, max); const b = rnd(0, a); return { a, op, b, c: a - b } }
  if (op === '×') { const a = rnd(lo, Math.min(factor, Math.floor(max / lo))); const b = rnd(lo, Math.max(lo, Math.min(factor, Math.floor(max / a)))); return { a, op, b, c: a * b } }
  const b = rnd(lo, Math.min(factor, max)); const c = rnd(1, Math.max(1, Math.min(factor, Math.floor(max / b)))); return { a: b * c, op: '÷', b, c }
}
export function generateWorksheet({ max, count, ops }, random = Math.random) {
  if (![10, 20, 50, 100].includes(max) || ![5, 10, 15, 20, 30].includes(count) || !ops.length || ops.some(op => !OPERATIONS.some(item => item.value === op))) throw new Error('Choose valid worksheet settings.')
  const seen = new Set(); const equations = []; let attempts = 0
  while (equations.length < count) {
    const equation = makeEquation(pick(ops, random), max, random)
    const key = `${equation.a}${equation.op}${equation.b}`
    if (seen.has(key) && ++attempts < 500) continue
    seen.add(key)
    equations.push({ ...equation, hide: pick(['c', 'c', 'b', 'a'], random) })
  }
  return equations
}
export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
export const BOND_TARGETS = [10, 20, 100]
export const TIME_LIMITS = [1, 2, 3, 4, 5, 10, 15, 20, 30].map(minutes => minutes * 60000)
export const MODE_PATTERN = /^(mix|mistakes|table-(?:[2-9]|1[0-2])|bonds-(?:10|20|100))$/
// Times-table drill: every sum uses the chosen table, on either side of the ×
export function generateTable({ table, count }, random = Math.random) {
  if (!TABLES.includes(table) || ![5, 10, 15, 20, 30].includes(count)) throw new Error('Choose valid worksheet settings.')
  const order = []
  while (order.length < count) order.push(...shuffle(Array.from({ length: 12 }, (_, index) => index + 1), random))
  return order.slice(0, count).map(n => {
    const [a, b] = random() < 0.5 ? [n, table] : [table, n]
    return { a, op: '×', b, c: a * b, hide: pick(['c', 'c', 'c', a === table ? 'b' : 'a'], random) }
  })
}
// Number bonds: pairs that make the target, as a missing addend or a subtraction from the target
export function generateBonds({ target, count }, random = Math.random) {
  if (!BOND_TARGETS.includes(target) || ![5, 10, 15, 20, 30].includes(count)) throw new Error('Choose valid worksheet settings.')
  const seen = new Set(); const equations = []; let attempts = 0
  while (equations.length < count) {
    const a = randomInt(0, target, random)
    const equation = random() < 0.7 ? { a, op: '+', b: target - a, c: target, hide: pick(['a', 'b'], random) } : { a: target, op: '−', b: a, c: target - a, hide: pick(['b', 'c'], random) }
    const key = `${equation.a}${equation.op}${equation.b}${equation.hide}`
    if (seen.has(key) && ++attempts < 500) continue
    seen.add(key); equations.push(equation)
  }
  return equations
}
export function shuffle(items, random = Math.random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] }
  return copy
}
// Sums whose most recent try was wrong or skipped. Rounds are newest first.
export function trickySums(rounds, limit = 30) {
  const latest = new Map()
  for (const problems of rounds) for (const p of problems || []) {
    const key = `${p.a}${p.op}${p.b}=${p.c}:${p.hide}`
    if (!latest.has(key)) latest.set(key, { problem: { a: p.a, op: p.op, b: p.b, c: p.c, hide: p.hide }, right: isCorrect(p, p.answer) })
  }
  return [...latest.values()].filter(item => !item.right).slice(0, limit).map(item => item.problem)
}
export function modeLabel(mode) {
  if (!mode || mode === 'mix') return ''
  if (mode === 'mistakes') return 'Tricky sums'
  const [kind, value] = mode.split('-')
  return kind === 'table' ? `${value} times table` : `Bonds to ${value}`
}
export function isCorrect(equation, answer) {
  return String(answer ?? '').trim() !== '' && /^\d+$/.test(String(answer).trim()) && Number(answer) === equation[equation.hide]
}
// Checks a round's sums as sent by the browser; returns them with only known fields, or null
export function cleanProblems(problems, total) {
  if (!Array.isArray(problems) || problems.length !== total) return null
  const clean = []
  for (const problem of problems) {
    if (!problem || typeof problem !== 'object') return null
    const { a, op, b, c, hide } = problem
    if (![a, b, c].every(n => Number.isInteger(n) && n >= 0 && n <= 100000)) return null
    if (!OPERATIONS.some(item => item.value === op) || !['a', 'b', 'c'].includes(hide)) return null
    const adds = op === '+' ? a + b === c : op === '−' ? a - b === c : op === '×' ? a * b === c : b > 0 && b * c === a
    if (!adds) return null
    const answer = typeof problem.answer === 'string' ? problem.answer.trim() : ''
    if (!/^\d{0,6}$/.test(answer)) return null
    clean.push({ a, op, b, c, hide, answer })
  }
  return clean
}
export function formatDuration(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
export function countryLabel(code) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return { flag: '🌍', name: 'Worldwide' }
  const flag = String.fromCodePoint(...[...code].map(letter => 0x1F1E6 + letter.charCodeAt(0) - 65))
  try { return { flag, name: new Intl.DisplayNames(['en'], { type: 'region' }).of(code) } } catch { return { flag, name: code } }
}
