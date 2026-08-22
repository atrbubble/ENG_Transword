export interface Token {
  value: string
  normalized: string
  isWord: boolean
}

const wordPattern = /[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]+/g

export interface StyledTextSegment {
  text: string
  isUnderlined: boolean
  markerNumber?: number
}

export function sanitizeDisplayText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/[\u0091\u0092]/g, "'")
    .replace(/[\u0093\u0094]/g, '"')
    .replace(/[\u0096\u0097]/g, '-')
    .replace(/[”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[]/g, '-')
    .replace(/[聮]/g, "'")
    .replace(/[聯聰]/g, '"')
    .replace(/��(?=\d)/g, '£')
    .replace(/([A-Za-z])��([A-Za-z])/g, "$1'$2")
    .replace(/(^|[\s(])��(?=[A-Za-z])/g, '$1"')
    .replace(/(?<=[A-Za-z.,!?])��(?=$|[\s)])/g, '"')
    .replace(/��/g, '"')
    .replace(/锟斤拷/g, '"')
    .replace(/□+/g, '-')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/20\d{2}年全国(?:硕士研究生招生考试|研究生考试)(?:（|\()?英语(?:（?一）?|\(一\)|一)?(?:）|\))?(?:真题)?试题/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeWord(word: string) {
  return word.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '')
}

export function buildLookupCandidates(word: string) {
  const normalized = normalizeWord(word)

  if (!normalized) {
    return []
  }

  const candidates = new Set([normalized])
  const add = (value: string) => {
    if (value && value.length >= 2) {
      candidates.add(value)
    }
  }

  if (normalized.endsWith('ies') && normalized.length > 3) {
    add(`${normalized.slice(0, -3)}y`)
  }

  if (normalized.endsWith('ied') && normalized.length > 3) {
    add(`${normalized.slice(0, -3)}y`)
  }

  if (normalized.endsWith('es') && normalized.length > 3) {
    add(normalized.slice(0, -2))
  }

  if (normalized.endsWith('s') && normalized.length > 3) {
    add(normalized.slice(0, -1))
  }

  if (normalized.endsWith('ed') && normalized.length > 4) {
    const stem = normalized.slice(0, -2)
    add(stem)
    add(`${stem}e`)

    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) {
      add(stem.slice(0, -1))
    }
  }

  if (normalized.endsWith('ing') && normalized.length > 5) {
    const stem = normalized.slice(0, -3)
    add(stem)
    add(`${stem}e`)

    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) {
      add(stem.slice(0, -1))
    }
  }

  return [...candidates]
}

function longestCommonSubstringLength(left: string, right: string) {
  const rows = left.length
  const cols = right.length
  let previous = new Array<number>(cols + 1).fill(0)
  let longest = 0

  for (let row = 1; row <= rows; row += 1) {
    const current = new Array<number>(cols + 1).fill(0)

    for (let col = 1; col <= cols; col += 1) {
      if (left[row - 1] === right[col - 1]) {
        current[col] = previous[col - 1] + 1
        longest = Math.max(longest, current[col])
      }
    }

    previous = current
  }

  return longest
}

export function findClosestDictionaryWord(target: string, dictionary: Record<string, unknown>) {
  const normalized = normalizeWord(target)

  if (!normalized || normalized.length < 3) {
    return null
  }

  let bestWord: string | null = null
  let bestOverlap = 0

  for (const candidate of Object.keys(dictionary)) {
    const overlap = longestCommonSubstringLength(normalized, candidate)

    if (!overlap) {
      continue
    }

    // 重合片段最长者优先;长度相同时取更短的词(词根通常比派生词更短)
    const better =
      overlap > bestOverlap ||
      (overlap === bestOverlap && (bestWord === null || candidate.length < bestWord.length))

    if (better) {
      bestOverlap = overlap
      bestWord = candidate
    }
  }

  if (bestWord === null) {
    return null
  }

  // 阈值:重合片段必须足够长,避免匹配到只有两三个字母巧合相同的词
  const minimumOverlap = Math.max(3, Math.floor(Math.min(normalized.length, bestWord.length) * 0.6))

  return bestOverlap >= minimumOverlap ? bestWord : null
}

