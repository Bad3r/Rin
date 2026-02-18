import { useEffect, useRef, useState } from 'react'
import type { Tag } from '@rin/api'
import { Helmet } from '../components/helmet'
import { useTranslation } from 'react-i18next'
import { Link } from 'wouter'
import { HashTag } from '../components/hashtag'
import { Waiting } from '../components/loading'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { client } from '../main'
import { siteName } from '../utils/constants'

export function HashtagsPage() {
  const { t } = useTranslation()
  const siteConfig = useSiteConfig()
  const [hashtags, setHashtags] = useState<Tag[]>()
  const ref = useRef(false)
  useEffect(() => {
    if (ref.current) return
    client.tag.list().then(({ data }) => {
      if (data) {
        setHashtags(data)
      }
    })
    ref.current = true
  }, [])
  return (
    <>
      <Helmet>
        <title>{`${t('hashtags')} - ${siteConfig.name}`}</title>
        <meta property='og:site_name' content={siteName} />
        <meta property='og:title' content={t('hashtags')} />
        <meta property='og:image' content={siteConfig.avatar} />
        <meta property='og:type' content='article' />
        <meta property='og:url' content={document.URL} />
      </Helmet>
      <Waiting for={hashtags}>
        <main className='w-full flex flex-col justify-center items-center mb-8 ani-show'>
          <div className='wauto text-start text-black dark:text-white py-4 text-4xl font-bold'>
            <p>{t('hashtags')}</p>
          </div>

          <div className='wauto flex flex-col flex-wrap items-start justify-start'>
            {hashtags
              ?.filter(({ count }) => count > 0)
              .map(hashtag => {
                return (
                  <div key={hashtag.id} className='w-full flex flex-row'>
                    <div className='w-full rounded-2xl m-2 duration-300 flex flex-row items-center space-x-4   '>
                      <Link
                        href={`/hashtag/${hashtag.name}`}
                        className='text-base t-primary hover:text-theme text-pretty overflow-hidden'
                      >
                        <HashTag name={hashtag.name} />
                      </Link>
                      <div className='flex-1' />
                      <span className='t-secondary text-sm'>
                        {t('article.total_short$count', { count: hashtag.count })}
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </main>
      </Waiting>
    </>
  )
}
