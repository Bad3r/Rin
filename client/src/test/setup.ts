import '@testing-library/jest-dom'
import { afterAll, beforeAll, vi } from 'vitest'

type JsdomVirtualConsole = {
  emit: (event: string, ...args: unknown[]) => boolean
}

const originalConsoleError = console.error
const originalConsoleLog = console.log
const originalConsoleInfo = console.info
const originalConsoleWarn = console.warn
let originalVirtualConsoleEmit: JsdomVirtualConsole['emit'] | undefined

beforeAll(() => {
  const virtualConsole = (window as unknown as { _virtualConsole?: JsdomVirtualConsole })._virtualConsole

  if (virtualConsole && typeof virtualConsole.emit === 'function') {
    originalVirtualConsoleEmit = virtualConsole.emit.bind(virtualConsole)
    virtualConsole.emit = (event, ...args) => {
      const firstArg = args[0]
      if (
        event === 'jsdomError' &&
        firstArg instanceof Error &&
        typeof firstArg.message === 'string' &&
        firstArg.message.includes('Could not parse CSS stylesheet')
      ) {
        return false
      }

      return originalVirtualConsoleEmit?.(event, ...args) ?? false
    }
  }

  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const firstArg = args[0]
    if (typeof firstArg === 'string' && firstArg.includes('Could not parse CSS stylesheet')) {
      return
    }
    if (
      firstArg instanceof Error &&
      typeof firstArg.message === 'string' &&
      firstArg.message.includes('Could not parse CSS stylesheet')
    ) {
      return
    }
    originalConsoleError(...args)
  })

  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    const firstArg = args[0]
    if (typeof firstArg === 'string' && firstArg.includes('i18next is maintained with support from Locize')) {
      return
    }

    originalConsoleLog(...args)
  })

  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
    const firstArg = args[0]
    if (typeof firstArg === 'string' && firstArg.includes('i18next is maintained with support from Locize')) {
      return
    }

    originalConsoleInfo(...args)
  })

  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const firstArg = args[0]
    if (typeof firstArg === 'string' && firstArg.includes('i18next is maintained with support from Locize')) {
      return
    }

    originalConsoleWarn(...args)
  })
})

afterAll(() => {
  const virtualConsole = (window as unknown as { _virtualConsole?: JsdomVirtualConsole })._virtualConsole
  if (virtualConsole && originalVirtualConsoleEmit) {
    virtualConsole.emit = originalVirtualConsoleEmit
  }

  console.error = originalConsoleError
  console.log = originalConsoleLog
  console.info = originalConsoleInfo
  console.warn = originalConsoleWarn
})
