import { Children, isValidElement, useEffect, type ReactElement, type ReactNode } from 'react'

interface HelmetProps {
  children?: ReactNode
}

type HelmetElement = ReactElement<Record<string, unknown>, string>

function isHelmetElement(node: ReactNode): node is HelmetElement {
  return isValidElement(node) && typeof node.type === 'string'
}

function toAttributeName(name: string): string {
  switch (name) {
    case 'className':
      return 'class'
    case 'htmlFor':
      return 'for'
    case 'httpEquiv':
      return 'http-equiv'
    case 'charSet':
      return 'charset'
    default:
      return name
  }
}

function setAttributes(element: HTMLElement, props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children') {
      continue
    }

    if (value === null || value === undefined || value === false) {
      continue
    }

    const attributeName = toAttributeName(key)

    if (value === true) {
      element.setAttribute(attributeName, '')
      continue
    }

    element.setAttribute(attributeName, String(value))
  }
}

function setTitleFromChildren(children: ReactNode): void {
  const values = Children.toArray(children)
    .map(child => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
    .join('')

  if (values.length > 0) {
    document.title = values
  }
}

function createHeadElement(type: string, props: Record<string, unknown>): HTMLElement | null {
  if (type !== 'meta' && type !== 'link') {
    return null
  }

  const element = document.createElement(type)
  setAttributes(element, props)
  element.setAttribute('data-rin-helmet', 'true')
  return element
}

export function Helmet({ children }: HelmetProps) {
  useEffect(() => {
    const previousTitle = document.title
    const insertedElements: HTMLElement[] = []

    for (const node of Children.toArray(children)) {
      if (!isHelmetElement(node)) {
        continue
      }

      if (node.type === 'title') {
        setTitleFromChildren(node.props.children as ReactNode)
        continue
      }

      const element = createHeadElement(node.type, node.props)
      if (element) {
        document.head.appendChild(element)
        insertedElements.push(element)
      }
    }

    return () => {
      for (const element of insertedElements) {
        element.remove()
      }
      document.title = previousTitle
    }
  }, [children])

  return null
}
