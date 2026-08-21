import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'

import { AppShell } from '@/components/AppShell'
import { PaperCard } from '@/components/PaperCard'
import { examPapers } from '@/data/examPapers'

export default function Home() {
  useEffect(() => {
    document.title = 'Transword Archive | 真题'
  }, [])

  return (
    <AppShell>
      <section>
        <div className="rounded-[32px] border border-stone-900/10 bg-[#21352b] p-8 text-[#f6edd7] shadow-[0_30px_90px_rgba(33,53,43,0.22)] md:p-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#d8c78f]">
            <Sparkles className="h-4 w-4" />
            考研阅读场景练习
          </p>
          <h1 className="max-w-2xl font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-4xl leading-tight md:text-5xl">
            在做真题的同时，
            <br />
            把整套试卷和重点词汇一起拿下。
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-8 text-[#eadfbe] md:text-base">
            页面已接入 2010-2026 英语一整套真题文本和红宝书词库。进入真题后，你可以在顶部切换完形、阅读、新题型、翻译、作文，并继续使用点词查义、右键加入生词本和分版块作答。
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              点击单词显示意思
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              右键加入生词本
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              整套试卷分版块练习
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#a4955f]">真题入口</p>
            <h2 className="mt-2 font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-3xl text-[#21352b]">
              选择年份开始训练
            </h2>
          </div>
          <p className="text-sm text-stone-500">支持整套试卷切换、点词查义、生词沉淀和右侧分页作答</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {examPapers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </div>
      </section>
    </AppShell>
  )
}
