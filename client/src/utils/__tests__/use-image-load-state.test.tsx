import '../../test/setup'
import { render, waitFor } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { useImageLoadState } from '../use-image-load-state'

function TestImage({
  src,
  complete,
  naturalWidth,
  fireLoadOnRef = false,
  onStatusChange,
}: {
  src: string
  complete: boolean
  naturalWidth: number
  fireLoadOnRef?: boolean
  onStatusChange?: (status: string) => void
}) {
  const { imageRef, loaded, failed, onLoad, onError } = useImageLoadState(src)

  useEffect(() => {
    onStatusChange?.(JSON.stringify({ failed, loaded }))
  }, [failed, loaded, onStatusChange])

  return (
    <>
      <div data-testid='status'>{JSON.stringify({ failed, loaded })}</div>
      <img
        ref={node => {
          ;(imageRef as MutableRefObject<HTMLImageElement | null>).current = node
          if (!node) {
            return
          }
          Object.defineProperty(node, 'complete', {
            configurable: true,
            get: () => complete,
          })
          Object.defineProperty(node, 'naturalWidth', {
            configurable: true,
            get: () => naturalWidth,
          })

          if (fireLoadOnRef) {
            onLoad()
          }
        }}
        src={src}
        alt=''
        onLoad={onLoad}
        onError={onError}
      />
    </>
  )
}

describe('useImageLoadState', () => {
  it('marks a cached image as loaded after src changes', async () => {
    const { getByTestId, rerender } = render(
      <TestImage src='https://example.com/a.png' complete={false} naturalWidth={0} />
    )

    expect(getByTestId('status')).toHaveTextContent('{"failed":false,"loaded":false}')

    rerender(<TestImage src='https://example.com/b.png' complete={true} naturalWidth={640} />)

    await waitFor(() => {
      expect(getByTestId('status')).toHaveTextContent('{"failed":false,"loaded":true}')
    })
  })

  it('marks a completed broken image as failed', async () => {
    const { getByTestId } = render(<TestImage src='https://example.com/broken.png' complete={true} naturalWidth={0} />)

    await waitFor(() => {
      expect(getByTestId('status')).toHaveTextContent('{"failed":true,"loaded":false}')
    })
  })

  it('does not reset a cached image after onLoad fires during ref assignment', async () => {
    const statusChanges: string[] = []
    const { getByTestId, rerender } = render(
      <TestImage
        src='https://example.com/a.png'
        complete={false}
        naturalWidth={0}
        onStatusChange={status => {
          statusChanges.push(status)
        }}
      />
    )

    statusChanges.length = 0

    rerender(
      <TestImage
        src='https://example.com/b.png'
        complete={true}
        naturalWidth={640}
        fireLoadOnRef
        onStatusChange={status => {
          statusChanges.push(status)
        }}
      />
    )

    await waitFor(() => {
      expect(getByTestId('status')).toHaveTextContent('{"failed":false,"loaded":true}')
    })

    const firstLoadedIndex = statusChanges.indexOf('{"failed":false,"loaded":true}')
    expect(firstLoadedIndex).toBeGreaterThanOrEqual(0)
    expect(statusChanges.slice(firstLoadedIndex)).toEqual(['{"failed":false,"loaded":true}'])
  })
})
