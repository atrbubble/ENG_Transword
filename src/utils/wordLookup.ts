import { dictionary } from '@/data/dictionary'
import type { DictionaryEntry } from '@/types/study'
import { MISSING_MEANING_PLACEHOLDER } from '@/utils/study'
import { buildLookupCandidates, findClosestDictionaryWord, normalizeWord } from '@/utils/text'

export interface ResolvedWord {
  normalized: string
  entry: DictionaryEntry
  matchedWord?: string
}

/**
 * 根据输入的原始单词在词库中解析出对应词条。
 * 优先精确匹配（含常见词形变化，如 studies→study），再退化为最长公共子串模糊匹配；
 * 都找不到时返回兜底词条（释义为占位符）。
 * 供「真题点词保存」和「生词本手动加入单词」共用，避免两处各写一套查找逻辑。
 */
export function resolveWordEntry(rawWord: string): ResolvedWord | null {
  const normalized = normalizeWord(rawWord)

  if (!normalized) {
    return null
  }

  const matchedWord = buildLookupCandidates(rawWord).find((candidate) => dictionary[candidate])
  const closestWord = matchedWord ? null : findClosestDictionaryWord(normalized, dictionary)
  const resolvedWord = matchedWord ?? closestWord
  const entry = (resolvedWord ? dictionary[resolvedWord] : undefined) ?? {
    word: normalized,
    meaning: MISSING_MEANING_PLACEHOLDER,
    source: 'fallback',
  }

  return {
    normalized,
    entry,
    matchedWord: resolvedWord && resolvedWord !== normalized ? resolvedWord : undefined,
  }
}
