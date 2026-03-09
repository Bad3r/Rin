import { useEffect, useRef, useState } from 'react'

export function useImageLoadState(src?: string) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const image = imageRef.current
    if (!src || !image) {
      setLoaded(false)
      setFailed(false)
      return
    }

    if (!image.complete) {
      setLoaded(false)
      setFailed(false)
      return
    }

    if (image.naturalWidth > 0) {
      setLoaded(true)
      setFailed(false)
      return
    }

    setLoaded(false)
    setFailed(true)
  }, [src])

  return {
    failed,
    imageRef,
    loaded,
    onError: () => {
      setLoaded(false)
      setFailed(true)
    },
    onLoad: () => {
      setLoaded(true)
      setFailed(false)
    },
  }
}
