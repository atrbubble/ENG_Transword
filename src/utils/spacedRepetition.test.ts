import { describe, expect, it } from 'vitest'

import type { SavedWord, WordProgress } from '@/types/study'
import {
  buildDailyQueue,
  computeStudyStats,
  DEFAULT_STUDY_SETTINGS,
  gradeProgress,
  toDateKey,
} from '@/utils/spacedRepetition'

function makeWord(word: string): SavedWord {
  return {
    word,
    meaning: `${word} 的释义`,
    sourcePaperId: 'p1',
    sourcePaperTitle: '样例真题',
    createdAt: '2026-06-13T10:00:00.000Z',
  }
}

describe('gradeProgress', () => {
  const now = new Date(2026, 8, 7, 9, 0, 0)

  it('records firstSeenAt on the very first rating', () => {
    const next = gradeProgress(undefined, 'abandon', 'again', now)

    expect(next.word).toBe('abandon')
    expect(next.firstSeenAt).toBe(now.toISOString())
    expect(next.mistakes).toBe(1)
    expect(next.interval).toBe(0)
    expect(next.reps).toBe(0)
  })

  it('schedules the first "good" three days out', () => {
    const next = gradeProgress(undefined, 'abandon', 'good', now)

    expect(next.interval).toBe(3)
    expect(next.reps).toBe(1)
    expect(toDateKey(new Date(next.nextReviewAt))).toBe('2026-09-10')
  })

  it('schedules the first "hard" one day out', () => {
    const next = gradeProgress(undefined, 'abandon', 'hard', now)

    expect(next.interval).toBe(1)
    expect(next.reps).toBe(1)
  })

  it('grows interval by ease on a repeat "good"', () => {
    const first = gradeProgress(undefined, 'abandon', 'good', now)
    const second = gradeProgress(first, 'abandon', 'good', now)

    // ease 2.5 -> 2.55 -> 2.6; interval 3 -> round(3 * 2.6) = 8
    expect(second.ease).toBeCloseTo(2.6)
    expect(second.interval).toBe(8)
    expect(second.reps).toBe(2)
  })

  it('resets progress and lowers ease on "again"', () => {
    const learned = gradeProgress(undefined, 'abandon', 'good', now)
    const again = gradeProgress(learned, 'abandon', 'again', now)

    expect(again.interval).toBe(0)
    expect(again.reps).toBe(0)
    expect(again.mistakes).toBe(1)
    // 之前的「good」已把 ease 提到 2.55，again 再降 0.2 → 2.35
    expect(again.ease).toBeCloseTo(2.35)
  })
})

describe('buildDailyQueue', () => {
  const now = new Date(2026, 8, 7, 9, 0, 0)
  const yesterday = new Date(2026, 8, 6, 9, 0, 0)
  // 昨天首次学习、又答错 → 今天到期复习，且不占用今日新词配额
  const dueProgress: WordProgress = gradeProgress(undefined, 'due', 'again', yesterday)
  const futureProgress: WordProgress = gradeProgress(undefined, 'future', 'good', now)

  it('puts due words first and fills the rest with new words', () => {
    const words = [makeWord('new'), makeWord('future'), makeWord('due')]
    const progress = { due: dueProgress, future: futureProgress }
    const queue = buildDailyQueue(words, progress, DEFAULT_STUDY_SETTINGS, now)

    expect(queue.map((word) => word.word)).toEqual(['due', 'new'])
  })

  it('respects the daily new-word budget', () => {
    const words = [makeWord('new1'), makeWord('new2'), makeWord('due')]
    const progress = { due: dueProgress }
    const queue = buildDailyQueue(words, progress, { dailyNewCount: 1, order: 'recent' }, now)

    expect(queue.map((word) => word.word)).toEqual(['due', 'new1'])
  })

  it('keeps recent order for new words by default', () => {
    const words = [makeWord('new1'), makeWord('new2'), makeWord('new3')]
    const queue = buildDailyQueue(words, {}, { dailyNewCount: 3, order: 'recent' }, now)

    expect(queue.map((word) => word.word)).toEqual(['new1', 'new2', 'new3'])
  })

  it('reverses new-word order in sequential mode', () => {
    const words = [makeWord('new1'), makeWord('new2'), makeWord('new3')]
    const queue = buildDailyQueue(words, {}, { dailyNewCount: 3, order: 'sequential' }, now)

    expect(queue.map((word) => word.word)).toEqual(['new3', 'new2', 'new1'])
  })
})

describe('computeStudyStats', () => {
  const today = new Date(2026, 8, 7, 9, 0, 0)

  it('counts new vs review and computes the streak', () => {
    const yesterday = new Date(2026, 8, 6, 9, 0, 0)
    const dayBefore = new Date(2026, 8, 5, 9, 0, 0)

    const progress: Record<string, WordProgress> = {
      fresh: gradeProgress(undefined, 'fresh', 'good', today),
      reviewed: gradeProgress(undefined, 'reviewed', 'good', yesterday),
      old: gradeProgress(undefined, 'old', 'good', dayBefore),
    }
    // 「reviewed」今天再复习一次
    progress.reviewed = gradeProgress(progress.reviewed, 'reviewed', 'good', today)

    const stats = computeStudyStats(progress, today)

    expect(stats.newToday).toBe(1)
    expect(stats.reviewToday).toBe(1)
    expect(stats.studiedToday).toBe(2)
    expect(stats.totalStudiedDays).toBe(3)
    expect(stats.streak).toBe(3)
  })
})
