// Sobe o túnel da Cloudflare e aponta o link fixo (GitHub Pages) para ele.
//   node scripts/tunel.mjs      → sobe servidor se necessário, publica o destino e mantém rodando com auto-reconexão
//   Ctrl+C                      → derruba o túnel e marca o link como "desligado"
import { execFileSync, spawn } from 'node:child_process'
import { Resolver } from 'node:dns/promises'
import https from 'node:https'
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
let caffeinateProcess = null
let cfProcess = null
let currentTunnelUrl = null
let encerrando = false

// ---------- 0. Prevenir suspensão de sistema enquanto o túnel rodar (macOS) ----------
if (process.platform === 'darwin') {
  try {
    // -i: prevent idle system sleep; -m: prevent disk sleep; -s: prevent system sleep on AC
    caffeinateProcess = spawn('caffeinate', ['-dims'], { stdio: 'ignore' })
    caffeinateProcess.unref()
    log('Modo anti-suspensão ativo (caffeinate -dims) ✓')
  } catch {}
}

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
      if (previewProcess && String(previewProcess.pid) === pid) continue
      try { process.kill(Number(pid), 'SIGKILL') } catch {}
    }
  } catch {}
}

async function garantirPreview() {
  if (await checarPreviewLocal()) return true
  liberarPorta(PORTA)
  log(`Iniciando servidor local (preview.py) na porta ${PORTA}…`)
  previewProcess = spawn('python3', [resolve(ROOT, 'scripts/preview.py'), '--port', String(PORTA)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  previewProcess.stderr.on('data', (d) => {
    if (!encerrando) process.stderr.write(d)
  })

  previewProcess.on('exit', (code) => {
    if (!encerrando && code !== 0) {
      log(`⚠️ Servidor de preview encerrou com código ${code}`)
    }
  })

  for (let i = 0; i < 30; i++) {
    await esperar(200)
    if (await checarPreviewLocal()) {
      log(`Preview server rodando em http://127.0.0.1:${PORTA}/ ✓`)
      return true
    }
  }
  log(`❌ Não foi possível iniciar o preview server na porta ${PORTA}.`)
  return false
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
  try {
    publicarArquivo('destino.json', BRANCH, url)
  } catch (err) {
    log(`Aviso ao publicar em ${BRANCH}/destino.json: ${err.message}`)
    try {
      publicarArquivo('pages/destino.json', 'main', url)
    } catch (e) {
      log(`Erro de fallback no GitHub: ${e.message}`)
    }
  }
}

async function aguardarPublicacao(url) {
  for (let i = 0; i < 40; i++) {
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

// ---------- 3. Checar túnel pela internet via DNS público ----------
const dnsPublico = new Resolver()
dnsPublico.setServers(['1.1.1.1', '8.8.8.8'])

async function tunelResponde(url) {
  if (!url) return false
  try {
    const host = new URL(url).hostname
    const ips = await dnsPublico.resolve4(host).catch(() => [])
    if (!ips || ips.length === 0) return false
    const ip = ips[0]
    return new Promise((resolve) => {
      const req = https.get(
        { host: ip, servername: host, path: '/api/health', headers: { host }, timeout: 6000 },
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

// ---------- 4. Lifecycle do Cloudflare Tunnel com Auto-Reconexão ----------
async function iniciarCloudflared() {
  if (cfProcess) {
    try { cfProcess.kill('SIGKILL') } catch {}
    cfProcess = null
  }

  log('Iniciando túnel da Cloudflare (cloudflared)…')
  const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORTA}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  cfProcess = cf

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

  cf.on('exit', () => {
    if (!encerrando) {
      log('⚠️ Conexão do cloudflared encerrou. O monitor de reconexão irá restabelecer…')
    }
  })

  for (let i = 0; i < 120 && !(url && registrado); i++) {
    if (encerrando) return null
    await esperar(500)
  }

  if (!url || !registrado) {
    log('⚠️ O túnel não registrou em 60 s.')
    try { cf.kill() } catch {}
    return null
  }

  log(`Túnel registrado com sucesso: ${url}`)

  let ok = false
  for (let i = 0; i < 20 && !ok; i++) {
    if (encerrando) return null
    ok = await tunelResponde(url).catch(() => false)
    if (!ok) await esperar(3000)
  }

  if (!ok) {
    log('⚠️ Túnel registrou mas não respondeu externamente via DNS.')
    try { cf.kill() } catch {}
    return null
  }

  log('Túnel respondendo pela internet via DNS público ✓')
  return url
}

function exibirBanner(url) {
  const linhas = [
    '✨ Portfolio Pedro Mariano no ar!',
    '',
    `Link fixo:          ${LINK_FIXO}`,
    `Túnel Cloudflare:   ${url}/`,
    `Monitor ativo:      Auto-reconexão e anti-suspensão ligados`,
    '',
    'Mantenha este terminal aberto. Pressione Ctrl+C para desligar.',
  ]
  const largura = Math.max(...linhas.map((l) => l.length)) + 2
  console.log(['', `  ┌${'─'.repeat(largura + 2)}┐`, ...linhas.map((l) => `  │ ${l.padEnd(largura)} │`), `  └${'─'.repeat(largura + 2)}┘`, ''].join('\n'))
}

async function encerrar(codigo = 0) {
  if (encerrando) return
  encerrando = true
  log('Encerrando túnel… atualizando link fixo para estado desligado.')
  try {
    publicar(null)
  } catch (e) {
    log(`⚠️ Não consegui atualizar o link fixo: ${e.message}`)
  }
  if (cfProcess) {
    try { cfProcess.kill('SIGKILL') } catch {}
  }
  if (previewProcess) {
    try { previewProcess.kill('SIGKILL') } catch {}
  }
  if (caffeinateProcess) {
    try { caffeinateProcess.kill('SIGKILL') } catch {}
  }
  process.exit(codigo)
}

process.on('SIGINT', () => encerrar(0))
process.on('SIGTERM', () => encerrar(0))

// ---------- 5. Loop Principal e Monitor de Saúde ----------
async function principal() {
  const previewOk = await garantirPreview()
  if (!previewOk) {
    console.error(`\n❌ Não foi possível preparar o servidor preview local.\n`)
    process.exit(1)
  }

  while (!encerrando) {
    await garantirPreview()
    const novaUrl = await iniciarCloudflared()

    if (!novaUrl) {
      log('Tentando reconectar em 10 segundos…')
      await esperar(10000)
      continue
    }

    currentTunnelUrl = novaUrl
    log('Atualizando o link fixo no GitHub Pages…')
    publicar(currentTunnelUrl)
    const publicado = await aguardarPublicacao(currentTunnelUrl)
    log(publicado ? 'Link fixo atualizado e verificado no GitHub Pages ✓' : '⚠️ Atualização enviada ao GitHub; o cache do CDN pode levar alguns instantes para sincronizar.')

    exibirBanner(currentTunnelUrl)

    // Monitor contínuo a cada 30 segundos
    let falhasConsecutivas = 0
    while (!encerrando) {
      await esperar(30000)
      if (encerrando) break

      const previewVivo = await checarPreviewLocal()
      if (!previewVivo) {
        log('⚠️ Servidor local caiu. Reiniciando…')
        await garantirPreview()
      }

      const responde = await tunelResponde(currentTunnelUrl)
      if (responde) {
        falhasConsecutivas = 0
      } else {
        falhasConsecutivas++
        log(`⚠️ Verificação de saúde falhou (${falhasConsecutivas}/2). Testando novamente em 5s…`)
        await esperar(5000)
        const recheck = await tunelResponde(currentTunnelUrl)
        if (recheck) {
          falhasConsecutivas = 0
          continue
        }
        if (falhasConsecutivas >= 2) {
          log('🚨 Túnel Cloudflare desconectado (queda de conexão ou suspensão detectada). Reiniciando túnel e atualizando link fixo…')
          break
        }
      }
    }
  }
}

principal().catch((err) => {
  console.error('Erro fatal no túnel:', err)
  encerrar(1)
})
