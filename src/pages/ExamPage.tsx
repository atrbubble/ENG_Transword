import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  MousePointerClick,
} from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { PassageReader } from '@/components/PassageReader'
import { QuestionPanel } from '@/components/QuestionPanel'
import { TranslationResponsePanel, WritingResponsePanel } from '@/components/TextResponsePanel'
import { WordPopover } from '@/components/WordPopover'
import { dictionary } from '@/data/dictionary'
import { examPaperMap } from '@/data/examPapers'
import { cn } from '@/lib/utils'
import { useStudyStore } from '@/store/useStudyStore'
import type {
  ActivePhraseSelection,
  Choice,
  ExamPassage,
  ExamQuestion,
  ExamSection,
  PhraseContextSelection,
  PhraseSelection,
  WordSelection,
} from '@/types/study'
import {
  buildLookupCandidates,
  extractSentenceForPhrase,
  extractSentenceForWord,
  normalizeWord,
  sanitizeDisplayText,
} from '@/utils/text'
import { normalizePhraseKey, resolvePhraseMeaning } from '@/utils/collocations'
import { MISSING_MEANING_PLACEHOLDER } from '@/utils/study'

function buildSelection(
  rawWord: string,
  paperId: string,
  paperTitle: string,
  metadata: {
    sourceSectionId?: string
    sourceSectionTitle?: string
    sourcePassageId?: string
    sourcePassageLabel?: string
    sourceContext?: string
  } = {},
): WordSelection | null {
  const normalized = normalizeWord(rawWord)

  if (!normalized) {
    return null
  }

  const matchedWord = buildLookupCandidates(rawWord).find((candidate) => dictionary[candidate])
  const entry = (matchedWord ? dictionary[matchedWord] : undefined) ?? {
    word: normalized,
    meaning: MISSING_MEANING_PLACEHOLDER,
    source: 'fallback',
  }

  return {
    raw: rawWord,
    normalized,
    entry,
    paperId,
    paperTitle,
    sourceSectionId: metadata.sourceSectionId,
    sourceSectionTitle: metadata.sourceSectionTitle,
    sourcePassageId: metadata.sourcePassageId,
    sourcePassageLabel: metadata.sourcePassageLabel,
    sourceContext: metadata.sourceContext,
  }
}

function buildPhraseSelection(
  phrase: string,
  metadata: {
    sourcePaperId?: string
    sourcePaperTitle?: string
    sourceSectionId?: string
    sourceSectionTitle?: string
    sourcePassageId?: string
    sourcePassageLabel?: string
    sourceContext?: string
  } = {},
): PhraseSelection | null {
  const normalized = normalizePhraseKey(phrase)

  if (normalized.split(' ').filter(Boolean).length < 2) {
    return null
  }

  const matched = resolvePhraseMeaning(phrase)

  return {
    phrase: phrase.trim(),
    normalized,
    meaning: matched.meaning,
    sourcePaperId: metadata.sourcePaperId,
    sourcePaperTitle: metadata.sourcePaperTitle,
    sourceSectionId: metadata.sourceSectionId,
    sourceSectionTitle: metadata.sourceSectionTitle,
    sourcePassageId: metadata.sourcePassageId,
    sourcePassageLabel: metadata.sourcePassageLabel,
    sourceContext: metadata.sourceContext,
    matchedCollocation: matched.matchedCollocation,
    matchedCategory: matched.matchedCategory,
  }
}

interface DraftPhraseSelection extends ActivePhraseSelection {
  words: string[]
  context: string
}

function estimateQuestionHeight(question: ExamQuestion) {
  return 120 + question.options.length * 58 + Math.ceil(question.prompt.length / 48) * 24
}

function paginateItems<T>(items: T[], maxHeight: number, estimateHeight: (item: T) => number) {
  if (!items.length) {
    return []
  }

  const pages: T[][] = []
  let currentPage: T[] = []
  let currentHeight = 0

  for (const item of items) {
    const nextHeight = estimateHeight(item)

    if (currentPage.length && currentHeight + nextHeight > maxHeight) {
      pages.push(currentPage)
      currentPage = [item]
      currentHeight = nextHeight
      continue
    }

    currentPage.push(item)
    currentHeight += nextHeight
  }

  if (currentPage.length) {
    pages.push(currentPage)
  }

  return pages
}

