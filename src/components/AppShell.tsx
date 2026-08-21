import { BookOpenText, BookmarkPlus, LibraryBig } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: '真题', icon: LibraryBig },
  { to: '/vocabulary', label: '生词本', icon: BookmarkPlus },
]

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(164,149,95,0.18),_transparent_38%),linear-gradient(180deg,_#f8f3e8_0%,_#efe5d0_45%,_#e7dac2_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 pb-10 pt-6 lg:px-10">
        <header className="mb-8 flex flex-col gap-6 rounded-[28px] border border-stone-900/10 bg-white/70 px-6 py-5 shadow-[0_24px_80px_rgba(57,48,28,0.08)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#21352b] text-[#f3e7cb] shadow-lg shadow-[#21352b]/20">
              <BookOpenText className="h-6 w-6" />
            </div>
            <div>
              <p className="font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-2xl tracking-wide text-[#21352b]">
                Transword Archive
              </p>
              <p className="text-sm text-stone-600">考研真题阅读、点词查义、答题记录同步进行</p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-3">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition duration-200',
                    isActive
                      ? 'border-[#21352b] bg-[#21352b] text-[#f6edd7] shadow-md'
                      : 'border-stone-300 bg-white/80 text-stone-700 hover:border-[#21352b]/40 hover:text-[#21352b]',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
