import { getAIConfig } from "./db-config";

// AI Provider presets with their default API URLs
const AI_PROVIDER_URLS: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    claude: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    deepseek: "https://api.deepseek.com/v1",
};

// Cloudflare Worker AI models
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

/**
 * Generate AI summary using Cloudflare Worker AI
 */
async function generateWorkerAISummary(
    env: Env,
    model: string,
    content: string
): Promise<string | null> {
    try {
        // Map model alias to full model name if needed
        const fullModelName = WORKER_AI_MODELS[model] || model;
        
        const response = await env.AI.run(fullModelName as any, {
            messages: [
                {
                    role: "system",
                    content: "你是一个专业的文章总结助手。请用简洁的中文总结文章的主要内容，不超过200字。只输出总结内容，不要有任何前缀或解释。"
                },
                {
                    role: "user",
                    content: content
                }
            ],
            max_tokens: 500,
            temperature: 0.3,
        });

        // Worker AI returns { response: string }
        const responseObj = response as any;
        if (responseObj && typeof responseObj === 'object' && 'response' in responseObj) {
            const text = responseObj.response;
            return typeof text === 'string' ? text.trim() : null;
        }
        
        // Handle text generation output format
        if (typeof responseObj === 'string') {
            return responseObj.trim();
        }

        console.error("[AI Summary] Unexpected Worker AI response format:", response);
        return null;
    } catch (error) {
        console.error("[AI Summary] Worker AI error:", error);
        return null;
    }
}

/**
 * Generate AI summary using external API (OpenAI-compatible)
 */
async function generateExternalAPISummary(
    config: {
        provider: string;
        model: string;
        api_key: string;
        api_url: string;
    },
    content: string
): Promise<string | null> {
    const { provider, model, api_key, api_url } = config;

    if (!api_key) {
        console.error("[AI Summary] API key not configured");
        return null;
    }

    // Use preset URL if not custom configured
    let finalApiUrl = api_url;
    if (!finalApiUrl && AI_PROVIDER_URLS[provider]) {
        finalApiUrl = AI_PROVIDER_URLS[provider];
    }

    if (!finalApiUrl) {
        console.error("[AI Summary] API URL not configured");
        return null;
    }

    try {
        const response = await fetch(`${finalApiUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_key}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "system",
                        content: "你是一个专业的文章总结助手。请用简洁的中文总结文章的主要内容，不超过200字。只输出总结内容，不要有任何前缀或解释。"
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                max_tokens: 500,
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Summary] API error: ${response.status} - ${errorText}`);
            return null;
        }

        const data = await response.json() as {
            choices?: Array<{
                message?: {
                    content?: string;
                };
            }>;
        };

        const summary = data.choices?.[0]?.message?.content?.trim();
        if (!summary) {
            console.error("[AI Summary] Empty response from API");
            return null;
        }

        return summary;
    } catch (error) {
        console.error("[AI Summary] External API error:", error);
        return null;
    }
}

/**
 * Generate AI summary for article content
 * Supports both Cloudflare Worker AI and external APIs
 * Configuration is read from D1 database
 */
export async function generateAISummary(
    env: Env, 
    db: any, 
    content: string
): Promise<string | null> {
    // Get AI configuration from database
    const config = await getAIConfig(db);

    // Check if AI summary is enabled
    if (!config.enabled) {
        return null;
    }

    const { provider, model } = config;

    // Truncate content if too long (to save tokens)
    const maxContentLength = 8000;
    const truncatedContent = content.length > maxContentLength
        ? content.slice(0, maxContentLength) + "..."
        : content;

    // Use Worker AI if provider is 'worker-ai'
    if (provider === 'worker-ai') {
        return generateWorkerAISummary(env, model, truncatedContent);
    }

    // Otherwise use external API
    return generateExternalAPISummary(config, truncatedContent);
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(provider: string): string[] {
    if (provider === 'worker-ai') {
        return Object.keys(WORKER_AI_MODELS);
    }
    
    // Return empty array for external providers (user can input any model)
    return [];
}

/**
 * Check if a provider requires API key
 */
export function requiresApiKey(provider: string): boolean {
    return provider !== 'worker-ai';
}
