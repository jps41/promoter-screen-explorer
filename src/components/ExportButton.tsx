import { toPng } from 'html-to-image'
import type { RefObject } from 'react'

type Props = { target: RefObject<HTMLElement | null>; filename: string }

/** Saves the referenced panel as a PNG, ready to drop into a slide. */
export function ExportButton({ target, filename }: Props) {
  async function save() {
    if (!target.current) return
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#ffffff'
    const url = await toPng(target.current, { pixelRatio: 2, backgroundColor: bg })
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.png`
    a.click()
  }
  return (
    <button className="btn ghost" onClick={save} title="Download this panel as a PNG">
      Export PNG
    </button>
  )
}
