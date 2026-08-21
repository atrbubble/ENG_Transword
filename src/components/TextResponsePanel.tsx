import { FilePenLine } from 'lucide-react'

import type { ExamTextResponse, ExamWritingTask } from '@/types/study'
import { sanitizeDisplayText } from '@/utils/text'

interface TranslationPanelProps {
  prompts: ExamTextResponse[]
  values: Record<string, string>
  onChange: (promptId: string, value: string) => void
}

interface WritingPanelProps {
  tasks: ExamWritingTask[]
  values: Record<string, string>
  onChange: (taskId: string, value: string) => void
}

export function TranslationResponsePanel({
  prompts,
  values,
  onChange,
}: TranslationPanelProps) {
  return (
    <div className="space-y-4">
      {prompts.map((prompt) => (
        <article
          key={prompt.id}
          className="rounded-[24px] border border-stone-900/10 bg-white/85 p-5 shadow-[0_20px_70px_rgba(57,48,28,0.08)]"
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-[#21352b]/8 font-semibold text-[#21352b]">
              {prompt.number}
            </div>
            <p className="pt-1 text-sm leading-7 text-stone-700">
              {sanitizeDisplayText(prompt.prompt)}
            </p>
          </div>
          <textarea
            value={values[prompt.id] ?? ''}
            onChange={(event) => onChange(prompt.id, event.target.value)}
            placeholder={prompt.placeholder ?? '输入你的作答'}
            className="min-h-[140px] w-full rounded-[20px] border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm leading-7 text-stone-700 outline-none transition focus:border-[#21352b]/40 focus:bg-white"
          />
        </article>
      ))}
    </div>
  )
}

export function WritingResponsePanel({ tasks, values, onChange }: WritingPanelProps) {
  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="rounded-[24px] border border-stone-900/10 bg-white/85 p-5 shadow-[0_20px_70px_rgba(57,48,28,0.08)]"
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-[#21352b]/8 font-semibold text-[#21352b]">
              {task.number}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#21352b]">{task.title}</p>
              <p className="text-sm leading-7 text-stone-700">{sanitizeDisplayText(task.prompt)}</p>
            </div>
          </div>
          <div className="mb-4 rounded-[20px] bg-[#f6f0e2] p-4 text-sm leading-7 text-stone-700">
            <div className="mb-2 inline-flex items-center gap-2 font-medium text-[#21352b]">
              <FilePenLine className="h-4 w-4" />
              写作要求
            </div>
            {task.instructions.map((line, index) => (
              <p key={`${task.id}-${index}`}>{sanitizeDisplayText(line)}</p>
            ))}
          </div>
          <textarea
            value={values[task.id] ?? ''}
            onChange={(event) => onChange(task.id, event.target.value)}
            placeholder="在这里写你的作文草稿"
            className="min-h-[200px] w-full rounded-[20px] border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm leading-7 text-stone-700 outline-none transition focus:border-[#21352b]/40 focus:bg-white"
          />
        </article>
      ))}
    </div>
  )
}
