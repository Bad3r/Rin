import { useContext } from 'react'
import { ClientConfigContext } from '../state/config'

export const SITE_CONFIG_KEYS = {
  name: 'site.name',
  description: 'site.description',
  avatar: 'site.avatar',
  pageSize: 'site.page_size',
  headerBehavior: 'header.behavior',
  headerLayout: 'header.layout',
  themeColor: 'theme.color',
} as const

function parsePageSize(value: number | string | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 5
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 5
  }

  return 5
}

function getStringDefault(key: Exclude<keyof typeof SITE_CONFIG_KEYS, 'pageSize'>) {
  switch (key) {
    case 'name':
      return 'Rin'
    case 'description':
    case 'avatar':
      return ''
    case 'headerBehavior':
      return 'fixed'
    case 'headerLayout':
      return 'classic'
    case 'themeColor':
      return '#fc466b'
  }
}

export function useSiteConfig() {
  const config = useContext(ClientConfigContext)

  return {
    name: config.get<string>(SITE_CONFIG_KEYS.name) || 'Rin',
    description: config.get<string>(SITE_CONFIG_KEYS.description) || '',
    avatar: config.get<string>(SITE_CONFIG_KEYS.avatar) || '',
    pageSize: parsePageSize(config.get<number | string>(SITE_CONFIG_KEYS.pageSize)),
    headerBehavior: config.get<string>(SITE_CONFIG_KEYS.headerBehavior) || 'fixed',
    headerLayout: config.get<string>(SITE_CONFIG_KEYS.headerLayout) || 'classic',
    themeColor: config.get<string>(SITE_CONFIG_KEYS.themeColor) || '#fc466b',
  }
}

export function useSiteConfigValue(key: 'pageSize'): number
export function useSiteConfigValue(key: Exclude<keyof typeof SITE_CONFIG_KEYS, 'pageSize'>): string
export function useSiteConfigValue(key: keyof typeof SITE_CONFIG_KEYS): number | string {
  const config = useContext(ClientConfigContext)
  const configKey = SITE_CONFIG_KEYS[key]

  if (key === 'pageSize') {
    return parsePageSize(config.get<number | string>(configKey))
  }

  return config.get<string>(configKey) || getStringDefault(key)
}
