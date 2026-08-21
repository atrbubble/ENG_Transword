import { ArrowRight, BookCheck, BookMarked, Download, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { useStudyStore } from '@/store/useStudyStore'
import type { AnswerRecord, SavedPhrase, SavedWord, TextResponseRecord } from '@/types/study'
import { normalizePhraseKey, resolvePhraseMeaning } from '@/utils/collocations'
import { normalizeWord, shouldAppendSpace, tokenizeParagraph } from '@/utils/text'
import { MISSING_MEANING_PLACEHOLDER } from '@/utils/study'

type NotebookMode = 'words' | 'phrases'

function markTargetWordInContext(context: string, targetWord: string) {
  const tokens = tokenizeParagraph(context)
  const targetNormalized = normalizeWord(targetWord)

  return tokens
    .map((token, index) => {
      const spacing = shouldAppendSpace(token.value, tokens[index + 1]?.value) ? ' ' : ''
      const isTarget = token.isWord && token.normalized && token.normalized === targetNormalized
      const value = isTarget
        ? `<mark style="background: #FFB8EBA6;">${token.value}</mark>`
        : token.value

      return `${value}${spacing}`
    })
    .join('')
}

function downloadVocabularyMd(words: ReturnType<typeof useStudyStore.getState>['savedWords']) {
  if (!words.length) {
    return
  }

  const content = words
    .map((word, index) => {
      const lines: string[] = [`## ${word.word}`, '']

      const details: string[] = []

      if (word.phonetic) {
        details.push(`音标：${word.phonetic}`)
      }

      if (word.partOfSpeech) {
        details.push(`词性：${word.partOfSpeech}`)
      }

      details.push(`释义：${word.meaning}`)

      lines.push(`- ${details.join('\n- ')}`, '', `来源：${word.sourcePaperTitle}`, '')

      if (word.sourceContext) {
        lines.push(`> ${markTargetWordInContext(word.sourceContext, word.word)}`, '')
      }

      if (index < words.length - 1) {
        lines.push('---', '')
      }

      return lines.join('\n')
    })
    .join('\n')

  const blob = new Blob([`# 生词列表\n\n${content}`], {
    type: 'text/markdown;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateLabel = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `transword-vocabulary-${dateLabel}.md`

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function buildReviewLink(
  item: Pick<
    SavedWord | SavedPhrase,
    'sourcePaperId' | 'sourceSectionId' | 'sourcePassageId'
  > &
    Partial<Pick<SavedWord, 'word'>>,
) {
  if (!item.sourcePaperId) {
    return null
  }

  const params = new URLSearchParams()

  if ('word' in item && item.word) {
    params.set('word', item.word)
  }

  if (item.sourceSectionId) {
    params.set('section', item.sourceSectionId)
  }

  if (item.sourcePassageId) {
    params.set('passage', item.sourcePassageId)
  }

  const query = params.toString()

  return `/exam/${item.sourcePaperId}${query ? `?${query}` : ''}`
}

function HighlightedExampleReview({
  context,
  targetText,
}: {
  context: string
  targetText: string
}) {
  const tokens = tokenizeParagraph(context)
  const targetTokens = tokenizeParagraph(targetText)
    .filter((token) => token.isWord)
    .map((token) => token.normalized)
    .filter(Boolean)
  const contextWordEntries = tokens
    .map((token, index) => ({
      index,
      normalized: token.normalized,
      isWord: token.isWord,
    }))
    .filter((token) => token.isWord && token.normalized)

  const highlightedIndexes = new Set<number>()

  if (targetTokens.length) {
    for (let start = 0; start <= contextWordEntries.length - targetTokens.length; start += 1) {
      const matches = targetTokens.every(
        (token, offset) => contextWordEntries[start + offset]?.normalized === token,
      )

      if (matches) {
        targetTokens.forEach((_, offset) => highlightedIndexes.add(contextWordEntries[start + offset].index))
        break
      }
    }
  }

  if (!highlightedIndexes.size && targetTokens.length) {
    tokens.forEach((token, index) => {
      if (token.isWord && targetTokens.includes(token.normalized)) {
        highlightedIndexes.add(index)
      }
    })
  }

  return (
    <span>
      “
      {tokens.map((token, index) => {
        const spacing = shouldAppendSpace(token.value, tokens[index + 1]?.value) ? ' ' : ''
        const isTarget = highlightedIndexes.has(index)

        return (
          <span key={`${token.value}-${index}`}>
            {isTarget ? (
              <span className="rounded-lg bg-[#21352b] px-1.5 py-0.5 text-[#f7eed8] shadow-sm">
                {token.value}
              </span>
            ) : (
              token.value
            )}
            {spacing}
          </span>
        )
      })}
      ”
    </span>
  )
}

export default function VocabularyPage() {
  const savedWords = useStudyStore((state) => state.savedWords)
  const savedPhrases = useStudyStore((state) => state.savedPhrases)
  const savePhrase = useStudyStore((state) => state.savePhrase)
  const deleteWord = useStudyStore((state) => state.deleteWord)
  const deletePhrase = useStudyStore((state) => state.deletePhrase)
  const updateWordMeaning = useStudyStore((state) => state.updateWordMeaning)
  const updatePhrase = useStudyStore((state) => state.updatePhrase)

  const [mode, setMode] = useState<NotebookMode>('words')
  const [keyword, setKeyword] = useState('')
  const [editingWord, setEditingWord] = useState<string | null>(null)
  const [draftMeaning, setDraftMeaning] = useState('')
  const [editingPhraseKey, setEditingPhraseKey] = useState<string | null>(null)
  const [phraseMeaningDraft, setPhraseMeaningDraft] = useState('')
  const [phraseDraft, setPhraseDraft] = useState('')
  const [phraseNoteDraft, setPhraseNoteDraft] = useState('')

  useEffect(() => {
    document.title = 'Transword Archive | 生词本'
  }, [])

  const filteredWords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return savedWords
    }

    return savedWords.filter(
      (word) =>
        word.word.includes(normalizedKeyword) ||
        word.meaning.includes(normalizedKeyword) ||
        word.sourcePaperTitle.includes(keyword.trim()) ||
        word.sourceContext?.toLowerCase().includes(normalizedKeyword),
    )
  }, [keyword, savedWords])

  const filteredPhrases = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return savedPhrases
    }

    return savedPhrases.filter(
      (phrase) =>
        phrase.phrase.toLowerCase().includes(normalizedKeyword) ||
        phrase.meaning.includes(normalizedKeyword) ||
        phrase.matchedCollocation?.toLowerCase().includes(normalizedKeyword) ||
        phrase.matchedCategory?.includes(keyword.trim()) ||
        phrase.sourcePaperTitle?.includes(keyword.trim()) ||
        phrase.sourceContext?.toLowerCase().includes(normalizedKeyword),
    )
  }, [keyword, savedPhrases])

  const manualPhraseMatch = useMemo(() => resolvePhraseMeaning(phraseDraft), [phraseDraft])
  const manualPhraseKey = normalizePhraseKey(phraseDraft)

  const startEditingWordMeaning = (word: string, meaning: string) => {
    if (meaning !== MISSING_MEANING_PLACEHOLDER) {
      return
    }

    setEditingWord(word)
    setDraftMeaning('')
  }

  const finishEditingWordMeaning = () => {
    if (!editingWord) {
      return
    }

    updateWordMeaning(editingWord, draftMeaning)
    setEditingWord(null)
    setDraftMeaning('')
  }

  const cancelEditingWordMeaning = () => {
    setEditingWord(null)
    setDraftMeaning('')
  }

  const startEditingPhraseMeaning = (phrase: SavedPhrase) => {
    setEditingPhraseKey(phrase.key)
    setPhraseMeaningDraft(phrase.meaning === MISSING_MEANING_PLACEHOLDER ? '' : phrase.meaning)
  }

  const finishEditingPhraseMeaning = () => {
    if (!editingPhraseKey) {
      return
    }

    const targetPhrase = savedPhrases.find((phrase) => phrase.key === editingPhraseKey)

    if (!targetPhrase) {
      setEditingPhraseKey(null)
      setPhraseMeaningDraft('')
      return
    }

    updatePhrase(editingPhraseKey, targetPhrase.phrase, phraseMeaningDraft)
    setEditingPhraseKey(null)
    setPhraseMeaningDraft('')
  }

  const cancelEditingPhraseMeaning = () => {
    setEditingPhraseKey(null)
    setPhraseMeaningDraft('')
  }

  const handleManualPhraseSave = () => {
    if (manualPhraseKey.split(' ').filter(Boolean).length < 2) {
      return
    }

    savePhrase({
      phrase: phraseDraft.trim(),
      normalized: manualPhraseKey,
      meaning: phraseNoteDraft.trim() || manualPhraseMatch.meaning,
      matchedCollocation: manualPhraseMatch.matchedCollocation,
      matchedCategory: manualPhraseMatch.matchedCategory,
    })

    setPhraseDraft('')
    setPhraseNoteDraft('')
  }

  const handleExportBackup = () => {
    const state = useStudyStore.getState()
    const content = JSON.stringify(
      {
        savedWords: state.savedWords,
        savedPhrases: state.savedPhrases,
        answerRecords: state.answerRecords,
        textResponseRecords: state.textResponseRecords,
      },
      null,
      2,
    )

    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateLabel = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `transword-backup-${dateLabel}.json`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      event.target.value = ''

      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<{
          savedWords: SavedWord[]
          savedPhrases: SavedPhrase[]
          answerRecords: AnswerRecord[]
          textResponseRecords: TextResponseRecord[]
        }>

        if (!Array.isArray(parsed.savedWords) || !Array.isArray(parsed.savedPhrases)) {
          alert('备份文件格式不正确，请选择 transword-backup-*.json 文件。')
          return
        }

        if (!window.confirm('导入会覆盖当前的全部数据，确定继续吗？')) {
          return
        }

        useStudyStore.setState({
          savedWords: parsed.savedWords,
          savedPhrases: parsed.savedPhrases,
          answerRecords: Array.isArray(parsed.answerRecords) ? parsed.answerRecords : [],
          textResponseRecords: Array.isArray(parsed.textResponseRecords)
            ? parsed.textResponseRecords
            : [],
        })
      } catch {
        alert('读取备份文件失败，文件可能已损坏。')
      }
    }

    reader.readAsText(file)
  }

  const renderEmptyState = () => (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#21352b]/8 text-[#21352b]">
        {mode === 'words' ? <BookMarked className="h-6 w-6" /> : <BookCheck className="h-6 w-6" />}
      </div>
      <h3 className="mt-4 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-2xl text-[#21352b]">
        {mode === 'words'
          ? savedWords.length
            ? '没有匹配到搜索结果'
            : '生词本还是空的'
          : savedPhrases.length
            ? '没有匹配到词组搜索结果'
            : '词组本还是空的'}
      </h3>
      <p className="mt-3 text-sm leading-7 text-stone-500">
        {mode === 'words'
          ? savedWords.length
            ? '换个关键词试试，或者回到阅读页继续点词积累。'
            : '回到真题阅读页，点击单词看释义，再右键加入生词本。'
          : savedPhrases.length
            ? '换个关键词试试，或者继续手动录入你的固定搭配。'
            : '在做题页按住左键拖过多个单词，再右键即可加入词组本。'}
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#21352b] px-5 py-3 text-sm text-[#f8f3e8] transition hover:bg-[#2b4739]"
      >
        <BookCheck className="h-4 w-4" />
        去做一套真题
      </Link>
    </div>
  )

  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[32px] border border-stone-900/10 bg-[#21352b] p-8 text-[#f6edd7] shadow-[0_30px_90px_rgba(33,53,43,0.18)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[#d8c78f]">Vocabulary Archive</p>
          <h1 className="mt-4 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-4xl leading-tight">
            这里不止有单词，
            <br />
            现在也能沉淀整段词组。
          </h1>
          <p className="mt-6 text-sm leading-8 text-[#eadfbe]">
            单词本负责积累词义，词组本负责沉淀固定搭配和你自己圈出来的重要表达。做题时拖选多个单词再右键，就能直接进入词组本。
          </p>

          <div className="mt-8 grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#d8c78f]">单词收藏</p>
              <p className="mt-2 text-3xl">{savedWords.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#d8c78f]">词组收藏</p>
              <p className="mt-2 text-3xl">{savedPhrases.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#d8c78f]">推荐动作</p>
              <p className="mt-2 text-sm leading-7">词组本会优先用固定搭配库自动匹配释义，你也可以手动补充自己的注释。</p>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[#d8c78f]">数据备份</p>
            <p className="mt-2 text-xs leading-6 text-[#eadfbe]">
              生词、词组、答题记录都存在浏览器本地。定期导出备份，换电脑或清理浏览器后也能一键找回。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#f6edd7] transition hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
                导出备份
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-[#f6edd7] transition hover:bg-white/20">
                <Upload className="h-4 w-4" />
                导入备份
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-stone-900/10 bg-white/82 p-8 shadow-[0_24px_80px_rgba(57,48,28,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setMode('words')}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    mode === 'words'
                      ? 'border-[#21352b] bg-[#21352b] text-[#f8f3e8]'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-[#21352b]/30 hover:text-[#21352b]'
                  }`}
                >
                  单词本
                </button>
                <button
                  type="button"
                  onClick={() => setMode('phrases')}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    mode === 'phrases'
                      ? 'border-[#21352b] bg-[#21352b] text-[#f8f3e8]'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-[#21352b]/30 hover:text-[#21352b]'
                  }`}
                >
                  词组本
                </button>
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.24em] text-[#a4955f]">
                {mode === 'words' ? 'Saved Words' : 'Saved Phrases'}
              </p>
              <h2 className="mt-2 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-3xl text-[#21352b]">
                {mode === 'words' ? '生词列表' : '词组列表'}
              </h2>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              {mode === 'words' ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => downloadVocabularyMd(savedWords)}
                    disabled={!savedWords.length}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-3 text-sm text-stone-600 transition hover:border-[#21352b]/30 hover:text-[#21352b] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Download className="h-4 w-4" />
                    导出 Markdown
                  </button>
                </div>
              ) : null}

              <label className="flex items-center gap-3 rounded-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500 md:min-w-[280px]">
                <Search className="h-4 w-4" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  className="w-full bg-transparent outline-none placeholder:text-stone-400"
                  placeholder={mode === 'words' ? '按单词、释义或真题来源搜索' : '按词组、释义或来源搜索'}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {mode === 'phrases' ? (
              <div className="rounded-[24px] border border-stone-200 bg-[#fbf8f1] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#21352b]">手动加入词组</p>
                    <p className="mt-1 text-xs leading-6 text-stone-500">
                      这里可以自定义写入词组和注释；如果和固定搭配库命中两个及以上单词，会自动带出注释。
                    </p>
                  </div>
                  {manualPhraseMatch.matchedCollocation ? (
                    <span className="rounded-full bg-[#21352b]/8 px-3 py-1 text-xs text-[#21352b]">
                      自动匹配：{manualPhraseMatch.matchedCollocation}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3">
                  <input
                    value={phraseDraft}
                    onChange={(event) => setPhraseDraft(event.target.value)}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-[#21352b]/35"
                    placeholder="输入你的词组，比如 keep an eye out for"
                  />
                  <textarea
                    value={phraseNoteDraft}
                    onChange={(event) => setPhraseNoteDraft(event.target.value)}
                    rows={3}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-7 text-stone-700 outline-none transition focus:border-[#21352b]/35"
                    placeholder={
                      manualPhraseMatch.matchedCollocation
                        ? `留空将自动使用：${manualPhraseMatch.meaning}`
                        : '输入你的自定义注释，留空则尝试自动匹配固定搭配库'
                    }
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-stone-500">
                      {manualPhraseKey.split(' ').filter(Boolean).length >= 2
                        ? '满足两个及以上单词，可保存到词组本。'
                        : '词组至少需要两个英文单词。'}
                    </p>
                    <button
                      type="button"
                      onClick={handleManualPhraseSave}
                      disabled={manualPhraseKey.split(' ').filter(Boolean).length < 2}
                      className="rounded-full bg-[#21352b] px-5 py-2 text-sm text-[#f8f3e8] transition hover:bg-[#2b4739] disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      保存词组
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {mode === 'words' ? (
              filteredWords.length ? (
                filteredWords.map((word) => {
                  const reviewLink = buildReviewLink(word)

                  return (
                    <article
                      key={word.word}
                      className="rounded-[24px] border border-stone-200 bg-[#fbf8f1] p-5 transition hover:border-[#21352b]/20 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-3xl text-[#21352b]">
                              {word.word}
                            </p>
                            {word.partOfSpeech ? (
                              <span className="rounded-full bg-[#21352b]/8 px-3 py-1 text-xs text-[#21352b]">
                                {word.partOfSpeech}
                              </span>
                            ) : null}
                          </div>
                          {editingWord === word.word ? (
                            <div className="space-y-2">
                              <textarea
                                value={draftMeaning}
                                onChange={(event) => setDraftMeaning(event.target.value)}
                                onBlur={finishEditingWordMeaning}
                                onKeyDown={(event) => {
                                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                                    event.preventDefault()
                                    finishEditingWordMeaning()
                                  }

                                  if (event.key === 'Escape') {
                                    event.preventDefault()
                                    cancelEditingWordMeaning()
                                  }
                                }}
                                autoFocus
                                rows={3}
                                className="w-full rounded-2xl border border-[#21352b]/20 bg-white px-4 py-3 text-sm leading-7 text-stone-700 outline-none transition focus:border-[#21352b]/45"
                                placeholder="双击后从空白开始输入你的注释"
                              />
                              <p className="text-xs text-stone-400">失焦保存，`Ctrl+Enter` 也可保存，`Esc` 取消。</p>
                            </div>
                          ) : (
                            <p
                              className="text-sm leading-7 text-stone-700"
                              onDoubleClick={() => startEditingWordMeaning(word.word, word.meaning)}
                            >
                              {word.meaning}
                              {word.meaning === MISSING_MEANING_PLACEHOLDER ? (
                                <span className="ml-2 text-xs text-[#a4955f]">双击可手动补充注释</span>
                              ) : null}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                            <span className="rounded-full bg-white px-3 py-2">{word.sourcePaperTitle}</span>
                          </div>
                          {word.sourceContext ? (
                            <div className="rounded-[20px] border border-stone-200/90 bg-white/75 px-4 py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-[#a4955f]">
                                  Example Review
                                </p>
                                {reviewLink ? (
                                  <Link
                                    to={reviewLink}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-[#21352b] transition hover:text-[#3f5b4b]"
                                  >
                                    回到原文
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Link>
                                ) : null}
                              </div>
                              <p className="mt-3 text-sm leading-7 text-stone-700">
                                <HighlightedExampleReview context={word.sourceContext} targetText={word.word} />
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteWord(word.word)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-red-300 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                          移除
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                renderEmptyState()
              )
            ) : filteredPhrases.length ? (
              filteredPhrases.map((phrase) => {
                const reviewLink = buildReviewLink(phrase)
                const isEditingMeaning = editingPhraseKey === phrase.key

                return (
                  <article
                    key={phrase.key}
                    className="rounded-[24px] border border-stone-200 bg-[#fbf8f1] p-5 transition hover:border-[#21352b]/20 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-3xl text-[#21352b]">
                            {phrase.phrase}
                          </p>
                          <span className="rounded-full bg-[#21352b]/8 px-3 py-1 text-xs text-[#21352b]">
                            词组
                          </span>
                          {phrase.matchedCategory ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-500">
                              {phrase.matchedCategory}
                            </span>
                          ) : null}
                        </div>

                        {isEditingMeaning ? (
                          <div className="space-y-2">
                            <textarea
                              value={phraseMeaningDraft}
                              onChange={(event) => setPhraseMeaningDraft(event.target.value)}
                              onBlur={finishEditingPhraseMeaning}
                              onKeyDown={(event) => {
                                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                                  event.preventDefault()
                                  finishEditingPhraseMeaning()
                                }

                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  cancelEditingPhraseMeaning()
                                }
                              }}
                              autoFocus
                              rows={3}
                              className="w-full rounded-2xl border border-[#21352b]/20 bg-white px-4 py-3 text-sm leading-7 text-stone-700 outline-none transition focus:border-[#21352b]/45"
                              placeholder="输入你自己的词组注释"
                            />
                            <p className="text-xs text-stone-400">失焦保存，`Ctrl+Enter` 也可保存，`Esc` 取消。</p>
                          </div>
                        ) : (
                          <p
                            className="text-sm leading-7 text-stone-700"
                            onDoubleClick={() => startEditingPhraseMeaning(phrase)}
                          >
                            {phrase.meaning}
                            <span className="ml-2 text-xs text-[#a4955f]">双击可修改词组注释</span>
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                          {phrase.sourcePaperTitle ? (
                            <span className="rounded-full bg-white px-3 py-2">{phrase.sourcePaperTitle}</span>
                          ) : (
                            <span className="rounded-full bg-white px-3 py-2">手动录入</span>
                          )}
                          {phrase.matchedCollocation ? (
                            <span className="rounded-full bg-white px-3 py-2">
                              命中搭配：{phrase.matchedCollocation}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-white px-3 py-2">
                            收藏于 {new Date(phrase.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>

                        {phrase.sourceContext ? (
                          <div className="rounded-[20px] border border-stone-200/90 bg-white/75 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-[#a4955f]">
                                Phrase Review
                              </p>
                              {reviewLink ? (
                                <Link
                                  to={reviewLink}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-[#21352b] transition hover:text-[#3f5b4b]"
                                >
                                  回到原文
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm leading-7 text-stone-700">
                              <HighlightedExampleReview
                                context={phrase.sourceContext}
                                targetText={phrase.phrase}
                              />
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => deletePhrase(phrase.key)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-red-300 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                        移除
                      </button>
                    </div>
                  </article>
                )
              })
            ) : (
              renderEmptyState()
            )}
          </div>
        </div>
      </section>
    </AppShell>
  )
}
