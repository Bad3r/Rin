import '../../test/setup'
import { describe, expect, it } from 'vitest'
import { isMarkdownImageLinkAtEnd } from '../markdown-image'

describe('isMarkdownImageLinkAtEnd', () => {
  it('matches a trailing markdown image after a newline', () => {
    expect(isMarkdownImageLinkAtEnd('Paragraph text\n![](https://example.com/image.png)')).toBe(true)
  })

  it('does not treat inline markdown images as block tails', () => {
    expect(isMarkdownImageLinkAtEnd('Paragraph text ![](https://example.com/image.png)')).toBe(false)
  })
})
