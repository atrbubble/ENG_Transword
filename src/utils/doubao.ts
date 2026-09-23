const DOUBAO_CHAT_URL = 'https://www.doubao.com/chat'

/**
 * 跳转豆包查询：先把待查询文本复制到剪贴板，再新开标签页打开豆包对话。
 * 豆包暂不支持用 URL 参数预填提问，所以用「复制 + 打开」的方式，用户粘贴即可查询。
 */
export function openDoubao(query: string) {
  const text = query.trim()

  if (!text) {
    return
  }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  window.open(DOUBAO_CHAT_URL, '_blank', 'noopener')
}