export default function ExamPage() {
  const { paperId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const paper = examPaperMap.get(paperId)
  const savedWords = useStudyStore((state) => state.savedWords)
  const savePhrase = useStudyStore((state) => state.savePhrase)
  const answerRecords = useStudyStore((state) => state.answerRecords)
  const textResponseRecords = useStudyStore((state) => state.textResponseRecords)
  const saveWord = useStudyStore((state) => state.saveWord)
  const setAnswer = useStudyStore((state) => state.setAnswer)
  const setTextResponse = useStudyStore((state) => state.setTextResponse)
  const isSavedWord = useStudyStore((state) => state.isSaved)

  const [selection, setSelection] = useState<WordSelection | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [draggingPhrase, setDraggingPhrase] = useState<DraftPhraseSelection | null>(null)
  const [phraseSelection, setPhraseSelection] = useState<DraftPhraseSelection | null>(null)
  const [suppressNextWordClick, setSuppressNextWordClick] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState('')
  const [activePassageId, setActivePassageId] = useState('')
  const [panelPage, setPanelPage] = useState(0)
  const [leftPanelHeight, setLeftPanelHeight] = useState(900)
  const leftPanelRef = useRef<HTMLDivElement | null>(null)
  const requestedWord = normalizeWord(searchParams.get('word') ?? '')

  useEffect(() => {
    document.title = paper ? `Transword Archive | ${paper.title}` : 'Transword Archive'
  }, [paper])

  useEffect(() => {
    if (paper) {
      const requestedSectionId = searchParams.get('section')
      const requestedSection = requestedSectionId
        ? paper.sections.find((section) => section.id === requestedSectionId)
        : undefined

      setActiveSectionId(requestedSection?.id ?? paper.sections[0]?.id ?? '')
    }
  }, [paper, searchParams])

  useEffect(() => {
    if (!paper) {
      return
    }

    const section = paper.sections.find((item) => item.id === activeSectionId) ?? paper.sections[0]

    if (section?.kind === 'reading') {
      const requestedPassageId = searchParams.get('passage')
      const requestedPassage = requestedPassageId
        ? section.passages.find((passage) => passage.id === requestedPassageId)
        : undefined

      setActivePassageId(requestedPassage?.id ?? section.passages[0]?.id ?? '')
    } else {
      setActivePassageId('')
    }
  }, [activeSectionId, paper, searchParams])

  useEffect(() => {
    setPanelPage(0)
    setDraggingPhrase(null)
    setPhraseSelection(null)
  }, [activeSectionId, activePassageId])

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (!draggingPhrase) {
        return
      }

      const hasPhrase = Math.abs(draggingPhrase.endIndex - draggingPhrase.startIndex) >= 1
      setPhraseSelection(hasPhrase ? draggingPhrase : null)
      setSuppressNextWordClick(hasPhrase)
      setDraggingPhrase(null)
    }

    window.addEventListener('mouseup', handleWindowMouseUp)

    return () => window.removeEventListener('mouseup', handleWindowMouseUp)
  }, [draggingPhrase])

  useEffect(() => {
    const element = leftPanelRef.current

    if (!element) {
      return
    }

    const updateHeight = () => {
      setLeftPanelHeight(Math.max(720, Math.ceil(element.getBoundingClientRect().height)))
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)

    return () => observer.disconnect()
  }, [activePassageId, activeSectionId, paper])

  const activeSection = useMemo<ExamSection | undefined>(() => {
    if (!paper) {
      return undefined
    }

    return paper.sections.find((section) => section.id === activeSectionId) ?? paper.sections[0]
  }, [activeSectionId, paper])

  const activePassage = useMemo<ExamPassage | undefined>(() => {
    if (!activeSection || activeSection.kind !== 'reading') {
      return undefined
    }

    return activeSection.passages.find((passage) => passage.id === activePassageId) ?? activeSection.passages[0]
  }, [activePassageId, activeSection])

  const selectedMap = useMemo(() => {
    if (!paper) {
      return {}
    }

    const allQuestions = paper.sections.flatMap((section) => {
      if (section.kind === 'reading') {
        return section.passages.flatMap((passage) => passage.questions)
      }

      if (section.kind === 'cloze' || section.kind === 'new_type') {
        return section.questions
      }

      return []
    })

    return allQuestions.reduce<Record<string, Choice | undefined>>((accumulator, question) => {
      accumulator[question.id] = answerRecords.find(
        (record) => record.paperId === paper.id && record.questionId === question.id,
      )?.choice
      return accumulator
    }, {})
  }, [answerRecords, paper])

  const textResponseMap = useMemo(() => {
    if (!paper) {
      return {}
    }

    return textResponseRecords.reduce<Record<string, string>>((accumulator, record) => {
      if (record.paperId === paper.id) {
        accumulator[record.promptId] = record.value
      }

      return accumulator
    }, {})
  }, [paper, textResponseRecords])

  if (!paper) {
    return <Navigate to="/" replace />
  }

  if (!activeSection) {
    return <Navigate to="/" replace />
  }

  const activeWord = selection?.normalized ?? requestedWord
  const activePhraseSelection = draggingPhrase ?? phraseSelection
  const savedWordList = savedWords.map((word) => word.word)
  const currentSaved = selection ? isSavedWord(selection.normalized) : false
  const totalQuestionCount = paper.sections.reduce((total, section) => {
    if (section.kind === 'reading') {
      return total + section.passages.reduce((sum, passage) => sum + passage.questions.length, 0)
    }

    if (section.kind === 'cloze' || section.kind === 'new_type') {
      return total + section.questions.length
    }

    return total
  }, 0)
  const answeredCount = Object.values(selectedMap).filter(Boolean).length

  const activeChoiceQuestions =
    activeSection.kind === 'reading'
      ? (activePassage?.questions ?? [])
      : activeSection.kind === 'cloze' || activeSection.kind === 'new_type'
        ? activeSection.questions
        : []
  const compactNewTypeOptions =
    activeSection.kind === 'new_type' &&
    (activeSection.subtype === '排序' || activeSection.subtype === '七选五')

  const sectionAnsweredCount =
    activeSection.kind === 'reading'
      ? activeSection.passages.reduce(
          (total, passage) =>
            total + passage.questions.filter((question) => selectedMap[question.id]).length,
          0,
        )
      : activeSection.kind === 'cloze' || activeSection.kind === 'new_type'
        ? activeSection.questions.filter((question) => selectedMap[question.id]).length
        : activeSection.kind === 'translation'
          ? activeSection.prompts.filter((prompt) => textResponseMap[prompt.id]?.trim()).length
          : activeSection.tasks.filter((task) => textResponseMap[task.id]?.trim()).length

  const sectionTotalCount =
    activeSection.kind === 'reading'
      ? activeSection.passages.reduce((total, passage) => total + passage.questions.length, 0)
      : activeSection.kind === 'cloze' || activeSection.kind === 'new_type'
        ? activeSection.questions.length
        : activeSection.kind === 'translation'
          ? activeSection.prompts.length
          : activeSection.tasks.length

  const panelContentMaxHeight = Math.max(380, leftPanelHeight - 240)

  const choicePages = paginateItems(activeChoiceQuestions, panelContentMaxHeight, estimateQuestionHeight)
  const translationPages =
    activeSection.kind === 'translation'
      ? paginateItems(activeSection.prompts, panelContentMaxHeight, () => 320)
      : []
  const writingPages =
    activeSection.kind === 'writing'
      ? paginateItems(activeSection.tasks, panelContentMaxHeight, () => 440)
      : []

  const totalPages =
    activeSection.kind === 'translation'
      ? translationPages.length
      : activeSection.kind === 'writing'
        ? writingPages.length
        : Math.max(choicePages.length, 1)

  const currentChoicePage =
    choicePages[Math.min(panelPage, Math.max(choicePages.length - 1, 0))] ?? []
  const currentTranslationPage =
    translationPages[Math.min(panelPage, Math.max(translationPages.length - 1, 0))] ?? []
  const currentWritingPage =
    writingPages[Math.min(panelPage, Math.max(writingPages.length - 1, 0))] ?? []

  const getPhraseText = (draft: DraftPhraseSelection) =>
    draft.words
      .slice(Math.min(draft.startIndex, draft.endIndex), Math.max(draft.startIndex, draft.endIndex) + 1)
      .join(' ')

  const handlePhraseDragStart = (
    payload: PhraseContextSelection,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) {
      return
    }

    setSelection(null)
    setPopoverPosition(null)
    setDraggingPhrase({
      scopeId: payload.scopeId,
      startIndex: payload.wordIndex,
      endIndex: payload.wordIndex,
      words: payload.words,
      context: payload.context,
    })
  }

  const handlePhraseDragEnter = (payload: PhraseContextSelection) => {
    setDraggingPhrase((current) => {
      if (!current || current.scopeId !== payload.scopeId) {
        return current
      }

      return {
        ...current,
        endIndex: payload.wordIndex,
      }
    })
  }

  const handlePhraseContextMenu = (
    payload: PhraseContextSelection,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const currentSelection =
      activePhraseSelection?.scopeId === payload.scopeId ? activePhraseSelection : phraseSelection

    if (!currentSelection) {
      return
    }

    const phraseText = getPhraseText(currentSelection)
    const nextPhrase = buildPhraseSelection(phraseText, {
      sourcePaperId: paper.id,
      sourcePaperTitle: `${paper.title} ${activeSection.title}${activePassage ? ` ${activePassage.label.toUpperCase()}` : ''}`,
      sourceSectionId: activeSection.id,
      sourceSectionTitle: activeSection.title,
      sourcePassageId: activePassage?.id,
      sourcePassageLabel: activePassage?.label,
      sourceContext: extractSentenceForPhrase(currentSelection.context, phraseText),
    })

    if (!nextPhrase) {
      return
    }

    savePhrase(nextPhrase)
    setPhraseSelection(currentSelection)
    setDraggingPhrase(null)
    setSuppressNextWordClick(false)
  }

  const handleWordClick = (
    rawWord: string,
    event: React.MouseEvent<HTMLButtonElement>,
    context?: string,
  ) => {
    if (suppressNextWordClick) {
      setSuppressNextWordClick(false)
      return
    }

    event.stopPropagation()
    setPhraseSelection(null)
    const nextSelection = buildSelection(
      rawWord,
      paper.id,
      `${paper.title} ${activeSection.title}${activePassage ? ` ${activePassage.label.toUpperCase()}` : ''}`,
      {
        sourceSectionId: activeSection.id,
        sourceSectionTitle: activeSection.title,
        sourcePassageId: activePassage?.id,
        sourcePassageLabel: activePassage?.label,
        sourceContext: context ? extractSentenceForWord(context, rawWord) : undefined,
      },
    )

    if (!nextSelection) {
      return
    }

    setSelection(nextSelection)
    setPopoverPosition({
      x: event.currentTarget.getBoundingClientRect().left,
      y: event.currentTarget.getBoundingClientRect().bottom + 12,
    })
  }

  const handleWordContextMenu = (
    rawWord: string,
    event: React.MouseEvent<HTMLButtonElement>,
    context?: string,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const nextSelection = buildSelection(
      rawWord,
      paper.id,
      `${paper.title} ${activeSection.title}${activePassage ? ` ${activePassage.label.toUpperCase()}` : ''}`,
      {
        sourceSectionId: activeSection.id,
        sourceSectionTitle: activeSection.title,
        sourcePassageId: activePassage?.id,
        sourcePassageLabel: activePassage?.label,
        sourceContext: context ? extractSentenceForWord(context, rawWord) : undefined,
      },
    )

    if (!nextSelection) {
      return
    }

    saveWord(nextSelection)
    setPhraseSelection(null)
    setSelection(nextSelection)
    setPopoverPosition({
      x: event.currentTarget.getBoundingClientRect().left,
      y: event.currentTarget.getBoundingClientRect().bottom + 12,
    })
  }

  const handleSaveWord = () => {
    if (!selection) {
      return
    }

    saveWord(selection)
  }

  return (
    <AppShell>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_400px]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-stone-900/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(57,48,28,0.08)]">
            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-stone-50 px-4 py-2 transition hover:border-[#21352b]/30 hover:text-[#21352b]"
              >
                <ArrowLeft className="h-4 w-4" />
                返回真题
              </Link>
              <span className="rounded-full bg-[#f6f0e2] px-4 py-2 text-[#21352b]">
                {paper.year} 真题
              </span>
              <span>{activeSection.title}</span>
            </div>

            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#a4955f]">Full Paper Archive</p>
                <h1 className="mt-2 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-4xl text-[#21352b]">
                  {paper.title}
                </h1>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="rounded-2xl bg-[#21352b] px-4 py-3 text-[#f8f3e8]">
                  {paper.duration}
                </div>
                <div className="rounded-2xl bg-stone-100 px-4 py-3 text-stone-600">
                  {paper.sections.length} 个版块 / {totalQuestionCount} 道选择题
                </div>
              </div>
            </div>
          </div>

          <article
            ref={leftPanelRef}
            className="relative overflow-hidden rounded-[32px] border border-stone-900/10 bg-white/82 p-8 shadow-[0_30px_90px_rgba(57,48,28,0.08)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.6),_rgba(247,241,228,0.3))]" />
            <div className="relative">
              <div className="mb-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-stone-400">
                <span>Paper Reader</span>
                <span className="h-px w-12 bg-stone-200" />
                <span>{activeSection.title}</span>
                {activePassage ? (
                  <>
                    <span className="h-px w-12 bg-stone-200" />
                    <span>{activePassage.label.toUpperCase()}</span>
                  </>
                ) : null}
                {activeSection.kind !== 'writing' ? <span className="h-px w-12 bg-stone-200" /> : null}
                <span>点击单词查义 / 拖选词组右键收藏</span>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                {paper.sections.map((section) => {
                  const active = section.id === activeSection.id
                  const currentAnswered =
                    section.kind === 'reading'
                      ? section.passages.reduce(
                          (total, passage) =>
                            total +
                            passage.questions.filter((question) => selectedMap[question.id]).length,
                          0,
                        )
                      : section.kind === 'cloze' || section.kind === 'new_type'
                        ? section.questions.filter((question) => selectedMap[question.id]).length
                        : section.kind === 'translation'
                          ? section.prompts.filter((prompt) => textResponseMap[prompt.id]?.trim()).length
                          : section.tasks.filter((task) => textResponseMap[task.id]?.trim()).length
                  const currentTotal =
                    section.kind === 'reading'
                      ? section.passages.reduce((total, passage) => total + passage.questions.length, 0)
                      : section.kind === 'cloze' || section.kind === 'new_type'
                        ? section.questions.length
                        : section.kind === 'translation'
                          ? section.prompts.length
                          : section.tasks.length

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSectionId(section.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? 'border-[#21352b] bg-[#21352b] text-[#f8f3e8]'
                          : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-[#21352b]/30 hover:text-[#21352b]'
                      }`}
                    >
                      {section.shortTitle} · {currentAnswered}/{currentTotal}
                    </button>
                  )
                })}
              </div>

              <div className="mb-8 rounded-[24px] border border-[#21352b]/10 bg-[#f6f0e2] px-5 py-4 text-sm text-stone-700">
                <p className="font-medium text-[#21352b]">
                  {activeSection.kind === 'reading' && activePassage ? activePassage.title : activeSection.title}
                  {activeSection.kind === 'new_type' ? ` · ${activeSection.subtype}` : ''}
                </p>
                <p className="mt-1 text-stone-600">
                  {sanitizeDisplayText(activeSection.instructions)}
                </p>
              </div>

              {activeSection.kind === 'reading' && activePassage ? (
                <>
                  <div className="mb-6 flex flex-wrap gap-3">
                    {activeSection.passages.map((passage) => {
                      const active = passage.id === activePassage.id
                      const currentAnswered = passage.questions.filter(
                        (question) => selectedMap[question.id],
                      ).length

                      return (
                        <button
                          key={passage.id}
                          type="button"
                          onClick={() => setActivePassageId(passage.id)}
                          className={cn(
                            'rounded-full border px-4 py-2 text-sm transition',
                            active
                              ? 'border-[#21352b] bg-[#21352b] text-[#f8f3e8]'
                              : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-[#21352b]/30 hover:text-[#21352b]',
                          )}
                        >
                          {passage.label.toUpperCase()} · {currentAnswered}/{passage.questions.length}
                        </button>
                      )
                    })}
                  </div>
                  <PassageReader
                    paragraphs={activePassage.paragraphs}
                    activeWord={activeWord}
                    savedWords={savedWordList}
                    onWordClick={handleWordClick}
                    onWordContextMenu={handleWordContextMenu}
                    activePhraseSelection={activePhraseSelection}
                    onPhraseDragStart={handlePhraseDragStart}
                    onPhraseDragEnter={handlePhraseDragEnter}
                    onPhraseContextMenu={handlePhraseContextMenu}
                  />
                </>
              ) : null}

              {activeSection.kind === 'cloze' ? (
                <PassageReader
                  paragraphs={activeSection.paragraphs}
                  blankNumbers={activeSection.questions.map((question) => question.number)}
                  activeWord={activeWord}
                  savedWords={savedWordList}
                  onWordClick={handleWordClick}
                  onWordContextMenu={handleWordContextMenu}
                  activePhraseSelection={activePhraseSelection}
                  onPhraseDragStart={handlePhraseDragStart}
                  onPhraseDragEnter={handlePhraseDragEnter}
                  onPhraseContextMenu={handlePhraseContextMenu}
                />
              ) : null}

              {activeSection.kind === 'new_type' ? (
                <div className="space-y-8">
                  {activeSection.leadParagraphs.length ? (
                    <PassageReader
                      paragraphs={activeSection.leadParagraphs}
                      activeWord={activeWord}
                      savedWords={savedWordList}
                      onWordClick={handleWordClick}
                      onWordContextMenu={handleWordContextMenu}
                      activePhraseSelection={activePhraseSelection}
                      onPhraseDragStart={handlePhraseDragStart}
                      onPhraseDragEnter={handlePhraseDragEnter}
                      onPhraseContextMenu={handlePhraseContextMenu}
                    />
                  ) : null}

                  {activeSection.optionItems.length ? (
                    <div className="rounded-[24px] border border-stone-200 bg-white/80 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-medium text-[#21352b]">
                          {activeSection.subtype === '排序' ? '候选段落' : '候选项列表'}
                        </p>
                        <span className="rounded-full bg-[#f6f0e2] px-3 py-1 text-xs text-[#21352b]">
                          {activeSection.subtype}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {activeSection.optionItems.map((item) => (
                          <div
                            key={item.key}
                            className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3"
                          >
                            <p className="mb-2 text-sm font-semibold text-[#21352b]">{item.key}</p>
                            <PassageReader
                              paragraphs={[item.text]}
                              activeWord={activeWord}
                              savedWords={savedWordList}
                              onWordClick={handleWordClick}
                              onWordContextMenu={handleWordContextMenu}
                              activePhraseSelection={activePhraseSelection}
                              onPhraseDragStart={handlePhraseDragStart}
                              onPhraseDragEnter={handlePhraseDragEnter}
                              onPhraseContextMenu={handlePhraseContextMenu}
                              showLineNumbers={false}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeSection.fixedLayout?.length ? (
                    <div className="rounded-[24px] border border-dashed border-[#a4955f]/50 bg-[#fbf7ee] p-5 text-sm leading-7 text-stone-600">
                      {activeSection.fixedLayout.map((line, index) => (
                        <p key={`${activeSection.id}-${index}`}>{sanitizeDisplayText(line)}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeSection.kind === 'translation' ? (
                <PassageReader
                  paragraphs={activeSection.paragraphs}
                  activeWord={activeWord}
                  savedWords={savedWordList}
                  onWordClick={handleWordClick}
                  onWordContextMenu={handleWordContextMenu}
                  activePhraseSelection={activePhraseSelection}
                  onPhraseDragStart={handlePhraseDragStart}
                  onPhraseDragEnter={handlePhraseDragEnter}
                  onPhraseContextMenu={handlePhraseContextMenu}
                  underlineTranslationTargets={true}
                />
              ) : null}

              {activeSection.kind === 'writing' ? (
                <div className="space-y-5">
                  {activeSection.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-5"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <span className="rounded-full bg-[#21352b] px-3 py-1 text-xs uppercase text-[#f8f3e8]">
                          {task.title}
                        </span>
                        <span className="text-sm text-stone-500">题号 {task.number}</span>
                      </div>
                      <p className="text-sm leading-7 text-stone-700">
                        {sanitizeDisplayText(task.prompt)}
                      </p>
                      <div className="mt-3 space-y-1 text-sm leading-7 text-stone-600">
                        {task.instructions.map((line, index) => (
                          <p key={`${task.id}-${index}`}>{sanitizeDisplayText(line)}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-stone-900/10 bg-[#21352b] p-6 text-[#f6edd7] shadow-[0_30px_90px_rgba(33,53,43,0.18)]">
            <div className="flex items-center gap-3">
              <MousePointerClick className="h-5 w-5 text-[#d8c78f]" />
              <h2 className="text-lg font-medium">本页可用交互</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#eadfbe]">
              <p>1. 左侧正文里点击单词，立即显示中文意思。</p>
              <p>2. 在目标单词上右键，可快速加入生词本。</p>
              <p>3. 右侧每道题题号前都能直接选 A/B/C/D。</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-900/10 bg-white/82 p-6 shadow-[0_24px_80px_rgba(57,48,28,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#a4955f]">答题区域</p>
                <h2 className="mt-2 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-3xl text-[#21352b]">
                  {activeSection.kind === 'reading' && activePassage
                    ? `${activePassage.label.toUpperCase()} 选择答案`
                    : activeSection.kind === 'translation'
                      ? '翻译作答'
                      : activeSection.kind === 'writing'
                        ? '作文草稿'
                        : `${activeSection.title} 作答`}
                </h2>
              </div>
              <CircleHelp className="h-6 w-6 text-[#21352b]" />
            </div>

            <div className="mb-4 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
              已完成 {answeredCount}/{totalQuestionCount} 道选择题，当前版块完成 {sectionAnsweredCount}/
              {sectionTotalCount}
            </div>

            <div
              className="overflow-y-auto pr-2"
              style={{
                maxHeight: `${panelContentMaxHeight}px`,
              }}
            >
              {activeSection.kind === 'translation' ? (
                <TranslationResponsePanel
                  prompts={currentTranslationPage}
                  values={textResponseMap}
                  onChange={(promptId, value) =>
                    setTextResponse({
                      paperId: paper.id,
                      promptId,
                      value,
                    })
                  }
                />
              ) : null}

              {activeSection.kind === 'writing' ? (
                <WritingResponsePanel
                  tasks={currentWritingPage}
                  values={textResponseMap}
                  onChange={(taskId, value) =>
                    setTextResponse({
                      paperId: paper.id,
                      promptId: taskId,
                      value,
                    })
                  }
                />
              ) : null}

              {activeSection.kind !== 'translation' && activeSection.kind !== 'writing' ? (
                <QuestionPanel
                  questions={currentChoicePage}
                  selectedMap={selectedMap}
                  compactOptions={compactNewTypeOptions}
                  activeWord={activeWord}
                  savedWords={savedWordList}
                  onWordClick={handleWordClick}
                  onWordContextMenu={handleWordContextMenu}
                  activePhraseSelection={activePhraseSelection}
                  onPhraseDragStart={handlePhraseDragStart}
                  onPhraseDragEnter={handlePhraseDragEnter}
                  onPhraseContextMenu={handlePhraseContextMenu}
                  onSelect={(questionId, choice) =>
                    setAnswer({
                      paperId: paper.id,
                      questionId,
                      choice,
                    })
                  }
                />
              ) : null}
            </div>

            {totalPages > 1 ? (
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-stone-600">
                <button
                  type="button"
                  onClick={() => setPanelPage((current) => Math.max(current - 1, 0))}
                  disabled={panelPage === 0}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </button>
                <span>
                  第 {Math.min(panelPage + 1, totalPages)} / {totalPages} 页
                </span>
                <button
                  type="button"
                  onClick={() => setPanelPage((current) => Math.min(current + 1, totalPages - 1))}
                  disabled={panelPage >= totalPages - 1}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          <Link
            to="/vocabulary"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[24px] border border-[#21352b]/15 bg-[#f6f0e2] px-5 py-4 text-sm text-[#21352b] transition hover:border-[#21352b]/30 hover:bg-[#efe2c1]"
          >
            <BookMarked className="h-4 w-4" />
            查看生词本
          </Link>
        </aside>
      </section>

      <WordPopover
        selection={selection}
        position={popoverPosition}
        isSaved={currentSaved}
        onSave={handleSaveWord}
        onClose={() => setSelection(null)}
      />
    </AppShell>
  )
}
