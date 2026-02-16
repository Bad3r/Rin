import { Router } from "../core/router";
import type { Context } from "../core/types";
import { getAIConfigForFrontend, setAIConfig, getAIConfig } from "../utils/db-config";
import { generateAISummary } from "../utils/ai";

// Sensitive fields that should not be exposed to frontend
const SENSITIVE_FIELDS = ['ai_summary.api_key'];

// Cloudflare Worker AI models mapping (short name -> full model ID)
const WORKER_AI_MODELS: Record<string, string> = {
    "llama-3-8b": "@cf/meta/llama-3-8b-instruct",
    "llama-3-1-8b": "@cf/meta/llama-3.1-8b-instruct",
    "llama-2-7b": "@cf/meta/llama-2-7b-chat-int8",
    "mistral-7b": "@cf/mistral/mistral-7b-instruct-v0.1",
    "mistral-7b-v2": "@cf/mistral/mistral-7b-instruct-v0.2-lora",
    "gemma-2b": "@cf/google/gemma-2b-it-lora",
    "gemma-7b": "@cf/google/gemma-7b-it-lora",
    "deepseek-coder": "@cf/deepseek-ai/deepseek-coder-6.7b-base-awq",
    "qwen-7b": "@cf/qwen/qwen1.5-7b-chat-awq",
};

// AI config keys mapping (flat key -> nested structure)
const AI_CONFIG_KEYS = ['ai_summary.enabled', 'ai_summary.provider', 'ai_summary.model', 'ai_summary.api_key', 'ai_summary.api_url'];

// Client config keys that should use environment variables as defaults
const CLIENT_CONFIG_ENV_DEFAULTS: Record<string, string> = {
    'site.name': 'NAME',
    'site.description': 'DESCRIPTION',
    'site.avatar': 'AVATAR',
    'site.page_size': 'PAGE_SIZE',
};

function maskSensitiveFields(config: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key in config) {
        const value = config[key];
        if (SENSITIVE_FIELDS.includes(key) && value) {
            result[key] = '••••••••';
        } else {
            result[key] = value;
        }
    }
    return result;
}

// Check if key is an AI config key
function isAIConfigKey(key: string): boolean {
    return AI_CONFIG_KEYS.includes(key) || key.startsWith('ai_summary.');
}

// Extract AI config from flat config object
function extractAIConfig(config: Record<string, any>): Record<string, any> {
    const aiConfig: Record<string, any> = {};
    for (const key of AI_CONFIG_KEYS) {
        if (config[key] !== undefined) {
            // Convert flat key to nested structure (e.g., ai_summary.enabled -> enabled)
            const nestedKey = key.replace('ai_summary.', '');
            aiConfig[nestedKey] = config[key];
        }
    }
    return aiConfig;
}

// Get client config with environment variable defaults
async function getClientConfigWithDefaults(
    clientConfig: any,
    env: Env
): Promise<Record<string, any>> {
    const all = await clientConfig.all();
    const result: Record<string, any> = Object.fromEntries(all);

    // Apply environment variable defaults for unset configs
    for (const [configKey, envKey] of Object.entries(CLIENT_CONFIG_ENV_DEFAULTS)) {
        if (result[configKey] === undefined || result[configKey] === '') {
            const envValue = env[envKey as keyof Env];
            if (envValue) {
                result[configKey] = envValue;
            }
        }
    }

    // Set default page_size if not set
    if (result['site.page_size'] === undefined || result['site.page_size'] === '') {
        result['site.page_size'] = 5;
    }

    return result;
}

