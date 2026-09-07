import type { SavedWord, WordRating } from '@/types/study'
import type { RevealLevel } from '@/utils/spacedRepetition'
import { normalizeWord, shouldAppendSpace, tokenizeParagraph } from '@/utils/text'

export type StudyStage = 'word' | 'sentence' | 'meaning'

const STAGE_ORDER: Record<StudyStage, number> = {
  word: 0,
  sentence: 1,
  meaning: 2,
}

function HighlightedSentence({ context, word }: { context: string; word: string }) {
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

interface RatingOption {
  rating: WordRating
  label: string
  key: string
  className: string
}

const RATING_OPTIONS: RatingOption[] = [
  {
    rating: 'good',
    label: '认识',
    key: '1',
    className: 'bg-[#21352b] text-[#f8f3e8] hover:bg-[#2b4739]',
  },
  {
    rating: 'hard',
    label: '模糊',
    key: '2',
    className: 'bg-[#efe5d0] text-[#7a5c1e] hover:bg-[#e7d8bb]',
  },
  {
    rating: 'again',
    label: '不认识',
    key: '3',
    className: 'bg-[#f3ddd7] text-[#9b3d2e] hover:bg-[#edcbc1]',
  },
]

interface StudyCardProps {
  word: SavedWord
  stage: StudyStage
  onAdvance: () => void
  onRate: (rating: WordRating, revealed: RevealLevel) => void
}

export function StudyCard({ word, stage, onAdvance, onRate }: StudyCardProps) {
  const level = STAGE_ORDER[stage]
  const hasSentence = Boolean(word.sourceContext?.trim())
  const showSentence = hasSentence && level >= 1
  const showMeaning = level >= 2
  const revealed = level as RevealLevel

  const advanceHint =
    stage === 'word'
      ? hasSentence
        ? '点击卡片或按空格查看例句'
        : '点击卡片或按空格查看释义'
      : stage === 'sentence'
        ? '点击卡片或按空格查看释义'
        : null

  return (
    <div
      onClick={showMeaning ? undefined : onAdvance}
      className={`min-h-[380px] rounded-[32px] border border-stone-900/10 bg-white/85 p-8 shadow-[0_30px_80px_rgba(33,53,43,0.12)] transition ${
        showMeaning ? '' : 'cursor-pointer hover:border-[#21352b]/25 hover:shadow-[0_36px_90px_rgba(33,53,43,0.18)]'
      }`}
    >
      <div className="flex min-h-[120px] flex-col items-center justify-center text-center">
        <p className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-6xl leading-tight text-[#21352b]">
          {word.word}
        </p>
        {word.matchedWord ? (
          <span className="mt-2 text-xl text-[#a4955f]">({word.matchedWord})</span>
        ) : null}
        {word.phonetic ? <p className="mt-2 text-sm text-stone-500">{word.phonetic}</p> : null}
      </div>

      {showSentence ? (
        <div className="mt-8 rounded-[24px] border border-stone-200 bg-[#fbf8f1] px-6 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#a4955f]">真题例句</p>
          <p className="mt-3 text-base leading-8 text-stone-700">
            <HighlightedSentence context={word.sourceContext!} word={word.word} />
          </p>
        </div>
      ) : null}

      {showMeaning ? (
        <div className="mt-8 rounded-[24px] border border-stone-200 bg-[#f6f0e2] px-6 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#a4955f]">释义</p>
          <p className="mt-3 text-lg leading-8 text-stone-800">{word.meaning}</p>
          {word.sourcePaperTitle ? (
            <p className="mt-3 text-xs text-stone-500">来源：{word.sourcePaperTitle}</p>
          ) : null}
        </div>
      ) : null}

      {advanceHint ? (
        <p className="mt-8 text-center text-sm text-stone-400">{advanceHint}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-3">
        {RATING_OPTIONS.map((option) => (
          <button
            key={option.rating}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRate(option.rating, revealed)
            }}
            className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${option.className}`}
          >
            {option.label}
            <span className="ml-1 text-xs opacity-60">{option.key}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
