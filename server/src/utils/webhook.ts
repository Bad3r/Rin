async function sendWebhook(url: string, data: Record<string, unknown>) {
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
}

export async function notify(webhook_url: string, message: string) {
  if (!webhook_url) {
    return
  }
  return await sendWebhook(webhook_url, { content: message })
}
