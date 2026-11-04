import test from 'node:test'
import assert from 'node:assert/strict'
import { makeEquation, generateWorksheet, isCorrect, cleanProblems, trickySums, modeLabel, MODE_PATTERN } from '../src/lib/worksheet.js'
import { emptyProgress, recordProgress, starsFor, BADGES, storeProgress, readProgress, mergeProgress, cleanProgress } from '../src/lib/progress.js'
let seed = 179
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
test('all four operations stay within each selected range and use whole numbers', () => {
 for (const max of [10,20,50,100]) for (const op of ['+','−','×','÷']) for (let i=0;i<1000;i++) {
  const q=makeEquation(op,max,random)
  for (const key of ['a','b','c']) assert.ok(Number.isInteger(q[key]) && q[key]>=0 && q[key]<=max, JSON.stringify(q))
  assert.equal(q.c, op==='+'?q.a+q.b:op==='−'?q.a-q.b:op==='×'?q.a*q.b:q.a/q.b)
  if(op==='÷') assert.ok(q.b>0)
 }
})
test('worksheets respect settings, reveal any missing term, and terminate with limited question space', () => {
 for(const count of [5,10,15,20,30]) {
  const questions=generateWorksheet({max:10,count,ops:['×']},()=>0)
  assert.equal(questions.length,count)
  for(const q of questions) {assert.equal(q.op,'×');assert.ok(['a','b','c'].includes(q.hide));assert.ok(isCorrect(q,String(q[q.hide])))}
 }
 assert.throws(()=>generateWorksheet({max:11,count:5,ops:['+']}))
})
test('zero is a valid answer; blank and malformed answers never count',()=>{
 const q={a:0,b:2,c:2,op:'+',hide:'a'}
 assert.ok(isCorrect(q,'0')); for(const a of ['',null,'x','0a','-0']) assert.equal(isCorrect(q,a),false)
})
const round={right:5,total:5,percent:100}
test('stars reward every completed round and accuracy',()=>{
 assert.equal(starsFor({percent:0}),1);assert.equal(starsFor({percent:60}),2);assert.equal(starsFor({percent:90}),3)
})
test('daily progress does not inflate streak; consecutive and skipped days work across month boundary',()=>{
 let p=recordProgress(emptyProgress(),round,['+'],new Date(2026,0,31))
 p=recordProgress(p,round,['+'],new Date(2026,0,31));assert.equal(p.streak,1);assert.equal(p.dailyStars,6)
 p=recordProgress(p,round,['+'],new Date(2026,1,1));assert.equal(p.streak,2);assert.equal(p.dailyStars,3)
 p=recordProgress(p,round,['+','−','×','÷'],new Date(2026,1,2));assert.equal(p.streak,3);assert.ok(BADGES.find(b=>b.id==='streak').test(p));assert.equal(p.mixed,1)
 p=recordProgress(p,round,['+'],new Date(2026,1,4));assert.equal(p.streak,1);assert.equal(p.bestStreak,3)
 assert.equal(p.rounds,5);assert.equal(p.correct,25);assert.equal(p.stars,15)
})
test('nickname progress persists independently and tolerates corrupt or denied storage',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}
 const p=recordProgress(emptyProgress(),round,['+'])
 storeProgress('Explorer',p,storage);assert.deepEqual(readProgress(' EXPLORER ',storage),p);assert.deepEqual(readProgress('Someone else',storage),emptyProgress())
 data.set('matemko.progress.explorer','bad json');assert.deepEqual(readProgress('Explorer',storage),emptyProgress())
 assert.deepEqual(readProgress('A',{getItem(){throw Error()}}),emptyProgress())
 assert.doesNotThrow(()=>storeProgress('A',p,{setItem(){throw Error()}}))
})
test('saved sums keep only known fields and reject anything that does not add up',()=>{
 const sums=[{a:48,op:'+',b:1,c:49,hide:'b',answer:' 1 ',extra:'x'},{a:49,op:'÷',b:7,c:7,hide:'b',answer:''}]
 assert.deepEqual(cleanProblems(sums,2),[{a:48,op:'+',b:1,c:49,hide:'b',answer:'1'},{a:49,op:'÷',b:7,c:7,hide:'b',answer:''}])
 assert.equal(cleanProblems(sums,3),null)
 assert.equal(cleanProblems([{a:2,op:'+',b:2,c:5,hide:'c',answer:'5'}],1),null)
 assert.equal(cleanProblems([{a:4,op:'÷',b:0,c:0,hide:'c',answer:'0'}],1),null)
 assert.equal(cleanProblems([{a:2,op:'+',b:2,c:4,hide:'d',answer:'4'}],1),null)
 assert.equal(cleanProblems([{a:2,op:'+',b:2,c:4,hide:'c',answer:'-4'}],1),null)
 assert.equal(cleanProblems('nope',1),null)
})
test('tricky sums keep only sums whose latest try was wrong or skipped', () => {
 const sum = (answer, a = 2) => ({ a, op: '+', b: 3, c: a + 3, hide: 'c', answer })
 const newestFirst = [[sum('5'), sum('9', 4)], [sum('6'), sum('', 7)], [sum('1', 4)]]
 assert.deepEqual(trickySums(newestFirst), [{ a: 4, op: '+', b: 3, c: 7, hide: 'c' }, { a: 7, op: '+', b: 3, c: 10, hide: 'c' }])
 assert.deepEqual(trickySums([null, []]), [])
 assert.equal(trickySums([Array.from({ length: 40 }, (_, i) => sum('', i))]).length, 30)
})
test('round modes are labelled and validated', () => {
 assert.equal(modeLabel('mistakes'), 'Tricky sums'); assert.equal(modeLabel('mix'), ''); assert.equal(modeLabel(null), '')
 for (const ok of ['mix', 'mistakes']) assert.ok(MODE_PATTERN.test(ok))
 for (const bad of ['table-7', 'mix ', 'anything']) assert.equal(MODE_PATTERN.test(bad), false)
})
test('merging progress from two devices never double counts and keeps the most recent day', () => {
 const phone = { ...emptyProgress(), rounds: 4, correct: 30, stars: 9, perfect: 1, bestStreak: 2, streak: 2, lastDay: '2026-11-03', dailyStars: 4 }
 const tablet = { ...emptyProgress(), rounds: 6, correct: 25, stars: 12, mixed: 1, bestStreak: 1, streak: 1, lastDay: '2026-11-04', dailyStars: 2 }
 const merged = mergeProgress(phone, tablet)
 assert.deepEqual(merged, { rounds: 6, correct: 30, stars: 12, perfect: 1, mixed: 1, streak: 1, bestStreak: 2, lastDay: '2026-11-04', dailyStars: 2 })
 assert.deepEqual(mergeProgress(merged, merged), merged)
 assert.deepEqual(mergeProgress(phone, tablet), mergeProgress(tablet, phone))
 assert.deepEqual(cleanProgress({ rounds: -3, stars: 'x', lastDay: 'yesterday', evil: 1 }), emptyProgress())
 assert.deepEqual(mergeProgress(null, phone), cleanProgress(phone))
})
