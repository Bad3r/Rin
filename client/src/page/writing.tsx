import i18n from 'i18next'
import _ from 'lodash'
import { Calendar } from 'primereact/calendar'
import 'primereact/resources/primereact.css'
import 'primereact/resources/themes/lara-light-indigo/theme.css'
import mermaid from 'mermaid'
import { useCallback, useEffect, useState } from 'react'
import { asDate, toIsoDateTimeString, type Feed } from '@rin/api'
import { Helmet } from '../components/helmet'
import { useTranslation } from 'react-i18next'
import Loading from '../components/react-loading'
import { type ShowAlertType, useAlert } from '../components/dialog'
import { Checkbox, Input } from '../components/input'
import { MarkdownEditor } from '../components/markdown_editor'
import { useSiteConfig } from '../hooks/useSiteConfig'
import { client } from '../main'
import { Cache } from '../utils/cache'
import { siteName } from '../utils/constants'

type EditableFeed = Feed & {
  alias?: string | null
  summary?: string
  listed?: number
  draft?: number
}

async function publish({
  title,
  alias,
  listed,
  content,
  summary,
  tags,
  draft,
  createdAt,
  onCompleted,
  showAlert,
}: {
  title: string
  listed: boolean
  content: string
  summary: string
  tags: string[]
  draft: boolean
  alias?: string
  createdAt?: Date
  onCompleted?: () => void
  showAlert: ShowAlertType
}) {
  const t = i18n.t
  const { data, error } = await client.feed.create({
    title,
    alias,
    content,
    summary,
    tags,
    listed,
    draft,
    createdAt: createdAt ? toIsoDateTimeString(createdAt, 'writing.createdAt') : undefined,
  })
  if (onCompleted) {
    onCompleted()
  }
  if (error) {
    showAlert(error.value)
  }
  if (data) {
    showAlert(t('publish.success'), () => {
      Cache.with().clear()
      window.location.href = `/feed/${data.insertedId}`
    })
  }
}

async function update({
  id,
  title,
  alias,
  content,
  summary,
  tags,
  listed,
  draft,
  createdAt,
  onCompleted,
  showAlert,
}: {
  id: number
  listed: boolean
  title?: string
  alias?: string
  content?: string
  summary?: string
  tags?: string[]
  draft?: boolean
  createdAt?: Date
  onCompleted?: () => void
  showAlert: ShowAlertType
}) {
  const t = i18n.t
  const { error } = await client.feed.update(id, {
    title,
    alias,
    content,
    summary,
    tags,
    listed,
    draft,
    createdAt: createdAt ? toIsoDateTimeString(createdAt, 'writing.createdAt') : undefined,
  })
  if (onCompleted) {
    onCompleted()
  }
  if (error) {
    showAlert(error.value)
  } else {
    showAlert(t('update.success'), () => {
      Cache.with(id).clear()
      window.location.href = `/feed/${id}`
    })
  }
}

