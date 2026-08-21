import { cn } from '@/lib/utils'
import type { ActivePhraseSelection, PhraseContextSelection } from '@/types/study'
import { splitPassageParagraphs } from '@/utils/cloze'
import {
  sanitizeDisplayText,
  shouldAppendSpace,
  splitTranslationSegments,
  tokenizeParagraph,
} from '@/utils/text'

interface PassageReaderProps {
  paragraphs: string[]
  blankNumbers?: number[]
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
  showLineNumbers?: boolean
  underlineTranslationTargets?: boolean
}

export function PassageReader({
  paragraphs,
  blankNumbers,
  activeWord,
  savedWords,
  onWordClick,
  onWordContextMenu,
  activePhraseSelection,
  onPhraseDragStart,
  onPhraseDragEnter,
  onPhraseContextMenu,
  showLineNumbers = true,
  underlineTranslationTargets = false,
}: PassageReaderProps) {
  const paragraphSegments = splitPassageParagraphs(paragraphs, blankNumbers)
  const translationSegments = underlineTranslationTargets
    ? splitTranslationSegments(paragraphs)
    : paragraphSegments.map((segments) =>
        segments.map((segment) => ({
          text: sanitizeDisplayText(segment.value),
          isUnderlined: false,
          markerNumber: undefined,
        })),
      )

  return (
    <div className="space-y-6">
      {paragraphSegments.map((segments, index) => {
        const styledSegments = translationSegments[index] ?? []

        return (
          <p
            key={`${paragraphs[index]?.slice(0, 24) ?? 'paragraph'}-${index}`}
            className="text-[17px] leading-9 text-stone-700 md:text-[18px]"
          >
            {showLineNumbers ? (
              <span className="mr-4 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-[#a4955f]">
                {index + 1 < 10 ? `0${index + 1}` : index + 1}
              </span>
            ) : null}
            {(underlineTranslationTargets ? styledSegments : segments).map((segment, segmentIndex) => {
              if ('markerNumber' in segment && segment.markerNumber) {
                return (
                  <span
                    key={`${segment.text}-${segmentIndex}`}
                    className="mx-1 inline-flex items-center rounded-xl border border-[#a4955f]/35 bg-[#fbf7ee] px-2 py-0.5 align-middle font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-[15px] text-[#21352b]"
                  >
                    {segment.text}
                  </span>
                )
              }

              if (segment.type === 'placeholder') {
                return (
                  <span
                    key={`${segment.value}-${segmentIndex}`}
                    className="mx-1 inline-flex min-w-[78px] items-center justify-center rounded-xl border border-[#a4955f]/35 bg-[#fbf7ee] px-2 py-1 align-middle font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-[15px] tracking-wide text-[#21352b]"
                  >
                    {segment.value}
                  </span>
                )
              }

              const segmentText = 'value' in segment ? segment.value : segment.text
              const tokens = tokenizeParagraph(segmentText)
              const isUnderlinedSegment = 'isUnderlined' in segment && segment.isUnderlined
              const wordTokens = tokens.filter((token) => token.isWord).map((token) => token.value)
              const selectionScopeId = `${index}-${segmentIndex}`
              let currentWordIndex = -1
              const renderedTokens = tokens.map((token, tokenIndex) => {
                if (!token.isWord) {
                  return (
                    <span
                      key={`${segmentIndex}-${segmentText}-${token.value}-${tokenIndex}`}
                      className="select-none"
                    >
                      {token.value}
                      {shouldAppendSpace(token.value, tokens[tokenIndex + 1]?.value) ? ' ' : ''}
                    </span>
                  )
                }

                currentWordIndex += 1
                const isActive = token.normalized && token.normalized === activeWord
                const isSaved = token.normalized && savedWords.includes(token.normalized)
                const phrasePayload: PhraseContextSelection = {
                  scopeId: selectionScopeId,
                  wordIndex: currentWordIndex,
                  words: wordTokens,
                  context: segmentText,
                }
                const isPhraseSelected =
                  activePhraseSelection?.scopeId === selectionScopeId &&
                  currentWordIndex >=
                    Math.min(activePhraseSelection.startIndex, activePhraseSelection.endIndex) &&
                  currentWordIndex <=
                    Math.max(activePhraseSelection.startIndex, activePhraseSelection.endIndex)

                return (
                  <span
                    key={`${segmentIndex}-${segmentText}-${token.value}-${tokenIndex}`}
                    className="inline-block"
                  >
                    <button
                      type="button"
                      onClick={(event) => onWordClick(token.value, event, segmentText)}
                      onContextMenu={(event) => {
                        if (
                          onPhraseContextMenu &&
                          isPhraseSelected &&
                          activePhraseSelection &&
                          Math.abs(activePhraseSelection.endIndex - activePhraseSelection.startIndex) >= 1
                        ) {
                          onPhraseContextMenu(phrasePayload, event)
                          return
                        }

                        onWordContextMenu(token.value, event, segmentText)
                      }}
                      onMouseDown={(event) => {
                        if (event.button !== 0 || !onPhraseDragStart) {
                          return
                        }

                        onPhraseDragStart(phrasePayload, event)
                      }}
                      onMouseEnter={() => {
                        if (!onPhraseDragEnter) {
                          return
                        }

                        onPhraseDragEnter(phrasePayload)
                      }}
                      className={cn(
                        'rounded-lg px-1.5 py-0.5 text-left transition duration-150',
                        isActive
                          ? 'bg-[#21352b] text-[#f7eed8] shadow-sm'
                          : 'hover:bg-[#21352b]/8 hover:text-[#21352b]',
                        isSaved && !isActive && 'bg-[#a4955f]/15 text-[#21352b]',
                        isPhraseSelected && 'bg-[#d8c78f]/40 text-[#21352b]',
                      )}
                    >
                      {token.value}
                    </button>
                    {shouldAppendSpace(token.value, tokens[tokenIndex + 1]?.value) ? ' ' : ''}
                  </span>
                )
              })

              return isUnderlinedSegment ? (
                <span
                  key={`${segmentIndex}-${segmentText}-underlined`}
                  className="border-b-2 border-[#a4955f] pb-0.5"
                >
                  {renderedTokens}
                </span>
              ) : (
                renderedTokens
              )
            })}
          </p>
        )
      })}
    </div>
  )
}
