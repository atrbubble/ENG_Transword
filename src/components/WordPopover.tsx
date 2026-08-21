import { useEffect, useRef } from 'react'
import { BookmarkCheck, BookmarkPlus, Languages, X } from 'lucide-react'

import type { WordSelection } from '@/types/study'

interface WordPopoverProps {
  selection: WordSelection | null
  position: { x: number; y: number } | null
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

  return (
    <div
      ref={popoverRef}
      className="fixed z-30 w-[300px] rounded-[24px] border border-stone-900/10 bg-white/95 p-5 shadow-[0_24px_60px_rgba(33,53,43,0.18)] backdrop-blur"
      style={{
        left: `${Math.min(position.x, window.innerWidth - 320)}px`,
        top: `${Math.min(position.y, window.innerHeight - 220)}px`,
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-2xl text-[#21352b]">
            {selection.normalized}
          </p>
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
          提示：右键单词也可快速加入生词本
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
