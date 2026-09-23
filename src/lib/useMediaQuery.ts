import { useEffect, useState } from 'react'

/** 订阅一个 CSS 媒体查询，返回当前是否命中（响应式渲染，如判断手机端）。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)

    setMatches(media.matches)
    media.addEventListener('change', onChange)

    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}
