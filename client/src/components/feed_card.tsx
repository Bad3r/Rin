import { asDate, type IsoDateTimeString } from '@rin/api'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'wouter'
import { drawBlurhashToCanvas } from '../utils/blurhash'
import { parseImageUrlMetadata } from '../utils/image-upload'
import { timeago } from '../utils/timeago'
import { useImageLoadState } from '../utils/use-image-load-state'
import { HashTag } from './hashtag'

function FeedCardImage({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { src: cleanSrc, blurhash, width, height } = parseImageUrlMetadata(src)
  const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(cleanSrc)
  const aspectRatio = width && height ? `${width} / ${height}` : undefined

  useEffect(() => {
    if (!blurhash || !canvasRef.current) {
      return
    }
    try {
      drawBlurhashToCanvas(canvasRef.current, blurhash)
    } catch (error) {
      console.error('Failed to render blurhash', error)
    }
  }, [blurhash])

  return (
    <div
      className='relative mb-2 flex max-h-80 w-full flex-row items-center overflow-hidden rounded-xl'
      style={{ aspectRatio }}
    >
      {blurhash && !loaded ? (
        <canvas ref={canvasRef} aria-hidden='true' className='absolute inset-0 h-full w-full scale-110 blur-sm' />
      ) : null}
      <img
        ref={imageRef}
        src={cleanSrc}
        alt=''
        width={width}
        height={height}
        onLoad={onLoad}
        onError={onError}
        className={`absolute inset-0 h-full w-full object-cover object-center hover:scale-105 translation duration-300 ${
          blurhash && (!loaded || failed) ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  )
}

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
        {avatar && <FeedCardImage src={avatar} />}
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
