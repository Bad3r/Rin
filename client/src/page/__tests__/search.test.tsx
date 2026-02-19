import { render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SearchPage } from '../search'

const { searchSpy } = vi.hoisted(() => ({
  searchSpy: vi.fn(async () => ({
    data: {
      size: 0,
      data: [],
      hasNext: false,
    },
  })),
}))

vi.mock('../../main', () => ({
  client: {
    search: {
      search: searchSpy,
    },
  },
}))

vi.mock('../../hooks/useSiteConfig', () => ({
  useSiteConfig: () => ({
    name: 'Test Site',
    avatar: '/avatar.png',
    pageSize: 5,
  }),
}))

vi.mock('../../components/helmet', () => ({
  Helmet: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('../../components/feed_card', () => ({
  FeedCard: () => null,
}))

vi.mock('../../components/loading', () => ({
  Waiting: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('wouter', async importOriginal => {
  const original = (await importOriginal()) as Record<string, unknown>
  return {
    ...original,
    useSearch: () => '?page=2&limit=1',
    Link: ({ children, href }: { children?: ReactNode; href: string }) => <a href={href}>{children}</a>,
  }
})

describe('SearchPage', () => {
  it('passes page and limit from URL query to search API', async () => {
    searchSpy.mockClear()

    render(<SearchPage keyword='query-keyword' />)

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('query-keyword', { page: 2, limit: 1 })
    })
  })
})
