import { describe, expect, it } from 'vitest'

import type { AnswerRecord, SavedWord } from '@/types/study'
import { removeSavedWord, upsertAnswerRecord, upsertSavedWord } from '@/utils/study'
import { buildLookupCandidates, findClosestDictionaryWord, normalizeWord, shouldAppendSpace, tokenizeParagraph } from '@/utils/text'

describe('text utils', () => {
  it('normalizes punctuation around words', () => {
    expect(normalizeWord('"Discipline,"')).toBe('discipline')
  })

  it('tokenizes paragraph into words and punctuation', () => {
    expect(tokenizeParagraph("Work, then rest.")[1]).toEqual({
      value: ',',
      normalized: '',
      isWord: false,
    })
  })

  it('avoids spaces before punctuation', () => {
    expect(shouldAppendSpace('word', ',')).toBe(false)
    expect(shouldAppendSpace('word', 'next')).toBe(true)
  })

  it('builds lookup candidates for inflected words', () => {
    expect(buildLookupCandidates('studies')).toContain('study')
    expect(buildLookupCandidates('running')).toContain('run')
    expect(buildLookupCandidates('bankers')).toContain('banker')
  })

  it('finds the closest dictionary word by longest overlap', () => {
    const dict: Record<string, unknown> = {
      normal: {},
      understand: {},
      abnormal: {},
      nation: {},
      able: {},
    }

    expect(findClosestDictionaryWord('normalization', dict)).toBe('normal')
    expect(findClosestDictionaryWord('understandability', dict)).toBe('understand')
    expect(findClosestDictionaryWord('abnormalities', dict)).toBe('abnormal')
  })

  it('returns null when no meaningful overlap exists', () => {
    expect(findClosestDictionaryWord('xyz', { normal: {}, able: {} })).toBeNull()
  })
})

describe('study utils', () => {
  const sampleWord: SavedWord = {
    word: 'discipline',
    meaning: '自律',
    sourcePaperId: 'p1',
    sourcePaperTitle: '样例真题',
    createdAt: '2026-06-13T10:00:00.000Z',
  }

  it('deduplicates saved words', () => {
    expect(upsertSavedWord([sampleWord], sampleWord)).toHaveLength(1)
  })

  it('removes saved words by normalized word', () => {
    expect(removeSavedWord([sampleWord], 'discipline')).toHaveLength(0)
  })

  it('replaces answer for the same question', () => {
    const initial: AnswerRecord[] = [
      { paperId: 'p1', questionId: 'q1', choice: 'A' },
      { paperId: 'p1', questionId: 'q2', choice: 'B' },
    ]

    expect(
      upsertAnswerRecord(initial, {
        paperId: 'p1',
        questionId: 'q1',
        choice: 'D',
      }),
    ).toEqual([
      { paperId: 'p1', questionId: 'q2', choice: 'B' },
      { paperId: 'p1', questionId: 'q1', choice: 'D' },
    ])
  })
})
