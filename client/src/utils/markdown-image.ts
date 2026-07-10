export function isMarkdownImageLinkAtEnd(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/(.*)(!\[.*?\]\(.*?\))$/s)

  if (match) {
    const [, beforeImage] = match
    return beforeImage.trim().length === 0 || beforeImage.endsWith('\n')
  }

  return false
}
