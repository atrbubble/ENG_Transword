import fixedCollocationsData from '../../word book/fixed_collocations.json'

import { MISSING_MEANING_PLACEHOLDER } from '@/utils/study'
import { normalizeWord } from '@/utils/text'

interface CollocationItem {
  collocation: string
  meaning: string
}

interface FixedCollocationsData {
  categories: Record<string, CollocationItem[]>
  total_count: number
}

export interface FixedCollocationMatch {
  collocation: string
  meaning: string
  category: string
  overlapCount: number
}

const PLACEHOLDER_WORDS = new Set([
  'a',
  'b',
  'sb',
  'sth',
  'sp',
  'one',
  'ones',
  'someone',
  'something',
])

function compactBrokenLetters(text: string) {
  return text.replace(/\b(?:[a-zA-Z]\s+){2,}[a-zA-Z]\b/g, (value) => value.replace(/\s+/g, ''))
}

function normalizeCollocationText(text: string) {
  return compactBrokenLetters(text)
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, '')
    .replace(/\.{2,}/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeCollocationText(text: string) {
  return normalizeCollocationText(text)
    .split(' ')
    .map((token) => normalizeWord(token))
    .filter((token) => token && !PLACEHOLDER_WORDS.has(token))
}

const fixedCollocations = Object.entries((fixedCollocationsData as FixedCollocationsData).categories).flatMap(
  ([category, items]) =>
    items.map((item) => ({
      ...item,
      category,
      tokens: tokenizeCollocationText(item.collocation),
      normalized: normalizeCollocationText(item.collocation),
    })),
)

export function normalizePhraseKey(phrase: string) {
  return tokenizeCollocationText(phrase).join(' ')
}

export function resolvePhraseMeaning(phrase: string) {
  const phraseTokens = tokenizeCollocationText(phrase)
  const phraseTokenSet = new Set(phraseTokens)

  if (phraseTokenSet.size < 2) {
    return {
      meaning: MISSING_MEANING_PLACEHOLDER,
      matchedCollocation: undefined,
      matchedCategory: undefined,
    }
  }

  const bestMatch = fixedCollocations
    .map((item) => {
      const overlapCount = item.tokens.filter((token) => phraseTokenSet.has(token)).length

      return {
        ...item,
        overlapCount,
      }
    })
    .filter((item) => item.overlapCount >= 2)
    .sort((left, right) => {
      if (right.overlapCount !== left.overlapCount) {
        return right.overlapCount - left.overlapCount
      }

      return Math.abs(left.tokens.length - phraseTokens.length) - Math.abs(right.tokens.length - phraseTokens.length)
    })[0]

  if (!bestMatch) {
    return {
      meaning: MISSING_MEANING_PLACEHOLDER,
      matchedCollocation: undefined,
      matchedCategory: undefined,
    }
  }

  return {
    meaning: bestMatch.meaning || MISSING_MEANING_PLACEHOLDER,
    matchedCollocation: bestMatch.collocation,
    matchedCategory: bestMatch.category,
  }
}
