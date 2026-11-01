import test from 'node:test'
import assert from 'node:assert/strict'
import { makeEquation, generateWorksheet, isCorrect } from '../src/lib/worksheet.js'
import { emptyProgress, recordProgress, starsFor, BADGES, storeProgress, readProgress } from '../src/lib/progress.js'
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
