import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import pdfParse from 'pdf-parse'
import wordExtractor from '@gmr-fms/word-extractor'

const projectRoot = process.cwd()
const zhenTiDir = path.join(projectRoot, 'ZhenTi')
const jiexiDir = path.join(zhenTiDir, 'jiexi')
const wordBookFile = path.join(projectRoot, 'word book', 'words.json')
const outputDir = path.join(projectRoot, 'scripts', 'generated')
const execFileAsync = promisify(execFile)
const EXAM_TITLE_LINE =
  /20\d{2}年全国(?:硕士研究生招生考试|研究生考试)(?:（|\()?英语(?:（?一）?|\(一\)|一)?(?:）|\))?(?:真题)?试题/g
const EXAM_TITLE_LINE_LOOSE =
  /20\d{2}\s*年?\s*全国(?:硕士研究生招生考试|研究生考试)[^\n]*?(?:英语|真题试题)/g
const combinedYears = ['2016', '2015', '2014', '2013', '2012', '2011', '2010']
const singleYearFiles = {
  '2017': '2017考研英语（一)真题.txt',
  '2018': '2018考研英语（一)真题.txt',
  '2019': '2019考研英语（一)真题.txt',
  '2020': '2020年考研英语一真题.txt',
  '2021': '2021年考研英语一真题.txt',
  '2022': '2022年考研英语一真题.txt',
  '2023': '2023年考研英语一真题.txt',
  '2024': '2024年考研英语一真题.txt',
  '2025': '2025年全国硕士研究生招生考试英语（一）试题-完整版.txt',
  '2026': '2026年考研英语一真题.txt',
}

function normalizeWord(word) {
  return word.toLowerCase().trim()
}

function toTsString(value) {
  return JSON.stringify(value, null, 2)
}

