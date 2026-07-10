export function extractImage(content: string) {
  const img_reg = /!\[.*?\]\((.*?)\)/
  const img_match = img_reg.exec(content)
  if (img_match) {
    return img_match[1]
  }

  const html_img_reg = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i
  const html_img_match = html_img_reg.exec(content)
  if (html_img_match) {
    return html_img_match[1]
  }

  return undefined
}
