import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Helmet } from '../components/helmet'
import { useTranslation } from 'react-i18next'
import { Link, useSearch } from 'wouter'
import { FeedCard } from '../components/feed_card'
import { Waiting } from '../components/loading'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { client } from '../main'
import { ProfileContext } from '../state/profile'
import { siteName } from '../utils/constants'
import { tryInt } from '../utils/int'

type FeedsData = {
  size: number
  data: any[]
  hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
  [key in FeedType]: FeedsData
}

export function FeedsPage() {
  const { t } = useTranslation()
  const siteConfig = useSiteConfig()
  const query = new URLSearchParams(useSearch())
  const queryType = (query.get('type') as FeedType) || 'normal'
  const queryPage = query.get('page') || ''
  const profile = useContext(ProfileContext)
  const [listState, _setListState] = useState<FeedType>(queryType)
  const [status, setStatus] = useState<'loading' | 'idle'>('idle')
  const [feeds, setFeeds] = useState<FeedsMap>({
    draft: { size: 0, data: [], hasNext: false },
    unlisted: { size: 0, data: [], hasNext: false },
    normal: { size: 0, data: [], hasNext: false },
  })
  const page = tryInt(1, query.get('page'))
  const limit = tryInt(10, query.get('limit'), siteConfig.pageSize)
  const ref = useRef('')

  const fetchFeeds = useCallback(
    (type: FeedType) => {
      client.feed
        .list({
          page: page,
          limit: limit,
          type: type,
        })
        .then(({ data }) => {
          if (data) {
            setFeeds(prev => ({
              ...prev,
              [type]: data,
            }))
            setStatus('idle')
          }
        })
    },
    [limit, page]
  )

  useEffect(() => {
    const key = `${queryPage} ${queryType}`
    if (ref.current === key) return
    if (queryType !== listState) {
      _setListState(queryType)
    }
    setStatus('loading')
    fetchFeeds(queryType)
    ref.current = key
  }, [fetchFeeds, listState, queryPage, queryType])
  return (
    <>
      <Helmet>
        <title>{`${t('article.title')} - ${siteConfig.name}`}</title>
        <meta property='og:site_name' content={siteName} />
        <meta property='og:title' content={t('article.title')} />
        <meta property='og:image' content={siteConfig.avatar} />
        <meta property='og:type' content='article' />
        <meta property='og:url' content={document.URL} />
      </Helmet>
      <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
        <main className='w-full flex flex-col justify-center items-center mb-8'>
          <div className='wauto text-start text-black dark:text-white py-4 text-4xl font-bold'>
            <p>
              {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
            </p>
            <div className='flex flex-row justify-between'>
              <p className='text-sm mt-4 text-neutral-500 font-normal'>
                {t('article.total$count', { count: feeds[listState]?.size })}
              </p>
              {profile?.permission && (
                <div className='flex flex-row space-x-4'>
                  <Link
                    href={listState === 'draft' ? '/?type=normal' : '/?type=draft'}
                    className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'draft' ? 'text-theme' : ''}`}
                  >
                    {t('draft_bin')}
                  </Link>
                  <Link
                    href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'}
                    className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'unlisted' ? 'text-theme' : ''}`}
                  >
                    {t('unlisted')}
                  </Link>
                </div>
              )}
            </div>
          </div>
          <Waiting for={status === 'idle'}>
            <div className='wauto flex flex-col ani-show'>
              {feeds[listState].data.map(({ id, ...feed }: any) => (
                <FeedCard key={id} id={id} {...feed} />
              ))}
            </div>
            <div className='wauto flex flex-row items-center mt-4 ani-show'>
              {page > 1 && (
                <Link
                  href={`/?type=${listState}&page=${page - 1}`}
                  className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}
                >
                  {t('previous')}
                </Link>
              )}
              <div className='flex-1' />
              {feeds[listState]?.hasNext && (
                <Link
                  href={`/?type=${listState}&page=${page + 1}`}
                  className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}
                >
                  {t('next')}
                </Link>
              )}
            </div>
          </Waiting>
        </main>
      </Waiting>
    </>
  )
}
