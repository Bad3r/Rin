#!/usr/bin/env bun
import * as fs from 'node:fs'
import * as path from 'node:path'

type CoverageMetric = {
  pct: number
}

type FileCoverage = {
  statements?: CoverageMetric
  branches?: CoverageMetric
}

type CoverageSummary = Record<string, FileCoverage>

type Threshold = {
  file: string
  statements: number
  branches: number
}

const THRESHOLDS: Threshold[] = [
  { file: 'server/src/core/base.ts', statements: 80, branches: 78 },
  { file: 'server/src/core/router-factory.ts', statements: 80, branches: 78 },
  { file: 'server/src/core/router-hono.ts', statements: 80, branches: 78 },
]

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/')
}

function resolveSummaryPath(): string {
  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, 'coverage/coverage-summary.json'),
    path.resolve(cwd, 'server/coverage/coverage-summary.json'),
    path.resolve(cwd, '../server/coverage/coverage-summary.json'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Coverage summary not found. Tried: ${candidates.map(candidate => normalizePath(candidate)).join(', ')}`
  )
}

function resolveCoverageRoots(summaryPath: string): { workspaceRoot: string; serverRoot: string } {
  const coverageDir = path.dirname(summaryPath)
  const serverRoot = path.dirname(coverageDir)
  const workspaceRoot = path.dirname(serverRoot)
  return { workspaceRoot, serverRoot }
}

function canonicalizeCoverageKeyPath(
  key: string,
  roots: { workspaceRoot: string; serverRoot: string }
): string | undefined {
  const normalized = normalizePath(key).replace(/^\.\/+/, '')
  if (normalized === 'total') {
    return undefined
  }

  if (path.isAbsolute(normalized)) {
    return normalizePath(path.resolve(normalized))
  }

  if (normalized.startsWith('src/')) {
    return normalizePath(path.resolve(roots.serverRoot, normalized))
  }

  return normalizePath(path.resolve(roots.workspaceRoot, normalized))
}

function getCoverageEntry(
  summary: CoverageSummary,
  relativeFile: string,
  roots: { workspaceRoot: string; serverRoot: string }
): FileCoverage | undefined {
  const target = normalizePath(path.resolve(roots.workspaceRoot, relativeFile))
  for (const [key, value] of Object.entries(summary)) {
    const candidate = canonicalizeCoverageKeyPath(key, roots)
    if (candidate === target) {
      return value
    }
  }
  return undefined
}

function readMetric(value: FileCoverage | undefined, metric: 'statements' | 'branches'): number | undefined {
  return value?.[metric]?.pct
}

function main(): void {
  const summaryPath = resolveSummaryPath()
  const roots = resolveCoverageRoots(summaryPath)
  const raw = fs.readFileSync(summaryPath, 'utf-8')
  const summary = JSON.parse(raw) as CoverageSummary

  const failures: string[] = []

  console.log(`[coverage] checking router/core thresholds from ${normalizePath(summaryPath)}`)

  for (const rule of THRESHOLDS) {
    const entry = getCoverageEntry(summary, rule.file, roots)
    if (!entry) {
      failures.push(`${rule.file}: missing from coverage summary`)
      continue
    }

    const statementsPct = readMetric(entry, 'statements')
    const branchesPct = readMetric(entry, 'branches')

    if (statementsPct === undefined) {
      failures.push(`${rule.file}: missing statements metric`)
    } else if (statementsPct < rule.statements) {
      failures.push(`${rule.file}: statements ${statementsPct.toFixed(2)}% < ${rule.statements}%`)
    }

    if (branchesPct === undefined) {
      failures.push(`${rule.file}: missing branches metric`)
    } else if (branchesPct < rule.branches) {
      failures.push(`${rule.file}: branches ${branchesPct.toFixed(2)}% < ${rule.branches}%`)
    }

    if (statementsPct !== undefined && branchesPct !== undefined) {
      console.log(
        `[coverage] ${rule.file}: statements ${statementsPct.toFixed(2)}% (min ${rule.statements}%), branches ${branchesPct.toFixed(2)}% (min ${rule.branches}%)`
      )
    }
  }

  if (failures.length > 0) {
    console.error('[coverage] threshold check failed:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('[coverage] router/core thresholds satisfied.')
}

main()
