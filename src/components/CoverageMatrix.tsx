import { useRef } from 'react'
import type { Promoter, Summary } from '../types'
import { colorFor, fmtFold } from '../data'
import { ExportButton } from './ExportButton'

type Props = {
  promoters: Promoter[]
  cellLines: string[]
  tissues: string[]
  vitro: Map<string, Summary>
  vivo: Map<string, Summary>
  timepoint: string
  onSelect: (promoterId: string) => void
}

function Cell({ s, onClick }: { s: Summary | undefined; onClick: () => void }) {
  if (!s) return <td className="cell untested" title="Not tested" />
  const allExcluded = s.n === 0
  const label = allExcluded
    ? `${s.promoterId} · ${s.context}: tested, but every record is QC-excluded (${s.excluded})`
    : `${s.promoterId} · ${s.context}: ${fmtFold(s.log2Rel)} vs CTRL-POS (n=${s.n}${s.excluded ? `, ${s.excluded} excluded` : ''})\nSource: ${s.sources.join(', ')}`
  return (
    <td
      className={`cell ${allExcluded ? 'flagged' : ''} ${s.excluded && !allExcluded ? 'partial' : ''}`}
      style={allExcluded ? undefined : { background: colorFor(s.log2Rel) }}
      title={label}
      onClick={onClick}
    />
  )
}

export function CoverageMatrix({ promoters, cellLines, tissues, vitro, vivo, timepoint, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const testedCount = (p: Promoter) =>
    [...cellLines.map((c) => vitro.get(`${p.id}|${c}`)), ...tissues.map((t) => vivo.get(`${p.id}|${t}`))].filter(Boolean)
      .length

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Where has each promoter been tested?</h2>
          <p className="sub">
            Color shows expression relative to CTRL-POS (in vivo at {timepoint}). Empty cells were never tested. Click a
            row to open its profile.
          </p>
        </div>
        <ExportButton target={ref} filename="coverage-matrix" />
      </header>
      <div className="matrix-wrap" ref={ref}>
        <table className="matrix">
          <thead>
            <tr>
              <th />
              <th colSpan={cellLines.length} className="group">
                In vitro
              </th>
              <th colSpan={tissues.length} className="group">
                In vivo
              </th>
              <th />
            </tr>
            <tr>
              <th className="rowhead">Promoter</th>
              {[...cellLines, ...tissues].map((c) => (
                <th key={c} className="colhead">
                  <span>{c}</span>
                </th>
              ))}
              <th className="colhead num">
                <span>Contexts</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {promoters.map((p) => (
              <tr key={p.id}>
                <th className="rowhead">
                  <button className="linklike" onClick={() => onSelect(p.id)}>
                    {p.id}
                  </button>
                  <span className="fam">{p.family}</span>
                </th>
                {cellLines.map((c) => (
                  <Cell key={c} s={vitro.get(`${p.id}|${c}`)} onClick={() => onSelect(p.id)} />
                ))}
                {tissues.map((t) => (
                  <Cell key={t} s={vivo.get(`${p.id}|${t}`)} onClick={() => onSelect(p.id)} />
                ))}
                <td className="num count">{testedCount(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="legend">
          <span className="swatch" style={{ background: colorFor(-5) }} /> 32× weaker
          <span className="swatch" style={{ background: colorFor(0) }} /> equal to CTRL-POS
          <span className="swatch" style={{ background: colorFor(5) }} /> 32× stronger
          <span className="swatch untested" /> not tested
          <span className="swatch flagged" /> tested, all records QC-excluded
          <span className="swatch partial-demo" /> some records excluded
        </div>
      </div>
    </section>
  )
}
