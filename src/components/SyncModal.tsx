import { QRCodeSVG } from 'qrcode.react'
import jsQR from 'jsqr'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Loader2, Pause, Play, RefreshCw, X } from 'lucide-react'

import { useStudyStore } from '@/store/useStudyStore'
import type {
  AnswerRecord,
  SavedPhrase,
  SavedWord,
  StudySettings,
  TextResponseRecord,
  WordProgress,
} from '@/types/study'
import { DEFAULT_STUDY_SETTINGS } from '@/utils/spacedRepetition'
import { assembleSyncFrames, buildSyncFrames, parseSyncFrame } from '@/utils/syncCodec'

type SyncMode = 'send' | 'receive'

interface BackupPayload {
  savedWords: SavedWord[]
  savedPhrases: SavedPhrase[]
  answerRecords: AnswerRecord[]
  textResponseRecords: TextResponseRecord[]
  wordProgress: Record<string, WordProgress>
  studySettings: StudySettings
}

function collectPayload(): BackupPayload {
  const state = useStudyStore.getState()

  return {
    savedWords: state.savedWords,
    savedPhrases: state.savedPhrases,
    answerRecords: state.answerRecords,
    textResponseRecords: state.textResponseRecords,
    wordProgress: state.wordProgress,
    studySettings: state.studySettings,
  }
}

function applyPayload(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) {
    return false
  }

  const payload = parsed as Partial<BackupPayload>

  if (!Array.isArray(payload.savedWords) || !Array.isArray(payload.savedPhrases)) {
    return false
  }

  useStudyStore.setState({
    savedWords: payload.savedWords,
    savedPhrases: payload.savedPhrases,
    answerRecords: Array.isArray(payload.answerRecords) ? payload.answerRecords : [],
    textResponseRecords: Array.isArray(payload.textResponseRecords)
      ? payload.textResponseRecords
      : [],
    wordProgress:
      payload.wordProgress && typeof payload.wordProgress === 'object'
        ? payload.wordProgress
        : {},
    studySettings: { ...DEFAULT_STUDY_SETTINGS, ...(payload.studySettings ?? {}) },
  })

  return true
}

const titleClass = "font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',serif] text-2xl text-[#21352b]"
const hintClass = 'text-center text-sm leading-6 text-stone-500'
const buttonClass =
  'inline-flex items-center gap-2 rounded-full bg-[#21352b] px-5 py-2.5 text-sm text-[#f8f3e8] transition hover:bg-[#2b4739]'

