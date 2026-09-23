import { describe, expect, it } from 'vitest'

import { assembleSyncFrames, buildSyncFrames, parseSyncFrame } from '@/utils/syncCodec'

function makePayload(wordCount: number) {
  const savedWords = Array.from({ length: wordCount }, (_, index) => ({
    word: `word${index}`,
    meaning: `释义${index}，这是一段比较长的释义文本，用来把整体体积撑大一点。`.repeat(4),
    sourcePaperId: '2020',
    sourcePaperTitle: '2020年考研英语（一）真题 阅读理解',
    sourceContext:
      `This is sentence number ${index} for word ${index}, with a fairly long context sentence to enlarge the payload.`.repeat(
        4,
      ),
    createdAt: '2026-01-01T00:00:00.000Z',
  }))

  return {
    savedWords,
    savedPhrases: [],
    answerRecords: [],
    textResponseRecords: [],
    wordProgress: {},
    studySettings: { dailyNewCount: 20, order: 'recent' },
  }
}

describe('syncCodec', () => {
  it('round-trips a multi-frame payload even when frames arrive out of order', async () => {
    const payload = makePayload(80)
    const frames = await buildSyncFrames(payload)

    expect(frames.length).toBeGreaterThan(1)

    const shuffled = [...frames].reverse()
    const parsed = shuffled.flatMap((frame) => {
      const result = parseSyncFrame(frame)

      return result ? [result] : []
    })

    expect(await assembleSyncFrames(parsed)).toEqual(payload)
  })

  it('parses frames and rejects non-sync text', () => {
    expect(parseSyncFrame('https://example.com/foo')).toBeNull()
    expect(parseSyncFrame('TWSYNC|x|1|abc')).toBeNull()
    expect(parseSyncFrame('TWSYNC|2|1|abc')).toEqual({ total: 2, index: 1, chunk: 'abc' })
  })
})
