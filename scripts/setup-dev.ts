#!/usr/bin/env bun
/**
 * 开发环境配置加载器
 * 从 .env.local 加载配置并生成 client/.env 和 .dev.vars
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT_DIR = process.cwd()
const ENV_FILE = path.join(ROOT_DIR, '.env.local')

// 检查 .env.local 是否存在
if (!fs.existsSync(ENV_FILE)) {
  console.error('❌ 错误：找不到 .env.local 文件')
  console.log('\n请执行以下步骤：')
  console.log('  1. cp .env.example .env.local')
  console.log('  2. 编辑 .env.local 填入你的配置')
  console.log('  3. 重新运行 dev 命令\n')
  process.exit(1)
}

// 解析 .env.local
function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // 跳过注释和空行
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

const envContent = fs.readFileSync(ENV_FILE, 'utf-8')
const env = parseEnv(envContent)

// 验证必要的环境变量
const requiredVars = [
  'S3_ENDPOINT',
  'S3_BUCKET',
  'JWT_SECRET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  // OAuth and site metadata are optional for local development
]

const missingVars = requiredVars.filter(v => !env[v])
if (missingVars.length > 0) {
  console.error('❌ 错误：以下必要环境变量未设置：')
  missingVars.forEach(v => {
    console.error(`   - ${v}`)
  })
  console.log('\n请编辑 .env.local 文件并添加这些配置\n')
  process.exit(1)
}

// 生成 client/.env
const clientEnvContent = `NAME=${env.NAME || 'Rin'}
DESCRIPTION=${env.DESCRIPTION || ''}
AVATAR=${env.AVATAR || ''}
PAGE_SIZE=${env.PAGE_SIZE || '5'}
RSS_ENABLE=${env.RSS_ENABLE || 'false'}
`

fs.writeFileSync(path.join(ROOT_DIR, 'client', '.env'), clientEnvContent)
console.log('✅ 已生成 client/.env')

// 生成 .dev.vars（用于 wrangler dev，本地值会覆盖 wrangler.toml 同名 vars）
const devVarsContent = `RIN_GITHUB_CLIENT_ID=${env.RIN_GITHUB_CLIENT_ID}
RIN_GITHUB_CLIENT_SECRET=${env.RIN_GITHUB_CLIENT_SECRET}
JWT_SECRET=${env.JWT_SECRET}
S3_ACCESS_KEY_ID=${env.S3_ACCESS_KEY_ID}
S3_SECRET_ACCESS_KEY=${env.S3_SECRET_ACCESS_KEY}
S3_FOLDER=${env.S3_FOLDER || 'images/'}
S3_CACHE_FOLDER=${env.S3_CACHE_FOLDER || 'cache/'}
S3_REGION=${env.S3_REGION || 'auto'}
S3_ENDPOINT=${env.S3_ENDPOINT}
S3_ACCESS_HOST=${env.S3_ACCESS_HOST || env.S3_ENDPOINT}
S3_BUCKET=${env.S3_BUCKET}
S3_FORCE_PATH_STYLE=${env.S3_FORCE_PATH_STYLE || 'false'}
WEBHOOK_URL=${env.WEBHOOK_URL || ''}
RSS_TITLE=${env.RSS_TITLE || 'Rin Development'}
RSS_DESCRIPTION=${env.RSS_DESCRIPTION || 'Development Environment'}
CACHE_STORAGE_MODE=${env.CACHE_STORAGE_MODE || 'database'}
ADMIN_USERNAME=${env.ADMIN_USERNAME}
ADMIN_PASSWORD=${env.ADMIN_PASSWORD}
NAME=${env.NAME || 'Rin'}
DESCRIPTION=${env.DESCRIPTION || 'A lightweight personal blogging system'}
AVATAR=${env.AVATAR || ''}
PAGE_SIZE=${env.PAGE_SIZE || '5'}
RSS_ENABLE=${env.RSS_ENABLE || 'false'}
`

fs.writeFileSync(path.join(ROOT_DIR, '.dev.vars'), devVarsContent)
console.log('✅ 已生成 .dev.vars')

console.log('\n🎉 配置加载完成！')
console.log('   现在可以运行：bun run dev\n')
