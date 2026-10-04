import { useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ErrorBar, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Dataset, Summary } from '../types'
import { fmtFold } from '../data'
import { ExportButton } from './ExportButton'

const SERIES = ['#2a6fdb', '#e0712c', '#2f9e74', '#b44bc4', '#c9a227', '#5b6b7f']

type Props = {
  dataset: Dataset
  selected: string[]
  setSelected: (ids: string[]) => void
  vitro: Map<string, Summary>
  vivo: Map<string, Summary>
  timepoint: string
}

export function Compare({ dataset, selected, setSelected, vitro, vivo, timepoint }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const allContexts = [...dataset.meta.cell_lines, ...dataset.meta.tissues]
  const [contexts, setContexts] = useState<string[]>(['HEK293', 'iPSC myotubes', 'iPSC neurons', 'Quadriceps', 'Brain'])
  const [adding, setAdding] = useState('')

  const lookup = (pid: string, ctx: string) =>
    dataset.meta.tissues.includes(ctx) ? vivo.get(`${pid}|${ctx}`) : vitro.get(`${pid}|${ctx}`)

  const data = contexts.map((ctx) => {
    const row: Record<string, string | number | null> = { context: ctx }
    for (const pid of selected) {
      const s = lookup(pid, ctx)
      row[pid] = s && s.n > 0 ? Number(s.log2Rel.toFixed(3)) : null
      row[`${pid}_sd`] = s && s.n > 0 ? Number(s.sd.toFixed(3)) : 0
    }
    return row
  })

  const missing = selected.flatMap((pid) =>
    contexts.filter((c) => !lookup(pid, c) || lookup(pid, c)!.n === 0).map((c) => `${pid} in ${c}`),
  )

  const toggleCtx = (c: string) => setContexts(contexts.includes(c) ? contexts.filter((x) => x !== c) : [...contexts, c])

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Compare promoters</h2>
          <p className="sub">Pick up to 6 promoters and the contexts to compare. Bars are mean ± SD, log2 vs CTRL-POS.</p>
        </div>
        <ExportButton target={ref} filename="promoter-comparison" />
      </header>

      <div className="controls">
        <div>
          <label className="lbl">Promoters</label>
          <ul className="chips">
            {selected.map((id, i) => (
              <li key={id} className="chip" style={{ borderColor: SERIES[i] }}>
                <span className="dot" style={{ background: SERIES[i] }} />
                {id}
                <button aria-label={`Remove ${id}`} onClick={() => setSelected(selected.filter((x) => x !== id))}>
                  ×
                </button>
              </li>
            ))}
            {selected.length < 6 && (
              <li>
                <select
                  value={adding}
                  onChange={(e) => {
                    if (e.target.value) setSelected([...selected, e.target.value])
                    setAdding('')
                  }}
                >
                  <option value="">+ add promoter</option>
                  {dataset.promoters
                    .filter((p) => !selected.includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} ({p.family})
                      </option>
                    ))}
                </select>
              </li>
            )}
          </ul>
        </div>
        <div>
          <label className="lbl">Contexts</label>
          <ul className="chips">
            {allContexts.map((c) => (
              <li key={c}>
                <button className={`chip toggle ${contexts.includes(c) ? 'on' : ''}`} onClick={() => toggleCtx(c)}>
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div ref={ref} className="chart-card">
        <h3>
          Promoter comparison <span className="muted">(log2 vs CTRL-POS; in vivo at {timepoint})</span>
        </h3>
        {selected.length === 0 || contexts.length === 0 ? (
          <p className="empty">Add at least one promoter and one context.</p>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="context" tick={{ fill: 'var(--text)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} label={{ value: 'log2 vs CTRL-POS', angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 12 }} />
              <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 3" />
              <Tooltip
                formatter={(v, name) => [typeof v === 'number' ? fmtFold(v) : 'not tested', String(name)]}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <Legend wrapperStyle={{ color: 'var(--text)' }} />
              {selected.map((pid, i) => (
                <Bar key={pid} dataKey={pid} fill={SERIES[i]} radius={[3, 3, 0, 0]}>
                  <ErrorBar dataKey={`${pid}_sd`} width={4} stroke="var(--text)" />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        {missing.length > 0 && <p className="note">No QC-passing data: {missing.join(' · ')}</p>}
      </div>
    </section>
  )
}