function sanitizeExtractedText(text) {
  return text
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/\u0001/g, '')
    .replace(/\u0008/g, '')
    .replace(/\u0013/g, '')
    .replace(/\u0014/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/\u3000/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
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
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/：/g, ':')
    .replace(/；/g, ';')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/^!\[[^\]]*]\([^)]+\)\s*$/gm, '')
    .replace(/^\[[^\]]+]\([^)]+\)\s*>\s*.*$/gm, '')
    .replace(/^扫码下载掌上考研APP.*$/gm, '')
    .replace(/^在职研究生招生信息网.*$/gm, '')
    .replace(/^公众平台[:：]?.*$/gim, '')
    .replace(/^\s*第?\s*\d+\s*页\s*$/gm, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/Section\s*I+\s*U?\s*se\s*of\s*English/gi, '\nSection I Use of English\n')
    .replace(/Section\s*II\s*R?\s*eading\s*Comprehension/gi, '\nSection II Reading Comprehension\n')
    .replace(/Section\s*III\s*W\s*riting/gi, '\nSection III Writing\n')
    .replace(/\bPart\s*([ABC])\b/gi, '\nPart $1\n')
    .replace(/\bText\s*([1-4])\b/gi, '\nText $1\n')
    .replace(/(^|[\s(])([b-hj-z])\s+([a-z]{2,})\b/g, '$1$2$3')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

function cleanInlineText(text) {
  return sanitizeExtractedText(text)
    .replace(EXAM_TITLE_LINE, ' ')
    .replace(EXAM_TITLE_LINE_LOOSE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .trim()
}

function extractTranslationTarget(block) {
  const normalized = cleanInlineText(block)

  if (!normalized) {
    return ''
  }

  const sentenceMatch = normalized.match(/^[\s\S]*?[.!?](?=(?:\s|$|["')\]])+)/)

  return (sentenceMatch ? sentenceMatch[0] : normalized).trim()
}

function findAllMatches(text, regex) {
  return [...text.matchAll(regex)]
}

function uniqueBy(items, getKey) {
  const map = new Map()

  for (const item of items) {
    map.set(getKey(item), item)
  }

  return [...map.values()]
}

function getMatchPosition(text, regex) {
  const match = regex.exec(text)

  if (!match || match.index === undefined) {
    return null
  }

  return {
    index: match.index,
    match,
  }
}

function sliceBetween(text, startRegex, endRegex) {
  const start = getMatchPosition(text, new RegExp(startRegex.source, startRegex.flags))

  if (!start) {
    return ''
  }

  const rest = text.slice(start.index)
  const end = getMatchPosition(rest, new RegExp(endRegex.source, endRegex.flags))
  const endIndex = end ? start.index + end.index : text.length

  return text.slice(start.index, endIndex).trim()
}

function stripHeading(text, headingRegex) {
  return sanitizeExtractedText(text).replace(headingRegex, '').trim()
}

function splitAfterDirections(text) {
  const normalized = sanitizeExtractedText(text)
  const directionsEnd = normalized.match(/\(\s*10\s*points?\s*\)|\(\s*20\s*points?\s*\)|（\s*10\s*points?\s*）|（\s*20\s*points?\s*）/i)

  if (!directionsEnd || directionsEnd.index === undefined) {
    return {
      instructions: '',
      body: normalized,
    }
  }

  const bodyStart = directionsEnd.index + directionsEnd[0].length
  return {
    instructions: cleanInlineText(normalized.slice(0, bodyStart)),
    body: normalized.slice(bodyStart).trim(),
  }
}

function extractCombinedYearTexts(combinedText) {
  const headingRegex = /(20(?:0[5-9]|1[0-6]))年全国硕士研究生[^\n]*/g
  const matches = findAllMatches(combinedText, headingRegex)
  const result = new Map()

  matches.forEach((match, index) => {
    const year = match[1]
    const start = match.index ?? 0
    const end = index + 1 < matches.length ? matches[index + 1].index : combinedText.length
    result.set(year, combinedText.slice(start, end).trim())
  })

  return result
}

function splitPassageBlocks(text) {
  const textRegex = /(?:^|\n)\s*Text\s*([1-4])\b/gi
  const matches = findAllMatches(text, textRegex)

  return matches.map((match, index) => {
    const number = Number(match[1])
    const start = match.index ?? 0
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length
    return {
      number,
      text: text.slice(start, end).trim(),
    }
  })
}

function parseParagraphs(text) {
  const blocks = sanitizeExtractedText(text)
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => cleanInlineText(line))
        .filter(Boolean)
        .filter(
          (line) =>
            !/^Directions:?$/i.test(line) &&
            !/^Read the following/i.test(line) &&
            !/^Answer the questions/i.test(line) &&
            !/^Mark your answers/i.test(line) &&
            !/^Text\s*[1-4]$/i.test(line) &&
            !/^Part\s*[ABC]$/i.test(line) &&
            !/^Section\s+[IVX]+\b/i.test(line),
        )
        .join(' '),
    )
    .map((block) => cleanInlineText(block))
    .filter(Boolean)

  return blocks.reduce((paragraphs, block) => {
    const previous = paragraphs[paragraphs.length - 1]

    if (!previous) {
      paragraphs.push(block)
      return paragraphs
    }

    if (!/[.!?:"')\]]$/.test(previous) || /^[a-z_(]/.test(block)) {
      paragraphs[paragraphs.length - 1] = cleanInlineText(`${previous} ${block}`)
      return paragraphs
    }

    paragraphs.push(block)
    return paragraphs
  }, [])
}

function normalizeReadingLine(line) {
  return cleanInlineText(line)
    .replace(/\s+'\s*s(?=[A-Za-z])/g, "'s ")
    .replace(/\s+'\s*(re|ve|ll|d|m|t)\b/gi, "'$1")
    .replace(/([A-Za-z]+(?:'s|'re|'ve|'ll|'d|n't))(?=[A-Za-z])/g, '$1 ')
    .replace(/([.!?])(?=[A-Z"(])/g, '$1 ')
    .replace(/([,:;])(?=[A-Za-z])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function shouldStartNewReadingParagraph(previous, current) {
  if (!previous) {
    return true
  }

  if (/^[A-Z"(]/.test(current) && /[.!?]"?$/.test(previous)) {
    return true
  }

  return false
}

function parseReadingParagraphs(text) {
  const lines = sanitizeExtractedText(text)
    .split('\n')
    .map((line) => normalizeReadingLine(line))
    .filter(Boolean)
    .filter(
      (line) =>
        !/^Directions:?$/i.test(line) &&
        !/^Read the following/i.test(line) &&
        !/^Answer the questions/i.test(line) &&
        !/^Mark your answers/i.test(line) &&
        !/^Text\s*[1-4]$/i.test(line) &&
        !/^Part\s*[ABC]$/i.test(line) &&
        !/^Section\s+[IVX]+\b/i.test(line) &&
        !/^\d+$/.test(line) &&
        !line.match(EXAM_TITLE_LINE) &&
        !line.match(EXAM_TITLE_LINE_LOOSE),
    )

  return lines.reduce((paragraphs, line) => {
    const previous = paragraphs[paragraphs.length - 1]

    if (!previous || shouldStartNewReadingParagraph(previous, line)) {
      paragraphs.push(line)
      return paragraphs
    }

    paragraphs[paragraphs.length - 1] = normalizeReadingLine(`${previous} ${line}`)
    return paragraphs
  }, [])
}

function parseOptionLine(line) {
  const match = cleanInlineText(line).match(/^(?:\[\s*([A-H])\s*\]|【\s*([A-H])\s*】|([A-H])[.)])\s*(.*)$/)

  if (!match) {
    return null
  }

  return {
    key: match[1] ?? match[2] ?? match[3],
    text: cleanInlineText(match[4]),
  }
}

function isLikelyQuestionPrompt(line) {
  return /^(?:\d{2}[.)]\s*)?(?:according to|paragraph|what|which|why|how|the author|it can be inferred|the phrase)/i.test(
    cleanInlineText(line),
  )
}

function splitBodyAndQuestionText(body, numberRegex) {
  const numberedMatch = body.match(numberRegex)

  if (numberedMatch && numberedMatch.index !== undefined) {
    return {
      contentText: body.slice(0, numberedMatch.index).trim(),
      questionText: body.slice(numberedMatch.index).trim(),
    }
  }

  const lines = sanitizeExtractedText(body).split('\n')
  const firstOptionIndex = lines.findIndex((line) => Boolean(parseOptionLine(line)))

  if (firstOptionIndex !== -1) {
    let questionStartIndex = firstOptionIndex

    while (questionStartIndex > 0 && cleanInlineText(lines[questionStartIndex - 1])) {
      questionStartIndex -= 1
    }

    return {
      contentText: lines.slice(0, questionStartIndex).join('\n').trim(),
      questionText: lines.slice(questionStartIndex).join('\n').trim(),
    }
  }

  const blocks = sanitizeExtractedText(body)
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
  const inlineQuestionBlockIndex = blocks.findIndex((block) => {
    const lines = block
      .split('\n')
      .map((line) => cleanInlineText(line))
      .filter(Boolean)

    return lines.length === 5 && cleanInlineText(lines[0]).length <= 220
  })

  if (inlineQuestionBlockIndex !== -1) {
    return {
      contentText: blocks.slice(0, inlineQuestionBlockIndex).join('\n\n').trim(),
      questionText: blocks.slice(inlineQuestionBlockIndex).join('\n\n').trim(),
    }
  }

  const firstQuestionBlockIndex = blocks.findIndex((block, index) => {
    const nextBlock = blocks[index + 1]

    if (!nextBlock) {
      return false
    }

    const optionLines = nextBlock
      .split('\n')
      .map((line) => cleanInlineText(line))
      .filter(Boolean)

    return block.length <= 220 && optionLines.length === 4
  })

  if (firstQuestionBlockIndex === -1) {
    const nonEmptyLines = lines.map((line) => cleanInlineText(line)).filter(Boolean)
    const firstPromptIndex = nonEmptyLines.findIndex((line) => isLikelyQuestionPrompt(line))

    if (firstPromptIndex === -1) {
      return null
    }

    return {
      contentText: nonEmptyLines.slice(0, firstPromptIndex).join('\n').trim(),
      questionText: nonEmptyLines.slice(firstPromptIndex).join('\n').trim(),
    }
  }

  return {
    contentText: blocks.slice(0, firstQuestionBlockIndex).join('\n\n').trim(),
    questionText: blocks.slice(firstQuestionBlockIndex).join('\n\n').trim(),
  }
}

function parseGroupedChoiceQuestions(text, year, sectionId, startNumber, promptBuilder) {
  const lines = sanitizeExtractedText(text)
    .split('\n')
    .map((line) => cleanInlineText(line))
    .filter(Boolean)

  const questions = []
  let promptLines = []
  let options = []

  const pushQuestion = () => {
    if (!options.length) {
      return
    }

    const number = startNumber + questions.length
    questions.push({
      id: `${year}-${sectionId}-q-${number}`,
      number,
      prompt: cleanInlineText(promptLines.join(' ')) || promptBuilder(number),
      options,
    })
    promptLines = []
    options = []
  }

  for (const line of lines) {
    const option = parseOptionLine(line)

    if (option) {
      options.push(option)

      if (options.length === 4) {
        pushQuestion()
      }

      continue
    }

    if (options.length) {
      pushQuestion()
    }

    promptLines.push(line)
  }

  if (options.length) {
    pushQuestion()
  }

  return questions
}

function parseBlockChoiceQuestions(text, year, sectionId, startNumber, promptBuilder) {
  const blocks = sanitizeExtractedText(text)
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
  const questions = []

  for (let index = 0; index < blocks.length - 1; index += 2) {
    const promptBlock = cleanInlineText(blocks[index])
    const optionLines = blocks[index + 1]
      .split('\n')
      .map((line) => cleanInlineText(line))
      .filter(Boolean)

    if (optionLines.length !== 4) {
      continue
    }

    const number = startNumber + questions.length
    questions.push({
      id: `${year}-${sectionId}-q-${number}`,
      number,
      prompt: promptBlock || promptBuilder(number),
      options: optionLines.map((line, optionIndex) => ({
        key: ['A', 'B', 'C', 'D'][optionIndex],
        text: line.replace(/^(?:\[\s*[A-D]\s*\]|【\s*[A-D]\s*】|[A-D][.)])\s*/i, '').trim(),
      })),
    })
  }

  if (questions.length) {
    return questions
  }

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => cleanInlineText(line))
      .filter(Boolean)

    if (lines.length !== 5) {
      continue
    }

    const number = startNumber + questions.length
    questions.push({
      id: `${year}-${sectionId}-q-${number}`,
      number,
      prompt: lines[0] || promptBuilder(number),
      options: lines.slice(1).map((line, optionIndex) => ({
        key: ['A', 'B', 'C', 'D'][optionIndex],
        text: line.replace(/^(?:\[\s*[A-D]\s*\]|【\s*[A-D]\s*】|[A-D][.)])\s*/i, '').trim(),
      })),
    })
  }

  return questions
}

function parseFlexiblePassageQuestions(text, year, sectionId, startNumber, promptBuilder) {
  const lines = sanitizeExtractedText(text)
    .split('\n')
    .map((line) => cleanInlineText(line))
    .filter(Boolean)
  const questions = []
  let currentPrompt = ''
  let optionTexts = []

  const flushQuestion = () => {
    if (!currentPrompt || optionTexts.length < 4) {
      currentPrompt = ''
      optionTexts = []
      return
    }

    const number = startNumber + questions.length
    questions.push({
      id: `${year}-${sectionId}-q-${number}`,
      number,
      prompt: currentPrompt || promptBuilder(number),
      options: optionTexts.slice(0, 4).map((text, index) => ({
        key: ['A', 'B', 'C', 'D'][index],
        text,
      })),
    })
    currentPrompt = ''
    optionTexts = []
  }

  const extractInlineOptions = (line) => {
    const normalized = cleanInlineText(line)
    const matches = [...normalized.matchAll(/(?:^|\s)([A-D])[.)]\s*/g)]

    if (!matches.length) {
      return normalized ? [normalized] : []
    }

    const parts = []
    const beforeFirst = normalized.slice(0, matches[0].index).trim()

    if (beforeFirst) {
      parts.push(beforeFirst)
    }

    matches.forEach((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length
      const optionText = normalized.slice(start, end).trim()

      if (optionText) {
        parts.push(optionText)
      }
    })

    return parts
  }

  for (const line of lines) {
    if (isLikelyQuestionPrompt(line)) {
      flushQuestion()
      currentPrompt = line.replace(/^\d{2}[.)]\s*/, '').trim()
      continue
    }

    if (!currentPrompt) {
      continue
    }

    optionTexts.push(...extractInlineOptions(line))

    if (optionTexts.length >= 4) {
      flushQuestion()
    }
  }

  flushQuestion()
  return questions
}

function cleanChoiceOptionText(text) {
  return cleanInlineText(text)
    .replace(/\?+(?=\s|$)/g, '')
    .replace(/\s+'\s+/g, "'")
    .trim()
}

function parseBracketOptions(text) {
  return findAllMatches(
    text,
    /\[\s*([A-D])\s*\]\s*([\s\S]*?)(?=(?:\[\s*[A-D]\s*\])|$)/g,
  ).map((match) => ({
    key: match[1],
    text: cleanChoiceOptionText(match[2]),
  }))
}

function parseClozeQuestions(text, year) {
  const normalized = sanitizeExtractedText(text)
    .replace(/【\s*([A-D])\s*】/g, '[$1] ')
    .replace(/(^|[\s(])([A-D])[.．](?=\s*[A-Za-z"'(])/g, '$1[$2] ')
    .replace(/(^|[^\d])(\d{1,2})[.．]?\s*(?=\[[A-D]\])/g, '$1\n$2. ')
    .replace(/\n{2,}/g, '\n')
    .trim()

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const candidateChunks = lines.filter((line) => /\[[A-D]\]/.test(line))
  const questions = []

  for (const chunk of candidateChunks) {
    const numberMatch = chunk.match(/^(\d{1,2})[.．]?\s*/)
    const number = numberMatch ? Number(numberMatch[1]) : questions.length + 1
    const optionSource = chunk.replace(/^(\d{1,2})[.．]?\s*/, '')
    const options = parseBracketOptions(optionSource)

    if (options.length !== 4) {
      continue
    }

    questions.push({
      id: `${year}-cloze-q-${number}`,
      number,
      prompt: `第 ${number} 空`,
      options,
    })
  }

  return uniqueBy(questions, (item) => item.number)
    .sort((left, right) => left.number - right.number)
}

function parseChoiceQuestions(text, year, sectionId, questionPattern, promptBuilder) {
  const questionRegex = new RegExp(questionPattern, 'g')
  const matches = findAllMatches(text, questionRegex)

  return matches.map((match, index) => {
    const number = Number(match[1])
    const start = match.index ?? 0
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length
    const chunk = sanitizeExtractedText(text.slice(start, end)).replace(/^\s*\d{2}\s*\.\s*/, '')
    const optionRegex = /(?:\[\s*([A-H])\s*\]|【\s*([A-H])\s*】|([A-H])[.)])/g
    const optionMatches = findAllMatches(chunk, optionRegex)
    const prompt = cleanInlineText(chunk.slice(0, optionMatches[0]?.index ?? chunk.length))
    const options = optionMatches.map((optionMatch, optionIndex) => {
      const optionStart = optionMatch.index ?? 0
      const optionEnd = optionIndex + 1 < optionMatches.length ? optionMatches[optionIndex + 1].index : chunk.length
      const optionText = cleanChoiceOptionText(
        chunk.slice(optionStart + optionMatch[0].length, optionEnd),
      )

      return {
        key: optionMatch[1] ?? optionMatch[2] ?? optionMatch[3],
        text: optionText,
      }
    })

    return {
      id: `${year}-${sectionId}-q-${number}`,
      number,
      prompt: prompt || promptBuilder(number),
      options,
    }
  })
}

function parsePassage(year, block) {
  const body = block.text.replace(/^Text\s*[1-4]\b/i, '').trim()
  const splitResult =
    splitBodyAndQuestionText(body, /(?:^|\n)\s*(\d{2})\s*\./m) ??
    (() => {
      const rawPromptIndex = body.search(
        /According to Paragraph|Paragraph\s*\d+\s*mainly|What did the study find|What can be inferred|Both\s+[A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)?/i,
      )

      if (rawPromptIndex > 0) {
        return {
          contentText: body.slice(0, rawPromptIndex).trim(),
          questionText: body.slice(rawPromptIndex).trim(),
        }
      }

      const normalizedBody = sanitizeExtractedText(body)
      const normalizedLines = sanitizeExtractedText(body)
        .split('\n')
        .map((line) => cleanInlineText(line))
        .filter(Boolean)
      const firstPromptIndex = normalizedLines.findIndex((line) => isLikelyQuestionPrompt(line))

      if (firstPromptIndex !== -1) {
        return {
          contentText: normalizedLines.slice(0, firstPromptIndex).join('\n').trim(),
          questionText: normalizedLines.slice(firstPromptIndex).join('\n').trim(),
        }
      }

      const directPromptMatch = normalizedBody.match(
        /According to Paragraph|Paragraph\s*\d+\s*mainly|What did|What can be inferred|Both\s+[A-Z][a-z]+.*?would agree/i,
      )

      if (!directPromptMatch || directPromptMatch.index === undefined) {
        return null
      }

      return {
        contentText: normalizedBody.slice(0, directPromptMatch.index).trim(),
        questionText: normalizedBody.slice(directPromptMatch.index).trim(),
      }
    })()

  if (!splitResult) {
    throw new Error(`${year} Text ${block.number} 未找到题目起始位置`)
  }

  const { contentText: paragraphsText, questionText: questionsText } = splitResult
  const paragraphs = parseReadingParagraphs(paragraphsText)
  const startNumber = 21 + (block.number - 1) * 5
  const questions = parseChoiceQuestions(
    questionsText,
    year,
    `text-${block.number}`,
    String.raw`(?:^|\n)\s*(\d{2})\s*\.`,
    (number) => `第 ${number} 题`,
  )

  return {
    id: `${year}-text-${block.number}`,
    label: `Text ${block.number}`,
    title: `第 ${block.number} 篇阅读`,
    paragraphs,
    questions:
      questions.length >= 5
        ? questions
        : (() => {
            const groupedQuestions = parseGroupedChoiceQuestions(
              questionsText,
              year,
              `text-${block.number}`,
              startNumber,
              (number) => `第 ${number} 题`,
            )

            return groupedQuestions.length >= 5
              ? groupedQuestions
              : (() => {
                  const blockQuestions = parseBlockChoiceQuestions(
                    questionsText,
                    year,
                    `text-${block.number}`,
                    startNumber,
                    (number) => `第 ${number} 题`,
                  )

                  return blockQuestions.length >= 5
                    ? blockQuestions
                    : parseFlexiblePassageQuestions(
                        questionsText,
                        year,
                        `text-${block.number}`,
                        startNumber,
                        (number) => `第 ${number} 题`,
                      )
                })()
          })(),
  }
}

function parseClozeSection(year, rawText) {
  const section = sliceBetween(
    rawText,
    /Section[^\n]*English/i,
    /Section[^\n]*Comprehension/i,
  )
  const stripped = stripHeading(section, /Section[^\n]*English/i)
  const { instructions, body } = splitAfterDirections(stripped)
  const splitResult = splitBodyAndQuestionText(body, /(?:^|\n)\s*(\d{1,2})\s*\./m)

  if (!splitResult) {
    throw new Error(`${year} 完形填空未找到题目起始位置`)
  }

  const { contentText, questionText } = splitResult
  const questions = parseClozeQuestions(questionText, year)

  return {
    id: `${year}-cloze`,
    kind: 'cloze',
    title: '完形填空',
    shortTitle: '完形',
    instructions,
    paragraphs: parseParagraphs(contentText),
    questions,
  }
}

function parseReadingSection(year, rawText) {
  const section = sliceBetween(
    rawText,
    /Section[^\n]*Comprehension/i,
    /Section[^\n]*Writing/i,
  )
  const partA = sliceBetween(section, /Part\s*A\b/i, /Part\s*B\b/i)
  const stripped = stripHeading(partA, /Part\s*A\b/i)
  const { instructions, body } = splitAfterDirections(stripped)
  const passageBlocks = splitPassageBlocks(body)

  if (passageBlocks.length < 4) {
    throw new Error(`${year} 阅读解析失败，仅识别到 ${passageBlocks.length} 篇`)
  }

  return {
    id: `${year}-reading`,
    kind: 'reading',
    title: '阅读理解',
    shortTitle: '阅读',
    instructions,
    passages: passageBlocks.slice(0, 4).map((block) => parsePassage(year, block)),
  }
}

function parseAvailableReadingSection(year, rawText) {
  const section = sliceBetween(
    rawText,
    /Section[^\n]*Comprehension/i,
    /Section[^\n]*Writing/i,
  )
  const partA = sliceBetween(section, /Part\s*A\b/i, /Part\s*B\b/i)
  const stripped = stripHeading(partA, /Part\s*A\b/i)
  const { instructions, body } = splitAfterDirections(stripped)
  const passageBlocks = splitPassageBlocks(body)

  return {
    id: `${year}-reading`,
    kind: 'reading',
    title: '阅读理解',
    shortTitle: '阅读',
    instructions,
    passages: passageBlocks.map((block) => parsePassage(year, block)),
  }
}

function detectNewTypeSubtype(text) {
  const normalized = sanitizeExtractedText(text)

  if (/wrong order|reorganize|choose the most suitable paragraphs|fill them into the numbered boxes/i.test(normalized)) {
    return '排序'
  }

  if (/subheading|heading/i.test(normalized)) {
    return '小标题'
  }

  return '七选五'
}

function parseOptionItems(text) {
  const lineMatches = text
    .split('\n')
    .filter((line) => /^\s*(?:\[[A-H]\]|【[A-H]】)\s*/.test(line))
    .map((line) => cleanInlineText(line))
    .map((line) => {
      const match = line.match(/^(?:\[([A-H])\]|【([A-H])】)\s*(.*)$/)

      return match
        ? {
            key: match[1] ?? match[2],
            text: cleanInlineText(match[3]),
          }
        : null
    })
    .filter(Boolean)

  if (lineMatches.length >= 5) {
    return uniqueBy(lineMatches, (item) => item.key)
  }

  const boundaryPattern = /(?:\[\s*([A-H])\s*\]|【\s*([A-H])\s*】)\s*([\s\S]*?)(?=\s*(?:\[\s*[A-H]\s*\]|【\s*[A-H]\s*】)|(?:\n\s*(?:4[1-5]\b|Part\s*C\b|Section\s*(?:III|Ⅲ)\b))|$)/g
  const boundaryMatches = findAllMatches(text, boundaryPattern)

  if (boundaryMatches.length >= 5) {
    return uniqueBy(
      boundaryMatches.map((match) => ({
        key: match[1] ?? match[2],
        text: cleanInlineText(match[3]),
      })),
      (item) => item.key,
    )
  }

  const pattern = /(?:^|\n)\s*(?:\[\s*([A-H])\s*\]|【\s*([A-H])\s*】|([A-H])[.)])\s*([\s\S]*?)(?=(?:\n\s*(?:\[\s*[A-H]\s*\]|【\s*[A-H]\s*】|[A-H][.)]))|(?:\n\s*(?:4[1-5]\b|Part\s*C\b|Section\s*(?:III|Ⅲ)\b))|$)/g
  const matches = findAllMatches(text, pattern)
  const parsedMatches = uniqueBy(
    matches.map((match) => ({
      key: match[1] ?? match[2] ?? match[3],
      text: cleanInlineText(match[4]),
    })),
    (item) => item.key,
  )

  if (parsedMatches.length >= 5) {
    return parsedMatches
  }

  const tailLines = sanitizeExtractedText(text)
    .split('\n')
    .map((line) => cleanInlineText(line))
    .filter(Boolean)
    .slice(-7)
    .map((line) =>
      line
        .replace(/^(?:\[\s*[A-H]\s*\]|【\s*[A-H]\s*】|[A-H][.)])\s*/i, '')
        .replace(/^[^\x20-\x7E]+/, '')
        .replace(/^or\s+/i, 'For ')
        .trim(),
    )
    .filter(Boolean)

  if (tailLines.length >= 5) {
    return tailLines.slice(0, 8).map((line, index) => ({
      key: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][index],
      text: line,
    }))
  }

  return parsedMatches
}

function parseNewTypeSection(year, rawText) {
  const readingSection = sliceBetween(
    rawText,
    /Section[^\n]*Comprehension/i,
    /Section[^\n]*Writing/i,
  )
  const partB = sliceBetween(
    readingSection,
    /Part\s*B\b/i,
    /Part\s*C\b/i,
  )
  const stripped = stripHeading(partB, /Part\s*B\b/i)
  const { instructions, body } = splitAfterDirections(stripped)
  const subtype = detectNewTypeSubtype(`${instructions}\n${body}`)
  const optionItems = parseOptionItems(body)

  if (optionItems.length < 5) {
    throw new Error(`${year} 新题型选项识别不足`)
  }

  const firstOptionIndex = body.search(/(?:^|\n)\s*(?:\[\s*[A-H]\s*\]|【\s*[A-H]\s*】|[A-H][.)])\s*/m)
  const lastOption = [...body.matchAll(/(?:^|\n)\s*(?:\[\s*[A-H]\s*\]|【\s*[A-H]\s*】|[A-H][.)])\s*[\s\S]*?(?=(?:\n\s*(?:\[\s*[A-H]\s*\]|【\s*[A-H]\s*】|[A-H][.)]))|(?:\n\s*(?:4[1-5]\b|Part\s*C\b))|$)/g)].pop()
  const lastOptionEnd = lastOption ? (lastOption.index ?? 0) + lastOption[0].length : 0
  let leadSource = ''

  if (subtype === '七选五') {
    leadSource =
      firstOptionIndex > 0
        ? body.slice(0, firstOptionIndex).trim()
        : sanitizeExtractedText(body)
            .split('\n')
            .map((line) => cleanInlineText(line))
            .filter(Boolean)
            .slice(0, Math.max(0, sanitizeExtractedText(body).split('\n').map((line) => cleanInlineText(line)).filter(Boolean).length - optionItems.length))
            .join('\n')
            .trim()
  } else if (subtype === '小标题') {
    leadSource = body
      .split('\n')
      .filter((line) => line.trim() && !/^\s*(?:\[[A-H]\]|【[A-H]】)\s*/.test(line))
      .join('\n')
      .trim()
  } else if (subtype === '排序') {
    leadSource = body
      .slice(lastOptionEnd)
      .replace(/(?:^|\n)\s*4[1-5][\s\S]*$/, '')
      .trim()
  }

  const layoutLines =
    subtype === '排序'
      ? body
          .split('\n')
          .map((line) => cleanInlineText(line))
          .filter((line) => !/^\s*(?:\[[A-H]\]|【[A-H]】)\s*/.test(line))
          .filter((line) => /4[1-5]/.test(line))
          .filter((line) => !/^\s*Directions:?$/i.test(line))
      : body
          .slice(lastOptionEnd)
          .split('\n')
          .map((line) => cleanInlineText(line))
          .filter((line) => /4[1-5]/.test(line))

  const questionOptions = optionItems.map((item) => ({ key: item.key, text: item.text }))
  const questions = Array.from({ length: 5 }, (_, index) => ({
    id: `${year}-new-type-q-${41 + index}`,
    number: 41 + index,
    prompt: `第 ${41 + index} 空`,
    options: questionOptions,
  }))

  return {
    id: `${year}-new-type`,
    kind: 'new_type',
    title: '新题型',
    shortTitle: '新题型',
    instructions,
    subtype,
    leadParagraphs: parseParagraphs(leadSource),
    optionItems,
    fixedLayout: layoutLines,
    questions,
  }
}

function parseTranslationPrompts(text) {
  const matches = findAllMatches(text, /\(?([4-5]\d)\)\s*([\s\S]*?)(?=(?:\(?[4-5]\d\))|$)/g)

  return uniqueBy(
    matches
      .map((match) => ({
        number: Number(match[1]),
        text: extractTranslationTarget(match[2]),
      }))
      .filter((item) => item.number >= 46 && item.number <= 50),
    (item) => item.number,
  )
}

function parseTranslationSection(year, rawText) {
  const readingSection = sliceBetween(
    rawText,
    /Section[^\n]*Comprehension/i,
    /Section[^\n]*Writing/i,
  )
  const partC = sliceBetween(
    readingSection,
    /Part\s*C\b/i,
    /Section[^\n]*Writing/i,
  )
  const stripped = stripHeading(partC, /Part\s*C\b/i)
  const { instructions, body } = splitAfterDirections(stripped)
  const repeatedIndex = body.search(/\n\s*46\)\s+/)
  const articleText = repeatedIndex > 0 ? body.slice(0, repeatedIndex).trim() : body
  const prompts = parseTranslationPrompts(articleText).map((item) => ({
    id: `${year}-translation-${item.number}`,
    number: item.number,
    prompt: item.text,
    placeholder: '输入你的中文翻译',
  }))

  // 翻译原文在 DOC 提取时段落间通常只有单 \n，parseParagraphs
  // 依赖 \n\n 会合并所有段落。这里改用逐行解析来还原自然段落。
  let paragraphs = parseReadingParagraphs(articleText)

  // 如果逐行解析结果也只是一段，退回 parseParagraphs 兜底
  if (paragraphs.length <= 1) {
    paragraphs = parseParagraphs(articleText)
  }

  return {
    id: `${year}-translation`,
    kind: 'translation',
    title: '翻译',
    shortTitle: '翻译',
    instructions,
    paragraphs,
    prompts,
  }
}

function parseWritingTask(year, partText, partKey, number) {
  const stripped = stripHeading(partText, /^Part\s*[AB]/i)
  const normalized = sanitizeExtractedText(stripped)
  const body = normalized.replace(/^\s*5[12][.．]?\s*Directions[:：]?\s*/i, '').trim()
  const lines = body
    .split('\n')
    .map((line) => cleanInlineText(line))
    .filter(Boolean)

  return {
    id: `${year}-writing-${partKey}`,
    number,
    title: `Part ${partKey.toUpperCase()}`,
    prompt: lines[0] ?? '',
    instructions: lines.slice(1),
  }
}

function parseWritingSection(year, rawText) {
  const section = sliceBetween(
    rawText,
    /Section[^\n]*Writing/i,
    /20\d{2}年全国硕士研究生|$/i,
  )
  const stripped = stripHeading(section, /Section[^\n]*Writing/i)
  const partA = sliceBetween(stripped, /Part\s*A\b/i, /Part\s*B\b/i)
  const partB = sliceBetween(stripped, /Part\s*B\b/i, /$/i)

  return {
    id: `${year}-writing`,
    kind: 'writing',
    title: '作文',
    shortTitle: '作文',
    instructions: '包含 Part A 应用文与 Part B 大作文。',
    tasks: [parseWritingTask(year, partA, 'a', 51), parseWritingTask(year, partB, 'b', 52)],
  }
}

function parsePaper(year, rawText) {
  const normalized = sanitizeExtractedText(rawText)

  return {
    id: `eng1-${year}`,
    year,
    title: `${year} 英语一真题`,
    duration: '建议 180 分钟',
    sections: [
      parseClozeSection(year, normalized),
      parseReadingSection(year, normalized),
      parseNewTypeSection(year, normalized),
      parseTranslationSection(year, normalized),
      parseWritingSection(year, normalized),
    ],
  }
}

async function generateRedbookDictionary() {
  const source = JSON.parse(await readFile(wordBookFile, 'utf8'))
  const dictionaryMap = new Map()

  for (const item of source) {
    const normalized = normalizeWord(item.word)

    if (!normalized || dictionaryMap.has(normalized)) {
      continue
    }

    dictionaryMap.set(normalized, {
      word: normalized,
      meaning: item.meaning,
      source: `红宝书 第${item.page}页`,
    })
  }

  const ordered = Object.fromEntries(
    [...dictionaryMap.entries()].sort((left, right) => left[0].localeCompare(right[0])),
  )

  const content = `import type { DictionaryEntry } from '@/types/study'\n\nexport const redbookDictionary: Record<string, DictionaryEntry> = ${toTsString(ordered)}\n`

  await writeFile(path.join(projectRoot, 'src', 'data', 'redbookDictionary.ts'), content, 'utf8')
  return dictionaryMap.size
}

async function extractDocText(filePath) {
  const document = await wordExtractor.fromFile(filePath)
  return document.getBody()
}

async function extractDocxText(filePath) {
  const psCommand = [
    `$path = '${filePath.replace(/'/g, "''")}'`,
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    '$zip = [System.IO.Compression.ZipFile]::OpenRead($path)',
    'try {',
    "  $entry = $zip.GetEntry('word/document.xml')",
    "  if (-not $entry) { throw 'word/document.xml not found' }",
    '  $reader = New-Object System.IO.StreamReader($entry.Open())',
    '  try {',
    '    $xml = $reader.ReadToEnd()',
    '  } finally {',
    '    $reader.Close()',
    '  }',
    '} finally {',
    '  $zip.Dispose()',
    '}',
    '$text = $xml `',
    '  -replace \'</w:p>\', "`n" `',
    "  -replace '<w:tab[^>]*/>', ' ' `",
    '  -replace \'<w:br[^>]*/>\', "`n" `',
    "  -replace '<[^>]+>', '' `",
    "  -replace '&amp;', '&' `",
    "  -replace '&lt;', '<' `",
    "  -replace '&gt;', '>' `",
    '  -replace \'&quot;\', \'"\' `',
    '  -replace \'&apos;\', "\'"',
    'Write-Output $text',
  ].join('\n')

  const shells = process.platform === 'win32' ? ['pwsh', 'powershell'] : ['pwsh']

  for (const shell of shells) {
    try {
      const { stdout } = await execFileAsync(shell, ['-NoProfile', '-Command', psCommand], {
        maxBuffer: 24 * 1024 * 1024,
      })
      if (stdout.trim()) {
        return stdout
      }
    } catch (error) {
      if (shell === shells[shells.length - 1]) {
        break
      }
    }
  }

  try {
    const legacyDocument = await wordExtractor.fromFile(filePath)
    const legacyText = legacyDocument.getBody()

    if (legacyText.trim()) {
      return legacyText
    }
  } catch (error) {
    // Ignore and throw the unified extraction error below.
  }

  throw new Error(`无法提取 DOCX：${filePath}`)
}

async function extractPdfText(filePath) {
  const buffer = await readFile(filePath)
  const result = await pdfParse(buffer)
  return result.text
}

async function dumpExamSources() {
  await mkdir(outputDir, { recursive: true })

  const rootFiles = await readdir(zhenTiDir)
  const docFiles = rootFiles
    .filter((file) => file.toLowerCase().endsWith('.doc'))
    .map((file) => path.join(zhenTiDir, file))
  const docxFiles = rootFiles
    .filter((file) => file.toLowerCase().endsWith('.docx'))
    .map((file) => path.join(zhenTiDir, file))
  const rootPdfFiles = rootFiles
    .filter((file) => file.toLowerCase().endsWith('.pdf'))
    .map((file) => path.join(zhenTiDir, file))

  const pdfFiles = (await readdir(jiexiDir))
    .filter((file) => file.toLowerCase().endsWith('.pdf'))
    .map((file) => path.join(jiexiDir, file))

  for (const filePath of docFiles) {
    const text = await extractDocText(filePath)
    const outputFile = path.join(outputDir, `${path.basename(filePath, '.doc')}.txt`)
    await writeFile(outputFile, text, 'utf8')
  }

  for (const filePath of docxFiles) {
    const text = await extractDocxText(filePath)
    const outputFile = path.join(outputDir, `${path.basename(filePath, '.docx')}.txt`)
    await writeFile(outputFile, text, 'utf8')
  }

  for (const filePath of rootPdfFiles) {
    const text = await extractPdfText(filePath)
    const outputFile = path.join(outputDir, `${path.basename(filePath, '.pdf')}.txt`)
    await writeFile(outputFile, text, 'utf8')
  }

  for (const filePath of pdfFiles) {
    const text = await extractPdfText(filePath)
    const outputFile = path.join(outputDir, `${path.basename(filePath, '.pdf')}.txt`)
    await writeFile(outputFile, text, 'utf8')
  }

  return {
    docCount: docFiles.length,
    docxCount: docxFiles.length,
    pdfCount: pdfFiles.length + rootPdfFiles.length,
  }
}

async function generateExamPapers() {
  const combinedText = await readFile(path.join(outputDir, '20052016年历年考研英语真题集.txt'), 'utf8')
  const combinedYearTextMap = extractCombinedYearTexts(sanitizeExtractedText(combinedText))
  const papers = []

  for (const year of combinedYears) {
    const text = combinedYearTextMap.get(year)

    if (!text) {
      throw new Error(`未在合集文件中找到 ${year} 年真题`)
    }

    papers.push(parsePaper(year, text))
  }

  for (const [year, fileName] of Object.entries(singleYearFiles)) {
    const text = await readFile(path.join(outputDir, fileName), 'utf8')
    const paper = parsePaper(year, text)

    if (year === '2025') {
      const onlineText = await readFile(
        path.join(outputDir, '2025年考研英语一真题-线上提取.txt'),
        'utf8',
      )
      const onlineNormalized = sanitizeExtractedText(onlineText)
      const burningVocabularyReadingText = await readFile(
        path.join(projectRoot, 'scripts', 'manual', '2025年考研英语一真题-burningvocabulary阅读提取.txt'),
        'utf8',
      )
      const burningVocabularyReadingNormalized = sanitizeExtractedText(
        burningVocabularyReadingText,
      )
      const burningVocabularySupplementText = await readFile(
        path.join(projectRoot, 'scripts', 'manual', '2025年考研英语一真题-burningvocabulary补充提取.txt'),
        'utf8',
      )
      const burningVocabularySupplementNormalized = sanitizeExtractedText(
        burningVocabularySupplementText,
      )

      try {
        paper.sections[0] = parseClozeSection(year, onlineNormalized)
      } catch (error) {
        // Keep local-source cloze when the online source is incomplete.
      }

      try {
        const cleanerReading = parseAvailableReadingSection(
          year,
          burningVocabularyReadingNormalized,
        )
        const currentReadingSection = paper.sections.find((section) => section.kind === 'reading')

        if (currentReadingSection && currentReadingSection.kind === 'reading') {
          currentReadingSection.passages = [
            ...cleanerReading.passages,
            ...currentReadingSection.passages.slice(cleanerReading.passages.length),
          ].slice(0, 4)
        }
      } catch (error) {
        // Keep local-source reading when the online source is incomplete.
      }

      try {
        paper.sections[2] = parseNewTypeSection(year, burningVocabularySupplementNormalized)
      } catch (error) {
        // Keep local-source new type section when the manual source is incomplete.
      }

      try {
        paper.sections[3] = parseTranslationSection(year, burningVocabularySupplementNormalized)
      } catch (error) {
        // Keep local-source translation when the manual source is incomplete.
      }

      try {
        paper.sections[4] = parseWritingSection(year, burningVocabularySupplementNormalized)
      } catch (error) {
        // Keep local-source writing when the manual source is incomplete.
      }
    }

    papers.push(paper)
  }

  papers.sort((left, right) => Number(right.year) - Number(left.year))

  const content =
    `import type { ExamPaper } from '@/types/study'\n\n` +
    `export const examPapers: ExamPaper[] = ${toTsString(papers)}\n\n` +
    `export const examPaperMap = new Map(examPapers.map((paper) => [paper.id, paper]))\n`

  await writeFile(path.join(projectRoot, 'src', 'data', 'examPapers.ts'), content, 'utf8')

  return {
    paperCount: papers.length,
    years: papers.map((paper) => paper.year),
  }
}

async function main() {
  const dictionaryCount = await generateRedbookDictionary()
  const examSourceCount = await dumpExamSources()
  const examPaperCount = await generateExamPapers()

  console.log(
    JSON.stringify(
      {
        dictionaryCount,
        ...examSourceCount,
        ...examPaperCount,
        outputDir,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