// 写作页面
export function WritingPage({ id }: { id?: number }) {
  const { t } = useTranslation()
  const siteConfig = useSiteConfig()
  const cache = Cache.with(id)
  const [title, setTitle] = cache.useCache('title', '')
  const [summary, setSummary] = cache.useCache('summary', '')
  const [tags, setTags] = cache.useCache('tags', '')
  const [alias, setAlias] = cache.useCache('alias', '')
  const [draft, setDraft] = useState(false)
  const [listed, setListed] = useState(true)
  const [content, setContent] = cache.useCache('content', '')
  const [createdAt, setCreatedAt] = useState<Date | undefined>(new Date())
  const [publishing, setPublishing] = useState(false)
  const { showAlert, AlertUI } = useAlert()

  useEffect(() => {
    if (id !== undefined || alias !== '' || typeof window === 'undefined') {
      return
    }
    const aliasFromQuery = new URLSearchParams(window.location.search).get('alias')?.trim()
    if (aliasFromQuery) {
      setAlias(aliasFromQuery)
    }
  }, [alias, id, setAlias])
  function publishButton() {
    if (publishing) return
    const tagsplit =
      tags
        .split('#')
        .filter(tag => tag !== '')
        .map(tag => tag.trim()) || []
    if (id !== undefined) {
      setPublishing(true)
      update({
        id,
        title,
        content,
        summary,
        alias,
        tags: tagsplit,
        draft,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert,
      })
    } else {
      if (!title) {
        showAlert(t('title_empty'))
        return
      }
      if (!content) {
        showAlert(t('content.empty'))
        return
      }
      setPublishing(true)
      publish({
        title,
        content,
        summary,
        tags: tagsplit,
        draft,
        alias,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert,
      })
    }
  }

  useEffect(() => {
    if (id) {
      client.feed.get(id).then(({ data }) => {
        if (data) {
          const feedData = data as EditableFeed
          if (title === '' && feedData.title) setTitle(feedData.title)
          if (tags === '' && feedData.hashtags)
            setTags(feedData.hashtags.map(({ name }: { name: string }) => `#${name}`).join(' '))
          if (alias === '' && feedData.alias) setAlias(feedData.alias)
          if (content === '') setContent(feedData.content)
          if (summary === '') setSummary(feedData.summary || '')
          setListed(feedData.listed === 1)
          setDraft(feedData.draft === 1)
          setCreatedAt(asDate(feedData.createdAt, 'feed.createdAt'))
        }
      })
    }
  }, [alias, content, id, setAlias, setContent, setSummary, setTags, setTitle, summary, tags, title])
  const debouncedUpdate = useCallback(
    _.debounce(() => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
      })
      mermaid
        .run({
          suppressErrors: true,
          nodes: document.querySelectorAll('pre.mermaid_default'),
        })
        .then(() => {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
          })
          mermaid.run({
            suppressErrors: true,
            nodes: document.querySelectorAll('pre.mermaid_dark'),
          })
        })
    }, 100),
    []
  )
  useEffect(() => {
    debouncedUpdate()
  }, [debouncedUpdate])
  function MetaInput({ className }: { className?: string }) {
    return (
      <div className={className}>
        <Input id={id} value={title} setValue={setTitle} placeholder={t('title')} />
        <Input id={id} value={summary} setValue={setSummary} placeholder={t('summary')} className='mt-4' />
        <Input id={id} value={tags} setValue={setTags} placeholder={t('tags')} className='mt-4' />
        <Input id={id} value={alias} setValue={setAlias} placeholder={t('alias')} className='mt-4' />
        <button
          type='button'
          className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4 w-full'
          onClick={() => setDraft(!draft)}
        >
          <p>{t('visible.self_only')}</p>
          <Checkbox id='draft' value={draft} setValue={setDraft} placeholder={t('draft')} />
        </button>
        <button
          type='button'
          className='select-none flex flex-row justify-between items-center mt-6 mb-2 px-4 w-full'
          onClick={() => setListed(!listed)}
        >
          <p>{t('listed')}</p>
          <Checkbox id='listed' value={listed} setValue={setListed} placeholder={t('listed')} />
        </button>
        <div className='select-none flex flex-row justify-between items-center mt-4 mb-2 pl-4'>
          <p className='break-keep mr-2'>{t('created_at')}</p>
          <Calendar
            value={createdAt}
            onChange={e => setCreatedAt(e.value || undefined)}
            showTime
            touchUI
            hourFormat='24'
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>{`${t('writing')} - ${siteConfig.name}`}</title>
        <meta property='og:site_name' content={siteName} />
        <meta property='og:title' content={t('writing')} />
        <meta property='og:image' content={siteConfig.avatar} />
        <meta property='og:type' content='article' />
        <meta property='og:url' content={document.URL} />
      </Helmet>
      <div className='grid grid-cols-1 md:grid-cols-3 t-primary mt-2'>
        <div className='col-span-2 pb-8'>
          <div className='bg-w rounded-2xl shadow-xl shadow-light p-4'>
            {MetaInput({ className: 'visible md:hidden mb-8' })}
            <MarkdownEditor content={content} setContent={setContent} height='600px' />
          </div>
          <div className='visible md:hidden flex flex-row justify-center mt-8'>
            <button
              type='button'
              onClick={publishButton}
              className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-light flex flex-row justify-center items-center space-x-2'
            >
              {publishing && <Loading type='spin' height={16} width={16} />}
              <span>{t('publish.title')}</span>
            </button>
          </div>
        </div>
        <div className='hidden md:visible max-w-96 md:flex flex-col'>
          {MetaInput({ className: 'bg-w rounded-2xl shadow-xl shadow-light p-4 mx-8' })}
          <div className='flex flex-row justify-center mt-8'>
            <button
              type='button'
              onClick={publishButton}
              className='basis-1/2 bg-theme text-white py-4 rounded-full shadow-xl shadow-light flex flex-row justify-center items-center space-x-2'
            >
              {publishing && <Loading type='spin' height={16} width={16} />}
              <span>{t('publish.title')}</span>
            </button>
          </div>
        </div>
      </div>
      <AlertUI />
    </>
  )
}
