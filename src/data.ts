import type { Dataset, InVitroRecord, InVivoRecord, QcSettings, Summary } from './types'

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/dataset.json`)
  if (!res.ok) throw new Error(`Could not load dataset (${res.status})`)
  return res.json()
}

const log2 = (x: number) => Math.log2(Math.max(x, 1e-6))

function meanSd(values: number[]) {
  const n = values.length
  if (n === 0) return { mean: NaN, sd: NaN }
  const mean = values.reduce((a, b) => a + b, 0) / n
  const sd = n > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
  return { mean, sd }
}

export const isIncluded = (flag: string | null, qc: QcSettings) => !flag || !qc.excludedFlags.has(flag)

/** In vitro values are already normalized to CTRL-POS within each experiment and cell line. */
export function summarizeInVitro(records: InVitroRecord[], qc: QcSettings): Map<string, Summary> {
  const groups = new Map<string, InVitroRecord[]>()
  for (const r of records) {
    const key = `${r.promoter_id}|${r.context}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  const out = new Map<string, Summary>()
  for (const [key, rows] of groups) {
    const kept = rows.filter((r) => isIncluded(r.qc_flag, qc))
    const { mean, sd } = meanSd(kept.map((r) => log2(r.relative_expression)))
    out.set(key, {
      promoterId: rows[0].promoter_id,
      context: rows[0].context,
      kind: 'in vitro',
      log2Rel: mean,
      sd,
      n: kept.length,
      excluded: rows.length - kept.length,
      sources: [...new Set(rows.map((r) => r.experiment_id))],
    })
  }
  return out
}

/**
 * In vivo radiance is normalized here: each animal's value is divided by the mean
 * CTRL-POS radiance (QC-passing animals only) in the same study, tissue and timepoint.
 */
export function summarizeInVivo(records: InVivoRecord[], qc: QcSettings, timepoint: string): Map<string, Summary> {
  const atTp = records.filter((r) => r.timepoint === timepoint)
  const refs = new Map<string, number[]>()
  for (const r of atTp) {
    if (r.promoter_id !== 'CTRL-POS' || !isIncluded(r.qc_flag, qc)) continue
    const k = `${r.study_id}|${r.context}`
    if (!refs.has(k)) refs.set(k, [])
    refs.get(k)!.push(r.radiance)
  }
  const refMean = new Map([...refs].map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]))

  const groups = new Map<string, InVivoRecord[]>()
  for (const r of atTp) {
    const key = `${r.promoter_id}|${r.context}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  const out = new Map<string, Summary>()
  for (const [key, rows] of groups) {
    const kept = rows.filter((r) => isIncluded(r.qc_flag, qc) && refMean.has(`${r.study_id}|${r.context}`))
    const vals = kept.map((r) => log2(r.radiance / refMean.get(`${r.study_id}|${r.context}`)!))
    const { mean, sd } = meanSd(vals)
    out.set(key, {
      promoterId: rows[0].promoter_id,
      context: rows[0].context,
      kind: 'in vivo',
      log2Rel: mean,
      sd,
      n: kept.length,
      excluded: rows.length - kept.length,
      sources: [...new Set(rows.map((r) => r.study_id))],
    })
  }
  return out
}

/** Diverging color for log2 relative expression: blue below reference, warm above. */
export function colorFor(v: number): string {
  if (Number.isNaN(v)) return 'var(--cell-flagged)'
  const t = Math.max(-1, Math.min(1, v / 5))
  if (t >= 0) {
    const l = 92 - 42 * t
    return `hsl(18 75% ${l}%)`
  }
  const l = 92 + 50 * t
  return `hsl(212 60% ${l}%)`
}

export const fmtFold = (log2Rel: number) => {
  if (Number.isNaN(log2Rel)) return '—'
  const fold = 2 ** log2Rel
  return fold >= 10 ? `${fold.toFixed(0)}×` : fold >= 0.1 ? `${fold.toFixed(2)}×` : `${fold.toExponential(1)}×`
}
