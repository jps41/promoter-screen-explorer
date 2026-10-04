import { useRef } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Dataset, Promoter, QcSettings, Summary } from '../types'
import { colorFor, fmtFold, isIncluded } from '../data'
import { ExportButton } from './ExportButton'

type Props = {
  promoter: Promoter
  dataset: Dataset
  vitro: Map<string, Summary>
  vivo: Map<string, Summary>
  qc: QcSettings
  timepoint: string
  onAddToCompare: (id: string) => void
}

export function PromoterProfile({ promoter, dataset, vitro, vivo, qc, timepoint, onAddToCompare }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const rows = [
    ...dataset.meta.cell_lines.map((c) => vitro.get(`${promoter.id}|${c}`)),
    ...dataset.meta.tissues.map((t) => vivo.get(`${promoter.id}|${t}`)),
  ]
    .filter((s): s is Summary => !!s && s.n > 0)
    .map((s) => ({ name: `${s.context}${s.kind === 'in vivo' ? ' (vivo)' : ''}`, value: s.log2Rel, sd: s.sd, n: s.n }))

  const untested = [...dataset.meta.cell_lines, ...dataset.meta.tissues].filter(
    (c) => !vitro.has(`${promoter.id}|${c}`) && !vivo.has(`${promoter.id}|${c}`),
  )

  const flagged = [
    ...dataset.in_vitro
      .filter((r) => r.promoter_id === promoter.id && r.qc_flag)
      .map((r) => ({ src: r.experiment_id, ctx: r.context, detail: `rep ${r.replicate}`, flag: r.qc_flag! })),
    ...dataset.in_vivo
      .filter((r) => r.promoter_id === promoter.id && r.qc_flag && r.timepoint === timepoint)
      .map((r) => ({ src: r.study_id, ctx: r.context, detail: r.animal_id, flag: r.qc_flag! })),
  ]

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>{promoter.id}</h2>
          <p className="sub">
            {promoter.family} · {promoter.length_bp ? `${promoter.length_bp} bp` : 'no promoter'} · design round{' '}
            {promoter.design_round}
            {promoter.notes && ` · ${promoter.notes}`}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => onAddToCompare(promoter.id)}>
            Add to comparison
          </button>
          <ExportButton target={ref} filename={`${promoter.id}-profile`} />
        </div>
      </header>

      <div ref={ref} className="chart-card">
        <h3>
          {promoter.id}: expression by context <span className="muted">(log2 vs CTRL-POS, mean ± SD; in vivo at {timepoint})</span>
        </h3>
        {rows.length === 0 ? (
          <p className="empty">No QC-passing data for this promoter with the current filters.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34 + 60)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 32, top: 8, bottom: 8 }}>
              <CartesianGrid horizontal={false} stroke="var(--grid)" />
              <XAxis type="number" domain={['auto', 'auto']} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fill: 'var(--text)', fontSize: 12 }} />
              <ReferenceLine x={0} stroke="var(--muted)" strokeDasharray="4 3" />
              <Tooltip
                formatter={(v, _k, item) => {
                  const n = Number(v)
                  return [`${fmtFold(n)} (log2 ${n.toFixed(2)}, n=${(item as { payload?: { n?: number } }).payload?.n ?? '?'})`, 'vs CTRL-POS']
                }}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {rows.map((r) => (
                  <Cell key={r.name} fill={colorFor(r.value)} stroke="var(--border-strong)" />
                ))}
                <ErrorBar dataKey="sd" width={6} stroke="var(--text)" direction="x" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="two-col">
        <div>
          <h3>Not yet tested in</h3>
          {untested.length ? (
            <ul className="chips">
              {untested.map((c) => (
                <li key={c} className="chip muted">
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Tested in every context.</p>
          )}
        </div>
        <div>
          <h3>QC flags on this promoter</h3>
          {flagged.length === 0 ? (
            <p className="muted">None.</p>
          ) : (
            <table className="mini">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Context</th>
                  <th>Record</th>
                  <th>Flag</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((f, i) => (
                  <tr key={i}>
                    <td>{f.src}</td>
                    <td>{f.ctx}</td>
                    <td>{f.detail}</td>
                    <td title={dataset.meta.qc_flags[f.flag]}>{f.flag.replace(/_/g, ' ')}</td>
                    <td>{isIncluded(f.flag, qc) ? 'included' : 'excluded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
