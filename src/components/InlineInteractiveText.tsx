import type React from 'react'

import { cn } from '@/lib/utils'
import type { ActivePhraseSelection, PhraseContextSelection } from '@/types/study'
import { shouldAppendSpace, tokenizeParagraph } from '@/utils/text'

interface InlineInteractiveTextProps {
  text: string
  activeWord: string
  savedWords: string[]
  onWordClick: (
    word: string,
    event: React.MouseEvent<HTMLButtonElement>,
    context?: string,
  ) => void
  onWordContextMenu: (
    word: string,
    event: React.MouseEvent<HTMLButtonElement>,
    context?: string,
  ) => void
  selectionScopeId?: string
  activePhraseSelection?: ActivePhraseSelection | null
  onPhraseDragStart?: (
    payload: PhraseContextSelection,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void
  onPhraseDragEnter?: (payload: PhraseContextSelection) => void
  onPhraseContextMenu?: (
    payload: PhraseContextSelection,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void
  className?: string
  wordClassName?: string
}

export function InlineInteractiveText({
  text,
  activeWord,
  savedWords,
  onWordClick,
  onWordContextMenu,
  selectionScopeId,
  activePhraseSelection,
  onPhraseDragStart,
  onPhraseDragEnter,
  onPhraseContextMenu,
  className,
  wordClassName,
}: InlineInteractiveTextProps) {
  const tokens = tokenizeParagraph(text)
  const wordTokens = tokens.filter((token) => token.isWord).map((token) => token.value)
  let currentWordIndex = -1

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        const spacing = shouldAppendSpace(token.value, tokens[index + 1]?.value) ? ' ' : ''

        if (!token.isWord) {
          return (
            <span key={`${token.value}-${index}`} className="select-none">
              {token.value}
              {spacing}
            </span>
          )
        }

        currentWordIndex += 1
        const isActive = token.normalized && token.normalized === activeWord
        const isSaved = token.normalized && savedWords.includes(token.normalized)
        const phrasePayload: PhraseContextSelection | undefined = selectionScopeId
          ? {
              scopeId: selectionScopeId,
              wordIndex: currentWordIndex,
              words: wordTokens,
              context: text,
            }
          : undefined
        const isPhraseSelected =
          activePhraseSelection?.scopeId === selectionScopeId &&
          currentWordIndex >= Math.min(activePhraseSelection.startIndex, activePhraseSelection.endIndex) &&
          currentWordIndex <= Math.max(activePhraseSelection.startIndex, activePhraseSelection.endIndex)

        return (
          <span key={`${token.value}-${index}`} className="inline-block">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onWordClick(token.value, event, text)
              }}
              onContextMenu={(event) => {
                event.stopPropagation()
                if (
                  phrasePayload &&
                  onPhraseContextMenu &&
                  isPhraseSelected &&
                  wordTokens.length > 1 &&
                  activePhraseSelection &&
                  Math.abs(activePhraseSelection.endIndex - activePhraseSelection.startIndex) >= 1
                ) {
                  onPhraseContextMenu(phrasePayload, event)
                  return
                }

                onWordContextMenu(token.value, event, text)
              }}
              onMouseDown={(event) => {
                if (event.button !== 0 || !phrasePayload || !onPhraseDragStart) {
                  return
                }

                onPhraseDragStart(phrasePayload, event)
              }}
              onMouseEnter={() => {
                if (!phrasePayload || !onPhraseDragEnter) {
                  return
                }

                onPhraseDragEnter(phrasePayload)
              }}
              className={cn(
                'rounded px-0.5 text-inherit transition-colors duration-150',
                isActive
                  ? 'bg-[#21352b] text-[#f7eed8]'
                  : 'hover:bg-[#21352b]/8 hover:text-[#21352b]',
                isSaved && !isActive && 'bg-[#a4955f]/15 text-[#21352b]',
                isPhraseSelected && 'bg-[#d8c78f]/40 text-[#21352b]',
                wordClassName,
              )}
            >
              {token.value}
            </button>
            {spacing}
          </span>
        )
      })}
    </span>
  )
}
