import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type {
  AnswerRecord,
  PhraseSelection,
  SavedPhrase,
  SavedWord,
  TextResponseRecord,
  WordSelection,
} from '@/types/study'
import {
  MISSING_MEANING_PLACEHOLDER,
  removeSavedPhrase,
  removeSavedWord,
  updateSavedWordMeaning,
  updateSavedPhrase,
  upsertAnswerRecord,
  upsertSavedPhrase,
  upsertSavedWord,
  upsertTextResponseRecord,
} from '@/utils/study'

interface StudyState {
  savedWords: SavedWord[]
  savedPhrases: SavedPhrase[]
  answerRecords: AnswerRecord[]
  textResponseRecords: TextResponseRecord[]
  saveWord: (selection: WordSelection) => void
  savePhrase: (selection: PhraseSelection) => void
  deleteWord: (word: string) => void
  deletePhrase: (key: string) => void
  updateWordMeaning: (word: string, meaning: string) => void
  updatePhrase: (key: string, phrase: string, meaning: string) => void
  setAnswer: (record: AnswerRecord) => void
  setTextResponse: (record: TextResponseRecord) => void
  isSaved: (word: string) => boolean
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      savedWords: [],
      savedPhrases: [],
      answerRecords: [],
      textResponseRecords: [],
      saveWord: (selection) =>
        set((state) => ({
          savedWords: upsertSavedWord(state.savedWords, {
            word: selection.normalized,
            meaning: selection.entry.meaning,
            phonetic: selection.entry.phonetic,
            partOfSpeech: selection.entry.partOfSpeech,
            sourcePaperId: selection.paperId,
            sourcePaperTitle: selection.paperTitle,
            sourceSectionId: selection.sourceSectionId,
            sourceSectionTitle: selection.sourceSectionTitle,
            sourcePassageId: selection.sourcePassageId,
            sourcePassageLabel: selection.sourcePassageLabel,
            sourceContext: selection.sourceContext,
            createdAt: new Date().toISOString(),
          }),
        })),
      savePhrase: (selection) =>
        set((state) => ({
          savedPhrases: upsertSavedPhrase(state.savedPhrases, {
            key: selection.normalized,
            phrase: selection.phrase,
            meaning: selection.meaning,
            sourcePaperId: selection.sourcePaperId,
            sourcePaperTitle: selection.sourcePaperTitle,
            sourceSectionId: selection.sourceSectionId,
            sourceSectionTitle: selection.sourceSectionTitle,
            sourcePassageId: selection.sourcePassageId,
            sourcePassageLabel: selection.sourcePassageLabel,
            sourceContext: selection.sourceContext,
            matchedCollocation: selection.matchedCollocation,
            matchedCategory: selection.matchedCategory,
            createdAt: new Date().toISOString(),
          }),
        })),
      deleteWord: (word) =>
        set((state) => ({
          savedWords: removeSavedWord(state.savedWords, word),
        })),
      deletePhrase: (key) =>
        set((state) => ({
          savedPhrases: removeSavedPhrase(state.savedPhrases, key),
        })),
      updateWordMeaning: (word, meaning) =>
        set((state) => ({
          savedWords: updateSavedWordMeaning(
            state.savedWords,
            word,
            meaning.trim() || MISSING_MEANING_PLACEHOLDER,
          ),
        })),
      updatePhrase: (key, phrase, meaning) =>
        set((state) => ({
          savedPhrases: updateSavedPhrase(state.savedPhrases, key, {
            phrase: phrase.trim(),
            meaning: meaning.trim() || MISSING_MEANING_PLACEHOLDER,
          }),
        })),
      setAnswer: (record) =>
        set((state) => ({
          answerRecords: upsertAnswerRecord(state.answerRecords, record),
        })),
      setTextResponse: (record) =>
        set((state) => ({
          textResponseRecords: upsertTextResponseRecord(state.textResponseRecords, record),
        })),
      isSaved: (word) => get().savedWords.some((savedWord) => savedWord.word === word),
    }),
    {
      name: 'transword.study',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        savedWords: state.savedWords,
        savedPhrases: state.savedPhrases,
        answerRecords: state.answerRecords,
        textResponseRecords: state.textResponseRecords,
      }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<StudyState> | undefined

        return {
          ...currentState,
          savedWords: typedState?.savedWords ?? currentState.savedWords,
          savedPhrases: typedState?.savedPhrases ?? currentState.savedPhrases,
          answerRecords: typedState?.answerRecords ?? currentState.answerRecords,
          textResponseRecords: typedState?.textResponseRecords ?? currentState.textResponseRecords,
        }
      },
    },
  ),
)
