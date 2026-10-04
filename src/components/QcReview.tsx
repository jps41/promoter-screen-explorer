import type { Dataset, QcSettings } from '../types'

type Props = { dataset: Dataset; qc: QcSettings; setQc: (qc: QcSettings) => void }

export function QcReview({ dataset, qc, setQc }: Props) {
  const counts = new Map<string, { vitro: number; vivo: number; promoters: Set<string> }>()
  for (const code of Object.keys(dataset.meta.qc_flags)) counts.set(code, { vitro: 0, vivo: 0, promoters: new Set() })
  for (const r of dataset.in_vitro)
    if (r.qc_flag) {
      counts.get(r.qc_flag)!.vitro++
      counts.get(r.qc_flag)!.promoters.add(r.promoter_id)
    }
  for (const r of dataset.in_vivo)
    if (r.qc_flag) {
      counts.get(r.qc_flag)!.vivo++
      counts.get(r.qc_flag)!.promoters.add(r.promoter_id)
    }

  const toggle = (code: string) => {
    const next = new Set(qc.excludedFlags)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setQc({ excludedFlags: next })
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>QC review</h2>
          <p className="sub">
            Decide which flagged records count. Every view updates immediately, so you can see how much a conclusion
            depends on questionable data.
          </p>
        </div>
      </header>
      <table className="qc-table">
        <thead>
          <tr>
            <th>Flag</th>
            <th>Meaning</th>
            <th className="num">In vitro records</th>
            <th className="num">In vivo records</th>
            <th className="num">Promoters affected</th>
            <th>Use in analysis</th>
          </tr>
        </thead>
        <tbody>
          {[...counts].map(([code, c]) => (
            <tr key={code}>
              <td>
                <code>{code}</code>
              </td>
              <td>{dataset.meta.qc_flags[code]}</td>
              <td className="num">{c.vitro}</td>
              <td className="num">{c.vivo}</td>
              <td className="num">{c.promoters.size}</td>
              <td>
                <label className="switch">
                  <input type="checkbox" checked={!qc.excludedFlags.has(code)} onChange={() => toggle(code)} />
                  <span>{qc.excludedFlags.has(code) ? 'Excluded' : 'Included'}</span>
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
