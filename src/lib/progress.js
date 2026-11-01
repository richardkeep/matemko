export const DAILY_GOAL = 5
export const BADGES = [
  { id: 'first', emoji: '🌱', name: 'First little win', description: 'Finish your very first adventure.', test: p => p.rounds >= 1 },
  { id: 'perfect', emoji: '🌟', name: 'Maths superstar', description: 'Find every missing number in a round.', test: p => p.perfect >= 1 },
  { id: 'five', emoji: '🚀', name: 'Brave explorer', description: 'Keep exploring for five adventures.', test: p => p.rounds >= 5 },
  { id: 'mixed', emoji: '🎨', name: 'Mix-it-up master', description: 'Finish a round with all four operations.', test: p => p.mixed >= 1 },
  { id: 'hundred', emoji: '🦉', name: 'Wise little owl', description: 'Find 100 missing numbers correctly.', test: p => p.correct >= 100 },
  { id: 'streak', emoji: '🔥', name: 'Three-day spark', description: 'Practise on three days in a row.', test: p => p.bestStreak >= 3 },
]
export const emptyProgress = () => ({ rounds: 0, correct: 0, stars: 0, perfect: 0, mixed: 0, streak: 0, bestStreak: 0, lastDay: '', dailyStars: 0 })
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const starsFor = result => result.percent >= 90 ? 3 : result.percent >= 60 ? 2 : 1
export function recordProgress(previous, result, ops, date = new Date()) {
  const today = dayKey(date); const yesterday = new Date(date); yesterday.setDate(yesterday.getDate() - 1)
  const stars = starsFor(result)
  const streak = previous.lastDay === today ? previous.streak : previous.lastDay === dayKey(yesterday) ? previous.streak + 1 : 1
  return { rounds: previous.rounds + 1, correct: previous.correct + result.right, stars: previous.stars + stars, perfect: previous.perfect + (result.right === result.total ? 1 : 0), mixed: previous.mixed + (new Set(ops).size === 4 ? 1 : 0), streak, bestStreak: Math.max(previous.bestStreak, streak), lastDay: today, dailyStars: (previous.lastDay === today ? previous.dailyStars : 0) + stars }
}
export function readProgress(name, storage = localStorage) {
  if (!name.trim()) return emptyProgress()
  try {
    const saved = JSON.parse(storage.getItem('matemko.progress.' + name.trim().toLowerCase()))
    if (!saved || typeof saved !== 'object') return emptyProgress()
    const clean = emptyProgress()
    for (const key of Object.keys(clean)) if (key !== 'lastDay') clean[key] = Number.isFinite(saved[key]) && saved[key] >= 0 ? Math.floor(saved[key]) : 0
    clean.lastDay = /^\d{4}-\d{2}-\d{2}$/.test(saved.lastDay) ? saved.lastDay : ''
    return clean
  } catch { return emptyProgress() }
}
export function storeProgress(name, progress, storage = localStorage) {
  try { storage.setItem('matemko.progress.' + name.trim().toLowerCase(), JSON.stringify(progress)) } catch { /* Still celebrate progress when device storage is unavailable. */ }
}
