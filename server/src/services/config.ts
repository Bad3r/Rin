import type { Router } from '../core/router'
import type { Context } from '../core/types'
import { testAIModel } from '../utils/ai'
import { getAIConfig, getAIConfigForFrontend, setAIConfig, type AIConfig } from '../utils/db-config'

// Sensitive fields that should not be exposed to frontend
const SENSITIVE_FIELDS = ['ai_summary.api_key']

// AI config keys mapping (flat key -> nested structure)
const AI_CONFIG_KEYS = [
  'ai_summary.enabled',
  'ai_summary.provider',
  'ai_summary.model',
  'ai_summary.api_key',
  'ai_summary.api_url',
]

// Client config keys that should use environment variables as defaults
const CLIENT_CONFIG_ENV_DEFAULTS: Record<string, string> = {
  'site.name': 'NAME',
  'site.description': 'DESCRIPTION',
  'site.avatar': 'AVATAR',
  'site.page_size': 'PAGE_SIZE',
}

interface ConfigStoreLike {
  all(): Promise<Map<string, unknown>>
  set(key: string, value: unknown, save?: boolean): Promise<void>
  save(): Promise<void>
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return undefined
}

function maskSensitiveFields(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key in config) {
    const value = config[key]
    if (SENSITIVE_FIELDS.includes(key) && value) {
      result[key] = '••••••••'
    } else {
      result[key] = value
    }
  }
  return result
}

// Check if key is an AI config key
function isAIConfigKey(key: string): boolean {
  return AI_CONFIG_KEYS.includes(key) || key.startsWith('ai_summary.')
}

// Get client config with environment variable defaults
async function getClientConfigWithDefaults(clientConfig: ConfigStoreLike, env: Env): Promise<Record<string, unknown>> {
  const all = await clientConfig.all()
  const result: Record<string, unknown> = Object.fromEntries(all)

  // Apply environment variable defaults for unset configs
  for (const [configKey, envKey] of Object.entries(CLIENT_CONFIG_ENV_DEFAULTS)) {
    if (result[configKey] === undefined || result[configKey] === '') {
      const envValue = env[envKey as keyof Env]
      if (envValue) {
        result[configKey] = envValue
      }
    }
  }

  // Set default page_size if not set
  if (result['site.page_size'] === undefined || result['site.page_size'] === '') {
    result['site.page_size'] = 5
  }

  return result
}

