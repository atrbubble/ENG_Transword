import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type {
  AnswerRecord,
  PhraseSelection,
  SavedPhrase,
  SavedWord,
  StudySettings,
  TextResponseRecord,
  WordProgress,
  WordRating,
  WordSelection,
} from '@/types/study'
import { DEFAULT_STUDY_SETTINGS, gradeProgress, markMasteredProgress, type RevealLevel } from '@/utils/spacedRepetition'
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
  wordProgress: Record<string, WordProgress>
  studySettings: StudySettings
  saveWord: (selection: WordSelection) => void
  savePhrase: (selection: PhraseSelection) => void
  deleteWord: (word: string) => void
  deletePhrase: (key: string) => void
  updateWordMeaning: (word: string, meaning: string) => void
  updatePhrase: (key: string, phrase: string, meaning: string) => void
  setAnswer: (record: AnswerRecord) => void
  setTextResponse: (record: TextResponseRecord) => void
  rateWord: (word: string, rating: WordRating, revealed: RevealLevel) => void
  markMastered: (word: string) => void
  setStudySettings: (partial: Partial<StudySettings>) => void
  isSaved: (word: string) => boolean
}

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      savedWords: [],
      savedPhrases: [],
      answerRecords: [],
      textResponseRecords: [],
      wordProgress: {},
      studySettings: DEFAULT_STUDY_SETTINGS,
      saveWord: (selection) =>
        set((state) => ({
          savedWords: upsertSavedWord(state.savedWords, {
            word: selection.normalized,
            matchedWord: selection.matchedWord,
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
      rateWord: (word, rating, revealed) =>
        set((state) => ({
          wordProgress: {
            ...state.wordProgress,
            [word]: gradeProgress(state.wordProgress[word], word, rating, revealed, new Date()),
          },
        })),
      markMastered: (word) =>
        set((state) => ({
          wordProgress: {
            ...state.wordProgress,
            [word]: markMasteredProgress(state.wordProgress[word], word, new Date()),
          },
        })),
      setStudySettings: (partial) =>
        set((state) => ({
          studySettings: { ...state.studySettings, ...partial },
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
        wordProgress: state.wordProgress,
        studySettings: state.studySettings,
      }),
      merge: (persistedState, currentState) => {
        const typedState = persistedState as Partial<StudyState> | undefined

        return {
          ...currentState,
          savedWords: typedState?.savedWords ?? currentState.savedWords,
          savedPhrases: typedState?.savedPhrases ?? currentState.savedPhrases,
          answerRecords: typedState?.answerRecords ?? currentState.answerRecords,
          textResponseRecords: typedState?.textResponseRecords ?? currentState.textResponseRecords,
          wordProgress: typedState?.wordProgress ?? currentState.wordProgress,
          studySettings: { ...currentState.studySettings, ...(typedState?.studySettings ?? {}) },
        }
      },
    },
  ),
)