function SendPanel() {
  const [frames, setFrames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let cancelled = false

    buildSyncFrames(collectPayload())
      .then((nextFrames) => {
        if (!cancelled) {
          setFrames(nextFrames)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('生成二维码失败，请重试。')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (frames.length <= 1 || paused) {
      return
    }

    const timer = setInterval(() => setIndex((current) => (current + 1) % frames.length), 1000)

    return () => clearInterval(timer)
  }, [frames.length, paused])

  if (error) {
    return <p className="py-10 text-center text-sm text-red-500">{error}</p>
  }

  if (!frames.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-stone-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">正在生成二维码…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className={titleClass}>扫码同步</h2>
      <p className={hintClass}>
        在手机端本站打开「生词本 → 扫码接收」，用摄像头对准下方二维码，会自动拼接并导入。
      </p>

      <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-stone-200">
        <QRCodeSVG value={frames[index]} size={280} level="M" marginSize={2} />
      </div>

      <p className="text-sm text-stone-600">
        第 {index + 1} / {frames.length} 张
        {frames.length > 1 ? ' · 自动轮播中' : ''}
      </p>

      {frames.length > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIndex((current) => (current - 1 + frames.length) % frames.length)}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-[#21352b]/30 hover:text-[#21352b]"
          >
            上一张
          </button>
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-[#21352b]/30 hover:text-[#21352b]"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? '继续' : '暂停'}
          </button>
          <button
            type="button"
            onClick={() => setIndex((current) => (current + 1) % frames.length)}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-[#21352b]/30 hover:text-[#21352b]"
          >
            下一张
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ReceivePanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'importing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ received: 0, total: 0 })
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const chunksRef = useRef(new Map<number, string>())
  const doneRef = useRef(false)

  const onFrame = useCallback((text: string) => {
    if (doneRef.current) {
      return
    }

    const frame = parseSyncFrame(text)

    if (!frame) {
      return
    }

    const chunks = chunksRef.current

    if (chunks.has(frame.index)) {
      return
    }

    chunks.set(frame.index, frame.chunk)
    setProgress({ received: chunks.size, total: frame.total })

    if (chunks.size === frame.total) {
      doneRef.current = true
      setPhase('importing')

      const frames = Array.from(chunks.entries())
        .sort(([left], [right]) => left - right)
        .map(([index, chunk]) => ({ total: frame.total, index, chunk }))

      assembleSyncFrames(frames)
        .then((data) => {
          if (applyPayload(data)) {
            setPhase('done')
          } else {
            doneRef.current = false
            setPhase('error')
            setError('数据格式不正确。')
          }
        })
        .catch(() => {
          doneRef.current = false
          setPhase('error')
          setError('数据解析失败，请重试。')
        })
    }
  }, [])

  useEffect(() => {
    if (phase !== 'scanning') {
      return
    }

    let stream: MediaStream | null = null
    let raf = 0
    let cancelled = false
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('error')
        setError('当前浏览器不支持摄像头，请使用系统相机或用导出/导入备份。')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      } catch {
        setPhase('error')
        setError('无法访问摄像头，请确认已授权（需要 HTTPS 或 localhost）。')
        return
      }

      const video = videoRef.current

      if (cancelled || !stream || !video || !context) {
        stream?.getTracks().forEach((track) => track.stop())
        return
      }

      video.srcObject = stream
      await video.play().catch(() => {})

      const tick = () => {
        if (cancelled) {
          return
        }

        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          const width = video.videoWidth
          const height = video.videoHeight

          if (width && height) {
            canvas.width = width
            canvas.height = height
            context.drawImage(video, 0, 0, width, height)
            const image = context.getImageData(0, 0, width, height)
            const code = jsQR(image.data, width, height)

            if (code?.data) {
              onFrame(code.data)
            }
          }
        }

        raf = requestAnimationFrame(tick)
      }

      raf = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [phase, onFrame])

  const startScan = () => {
    chunksRef.current.clear()
    doneRef.current = false
    setProgress({ received: 0, total: 0 })
    setError('')
    setPhase('scanning')
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-[#2f5a3e]" />
        <h2 className={titleClass}>导入成功</h2>
        <p className="text-sm text-stone-500">学习数据已同步到本设备。</p>
        <button type="button" onClick={onClose} className={buttonClass}>
          完成
        </button>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-sm text-red-500">{error}</p>
        <button type="button" onClick={startScan} className={buttonClass}>
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className={titleClass}>扫码接收</h2>
      <p className={hintClass}>
        在电脑端打开「生词本 → 生成二维码」，用摄像头对准二维码，即可自动拼接并导入。
      </p>

      {phase === 'idle' ? (
        <button type="button" onClick={startScan} className={buttonClass}>
          <Camera className="h-4 w-4" />
          开始扫码
        </button>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-44 w-full rounded-2xl bg-stone-900 object-cover"
          />
          {phase === 'importing' ? (
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在导入…
            </div>
          ) : (
            <p className="text-sm text-stone-600">
              正在扫描 · 已收到 {progress.received}
              {progress.total ? ` / ${progress.total}` : ''} 张
            </p>
          )}
        </>
      )}
    </div>
  )
}

interface SyncModalProps {
  mode: SyncMode
  onClose: () => void
}

export function SyncModal({ mode, onClose }: SyncModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-[28px] border border-stone-900/10 bg-white/95 p-6 shadow-[0_30px_90px_rgba(33,53,43,0.3)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        {mode === 'send' ? <SendPanel /> : <ReceivePanel onClose={onClose} />}
      </div>
    </div>
  )
}
