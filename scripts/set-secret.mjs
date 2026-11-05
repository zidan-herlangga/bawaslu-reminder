const fs = require('fs')
const path = require('path')
const readline = require('readline')

function loadEnv(p) {
  const txt = fs.readFileSync(p, 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l.startsWith('#')) continue
    const i = l.indexOf('=')
    if (i < 0) continue
    const k = l.slice(0, i).trim()
    let v = l.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[k] = v
  }
  return env
}

function saveEnv(p, envObj) {
  const lines = []
  for (const [k, v] of Object.entries(envObj)) {
    if (k === 'SUPABASE_SERVICE_ROLE_KEY') {
      lines.push(`${k}=${v}`)
      continue
    }
    lines.push(`${k}=${v}`)
  }
  fs.writeFileSync(p, lines.join('\r\n') + '\r\n', 'utf8')
}

const envPath = path.resolve(process.cwd(), '.env')
const env = loadEnv(envPath)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('Masukkan secret key sb_secret_...: ', (ans) => {
  rl.close()
  const secret = ans.trim()
  if (!secret) {
    console.error('Kosong')
    process.exit(1)
  }
  if (!secret.startsWith('sb_secret_')) {
    console.error('Harus diawali sb_secret_')
    process.exit(1)
  }
  fs.copyFileSync(envPath, envPath + '.bak.' + Date.now())
  // replace or add
  const txt = fs.readFileSync(envPath, 'utf8')
  const lines = txt.split(/\r?\n/)
  let found = false
  const out = lines.map(l => {
    if (l.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      found = true
      return `SUPABASE_SERVICE_ROLE_KEY=${secret}`
    }
    return l
  })
  if (!found) out.push(`SUPABASE_SERVICE_ROLE_KEY=${secret}`)
  fs.writeFileSync(envPath, out.join('\r\n') + '\r\n', 'utf8')
  console.log('Selesai. Key disimpan di .env')
})
