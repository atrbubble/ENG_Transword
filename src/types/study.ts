export type Choice = string

export type ExamSectionKind = 'cloze' | 'reading' | 'new_type' | 'translation' | 'writing'

export type NewTypeSubtype = '七选五' | '排序' | '小标题'

export interface ExamQuestionOption {
  key: Choice
  text: string
}

export interface ExamQuestion {
  id: string
  number: number
  prompt: string
  options: ExamQuestionOption[]
}

export interface ExamTextResponse {
  id: string
  number: number
  prompt: string
  placeholder?: string
}

export interface ExamPassage {
  id: string
  label: string
  title: string
  paragraphs: string[]
  questions: ExamQuestion[]
}

export interface ExamNewTypeOption {
  key: string
  text: string
}

export interface ExamWritingTask {
  id: string
  number: number
  title: string
  prompt: string
  instructions: string[]
}

export interface BaseExamSection {
  id: string
  kind: ExamSectionKind
  title: string
  shortTitle: string
  instructions: string
}

export interface ClozeSection extends BaseExamSection {
  kind: 'cloze'
  paragraphs: string[]
  questions: ExamQuestion[]
}

export interface ReadingSection extends BaseExamSection {
  kind: 'reading'
  passages: ExamPassage[]
}

export interface NewTypeSection extends BaseExamSection {
  kind: 'new_type'
  subtype: NewTypeSubtype
  leadParagraphs: string[]
  optionItems: ExamNewTypeOption[]
  fixedLayout?: string[]
  questions: ExamQuestion[]
}

export interface TranslationSection extends BaseExamSection {
  kind: 'translation'
  paragraphs: string[]
  prompts: ExamTextResponse[]
}

export interface WritingSection extends BaseExamSection {
  kind: 'writing'
  tasks: ExamWritingTask[]
}

export type ExamSection =
  | ClozeSection
  | ReadingSection
  | NewTypeSection
  | TranslationSection
  | WritingSection

export interface ExamPaper {
  id: string
  year: string
  title: string
  duration: string
  sections: ExamSection[]
}

export interface DictionaryEntry {
  word: string
  phonetic?: string
  partOfSpeech?: string
  meaning: string
  source?: string
}

export interface SavedWord {
  word: string
  matchedWord?: string
  meaning: string
  phonetic?: string
  partOfSpeech?: string
  sourcePaperId: string
  sourcePaperTitle: string
  sourceSectionId?: string
  sourceSectionTitle?: string
  sourcePassageId?: string
  sourcePassageLabel?: string
  sourceContext?: string
  createdAt: string
}

export interface SavedPhrase {
  key: string
  phrase: string
  meaning: string
  sourcePaperId?: string
  sourcePaperTitle?: string
  sourceSectionId?: string
  sourceSectionTitle?: string
  sourcePassageId?: string
  sourcePassageLabel?: string
  sourceContext?: string
  matchedCollocation?: string
  matchedCategory?: string
  createdAt: string
}

export interface AnswerRecord {
  paperId: string
  questionId: string
  choice: Choice
}

export interface TextResponseRecord {
  paperId: string
  promptId: string
  value: string
}

export interface WordSelection {
  raw: string
  normalized: string
  entry: DictionaryEntry
  matchedWord?: string
  paperId: string
  paperTitle: string
  sourceSectionId?: string
  sourceSectionTitle?: string
  sourcePassageId?: string
  sourcePassageLabel?: string
  sourceContext?: string
}

export interface PhraseSelection {
  phrase: string
  normalized: string
  meaning: string
  sourcePaperId?: string
  sourcePaperTitle?: string
  sourceSectionId?: string
  sourceSectionTitle?: string
  sourcePassageId?: string
  sourcePassageLabel?: string
  sourceContext?: string
  matchedCollocation?: string
  matchedCategory?: string
}

export interface PhraseContextSelection {
  scopeId: string
  wordIndex: number
  words: string[]
  context: string
}

export interface ActivePhraseSelection {
  scopeId: string
  startIndex: number
  endIndex: number
}
