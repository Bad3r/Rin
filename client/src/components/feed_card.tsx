import { asDate, type IsoDateTimeString } from '@rin/api'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'wouter'
import { timeago } from '../utils/timeago'
import { HashTag } from './hashtag'

export function FeedCard({
  id,
  title,
  avatar,
  draft,
  listed,
  top,
  summary,
  hashtags,
  createdAt,
  updatedAt,
}: {
  id: string | number
  avatar?: string | null
  draft?: number
  listed?: number
  top?: number
  title: string | null
  summary?: string
  hashtags: { id: number; name: string }[]
  createdAt: IsoDateTimeString | Date
  updatedAt: IsoDateTimeString | Date
}) {
  const { t } = useTranslation()
  return useMemo(() => {
    const createdAtDate = asDate(createdAt, 'feed.createdAt')
    const updatedAtDate = asDate(updatedAt, 'feed.updatedAt')
    const isUpdated = createdAtDate.getTime() !== updatedAtDate.getTime()

    return (
      <Link href={`/feed/${id}`} target='_blank' className='w-full rounded-2xl bg-w my-2 p-6 duration-300 bg-button'>
        {avatar && (
          <div className='flex flex-row items-center mb-2 rounded-xl overflow-clip'>
            <img
              src={avatar}
              alt=''
              className='object-cover object-center w-full max-h-96 hover:scale-105 translation duration-300'
            />
          </div>
        )}
        <h1 className='text-xl font-bold text-gray-700 dark:text-white text-pretty overflow-hidden'>{title || ''}</h1>
        <p className='space-x-2'>
          <span className='text-gray-400 text-sm' title={createdAtDate.toLocaleString()}>
            {isUpdated ? t('feed_card.published$time', { time: timeago(createdAtDate) }) : timeago(createdAtDate)}
          </span>
          {isUpdated && (
            <span className='text-gray-400 text-sm' title={updatedAtDate.toLocaleString()}>
              {t('feed_card.updated$time', { time: timeago(updatedAtDate) })}
            </span>
          )}
        </p>
        <p className='space-x-2'>
          {draft === 1 && <span className='text-gray-400 text-sm'>{t('draft')}</span>}
          {listed === 0 && <span className='text-gray-400 text-sm'>{t('unlisted')}</span>}
          {top === 1 && <span className='text-theme text-sm'>{t('article.top.title')}</span>}
        </p>
        <p className='text-pretty overflow-hidden dark:text-neutral-500'>{summary || ''}</p>
        {hashtags.length > 0 && (
          <div className='mt-2 flex flex-row flex-wrap justify-start gap-x-2'>
            {hashtags.map(({ name }) => (
              <HashTag key={name} name={name} />
            ))}
          </div>
        )}
      </Link>
    )
  }, [id, title, avatar, draft, listed, top, summary, hashtags, createdAt, updatedAt, t])
}
