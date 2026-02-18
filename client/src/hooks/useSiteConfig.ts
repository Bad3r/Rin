import { useContext } from 'react'
import { ClientConfigContext } from '../state/config'

// Site configuration keys
export const SITE_CONFIG_KEYS = {
  name: 'site.name',
  description: 'site.description',
  avatar: 'site.avatar',
  pageSize: 'site.page_size',
} as const

// Hook to get site configuration
export function useSiteConfig() {
  const config = useContext(ClientConfigContext)

  return {
    name: config.get<string>(SITE_CONFIG_KEYS.name) || 'Rin',
    description: config.get<string>(SITE_CONFIG_KEYS.description) || '',
    avatar: config.get<string>(SITE_CONFIG_KEYS.avatar) || '',
    pageSize: config.get<number>(SITE_CONFIG_KEYS.pageSize) || 5,
  }
}

// Hook to get a specific site config value
export function useSiteConfigValue(key: 'pageSize'): number
export function useSiteConfigValue(key: Exclude<keyof typeof SITE_CONFIG_KEYS, 'pageSize'>): string
export function useSiteConfigValue(key: keyof typeof SITE_CONFIG_KEYS): number | string {
  const config = useContext(ClientConfigContext)
  const configKey = SITE_CONFIG_KEYS[key]

  if (key === 'pageSize') {
    return config.get<number>(configKey) || 5
  }

  return config.get<string>(configKey) || ''
}
