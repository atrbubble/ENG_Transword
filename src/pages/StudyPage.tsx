import { ArrowLeft, BookMarked, CheckCircle2, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { StudyCard, type StudyStage } from '@/components/StudyCard'
import { StudySummary } from '@/components/StudySummary'
import { TodayReview, type TodayReviewWord } from '@/components/TodayReview'
import { useStudyStore } from '@/store/useStudyStore'
import type { SavedWord, StudyOrder, WordRating } from '@/types/study'
import { buildDailyQueue, computeStudyStats, toDateKey, type RevealLevel } from '@/utils/spacedRepetition'

const DAILY_OPTIONS = [10, 20, 30, 50]

const ORDER_OPTIONS: { value: StudyOrder; label: string }[] = [
  { value: 'recent', label: '最新优先' },
  { value: 'sequential', label: '从早到晚' },
  { value: 'random', label: '随机' },
]

const REVEAL_LEVEL: Record<StudyStage, RevealLevel> = { word: 0, sentence: 1, meaning: 2 }

interface Session {
  queue: SavedWord[]
  total: number
  done: number
}

export default function StudyPage() {
  const savedWords = useStudyStore((state) => state.savedWords)
  const wordProgress = useStudyStore((state) => state.wordProgress)
  const studySettings = useStudyStore((state) => state.studySettings)
  const rateWord = useStudyStore((state) => state.rateWord)
  const setStudySettings = useStudyStore((state) => state.setStudySettings)

  const [session, setSession] = useState<Session>(() => {
    const queue = buildDailyQueue(savedWords, wordProgress, studySettings, new Date())

    return { queue, total: queue.length, done: 0 }
  })
  const [stage, setStage] = useState<StudyStage>('word')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showTodayReview, setShowTodayReview] = useState(false)

  const current = session.queue[0]
  const hasSentence = Boolean(current?.sourceContext?.trim())

  useEffect(() => {
    document.title = 'Transword Archive | 背单词'
  }, [])

  const handleAdvance = useCallback(() => {
    setStage((prev) => {
      if (prev === 'word') {
        return hasSentence ? 'sentence' : 'meaning'
      }

      if (prev === 'sentence') {
        return 'meaning'
      }

      return prev
    })
  }, [hasSentence])

  const handleRate = useCallback(
    (rating: WordRating, revealed: RevealLevel) => {
      if (!current) {
        return
      }

      rateWord(current.word, rating, revealed)
      setStage('word')
      setSession((prev) => {
        if (rating === 'again') {
          return { ...prev, queue: [...prev.queue.slice(1), current] }
        }

        return { ...prev, queue: prev.queue.slice(1), done: prev.done + 1 }
      })
    },
    [current, rateWord],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()

        if (stage !== 'meaning') {
          handleAdvance()
        }

        return
      }

      let rating: WordRating | null = null

      if (event.key === '1') {
        rating = 'good'
      } else if (event.key === '2') {
        rating = 'hard'
      } else if (event.key === '3') {
        rating = 'again'
      }

      if (rating) {
        event.preventDefault()
        handleRate(rating, REVEAL_LEVEL[stage])
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stage, handleAdvance, handleRate])

  const stats = useMemo(() => computeStudyStats(wordProgress, new Date()), [wordProgress])

  const todayStudied = useMemo(() => {
    const todayKey = toDateKey(new Date())
    const byWord = new Map(savedWords.map((saved) => [saved.word, saved]))
    const result: TodayReviewWord[] = []

    Object.entries(wordProgress)
      .filter(([, progress]) => toDateKey(new Date(progress.lastReviewedAt)) === todayKey)
      .sort(([, left], [, right]) => left.lastReviewedAt.localeCompare(right.lastReviewedAt))
      .forEach(([word]) => {
        const saved = byWord.get(word)

        if (saved) {
          result.push({ word, matchedWord: saved.matchedWord, meaning: saved.meaning })
        }
      })

    return result
  }, [wordProgress, savedWords])

  const progress = session.total ? Math.round((session.done / session.total) * 100) : 0

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              to="/vocabulary"
              className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-[#21352b]"
            >
              <ArrowLeft className="h-4 w-4" />
              生词本
            </Link>
            <h1 className="mt-2 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-3xl text-[#21352b]">
              背单词
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-[#21352b]/30 hover:text-[#21352b]"
          >
            <Settings2 className="h-4 w-4" />
            设置
          </button>
        </div>

        {settingsOpen ? (
          <div className="mb-6 rounded-[24px] border border-stone-200 bg-white/80 p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[#a4955f]">每日新词</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {DAILY_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setStudySettings({ dailyNewCount: count })}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    studySettings.dailyNewCount === count
                      ? 'border-[#21352b] bg-[#21352b] text-[#f8f3e8]'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-[#21352b]/30'
                  }`}
                >
                  {count} 词
                </button>
              ))}
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.18em] text-[#a4955f]">新词顺序</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {ORDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStudySettings({ order: option.value })}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    studySettings.order === option.value
                      ? 'border-[#21352b] bg-[#21352b] text-[#f8f3e8]'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-[#21352b]/30'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="mt-6 text-xs leading-6 text-stone-400">
              每日新词与顺序在下次进入背单词时生效。
            </p>
          </div>
        ) : null}

        {!savedWords.length ? (
          <div className="rounded-[32px] border border-dashed border-stone-300 bg-stone-50 px-8 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#21352b]/8 text-[#21352b]">
              <BookMarked className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-2xl text-[#21352b]">
              生词本还没有单词
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-500">
              先回到真题阅读页，点击单词看释义，再右键加入生词本，就能来这里背了。
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#21352b] px-5 py-3 text-sm text-[#f8f3e8] transition hover:bg-[#2b4739]"
            >
              去做一套真题
            </Link>
          </div>
        ) : !current ? (
          <div className="rounded-[32px] border border-stone-900/10 bg-white/85 p-8 text-center shadow-[0_24px_80px_rgba(57,48,28,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#21352b] text-[#f3e7cb]">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-3xl text-[#21352b]">
              今日任务完成
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-500">
              今天的新词和到期复习都已经背完，明天再来巩固吧。
            </p>

            <div className="mt-8">
              <StudySummary stats={stats} />
            </div>

            <button
              type="button"
              onClick={() => setShowTodayReview((open) => !open)}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#21352b]/30 bg-white px-5 py-3 text-sm text-[#21352b] transition hover:bg-[#f6f0e2]"
            >
              {showTodayReview ? '收起今日已学' : `查看今日已学（${todayStudied.length}）`}
            </button>

            {showTodayReview ? (
              <div className="mt-6 text-left">
                <TodayReview words={todayStudied} />
              </div>
            ) : null}

            <Link
              to="/vocabulary"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#21352b] px-5 py-3 text-sm text-[#f8f3e8] transition hover:bg-[#2b4739]"
            >
              返回生词本
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-sm text-stone-500">
                <span>
                  本组 {session.total} 词 · 已学 {session.done} 词
                </span>
                <span>快捷键：空格看提示，1/2/3 评分</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200/70">
                <div
                  className="h-full rounded-full bg-[#21352b] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <StudyCard word={current} stage={stage} onAdvance={handleAdvance} onRate={handleRate} />

            <div className="mt-6">
              <StudySummary stats={stats} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
