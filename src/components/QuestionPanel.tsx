import { CheckCircle2, Circle } from 'lucide-react'
import type React from 'react'

import { InlineInteractiveText } from '@/components/InlineInteractiveText'
import { cn } from '@/lib/utils'
import type { ActivePhraseSelection, Choice, ExamQuestion, PhraseContextSelection } from '@/types/study'

interface QuestionPanelProps {
  questions: ExamQuestion[]
  selectedMap: Record<string, Choice | undefined>
  onSelect: (questionId: string, choice: Choice) => void
  compactOptions?: boolean
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
}

export function QuestionPanel({
  questions,
  selectedMap,
  onSelect,
  compactOptions = false,
  activeWord,
  savedWords,
  onWordClick,
  onWordContextMenu,
  activePhraseSelection,
  onPhraseDragStart,
  onPhraseDragEnter,
  onPhraseContextMenu,
}: QuestionPanelProps) {
  return (
    <div className="space-y-4">
      {questions.map((question) => {
        const currentChoice = selectedMap[question.id]
        const choiceLabels = question.options.map((option) => option.key)

        return (
          <article
            key={question.id}
            className="rounded-[24px] border border-stone-900/10 bg-white/85 p-5 shadow-[0_20px_70px_rgba(57,48,28,0.08)]"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {choiceLabels.map((choice) => {
                const active = currentChoice === choice

                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => onSelect(question.id, choice)}
                    className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm transition duration-150',
                      active
                        ? 'border-[#21352b] bg-[#21352b] text-[#f8f3e8]'
                        : 'border-stone-300 bg-stone-50 text-stone-600 hover:border-[#21352b]/40 hover:text-[#21352b]',
                    )}
                  >
                    {choice}
                  </button>
                )
              })}

              <div className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#f6f0e2] px-3 py-2 text-sm text-[#21352b]">
                {currentChoice ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    已选 {currentChoice}
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4" />
                    未作答
                  </>
                )}
              </div>
            </div>

            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-[#21352b]/8 font-semibold text-[#21352b]">
                {question.number}
              </div>
              <p className="pt-1 text-sm leading-7 text-stone-700">
                <InlineInteractiveText
                  text={question.prompt}
                  activeWord={activeWord}
                  savedWords={savedWords}
                  onWordClick={onWordClick}
                  onWordContextMenu={onWordContextMenu}
                  selectionScopeId={`${question.id}-prompt`}
                  activePhraseSelection={activePhraseSelection}
                  onPhraseDragStart={onPhraseDragStart}
                  onPhraseDragEnter={onPhraseDragEnter}
                  onPhraseContextMenu={onPhraseContextMenu}
                />
              </p>
            </div>

            <div className={cn('grid gap-2', compactOptions && 'grid-cols-3 sm:grid-cols-4')}>
              {question.options.map((option) => {
                const active = currentChoice === option.key

                return (
                  <div
                    key={option.key}
                    onClick={() => onSelect(question.id, option.key)}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition duration-150',
                      active
                        ? 'border-[#21352b] bg-[#21352b]/6 text-[#21352b]'
                        : 'border-stone-200 bg-stone-50/70 text-stone-600 hover:border-[#21352b]/30 hover:bg-white',
                      compactOptions && 'justify-center px-3 py-3',
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(question.id, option.key)
                      }
                    }}
                  >
                    <span className="font-semibold">{option.key}.</span>
                    {!compactOptions ? (
                      <span className="leading-6">
                        <InlineInteractiveText
                          text={option.text}
                          activeWord={activeWord}
                          savedWords={savedWords}
                          onWordClick={onWordClick}
                          onWordContextMenu={onWordContextMenu}
                          selectionScopeId={`${question.id}-${option.key}`}
                          activePhraseSelection={activePhraseSelection}
                          onPhraseDragStart={onPhraseDragStart}
                          onPhraseDragEnter={onPhraseDragEnter}
                          onPhraseContextMenu={onPhraseContextMenu}
                        />
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </article>
        )
      })}
    </div>
  )
}
