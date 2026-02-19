import { Helmet } from '../components/helmet'
import { useTranslation } from 'react-i18next'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { siteName } from '../utils/constants'

export function AboutPage() {
  const { t } = useTranslation()
  const siteConfig = useSiteConfig()
  const description = siteConfig.description || t('about.description')

  return (
    <>
      <Helmet>
        <title>{`${t('about.title')} - ${siteConfig.name}`}</title>
        <meta property='og:site_name' content={siteName} />
        <meta property='og:title' content={t('about.title')} />
        <meta property='og:description' content={description} />
        <meta property='og:image' content={siteConfig.avatar} />
        <meta property='og:type' content='website' />
        <meta property='og:url' content={document.URL} />
      </Helmet>
      <main className='wauto rounded-2xl bg-w m-2 p-6 t-primary ani-show' aria-label={t('about.title')}>
        <h1 className='text-2xl font-bold mb-4'>{t('about.title')}</h1>
        <p className='t-secondary whitespace-pre-wrap break-words'>{description}</p>
      </main>
    </>
  )
}
