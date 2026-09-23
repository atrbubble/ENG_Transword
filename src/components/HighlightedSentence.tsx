import { normalizeWord, shouldAppendSpace, tokenizeParagraph } from '@/utils/text'

/** 在例句中高亮目标单词（桌面背单词卡片与手机全屏模式共用）。 */
export function HighlightedSentence({ context, word }: { context: string; word: string }) {
  const tokens = tokenizeParagraph(context)
  const target = normalizeWord(word)

  return (
    <>
      {tokens.map((token, index) => {
        const spacing = shouldAppendSpace(token.value, tokens[index + 1]?.value) ? ' ' : ''
        const isTarget = token.isWord && token.normalized === target

        return (
          <span key={`${token.value}-${index}`}>
            {isTarget ? (
              <span className="rounded-md bg-[#21352b] px-1.5 py-0.5 text-[#f7eed8]">
                {token.value}
              </span>
            ) : (
              token.value
            )}
            {spacing}
          </span>
        )
      })}
    </>
  )
}
