import { Flame, Layers, Repeat, Sprout } from 'lucide-react'

import type { StudyStats } from '@/utils/spacedRepetition'

interface StudySummaryProps {
  stats: StudyStats
}

export function StudySummary({ stats }: StudySummaryProps) {
  const tiles = [
    { icon: Sprout, label: '今日新学', value: stats.newToday },
    { icon: Repeat, label: '今日复习', value: stats.reviewToday },
    { icon: Flame, label: '连续打卡', value: `${stats.streak} 天` },
    { icon: Layers, label: '累计学习', value: `${stats.totalStudiedDays} 天` },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="rounded-[20px] border border-stone-900/10 bg-white/70 px-4 py-4 text-center"
        >
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#21352b]/8 text-[#21352b]">
            <Icon className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-medium text-[#21352b]">{value}</p>
          <p className="mt-1 text-xs text-stone-500">{label}</p>
        </div>
      ))}
    </div>
  )
}
