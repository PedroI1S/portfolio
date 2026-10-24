// Sobe o túnel da Cloudflare e aponta o link fixo (GitHub Pages) para ele.
//   node scripts/tunel.mjs      → sobe servidor se necessário, publica o destino e mantém rodando
//   Ctrl+C                      → derruba o túnel e marca o link como "desligado"
import { execFileSync, spawn } from 'node:child_process'
import { Resolver } from 'node:dns/promises'
import https from 'node:https'
import http from 'node:http'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const REPO = process.env.REPO ?? 'PedroI1S/portfolio'
const BRANCH = process.env.PAGES_BRANCH ?? 'gh-pages'
const LINK_FIXO = process.env.LINK_FIXO ?? 'https://pedroi1s.github.io/portfolio/'
const PORTA = Number(process.env.PORT ?? 4173)

const log = (m) => console.log(`\x1b[36m[túnel]\x1b[0m ${m}`)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

let previewProcess = null
let encerrando = false

// ---------- 1. Garantir que o preview server está no ar ----------
async function checarPreviewLocal() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORTA}/api/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

function liberarPorta(porta) {
  try {
    const pids = execFileSync('lsof', ['-ti', `:${porta}`], { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean)
    for (const pid of pids) {
      try { process.kill(Number(pid), 'SIGKILL') } catch {}
    }
  } catch {}
}

if (!(await checarPreviewLocal())) {
  liberarPorta(PORTA)
  log(`Servidor local não detectado na porta ${PORTA}. Iniciando scripts/preview.py…`)
  previewProcess = spawn('python3', [resolve(ROOT, 'scripts/preview.py'), '--port', String(PORTA)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  previewProcess.stderr.on('data', (d) => process.stderr.write(d))

  previewProcess.on('exit', (code) => {
    if (!encerrando && code !== 0) {
      log(`⚠️ Servidor de preview encerrou com código ${code}`)
    }
  })

  // Aguarda até 5 segundos para o servidor responder
  let pronto = false
  for (let i = 0; i < 25; i++) {
    await esperar(200)
    if (await checarPreviewLocal()) {
      pronto = true
      break
    }
  }

  if (!pronto) {
    console.error(`\n❌ Não foi possível iniciar o preview server na porta ${PORTA}.\nRode manualmente em outro terminal: python3 scripts/preview.py\n`)
    process.exit(1)
  }
  log(`Preview server rodando em http://127.0.0.1:${PORTA}/ ✓`)
} else {
  log(`Preview server já ativo em http://127.0.0.1:${PORTA}/ ✓`)
}

// ---------- 2. Publicar destino no GitHub Pages ----------
function obterShaDestino(caminho, branch) {
  try {
    const url = branch ? `repos/${REPO}/contents/${caminho}?ref=${branch}` : `repos/${REPO}/contents/${caminho}`
    return execFileSync('gh', ['api', url, '--jq', '.sha'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function publicarArquivo(caminho, branch, url) {
  const sha = obterShaDestino(caminho, branch)
  const payload = JSON.stringify({ url, atualizadoEm: new Date().toISOString() }, null, 2) + '\n'
  const conteudo = Buffer.from(payload).toString('base64')

  const args = [
    'api',
    '-X',
    'PUT',
    `repos/${REPO}/contents/${caminho}`,
    '-f',
    `message=Destino: ${url ?? 'desligado'}`,
    '-f',
    `content=${conteudo}`,
  ]
  if (sha) args.push('-f', `sha=${sha}`)
  if (branch) args.push('-f', `branch=${branch}`)

  execFileSync('gh', args, { stdio: 'ignore' })
}

function publicar(url) {
  // Publica na branch do GitHub Pages (gh-pages) e também atualiza pages/destino.json caso exista
  try {
    publicarArquivo('destino.json', BRANCH, url)
  } catch (err) {
    log(`Aviso ao publicar em ${BRANCH}/destino.json: ${err.message}`)
    // Fallback: tentar atualizar na raiz de main ou pages/destino.json
    try {
      publicarArquivo('pages/destino.json', 'main', url)
    } catch (e) {
      log(`Erro de fallback no GitHub: ${e.message}`)
    }
  }
}

async function aguardarPublicacao(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${LINK_FIXO}destino.json?t=${Date.now()}`, { cache: 'no-store' })
      if (r.ok) {
        const data = await r.json()
        if (data.url === url) return true
      }
    } catch {}
    await esperar(3000)
  }
  return false
}

// ---------- 3. Checar o túnel pelo DNS público ----------
const dnsPublico = new Resolver()
dnsPublico.setServers(['1.1.1.1', '8.8.8.8'])

async function tunelResponde(url) {
  try {
    const host = new URL(url).hostname
    const [ip] = await dnsPublico.resolve4(host)
    return new Promise((resolve) => {
      const req = https.get(
        { host: ip, servername: host, path: '/api/health', headers: { host }, timeout: 8000 },
        (res) => resolve(res.statusCode === 200)
      )
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
  } catch {
    return false
  }
}

// ---------- 4. Subir o túnel Cloudflare ----------
log('Iniciando túnel da Cloudflare (cloudflared)…')
const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORTA}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

let url = null
let registrado = false

const ler = (dados) => {
  const texto = dados.toString()
  const m = texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
  if (m && !url) url = m[0]
  if (texto.includes('Registered tunnel connection')) registrado = true
}
cf.stdout.on('data', ler)
cf.stderr.on('data', ler)

async function encerrar(codigo = 0) {
  if (encerrando) return
  encerrando = true
  log('Encerrando túnel… atualizando link fixo para estado desligado.')
  try {
    publicar(null)
  } catch (e) {
    log(`⚠️ Não consegui atualizar o link fixo: ${e.message}`)
  }
  try { cf.kill() } catch {}
  if (previewProcess) {
    try { previewProcess.kill() } catch {}
  }
  process.exit(codigo)
}

process.on('SIGINT', () => encerrar(0))
process.on('SIGTERM', () => encerrar(0))

cf.on('exit', () => {
  if (!encerrando) {
    log('❌ O cloudflared parou inesperadamente. Tente rodar `node scripts/tunel.mjs` novamente.')
    encerrar(1)
  }
})

for (let i = 0; i < 120 && !(url && registrado); i++) await esperar(500)
if (!url || !registrado) {
  log('❌ O túnel não registrou em 60 s. Verifique a internet e tente novamente.')
  await encerrar(1)
}
log(`Túnel registrado com sucesso: ${url}`)

let ok = false
for (let i = 0; i < 20 && !ok; i++) {
  ok = await tunelResponde(url).catch(() => false)
  if (!ok) await esperar(3000)
}
if (!ok) {
  log('❌ O túnel não respondeu pela internet.')
  await encerrar(1)
}
log('Túnel respondendo pela internet via DNS público ✓')

log('Atualizando o link fixo no GitHub Pages…')
publicar(url)
const publicado = await aguardarPublicacao(url)
log(publicado ? 'Link fixo atualizado e verificado no GitHub Pages ✓' : '⚠️ Atualização enviada ao GitHub; o cache do CDN pode levar alguns instantes para sincronizar.')

const linhas = [
  '✨ Portfolio Pedro Mariano no ar!',
  '',
  `Link fixo:       ${LINK_FIXO}`,
  `Túnel direto:    ${url}/`,
  `Validade túnel:  ~24 horas contínuas`,
  '',
  'Mantenha este terminal aberto. Pressione Ctrl+C para desligar.',
]
const largura = Math.max(...linhas.map((l) => l.length)) + 2
console.log(['', `  ┌${'─'.repeat(largura + 2)}┐`, ...linhas.map((l) => `  │ ${l.padEnd(largura)} │`), `  └${'─'.repeat(largura + 2)}┘`, ''].join('\n'))
