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
export function isCorrect(equation, answer) {
  return String(answer ?? '').trim() !== '' && /^\d+$/.test(String(answer).trim()) && Number(answer) === equation[equation.hide]
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
