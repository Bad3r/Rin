import { asDate, type IsoDateTimeString } from '@rin/api'
import { format } from '@astroimg/timeago'
import i18n from 'i18next'

export function timeago(time: IsoDateTimeString | number | Date) {
  const locale = i18n.language !== 'zh-CN' ? 'en' : 'zh-CN'
  const normalizedTime = typeof time === 'number' ? new Date(time) : asDate(time, 'timeago value')
  return format(normalizedTime, 'DEFAULT', locale)
}