export function tokenizeParagraph(paragraph: string): Token[] {
  const matches = sanitizeDisplayText(paragraph).match(wordPattern) ?? []

  return matches.map((value) => {
    const normalized = normalizeWord(value)

    return {
      value,
      normalized,
      isWord: /^[A-Za-z]/.test(value),
    }
  })
}

export function shouldAppendSpace(current: string, next?: string) {
  if (!next) {
    return false
  }

  if (/^[,.;:!?)]/.test(next)) {
    return false
  }

  if (/^[’']/.test(next)) {
    return false
  }

  if (/[(]$/.test(current)) {
    return false
  }

  return true
}

export function extractSentenceForWord(text: string, rawWord: string) {
  const normalizedTarget = normalizeWord(rawWord)
  const sanitized = sanitizeDisplayText(text)

  if (!sanitized) {
    return ''
  }

  if (!normalizedTarget) {
    return sanitized
  }

  const sentences =
    sanitized.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((sentence) => sentence.trim()) ?? []

  if (!sentences.length) {
    return sanitized
  }

  return (
    sentences.find((sentence) =>
      tokenizeParagraph(sentence).some((token) => token.normalized === normalizedTarget),
    ) ?? sanitized
  )
}

export function extractSentenceForPhrase(text: string, phrase: string) {
  const targetTokens = sanitizeDisplayText(phrase)
    ? tokenizeParagraph(phrase)
        .filter((token) => token.isWord)
        .map((token) => token.normalized)
        .filter(Boolean)
    : []
  const sanitized = sanitizeDisplayText(text)

  if (!sanitized) {
    return ''
  }

  if (targetTokens.length < 2) {
    return sanitized
  }

  const sentences =
    sanitized.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((sentence) => sentence.trim()) ?? []

  if (!sentences.length) {
    return sanitized
  }

  return (
    sentences.find((sentence) => {
      const sentenceTokens = tokenizeParagraph(sentence)
        .filter((token) => token.isWord)
        .map((token) => token.normalized)
        .filter(Boolean)

      for (let index = 0; index <= sentenceTokens.length - targetTokens.length; index += 1) {
        const matches = targetTokens.every((token, tokenIndex) => sentenceTokens[index + tokenIndex] === token)

        if (matches) {
          return true
        }
      }

      return false
    }) ?? sanitized
  )
}

function extractTranslationTargetText(text: string) {
  const normalized = sanitizeDisplayText(text)

  if (!normalized) {
    return ''
  }

  const sentenceMatch = normalized.match(/^[\s\S]*?[.!?](?=(?:\s|$|["')\]])+)/)

  return (sentenceMatch ? sentenceMatch[0] : normalized).trim()
}

export function splitTranslationSegments(paragraphs: string[], numbers: number[] = [46, 47, 48, 49, 50]) {
  const markerPattern = new RegExp(`\\(?(${numbers.join('|')})\\)\\s*`, 'g')

  return paragraphs.map((paragraph) => {
    const text = sanitizeDisplayText(paragraph)
    const segments: StyledTextSegment[] = []
    let lastIndex = 0

    for (const match of text.matchAll(markerPattern)) {
      const matchIndex = match.index ?? 0

      if (matchIndex > lastIndex) {
        segments.push({
          text: text.slice(lastIndex, matchIndex),
          isUnderlined: false,
        })
      }

      segments.push({
        text: match[0].trim(),
        isUnderlined: false,
        markerNumber: Number(match[1]),
      })

      const targetStart = matchIndex + match[0].length
      const targetSource = text.slice(targetStart)
      const targetText = extractTranslationTargetText(targetSource)

      if (targetText) {
        segments.push({
          text: targetText,
          isUnderlined: true,
        })
      }

      lastIndex = targetStart + targetText.length
    }

    if (lastIndex < text.length) {
      segments.push({
        text: text.slice(lastIndex),
        isUnderlined: false,
      })
    }

    if (!segments.length) {
      segments.push({
        text,
        isUnderlined: false,
      })
    }

    return segments
  })
}
