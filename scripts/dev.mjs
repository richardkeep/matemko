import { spawn, spawnSync } from 'node:child_process'
const run = (file, args) => spawnSync(process.execPath, [file, ...args], { stdio: 'inherit' })
for (const [file, args] of [
  ['node_modules/vite/bin/vite.js', ['build']],
  ['node_modules/wrangler/bin/wrangler.js', ['d1','migrations','apply','matemko','--local']],
]) {
  const result = run(file, args)
  if (result.status !== 0) process.exit(result.status || 1)
}
const children = [
  spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js','dev','--local','--ip','127.0.0.1','--port','8787','--inspector-port','9235'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','0.0.0.0',...process.argv.slice(2)], { stdio: 'inherit' }),
]
let stopping = false
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(child => child.kill('SIGTERM')); process.exitCode = code }
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => stop())
children.forEach(child => { child.on('error', error => { console.error(error); stop(1) }); child.on('exit', code => stop(code || 0)) })
