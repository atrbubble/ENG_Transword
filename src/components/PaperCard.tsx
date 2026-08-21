import { ArrowRight, Clock3, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { ExamPaper } from '@/types/study'

interface PaperCardProps {
  paper: ExamPaper
}

export function PaperCard({ paper }: PaperCardProps) {
  const sectionCount = paper.sections.length
  const questionCount = paper.sections.reduce((total, section) => {
    if (section.kind === 'reading') {
      return total + section.passages.reduce((sum, passage) => sum + passage.questions.length, 0)
    }

    if (section.kind === 'cloze' || section.kind === 'new_type') {
      return total + section.questions.length
    }

    return total
  }, 0)

  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-stone-900/10 bg-white/80 p-6 shadow-[0_24px_80px_rgba(57,48,28,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(33,53,43,0.14)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#21352b] via-[#a4955f] to-[#e2c777]" />
      <div className="mb-5 flex items-center justify-between text-sm text-stone-500">
        <span className="rounded-full border border-[#21352b]/15 bg-[#21352b]/5 px-3 py-1 text-[#21352b]">
          {paper.year} 真题
        </span>
        <span>整套试卷</span>
      </div>

      <div className="space-y-3">
        <h2 className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-2xl text-[#21352b]">
          {paper.title}
        </h2>
        <p className="text-sm uppercase tracking-[0.28em] text-[#a4955f]">Full Paper Practice</p>
        <p className="text-sm leading-7 text-stone-600">
          包含完形、阅读、新题型、翻译、作文五大版块，支持点词查义、生词本沉淀和分版块作答。
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm text-stone-600">
        <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-2">
          <FileText className="h-4 w-4 text-[#21352b]" />
          {sectionCount} 个版块
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-2">
          <Clock3 className="h-4 w-4 text-[#21352b]" />
          {paper.duration}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-2">
          <FileText className="h-4 w-4 text-[#21352b]" />
          {questionCount} 题
        </span>
      </div>

      <Link
        to={`/exam/${paper.id}`}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#21352b] px-5 py-3 text-sm text-[#f8f3e8] transition duration-200 hover:bg-[#2b4739]"
      >
        进入做题
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  )
}
