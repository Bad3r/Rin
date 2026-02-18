import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Helmet } from '../helmet'

const describeWithDom = typeof document !== 'undefined' ? describe : describe.skip

describeWithDom('Helmet', () => {
  beforeEach(() => {
    document.head.querySelectorAll('[data-rin-helmet]').forEach(element => {
      element.remove()
    })
  })

  afterEach(() => {
    cleanup()
    document.head.querySelectorAll('[data-rin-helmet]').forEach(element => {
      element.remove()
    })
  })

  it('deduplicates meta tags by name and keeps the last value', () => {
    render(
      <>
        <Helmet>
          <meta name='description' content='first description' />
        </Helmet>
        <Helmet>
          <meta name='description' content='second description' />
        </Helmet>
      </>
    )

    const descriptionTags = document.head.querySelectorAll('meta[name="description"][data-rin-helmet]')

    expect(descriptionTags).toHaveLength(1)
    expect(descriptionTags[0]).toHaveAttribute('content', 'second description')
  })

  it('deduplicates link tags by rel+href', () => {
    render(
      <>
        <Helmet>
          <link rel='canonical' href='https://rin.example/posts/1' />
        </Helmet>
        <Helmet>
          <link rel='canonical' href='https://rin.example/posts/1' />
        </Helmet>
      </>
    )

    const canonicalLinks = document.head.querySelectorAll(
      'link[rel="canonical"][href="https://rin.example/posts/1"][data-rin-helmet]'
    )

    expect(canonicalLinks).toHaveLength(1)
  })
})
