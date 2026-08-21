import { describe, expect, it } from 'vitest'

import { splitPassageParagraphs } from '@/utils/cloze'

describe('cloze utils', () => {
  it('keeps real numbers and replaces underscored blanks', () => {
    const [segments] = splitPassageParagraphs(
      [
        "In 1924 America's factory hoped lighting ___1___ workers' productivity, while 1% of examples stayed untouched.",
      ],
      [1],
    )

    expect(segments).toEqual([
      {
        type: 'text',
        value: "In 1924 America's factory hoped lighting ",
      },
      {
        type: 'placeholder',
        value: '(1)_____',
        number: '1',
      },
      {
        type: 'text',
        value: " workers' productivity, while 1% of examples stayed untouched.",
      },
    ])
  })

  it('replaces bare OCR blank numbers in order', () => {
    const [segments] = splitPassageParagraphs(
      ['That is 1 a study conducted 3 1932 unique subjects which 4 pairs of unrelated friends.'],
      [1, 2, 3, 4],
    )

    expect(segments).toEqual([
      {
        type: 'text',
        value: 'That is ',
      },
      {
        type: 'placeholder',
        value: '(1)_____',
        number: '1',
      },
      {
        type: 'text',
        value: ' a study conducted ',
      },
      {
        type: 'placeholder',
        value: '(3)_____',
        number: '3',
      },
      {
        type: 'text',
        value: ' 1932 unique subjects which ',
      },
      {
        type: 'placeholder',
        value: '(4)_____',
        number: '4',
      },
      {
        type: 'text',
        value: ' pairs of unrelated friends.',
      },
    ])
  })

  it('supports full-width blank numbers', () => {
    const [segments] = splitPassageParagraphs(
      ['It may involve not only his parents and his friends,１those of the young women.'],
      [1],
    )

    expect(segments).toEqual([
      {
        type: 'text',
        value: 'It may involve not only his parents and his friends,',
      },
      {
        type: 'placeholder',
        value: '(1)_____',
        number: '1',
      },
      {
        type: 'text',
        value: 'those of the young women.',
      },
    ])
  })
})
