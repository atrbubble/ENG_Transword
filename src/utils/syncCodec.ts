// 扫码同步的编解码：把学习数据 gzip 压缩 → base64 → 按二维码容量切成多帧；
// 手机端逐帧解码后拼装还原。全程离线，无需后端。
//
// 帧格式：`TWSYNC|总帧数|当前帧序号|base64片段`（序号从 1 开始）。
// 之所以不用 URL 而是原始文本，是因为接收端用本应用内置摄像头（jsQR）连续识别，
// 可以拿到任意文本，容量也更大。

const MAGIC = 'TWSYNC'

// 单帧 base64 字符上限。二维码 byte 模式（纠错级别 M≈15%）容量约 2331 字节，
// 留出余量保证摄像头能稳定识别。
const CHUNK_CHARS = 1600

export interface SyncFrame {
  total: number
  index: number
  chunk: string
}

async function gzipText(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))

  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzipText(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))

  return new Response(stream).text()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }

  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

/** 把任意数据编码成一串扫码帧（按容量切分）。 */
export async function buildSyncFrames(payload: unknown): Promise<string[]> {
  const compressed = bytesToBase64(await gzipText(JSON.stringify(payload)))
  const total = Math.ceil(compressed.length / CHUNK_CHARS)
  const frames: string[] = []

  for (let index = 0; index < total; index += 1) {
    const chunk = compressed.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS)

    frames.push(`${MAGIC}|${total}|${index + 1}|${chunk}`)
  }

  return frames
}

/** 解析扫码得到的文本；不是同步帧时返回 null（便于摄像头忽略误识别的内容）。 */
export function parseSyncFrame(text: string): SyncFrame | null {
  const parts = text.split('|')

  if (parts.length !== 4 || parts[0] !== MAGIC) {
    return null
  }

  const total = Number(parts[1])
  const index = Number(parts[2])

  if (!Number.isInteger(total) || !Number.isInteger(index) || index < 1 || index > total) {
    return null
  }

  return { total, index, chunk: parts[3] }
}

/** 收齐全部帧后拼装还原为原始数据。 */
export async function assembleSyncFrames(frames: SyncFrame[]): Promise<unknown> {
  const ordered = [...frames].sort((left, right) => left.index - right.index)
  const base64 = ordered.map((frame) => frame.chunk).join('')

  return JSON.parse(await gunzipText(base64ToBytes(base64)))
}
