export interface PassageSegment {
  type: 'text' | 'placeholder'
  value: string
  number?: string
}

function findRemainingBlankIndex(blankNumbers: number[] | undefined, nextBlankIndex: number, number: number) {
  if (!blankNumbers?.length) {
    return -1
  }

  for (let index = nextBlankIndex; index < blankNumbers.length; index += 1) {
    if (blankNumbers[index] === number) {
      return index
    }
  }

  return -1
}

function toAsciiDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
}

function isDigitLike(value?: string) {
  return Boolean(value && /[0-9０-９]/.test(value))
}

function isBareBlankContext(paragraph: string, start: number, end: number) {
  const prev = paragraph[start - 1]
  const prevPrev = paragraph[start - 2]
  const next = paragraph[end]
  const nextNext = paragraph[end + 1]
  const suffix = paragraph.slice(end, end + 4)

  if (isDigitLike(prev) || isDigitLike(next)) {
    return false
  }

  if (next === '%') {
    return false
  }

  if ((prev === '.' || prev === ',') && isDigitLike(prevPrev)) {
    return false
  }

  if ((next === '.' || next === ',') && isDigitLike(nextNext)) {
    return false
  }

  if (/^(st|nd|rd|th)\b/i.test(suffix)) {
    return false
  }

  return true
}

export function splitPassageParagraphs(paragraphs: string[], blankNumbers?: number[]) {
  const matchRegex =
    /_{2,}\s*([0-9０-９]{1,2})\s*_{2,}|\(\s*([0-9０-９]{1,2})\s*\)\s*_{2,}|([0-9０-９]{1,2})\s*[.．]?/g
  let nextBlankIndex = 0

  return paragraphs.map((paragraph) => {
    const segments: PassageSegment[] = []
    let cursor = 0

    for (const match of paragraph.matchAll(matchRegex)) {
      const start = match.index ?? 0
      const end = start + match[0].length
      const explicitNumber = match[1] ?? match[2]
      const bareNumber = match[3]
      const normalizedValue = toAsciiDigits(explicitNumber ?? bareNumber ?? '')
      const normalizedNumber = Number(normalizedValue)
      let placeholderNumber: string | null = null
      let matchedBlankIndex = -1

      if (explicitNumber) {
        placeholderNumber = normalizedValue
        matchedBlankIndex = findRemainingBlankIndex(blankNumbers, nextBlankIndex, normalizedNumber)
      } else if (bareNumber && blankNumbers?.length) {
        matchedBlankIndex = findRemainingBlankIndex(blankNumbers, nextBlankIndex, normalizedNumber)

        if (
          matchedBlankIndex !== -1 &&
          isBareBlankContext(paragraph, start, end)
        ) {
          placeholderNumber = normalizedValue
        }
      }

      if (!placeholderNumber) {
        continue
      }

      if (cursor < start) {
        segments.push({
          type: 'text',
          value: paragraph.slice(cursor, start),
        })
      }

      segments.push({
        type: 'placeholder',
        value: `(${placeholderNumber})_____`,
        number: placeholderNumber,
      })
      cursor = end

      if (matchedBlankIndex !== -1) {
        nextBlankIndex = matchedBlankIndex + 1
      }
    }

    if (cursor < paragraph.length) {
      segments.push({
        type: 'text',
        value: paragraph.slice(cursor),
      })
    }

    return segments.length
      ? segments
      : [
          {
            type: 'text',
            value: paragraph,
          },
        ]
  })
}
