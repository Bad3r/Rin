import { useCallback, useEffect, useRef, useState } from 'react'
import type { TagDetail } from '@rin/api'
import { Helmet } from '../components/helmet'
import { useTranslation } from 'react-i18next'
import { FeedCard } from '../components/feed_card'
import { Waiting } from '../components/loading'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { client } from '../main'
import { siteName } from '../utils/constants'

export function HashtagPage({ name }: { name: string }) {
  const { t } = useTranslation()
  const siteConfig = useSiteConfig()
  const [status, setStatus] = useState<'loading' | 'idle'>('idle')
  const [hashtag, setHashtag] = useState<TagDetail>()
  const ref = useRef('')
  const fetchFeeds = useCallback(() => {
    const nameDecoded = decodeURI(name)
    client.tag.get(nameDecoded).then(({ data }) => {
      if (data) {
        setHashtag(data)
        setStatus('idle')
      }
    })
  }, [name])
  useEffect(() => {
    if (ref.current === name) return
    setStatus('loading')
    fetchFeeds()
    ref.current = name
  }, [name, fetchFeeds])
  return (
    <>
      <Helmet>
        <title>{`${hashtag?.name} - ${siteConfig.name}`}</title>
        <meta property='og:site_name' content={siteName} />
        <meta property='og:title' content={hashtag?.name} />
        <meta property='og:image' content={siteConfig.avatar} />
        <meta property='og:type' content='article' />
        <meta property='og:url' content={document.URL} />
      </Helmet>
      <Waiting for={hashtag || status === 'idle'}>
        <main className='w-full flex flex-col justify-center items-center mb-8'>
          <div className='wauto text-start text-black dark:text-white py-4 text-4xl font-bold'>
            <p>{hashtag?.name}</p>
            <div className='flex flex-row justify-between'>
              <p className='text-sm mt-4 text-neutral-500 font-normal'>
                {t('article.total$count', { count: hashtag?.feeds?.length })}
              </p>
            </div>
          </div>
          <Waiting for={status === 'idle'}>
            <div className='wauto flex flex-col'>
              {hashtag?.feeds?.map(feedItem => {
                const { id, ...feed } = feedItem
                return <FeedCard key={id} id={`${id}`} {...feed} />
              })}
            </div>
          </Waiting>
        </main>
      </Waiting>
    </>
  )
}
