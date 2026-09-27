// 区间分段与配色：把标注区间切成互不重叠的文本段，同一段内可能叠加多条标注

export interface TextSegment {
  start: number
  end: number
  annotationIds: string[]
}

interface Interval {
  start: number
  end: number
  id: string
}

export function buildSegments(
  textLength: number,
  intervals: Interval[],
): TextSegment[] {
  // 忽略空区间与越界区间；valid 保持输入顺序，段内标注 ID 顺序与之对应
  const valid = intervals.filter(
    (iv) => iv.start >= 0 && iv.end <= textLength && iv.end > iv.start,
  )

  // 端点事件扫描：同一位置上先处理结束、再处理开始（半开区间 [start,end)，
  // 端点相接处旧标注退出与新标注进入相抵，不会出现在同一段里）
  const events: Array<{ pos: number; type: 'end' | 'start'; idx: number }> = []
  for (let i = 0; i < valid.length; i++) {
    events.push({ pos: valid[i].end, type: 'end', idx: i })
    events.push({ pos: valid[i].start, type: 'start', idx: i })
  }
  events.sort((x, y) => x.pos - y.pos || (x.type === 'end' ? -1 : 1))

  const segments: TextSegment[] = []
  const active = new Set<number>() // 覆盖当前扫描位置的 valid 下标
  let eventIdx = 0
  let pos = 0

  const emit = (end: number) => {
    if (end <= pos) return
    // 按下标排序即还原输入顺序：颜色叠加与点击检查的行为与逐段过滤一致
    const annotationIds = [...active].sort((a, b) => a - b).map((i) => valid[i].id)
    segments.push({ start: pos, end, annotationIds })
  }

  // 事件只随端点推进，活动集合增量维护，避免每段重新全量扫描所有区间
  while (eventIdx < events.length) {
    const p = events[eventIdx].pos
    emit(p)
    pos = p
    // 处理完同一位置的全部事件（先 end 后 start）再前进
    while (eventIdx < events.length && events[eventIdx].pos === p) {
      const ev = events[eventIdx]
      if (ev.type === 'end') active.delete(ev.idx)
      else active.add(ev.idx)
      eventIdx += 1
    }
  }
  emit(textLength)

  return segments
}

// ---------- 颜色混合 ----------

const PALETTE: Array<[number, number, number]> = [
  [255, 138, 128], // red
  [255, 213, 79], // amber
  [129, 199, 132], // green
  [100, 181, 246], // blue
  [186, 104, 200], // purple
  [255, 167, 38], // orange
  [77, 208, 225], // cyan
]

export function colorForId(id: string): [number, number, number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function toRgb(c: [number, number, number]) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/**
 * 多条标注叠加：以白色为底、各颜色半透明叠加后，再按 alpha 与白底混合，
 * 输出浏览器可直接使用的 rgb()。
 */
export function blendedColor(ids: string[], alpha = 0.38): string {
  if (ids.length === 0) return 'transparent'
  if (ids.length === 1) return toRgb(colorForId(ids[0]))

  let [r, g, b]: [number, number, number] = [255, 255, 255]
  for (const id of ids) {
    const [cr, cg, cb] = colorForId(id)
    ;[r, g, b] = blendOver([r, g, b], [cr, cg, cb], alpha)
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

function blendOver(
  base: number[],
  over: number[],
  alpha: number,
): [number, number, number] {
  return [
    base[0] * (1 - alpha) + over[0] * alpha,
    base[1] * (1 - alpha) + over[1] * alpha,
    base[2] * (1 - alpha) + over[2] * alpha,
  ]
}

/** 单条标注的徽章底色 */
export function badgeColor(id: string): string {
  return toRgb(colorForId(id))
}
