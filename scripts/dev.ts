#!/usr/bin/env bun
/**
 * Unified development server.
 * Starts frontend + backend and runs local database migrations.
 */

import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as path from 'node:path'

const ROOT_DIR = process.cwd()
const WRANGLER_SEND_METRICS = process.env.WRANGLER_SEND_METRICS ?? 'false'
process.env.WRANGLER_SEND_METRICS = WRANGLER_SEND_METRICS

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip comments and empty lines.
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim()
      const value = trimmed.substring(equalIndex + 1).trim()
      env[key] = value
    }
  }

  return env
}

// ANSI color helpers.
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(label: string, message: string, color: string = colors.reset) {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}[${label}]${colors.reset} ${message}`)
}

// Check whether a TCP port is available.
function checkPort(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', (err: unknown) => {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
        resolve(false)
      } else {
        resolve(true)
      }
    })
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port)
  })
}

// Ensure required configuration files are generated.
if (!fs.existsSync(path.join(ROOT_DIR, '.env.local'))) {
  log('Setup', 'First run detected; initializing development configuration...', colors.yellow)

  // Run setup script.
  const setupProcess = spawn('bun', ['scripts/setup-dev.ts'], {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  })

  setupProcess.on('exit', code => {
    if (code !== 0) {
      process.exit(code || 1)
    }
    startDev()
  })
} else {
  // Regenerate config when .env.local is newer than wrangler.toml.
  const envStat = fs.statSync(path.join(ROOT_DIR, '.env.local'))
  const wranglerStat = fs.existsSync(path.join(ROOT_DIR, 'wrangler.toml'))
    ? fs.statSync(path.join(ROOT_DIR, 'wrangler.toml'))
    : { mtime: new Date(0) }

  if (envStat.mtime > wranglerStat.mtime) {
    log('Setup', 'Configuration changes detected; regenerating files...', colors.yellow)
    const setupProcess = spawn('bun', ['scripts/setup-dev.ts'], {
      stdio: 'inherit',
      cwd: ROOT_DIR,
    })

    setupProcess.on('exit', code => {
      if (code !== 0) {
        process.exit(code || 1)
      }
      startDev()
    })
  } else {
    startDev()
  }
}

const ENV_FILE = path.join(ROOT_DIR, '.env.local')
if (!fs.existsSync(ENV_FILE)) {
  log('Error', '.env.local is missing; cannot start the development server', colors.red)
  process.exit(1)
}
const envContent = fs.readFileSync(ENV_FILE, 'utf-8')
const env = parseEnv(envContent)
const FRONTEND_PORT = env.FRONTEND_PORT ? parseInt(env.FRONTEND_PORT, 10) : 5173
const BACKEND_PORT = env.BACKEND_PORT ? parseInt(env.BACKEND_PORT, 10) : 11498

async function startDev() {
  log('Dev', 'Starting development server...', colors.green)

  // Validate required ports are free.
  const frontendAvailable = await checkPort(FRONTEND_PORT)
  const backendAvailable = await checkPort(BACKEND_PORT)

  if (!frontendAvailable) {
    log('Error', `Port ${FRONTEND_PORT} is already in use`, colors.red)
    log('Help', 'Stop the process using this port or change FRONTEND_PORT in .env.local', colors.yellow)
    process.exit(1)
  }

  if (!backendAvailable) {
    log('Error', `Port ${BACKEND_PORT} is already in use`, colors.red)
    log('Help', 'Stop the running wrangler dev process using this port', colors.yellow)
    process.exit(1)
  }

  // Run database migrations before starting servers.
  log('DB', 'Checking database migrations...', colors.cyan)
  const migrateProcess = spawn('bun', ['scripts/db-migrate-local.ts'], {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  })

  migrateProcess.on('exit', code => {
    if (code !== 0) {
      log('DB', 'Database migrations failed', colors.red)
      process.exit(code || 1)
    }

    log('DB', 'Database migrations completed', colors.green)
    startServers()
  })
}

function startServers() {
  log('Dev', 'Starting frontend and backend services...', colors.green)

  let backendReady = false
  let frontendReady = false

  // Start backend.
  const backend = spawn('bun', ['wrangler', 'dev', '--port', String(BACKEND_PORT)], {
    cwd: ROOT_DIR,
    env: { ...process.env, WRANGLER_SEND_METRICS },
  })

  // Start frontend.
  const frontend = spawn('bun', ['--filter', './client', 'dev', '--port', String(FRONTEND_PORT)], {
    cwd: ROOT_DIR,
    env: { ...process.env },
  })

  // Stream subprocess output.
  backend.stdout.on('data', data => {
    const lines = data
      .toString()
      .split('\n')
      .filter((l: string) => l.trim())
    lines.forEach((line: string) => {
      if (line.includes('Ready') || line.includes('http://localhost')) {
        log('Backend', line, colors.blue)
        if (!backendReady && line.includes('Ready')) {
          backendReady = true
          checkAllReady()
        }
      } else if (line.includes('Error') || line.includes('error')) {
        log('Backend', line, colors.red)
      } else {
        log('Backend', line, colors.dim)
      }
    })
  })

  backend.stderr.on('data', data => {
    const lines = data
      .toString()
      .split('\n')
      .filter((l: string) => l.trim())
    lines.forEach((line: string) => {
      log('Backend', line, colors.red)
    })
  })

  frontend.stdout.on('data', data => {
    const lines = data
      .toString()
      .split('\n')
      .filter((l: string) => l.trim())
    lines.forEach((line: string) => {
      if (line.includes('Local') || line.includes('http://localhost')) {
        log('Frontend', line, colors.magenta)
        if (!frontendReady && line.includes('Local:')) {
          frontendReady = true
          checkAllReady()
        }
      } else if (line.includes('Error') || line.includes('error')) {
        log('Frontend', line, colors.red)
      } else {
        log('Frontend', line, colors.dim)
      }
    })
  })

  frontend.stderr.on('data', data => {
    const lines = data
      .toString()
      .split('\n')
      .filter((l: string) => l.trim())
    lines.forEach((line: string) => {
      log('Frontend', line, colors.red)
    })
  })

  // Handle subprocess exits.
  backend.on('exit', code => {
    log('Backend', `Process exited with code: ${code}`, colors.red)
    frontend.kill()
    process.exit(code || 0)
  })

  frontend.on('exit', code => {
    log('Frontend', `Process exited with code: ${code}`, colors.red)
    backend.kill()
    process.exit(code || 0)
  })

  // Graceful shutdown.
  process.on('SIGINT', () => {
    log('Dev', 'Shutting down development server...', colors.yellow)
    backend.kill('SIGINT')
    frontend.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    backend.kill('SIGTERM')
    frontend.kill('SIGTERM')
  })

  // Show ready banner once both services are ready.
  function checkAllReady() {
    if (backendReady && frontendReady) {
      showReadyMessage()
    }
  }

  // Print access information.
  function showReadyMessage() {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`${colors.bright}🚀 Development server is ready!${colors.reset}`)
    console.log('='.repeat(60))
    console.log(`${colors.cyan}📱 Frontend:${colors.reset} http://localhost:${FRONTEND_PORT}`)
    console.log(`${colors.blue}🔌 Backend:${colors.reset} http://localhost:${BACKEND_PORT}`)
    console.log(`${'='.repeat(60)}\n`)
  }

  // Fallback banner if readiness pattern detection misses.
  setTimeout(() => {
    if (!backendReady || !frontendReady) {
      showReadyMessage()
    }
  }, 8000)
}
