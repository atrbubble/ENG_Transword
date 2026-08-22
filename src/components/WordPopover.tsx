import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BookmarkCheck, BookmarkPlus, Languages, X } from 'lucide-react'

import type { WordSelection } from '@/types/study'

export interface PopoverAnchor {
  left: number
  top: number
  bottom: number
}

interface WordPopoverProps {
  selection: WordSelection | null
  position: PopoverAnchor | null
  isSaved: boolean
  onSave: () => void
  onClose: () => void
}

export function WordPopover({
  selection,
  position,
  isSaved,
  onSave,
  onClose,
}: WordPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [popoverSize, setPopoverSize] = useState({ width: 300, height: 0 })

  useLayoutEffect(() => {
    if (!selection || !position || !popoverRef.current) {
      return
    }

    const rect = popoverRef.current.getBoundingClientRect()
    setPopoverSize({ width: rect.width, height: rect.height })
  }, [selection, position])

  useEffect(() => {
    if (!selection || !position) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('click', handleClickOutside)

    return () => document.removeEventListener('click', handleClickOutside)
  }, [selection, position, onClose])

  if (!selection || !position) {
    return null
  }

  const edge = 8
  const gap = 6
  const width = popoverSize.width
  const height = popoverSize.height

  const left = Math.max(edge, Math.min(position.left, window.innerWidth - width - edge))

  // 优先显示在单词下方;放不下则翻到单词上方,避免遮住被点击的单词
  let top = position.bottom + gap
  if (top + height > window.innerHeight - edge) {
    top = position.top - gap - height
  }
  top = Math.max(edge, Math.min(top, window.innerHeight - height - edge))

  return (
    <div
      ref={popoverRef}
      className="fixed z-30 w-[300px] rounded-[24px] border border-stone-900/10 bg-white/95 p-5 shadow-[0_24px_60px_rgba(33,53,43,0.18)] backdrop-blur"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-2xl text-[#21352b]">
            {selection.normalized}
          </p>
          {selection.matchedWord ? (
            <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#d8c78f] bg-[#f8edc9] px-3 py-1 text-xs font-semibold text-[#6b5200]">
              <span>未收录原词，已匹配相近词：</span>
              <span className="font-bold text-[#21352b]">{selection.matchedWord}</span>
            </div>
          ) : null}
          <p className="mt-1 text-sm text-stone-500">
            {selection.entry.phonetic ?? '暂无音标'} {selection.entry.partOfSpeech ?? ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
          aria-label="关闭释义浮层"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-2xl bg-[#f6f0e2] p-4 text-sm text-stone-700">
        <div className="mb-2 inline-flex items-center gap-2 text-[#21352b]">
          <Languages className="h-4 w-4" />
          释义
        </div>
        <p className="leading-7">{selection.entry.meaning}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs leading-6 text-stone-500">
          来源：{selection.paperTitle}
          <br />
          提示：右键单词可在生词本一键加入/移除
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaved}
          className="inline-flex items-center gap-2 rounded-full border border-[#21352b]/15 bg-[#21352b] px-4 py-2 text-sm text-[#f8f3e8] transition hover:bg-[#2b4739] disabled:cursor-not-allowed disabled:border-[#a4955f]/25 disabled:bg-[#a4955f] disabled:text-white"
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
          {isSaved ? '已在生词本' : '加入生词本'}
        </button>
      </div>
    </div>
  )
}
