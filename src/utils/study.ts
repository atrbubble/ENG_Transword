import type { AnswerRecord, SavedPhrase, SavedWord, TextResponseRecord } from '@/types/study'

export const MISSING_MEANING_PLACEHOLDER = '红宝书词库里暂时没有收录这条释义。'

export function upsertSavedWord(words: SavedWord[], nextWord: SavedWord) {
  const existingWord = words.find((word) => word.word === nextWord.word)

  if (existingWord) {
    const mergedWord: SavedWord = {
      ...existingWord,
      ...nextWord,
      meaning:
        existingWord.meaning !== MISSING_MEANING_PLACEHOLDER
          ? existingWord.meaning
          : nextWord.meaning,
      phonetic: existingWord.phonetic ?? nextWord.phonetic,
      partOfSpeech: existingWord.partOfSpeech ?? nextWord.partOfSpeech,
      matchedWord: existingWord.matchedWord ?? nextWord.matchedWord,
    }

    return words
      .map((word) => (word.word === nextWord.word ? mergedWord : word))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  return [nextWord, ...words].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}

export function removeSavedWord(words: SavedWord[], target: string) {
  return words.filter((word) => word.word !== target)
}

export function updateSavedWordMeaning(words: SavedWord[], target: string, meaning: string) {
  return words.map((word) => (word.word === target ? { ...word, meaning } : word))
}

export function upsertSavedPhrase(phrases: SavedPhrase[], nextPhrase: SavedPhrase) {
  const existingPhrase = phrases.find((phrase) => phrase.key === nextPhrase.key)

  if (existingPhrase) {
    const mergedPhrase: SavedPhrase = {
      ...existingPhrase,
      ...nextPhrase,
      meaning:
        existingPhrase.meaning !== MISSING_MEANING_PLACEHOLDER
          ? existingPhrase.meaning
          : nextPhrase.meaning,
    }

    return phrases
      .map((phrase) => (phrase.key === nextPhrase.key ? mergedPhrase : phrase))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  return [nextPhrase, ...phrases].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}

export function removeSavedPhrase(phrases: SavedPhrase[], target: string) {
  return phrases.filter((phrase) => phrase.key !== target)
}

export function updateSavedPhrase(
  phrases: SavedPhrase[],
  target: string,
  updates: Pick<SavedPhrase, 'phrase' | 'meaning'>,
) {
  return phrases.map((phrase) => (phrase.key === target ? { ...phrase, ...updates } : phrase))
}

export function upsertAnswerRecord(records: AnswerRecord[], nextRecord: AnswerRecord) {
  const filtered = records.filter(
    (record) =>
      !(record.paperId === nextRecord.paperId && record.questionId === nextRecord.questionId),
  )

  return [...filtered, nextRecord]
}

export function upsertTextResponseRecord(records: TextResponseRecord[], nextRecord: TextResponseRecord) {
  const filtered = records.filter(
    (record) => !(record.paperId === nextRecord.paperId && record.promptId === nextRecord.promptId),
  )

  return [...filtered, nextRecord]
}
