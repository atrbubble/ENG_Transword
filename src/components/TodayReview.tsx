import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export interface TodayReviewWord {
  word: string
  matchedWord?: string
  meaning: string
}

interface TodayReviewProps {
  words: TodayReviewWord[]
}

export function TodayReview({ words }: TodayReviewProps) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})

  if (!words.length) {
    return null
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {words.map((item, index) => {
          const open = Boolean(revealed[index])

          return (
            <button
              key={`${item.word}-${index}`}
              type="button"
              onClick={() => setRevealed((prev) => ({ ...prev, [index]: !prev[index] }))}
              className={`rounded-[20px] border px-4 py-4 text-left transition ${
                open
                  ? 'border-[#21352b]/25 bg-[#f6f0e2]'
                  : 'border-stone-200 bg-white/80 hover:border-[#21352b]/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-lg leading-snug text-[#21352b]">
                  {item.word}
                  {item.matchedWord ? (
                    <span className="ml-1 text-sm text-[#a4955f]">({item.matchedWord})</span>
                  ) : null}
                </p>
                {open ? (
                  <EyeOff className="h-4 w-4 shrink-0 text-stone-400" />
                ) : (
                  <Eye className="h-4 w-4 shrink-0 text-stone-300" />
                )}
              </div>
              {open ? <p className="mt-2 text-sm leading-6 text-stone-700">{item.meaning}</p> : null}
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-center text-xs text-stone-400">点击卡片显示 / 隐藏释义</p>
    </div>
  )
}
