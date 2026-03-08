const toPositiveInteger = (value?: string | null): number | undefined => {
  if (!value) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function parseImageUrlMetadata(url?: string | null): {
  src: string
  blurhash?: string
  width?: number
  height?: number
} {
  if (!url) {
    return { src: '' }
  }

  const [src, fragment = ''] = url.split('#', 2)
  const params = new URLSearchParams(fragment)

  return {
    src,
    blurhash: params.get('blurhash') || undefined,
    width: toPositiveInteger(params.get('width')),
    height: toPositiveInteger(params.get('height')),
  }
}
