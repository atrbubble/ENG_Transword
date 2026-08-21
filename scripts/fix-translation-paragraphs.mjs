/**
 * 修复 examPapers.ts 中所有年份的翻译段落划分。
 *
 * 问题：parseParagraphs 用 \n\n 分割，但 DOC 提取的 txt
 * 段落间只有单 \n，导致整篇翻译合并为一段。
 *
 * 做法：读取原始 generated txt，以单 \n 切行后，
 * 用 shouldStartNewParagraph 逐行判断是否开启新段落。
 * 仅重写 paragraphs 数组，不触及 prompts 等其他字段。
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const examPapersPath = path.join(projectRoot, 'src', 'data', 'examPapers.ts')
const generatedDir = path.join(projectRoot, 'scripts', 'generated')

// ---------------------------------------------------------------------------
// 文本清洗（与 generate-data.mjs 保持一致）
// ---------------------------------------------------------------------------
function sanitizeExtractedText(text) {
  return text
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    .replace(//g, '')
    .replace(//g, '')
    .replace(//g, '')
    .replace(//g, '')
    .replace(/ /g, ' ')
    .replace(/­/g, '')
    .replace(/　/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[]/g, "'")
    .replace(/[]/g, '"')
    .replace(/[]/g, '-')
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
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

function cleanInlineText(text) {
  return sanitizeExtractedText(text)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .trim()
}

// ---------------------------------------------------------------------------
// 段落识别
// ---------------------------------------------------------------------------
function shouldStartNewParagraph(previousLine, currentLine) {
  if (!previousLine) return true
  // 上一行以句末标点结束，当前行以大写或括号开头 → 新段落
  if (/^[A-Z"(]/.test(currentLine) && /[.!?]"?'?$/.test(previousLine)) return true
  return false
}

function extractTranslationParagraphs(rawText) {
  const normalized = sanitizeExtractedText(rawText)

  // 找到 Part C 翻译部分
  const partCMatch = normalized.match(/Part\s*C\b/i)
  if (!partCMatch || partCMatch.index === undefined) return null

  const afterPartC = normalized.slice(partCMatch.index + partCMatch[0].length)

  // 去掉 Directions 行
  const directionsEnd = afterPartC.search(
    /\(\s*10\s*points?\s*\)|（\s*10\s*points?\s*）|\(\s*10\s*points?\s*\)/i,
  )
  const bodyStart =
    directionsEnd >= 0
      ? afterPartC.indexOf('\n', directionsEnd) + 1
      : afterPartC.indexOf('\n') + 1

  const body = afterPartC.slice(bodyStart).trim()

  // 如果 line 49-50（重复的题号）出现在文本中，截断
  const repeated46Index = body.search(/\n\s*46\)\s+/)
  const articleText =
    repeated46Index > 0 ? body.slice(0, repeated46Index).trim() : body

  // 找到 Section III/Ⅲ Writing / Part A / 51. Directions 等写作部分标记并截断
  const writingBoundary = articleText.search(
    /\n\s*(?:Section\s+(?:III+|Ⅲ|[IVX]+)\s+Writing|(?:Part\s*[AB]|5[12][.．])\s*Directions:?)/i,
  )
  const cleanText =
    writingBoundary > 0 ? articleText.slice(0, writingBoundary).trim() : articleText

  // 按行拆分
  const lines = cleanText
    .split('\n')
    .map((line) => cleanInlineText(line))
    .filter(Boolean)
    .filter(
      (line) =>
        !/^Directions:?$/i.test(line) &&
        !/^Read the following/i.test(line) &&
        !/^Mark your answers/i.test(line) &&
        !/^Section\s+[IVX]+\b/i.test(line) &&
        !/^Part\s*[ABC]$/i.test(line) &&
        !/^\d+$/.test(line) &&
        !/^扫码下载掌上考研/i.test(line) &&
        !/^公众平台[:：]?/i.test(line),
    )

  // 逐行合并为段落
  const paragraphs = lines.reduce((acc, line) => {
    const prev = acc[acc.length - 1]
    if (!prev || shouldStartNewParagraph(prev, line)) {
      acc.push(line)
    } else {
      acc[acc.length - 1] = cleanInlineText(`${prev} ${line}`)
    }
    return acc
  }, [])

  // 修正过度拆分：如果前一段太短（≤1 句话且 <200 字符），
  // 且不含翻译标记 (46)-(50)，则合并到下一段。
  const translationMarkerRe = /\((?:46|47|48|49|50)\)/
  const merged = []
  for (const para of paragraphs) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      prev.length < 200 &&
      prev.split(/[.!?]\s/).length <= 2 &&
      !translationMarkerRe.test(prev)
    ) {
      merged[merged.length - 1] = cleanInlineText(`${prev} ${para}`)
    } else {
      merged.push(para)
    }
  }

  return merged.length > 1 ? merged : null
}

// ---------------------------------------------------------------------------
// 年份 → 源文件映射
// ---------------------------------------------------------------------------
const yearFileMap = {
  '2010': '20052016年历年考研英语真题集.txt',
  '2011': '20052016年历年考研英语真题集.txt',
  '2012': '20052016年历年考研英语真题集.txt',
  '2013': '20052016年历年考研英语真题集.txt',
  '2014': '20052016年历年考研英语真题集.txt',
  '2015': '20052016年历年考研英语真题集.txt',
  '2016': '20052016年历年考研英语真题集.txt',
  '2017': '2017考研英语（一)真题.txt',
  '2018': '2018考研英语（一)真题.txt',
  '2019': '2019考研英语（一)真题.txt',
  '2020': '2020年考研英语一真题.txt',
  '2021': '2021年考研英语一真题.txt',
  '2022': '2022年考研英语一真题.txt',
  '2023': '2023年考研英语一真题.txt',
  '2024': '2024年考研英语一真题.txt',
  // 2025 已是多段，跳过
  // 2026 已手动修复，跳过
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function main() {
  console.log('Reading examPapers.ts...')
  let source = await readFile(examPapersPath, 'utf-8')

  let fixedCount = 0
  let unchangedCount = 0
  let failedCount = 0

  for (const [year, fileName] of Object.entries(yearFileMap)) {
    const sectionId = `${year}-translation`
    console.log(`\n--- ${year} (${fileName}) ---`)

    try {
      const rawPath = path.join(generatedDir, fileName)
      const rawContent = await readFile(rawPath, 'utf-8')

      // 对于合集文件，需要提取目标年份的文本
      let yearText = rawContent
      if (year >= '2010' && year <= '2016') {
        // 合集文件：提取特定年份
        const yearHeading = new RegExp(
          `${year}年[^\\n]*`,
          'g',
        )
        const matches = [...rawContent.matchAll(yearHeading)]
        if (matches.length > 0) {
          const startIndex = matches[0].index ?? 0
          // 找到下一个年份标题或文件末尾
          const nextYearMatch = rawContent
            .slice(startIndex + 10)
            .match(/20(?:0[5-9]|1[0-6])年[^\n]*/)
          const endIndex = nextYearMatch
            ? startIndex + 10 + (nextYearMatch.index ?? 0)
            : rawContent.length
          yearText = rawContent.slice(startIndex, endIndex)
        }
      }

      const paragraphs = extractTranslationParagraphs(yearText)

      if (!paragraphs || paragraphs.length <= 1) {
        console.log(`  → 未能从原始文本中提取多段落，保持原样`)
        unchangedCount++
        continue
      }

      console.log(
        `  → 提取到 ${paragraphs.length} 段: ${paragraphs.map((p) => p.slice(0, 50)).join(' | ')}`,
      )

      // 在 examPapers.ts 中定位并替换这个年份的翻译 paragraphs
      const sectionPattern = new RegExp(
        `("id":\\s*"${sectionId}"[\\s\\S]*?"paragraphs":\\s*)\\[[\\s\\S]*?\\](\\s*,\\s*"prompts")`,
        'm',
      )

      const newParagraphsJson = JSON.stringify(paragraphs, null, 10)
        .replace(/^\[\n\s*/, '[\n          ')
        .replace(/\n\s*\]$/, '\n        ]')

      const newSource = source.replace(sectionPattern, (match, before, after) => {
        return `${before}${newParagraphsJson}${after}`
      })

      if (newSource !== source) {
        source = newSource
        fixedCount++
        console.log(`  ✓ 已替换`)
      } else {
        console.log(`  ✗ 替换失败: 未匹配到 section pattern`)
        failedCount++
      }
    } catch (err) {
      console.error(`  ✗ 出错: ${err.message}`)
      failedCount++
    }
  }

  // 写回
  if (fixedCount > 0) {
    console.log(`\n写入 examPapers.ts (${fixedCount} 年已修复)...`)
    await writeFile(examPapersPath, source, 'utf-8')
    console.log('完成。')
  }

  console.log(
    `\n汇总: ${fixedCount} 修复 / ${unchangedCount} 未变 / ${failedCount} 失败`,
  )
}

main().catch(console.error)
