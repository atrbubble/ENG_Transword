import type { SavedWord, StudySettings, WordProgress, WordRating } from '@/types/study'

export const EASE_DEFAULT = 2.5
export const EASE_MIN = 1.3
export const EASE_MAX = 2.8

// 连续「认识」达到该间隔天数后视为「已掌握」，用于统计掌握度分布。
export const MASTERED_INTERVAL_DAYS = 21

export const DEFAULT_STUDY_SETTINGS: StudySettings = {
  dailyNewCount: 20,
  order: 'recent',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function endOfDay(date: Date) {
  const next = startOfDay(date)
  next.setHours(23, 59, 59, 999)
  return next
}

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// 揭示层级：评分时已经看到了多少提示。
// 0 = 只看单词；1 = 看到例句；2 = 看到释义。
export type RevealLevel = 0 | 1 | 2

// 「认识」的权重按揭示层级分档：零提示就想起来 → 记得更牢 → 间隔更长、ease 更高。
const GOOD_EASE_DELTA: Record<RevealLevel, number> = { 0: 0.15, 1: 0.05, 2: -0.05 }
const GOOD_FIRST_INTERVAL: Record<RevealLevel, number> = { 0: 4, 1: 3, 2: 1 }

/**
 * 简化 SM-2 调度：根据本次评分推进单词的下次复习时间。
 * - again：归零间隔，当天再见；ease 下调，reps 清零，累计一次错误。
 * - hard：间隔按 1.2 倍增长（至少 1 天），ease 小幅下调。
 * - good：首次间隔与 ease 增量的强弱取决于 `revealed`（评分前看到了多少提示）。
 */
export function gradeProgress(
  prev: WordProgress | undefined,
  word: string,
  rating: WordRating,
  revealed: RevealLevel,
  now: Date,
): WordProgress {
  const ease = prev?.ease ?? EASE_DEFAULT
  const interval = prev?.interval ?? 0
  const reps = prev?.reps ?? 0
  const mistakes = prev?.mistakes ?? 0
  const firstSeenAt = prev?.firstSeenAt ?? now.toISOString()

  if (rating === 'again') {
    return {
      word,
      ease: clamp(ease - 0.2, EASE_MIN, EASE_MAX),
      interval: 0,
      reps: 0,
      mistakes: mistakes + 1,
      nextReviewAt: now.toISOString(),
      firstSeenAt,
      lastReviewedAt: now.toISOString(),
    }
  }

  if (rating === 'hard') {
    const nextInterval = Math.max(1, Math.round(interval * 1.2))

    return {
      word,
      ease: clamp(ease - 0.15, EASE_MIN, EASE_MAX),
      interval: nextInterval,
      reps: reps + 1,
      mistakes,
      nextReviewAt: addDays(now, nextInterval).toISOString(),
      firstSeenAt,
      lastReviewedAt: now.toISOString(),
    }
  }

  const delta = GOOD_EASE_DELTA[revealed] ?? 0.05
  const firstInterval = GOOD_FIRST_INTERVAL[revealed] ?? 3
  const nextEase = clamp(ease + delta, EASE_MIN, EASE_MAX)
  const nextInterval = interval === 0 ? firstInterval : Math.max(1, Math.round(interval * nextEase))

  return {
    word,
    ease: nextEase,
    interval: nextInterval,
    reps: reps + 1,
    mistakes,
    nextReviewAt: addDays(now, nextInterval).toISOString(),
    firstSeenAt,
    lastReviewedAt: now.toISOString(),
  }
}

function shuffle<T>(items: T[]) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }

  return copy
}

/**
 * 构建今日学习队列：到期复习词优先，新词按每日目标补足。
 * savedWords 默认按收藏时间倒序（最新在前）。
 */
export function buildDailyQueue(
  savedWords: SavedWord[],
  progress: Record<string, WordProgress>,
  settings: StudySettings,
  now: Date,
): SavedWord[] {
  const todayKey = toDateKey(now)
  const due: SavedWord[] = []
  const newWords: SavedWord[] = []

  for (const word of savedWords) {
    const entry = progress[word.word]

    if (!entry) {
      newWords.push(word)
    } else if (new Date(entry.nextReviewAt).getTime() <= endOfDay(now).getTime()) {
      due.push(word)
    }
  }

  due.sort((left, right) => {
    const leftAt = progress[left.word]?.nextReviewAt ?? ''
    const rightAt = progress[right.word]?.nextReviewAt ?? ''

    return leftAt.localeCompare(rightAt)
  })

  const learnedToday = Object.values(progress).filter(
    (entry) => toDateKey(new Date(entry.firstSeenAt)) === todayKey,
  ).length
  const newBudget = Math.max(0, settings.dailyNewCount - learnedToday)

  const orderedNew =
    settings.order === 'random'
      ? shuffle(newWords)
      : settings.order === 'sequential'
        ? [...newWords].reverse()
        : newWords

  return [...due, ...orderedNew.slice(0, newBudget)]
}

export interface StudyStats {
  newToday: number
  reviewToday: number
  studiedToday: number
  totalStudiedDays: number
  streak: number
  masteredCount: number
  learningCount: number
}

export function computeStudyStats(
  progress: Record<string, WordProgress>,
  now: Date,
): StudyStats {
  const todayKey = toDateKey(now)
  const entries = Object.values(progress)

  const studiedDays = new Set<string>()
  let newToday = 0
  let reviewToday = 0

  for (const entry of entries) {
    const firstKey = toDateKey(new Date(entry.firstSeenAt))
    const lastKey = toDateKey(new Date(entry.lastReviewedAt))

    studiedDays.add(firstKey)
    studiedDays.add(lastKey)

    if (firstKey === todayKey) {
      newToday += 1
    }

    if (lastKey === todayKey && firstKey !== todayKey) {
      reviewToday += 1
    }
  }

  // 连续打卡：从今天往回数；今天还没学则从昨天开始，避免当天尚未学习就断签。
  let cursor = new Date(now)
  if (!studiedDays.has(todayKey)) {
    cursor = addDays(cursor, -1)
  }

  let streak = 0
  while (studiedDays.has(toDateKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  const masteredCount = entries.filter((entry) => entry.interval >= MASTERED_INTERVAL_DAYS).length

  return {
    newToday,
    reviewToday,
    studiedToday: newToday + reviewToday,
    totalStudiedDays: studiedDays.size,
    streak,
    masteredCount,
    learningCount: entries.length - masteredCount,
  }
}