export function ConfigService(router: Router): void {
    router.group('/config', (group) => {
        // GET /config/:type
        group.get('/:type', async (ctx: Context) => {
            const { set, admin, params, store: { db, serverConfig, clientConfig } } = ctx;
            const { type } = params;
            
            if (type !== 'server' && type !== 'client') {
                set.status = 400;
                return 'Invalid type';
            }
            
            if (type === 'server' && !admin) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            // Server config: includes regular server config + AI config
            if (type === 'server') {
                const all = await serverConfig.all();
                const configObj = Object.fromEntries(all);
                
                // Get AI config and merge into server config with flattened keys
                const aiConfig = await getAIConfigForFrontend(db);
                configObj['ai_summary.enabled'] = String(aiConfig.enabled);
                configObj['ai_summary.provider'] = aiConfig.provider;
                configObj['ai_summary.model'] = aiConfig.model;
                configObj['ai_summary.api_url'] = aiConfig.api_url;
                configObj['ai_summary.api_key'] = aiConfig.api_key_set ? '••••••••' : '';
                
                return maskSensitiveFields(configObj);
            }
            
            // Client config: apply environment variable defaults and include AI summary status
            const clientConfigData = await getClientConfigWithDefaults(clientConfig, ctx.env);
            const aiConfig = await getAIConfigForFrontend(db);
            return {
                ...clientConfigData,
                'ai_summary.enabled': aiConfig.enabled ?? false
            };
        });

        // POST /config/:type
        group.post('/:type', async (ctx: Context) => {
            const { set, admin, body, params, store: { db, serverConfig, clientConfig } } = ctx;
            const { type } = params;
            
            if (type !== 'server' && type !== 'client') {
                set.status = 400;
                return 'Invalid type';
            }
            
            if (!admin) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            // Separate AI config from regular config
            const regularConfig: Record<string, any> = {};
            const aiConfigUpdates: Record<string, any> = {};
            
            for (const key in body) {
                if (isAIConfigKey(key)) {
                    // Convert flat key to nested key for AI config
                    const nestedKey = key.replace('ai_summary.', '');
                    aiConfigUpdates[nestedKey] = body[key];
                } else {
                    regularConfig[key] = body[key];
                }
            }
            
            // Save regular config
            const config = type === 'server' ? serverConfig : clientConfig;
            for (const key in regularConfig) {
                await config.set(key, regularConfig[key], false);
            }
            await config.save();
            
            // Save AI config if there are any AI config updates
            if (Object.keys(aiConfigUpdates).length > 0) {
                await setAIConfig(db, aiConfigUpdates);
            }
            
            return 'OK';
        }, {
            type: 'object',
            additionalProperties: true
        });

        // DELETE /config/cache
        group.delete('/cache', async (ctx: Context) => {
            const { set, admin, store: { cache } } = ctx;
            
            if (!admin) {
                set.status = 401;
                return 'Unauthorized';
            }
            
            await cache.clear();
            return 'OK';
        });

        // POST /config/test-ai - Test AI model configuration
        group.post('/test-ai', async (ctx: Context) => {
            const { set, admin, body, store: { db, env } } = ctx;
            
            if (!admin) {
                set.status = 401;
                return { error: 'Unauthorized' };
            }

            // Get current AI config from database
            const config = await getAIConfig(db);
            
            // Override with test parameters if provided
            const testConfig = {
                ...config,
                enabled: true, // Force enable for testing
                provider: body.provider || config.provider,
                model: body.model || config.model,
                api_url: body.api_url !== undefined ? body.api_url : config.api_url,
                api_key: body.api_key !== undefined ? body.api_key : config.api_key,
            };

            // Test prompt
            const testPrompt = body.testPrompt || "Hello! This is a test message. Please respond with a simple greeting.";

            try {
                // Temporarily override config for testing
                let result: string | null = null;
                
                if (testConfig.provider === 'worker-ai') {
                    // Use Worker AI directly
                    // Map short model name to full model ID if needed
                    const fullModelName = WORKER_AI_MODELS[testConfig.model] || testConfig.model;
                    console.log(`[Test AI] Using Worker AI model: ${fullModelName} (from ${testConfig.model})`);
                    const response = await env.AI.run(fullModelName as any, {
                        messages: [
                            { role: "user", content: testPrompt }
                        ],
                        max_tokens: 100,
                    });
                    
                    const responseObj = response as any;
                    if (responseObj && typeof responseObj === 'object' && 'response' in responseObj) {
                        result = responseObj.response;
                    } else if (typeof responseObj === 'string') {
                        result = responseObj;
                    }
                } else {
                    // Use external API
                    const response = await fetch(`${testConfig.api_url}/chat/completions`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${testConfig.api_key}`,
                        },
                        body: JSON.stringify({
                            model: testConfig.model,
                            messages: [{ role: "user", content: testPrompt }],
                            max_tokens: 100,
                        }),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        return { 
                            success: false, 
                            error: `API error: ${response.status}`, 
                            details: errorText 
                        };
                    }

                    const data = await response.json() as any;
                    result = data.choices?.[0]?.message?.content;
                }

                if (result) {
                    return { 
                        success: true, 
                        response: result,
                        provider: testConfig.provider,
                        model: testConfig.model
                    };
                } else {
                    return { 
                        success: false, 
                        error: 'Empty response from AI' 
                    };
                }
            } catch (error: any) {
                let errorMessage = error.message || 'Unknown error';
                let errorDetails = '';
                
                console.error('[Test AI] Error caught:', error);
                
                // Provide more detailed error messages for common issues
                if (errorMessage.includes('fetch failed') || errorMessage.includes('NetworkError')) {
                    errorMessage = 'Network error: Unable to connect to AI service';
                    errorDetails = 'Please check your API URL and network connection. If using a custom API, ensure the URL is correct and accessible.';
                } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                    errorMessage = 'Authentication failed: Invalid API key';
                    errorDetails = 'Please check your API key. Make sure it is correct and has not expired.';
                } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
                    errorMessage = 'Rate limit exceeded';
                    errorDetails = 'You have made too many requests. Please wait a moment and try again.';
                } else if (errorMessage.includes('404')) {
                    errorMessage = 'Model not found';
                    errorDetails = `The model "${testConfig.model}" was not found. Please verify the model name is correct for provider "${testConfig.provider}".`;
                } else if (errorMessage.includes('500') || errorMessage.includes('503')) {
                    errorMessage = 'AI service temporarily unavailable';
                    errorDetails = 'The AI service is experiencing issues. Please try again later.';
                } else if (errorMessage.includes('Invalid') || errorMessage.includes('type')) {
                    errorMessage = `AI model error: ${errorMessage}`;
                    errorDetails = `The AI service returned an error. Please check that the model "${testConfig.model}" is correct and supported by your provider.`;
                }
                
                return { 
                    success: false, 
                    error: errorMessage,
                    details: errorDetails || undefined
                };
            }
        }, {
            type: 'object',
            properties: {
                provider: { type: 'string' },
                model: { type: 'string' },
                api_url: { type: 'string' },
                api_key: { type: 'string' },
                testPrompt: { type: 'string' }
            }
        });
    });
}