export function ConfigService(router: Router): void {
  router.group('/config', group => {
    // POST /config/test-ai - Test AI model configuration
    // NOTE: Must be defined BEFORE /:type route to avoid being captured as a type parameter
    group.post(
      '/test-ai',
      async (ctx: Context) => {
        const {
          set,
          admin,
          body,
          store: { db, env },
        } = ctx
        const requestBody = body as Record<string, unknown>

        if (!admin) {
          set.status = 401
          return { error: 'Unauthorized' }
        }

        // Get current AI config from database
        const config = await getAIConfig(db)

        // Build test config with overrides
        const testConfig = {
          provider: asString(requestBody.provider) || config.provider,
          model: asString(requestBody.model) || config.model,
          api_url: requestBody.api_url !== undefined ? asString(requestBody.api_url) || '' : config.api_url,
          api_key: requestBody.api_key !== undefined ? asString(requestBody.api_key) || '' : config.api_key,
        }

        // Test prompt
        const testPrompt =
          asString(requestBody.testPrompt) || 'Hello! This is a test message. Please respond with a simple greeting.'

        // Use unified test function
        return await testAIModel(env, testConfig, testPrompt)
      },
      {
        type: 'object',
        properties: {
          provider: { type: 'string', optional: true },
          model: { type: 'string', optional: true },
          api_url: { type: 'string', optional: true },
          api_key: { type: 'string', optional: true },
          testPrompt: { type: 'string', optional: true },
        },
      }
    )

    // GET /config/:type
    group.get('/:type', async (ctx: Context) => {
      const {
        set,
        admin,
        params,
        store: { db, serverConfig, clientConfig },
      } = ctx
      const { type } = params

      if (type !== 'server' && type !== 'client') {
        set.status = 400
        return 'Invalid type'
      }

      if (type === 'server' && !admin) {
        set.status = 401
        return 'Unauthorized'
      }

      // Server config: includes regular server config + AI config
      if (type === 'server') {
        const all = await serverConfig.all()
        const configObj = Object.fromEntries(all)

        // Get AI config and merge into server config with flattened keys
        const aiConfig = await getAIConfigForFrontend(db)
        configObj['ai_summary.enabled'] = String(aiConfig.enabled)
        configObj['ai_summary.provider'] = aiConfig.provider
        configObj['ai_summary.model'] = aiConfig.model
        configObj['ai_summary.api_url'] = aiConfig.api_url
        configObj['ai_summary.api_key'] = aiConfig.api_key_set ? '••••••••' : ''

        return maskSensitiveFields(configObj)
      }

      // Client config: apply environment variable defaults and include AI summary status
      const clientConfigData = await getClientConfigWithDefaults(clientConfig, ctx.env)
      const aiConfig = await getAIConfigForFrontend(db)
      return {
        ...clientConfigData,
        'ai_summary.enabled': aiConfig.enabled ?? false,
      }
    })

    // POST /config/:type
    group.post(
      '/:type',
      async (ctx: Context) => {
        const {
          set,
          admin,
          body,
          params,
          store: { db, serverConfig, clientConfig },
        } = ctx
        const requestBody = body as Record<string, unknown>
        const { type } = params

        if (type !== 'server' && type !== 'client') {
          set.status = 400
          return 'Invalid type'
        }

        if (!admin) {
          set.status = 401
          return 'Unauthorized'
        }

        // Separate AI config from regular config
        const regularConfig: Record<string, unknown> = {}
        const aiConfigUpdates: Partial<AIConfig> = {}

        for (const key in requestBody) {
          const value = requestBody[key]
          if (isAIConfigKey(key)) {
            // Convert flat key to nested key for AI config
            const nestedKey = key.replace('ai_summary.', '')
            if (nestedKey === 'enabled') {
              const enabled = asBoolean(value)
              if (enabled !== undefined) {
                aiConfigUpdates.enabled = enabled
              }
            } else if (nestedKey === 'provider') {
              const provider = asString(value)
              if (provider !== undefined) {
                aiConfigUpdates.provider = provider
              }
            } else if (nestedKey === 'model') {
              const model = asString(value)
              if (model !== undefined) {
                aiConfigUpdates.model = model
              }
            } else if (nestedKey === 'api_key') {
              const apiKey = asString(value)
              if (apiKey !== undefined) {
                aiConfigUpdates.api_key = apiKey
              }
            } else if (nestedKey === 'api_url') {
              const apiUrl = asString(value)
              if (apiUrl !== undefined) {
                aiConfigUpdates.api_url = apiUrl
              }
            }
          } else {
            regularConfig[key] = value
          }
        }

        // Save regular config
        const config: ConfigStoreLike =
          type === 'server' ? (serverConfig as ConfigStoreLike) : (clientConfig as ConfigStoreLike)
        for (const key in regularConfig) {
          await config.set(key, regularConfig[key], false)
        }
        await config.save()

        // Save AI config if there are any AI config updates
        if (Object.keys(aiConfigUpdates).length > 0) {
          await setAIConfig(db, aiConfigUpdates)
        }

        return 'OK'
      },
      {
        type: 'object',
        additionalProperties: true,
      }
    )

    // DELETE /config/cache
    group.delete('/cache', async (ctx: Context) => {
      const {
        set,
        admin,
        store: { cache },
      } = ctx

      if (!admin) {
        set.status = 401
        return 'Unauthorized'
      }

      await cache.clear()
      return 'OK'
    })
  })
}
