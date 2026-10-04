import { useEffect, useMemo, useState } from 'react'
import type { Dataset, QcSettings } from './types'
import { loadDataset, summarizeInVitro, summarizeInVivo } from './data'
import { CoverageMatrix } from './components/CoverageMatrix'
import { PromoterProfile } from './components/PromoterProfile'
import { Compare } from './components/Compare'
import { QcReview } from './components/QcReview'

type Tab = 'coverage' | 'profile' | 'compare' | 'qc'

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('coverage')
  const [qc, setQc] = useState<QcSettings>({ excludedFlags: new Set() })
  const [timepoint, setTimepoint] = useState('Week 4')
  const [family, setFamily] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('SP-001')
  const [compareIds, setCompareIds] = useState<string[]>(['CTRL-POS', 'SP-002', 'SP-013', 'SP-036'])

  useEffect(() => {
    loadDataset()
      .then((d) => {
        setDataset(d)
        setQc({ excludedFlags: new Set(Object.keys(d.meta.qc_flags)) })
      })
      .catch((e) => setError(String(e)))
  }, [])

  const vitro = useMemo(() => (dataset ? summarizeInVitro(dataset.in_vitro, qc) : new Map()), [dataset, qc])
  const vivo = useMemo(() => (dataset ? summarizeInVivo(dataset.in_vivo, qc, timepoint) : new Map()), [dataset, qc, timepoint])

  if (error) return <div className="state">Error: {error}</div>
  if (!dataset) return <div className="state">Loading…</div>

  const families = ['All', ...new Set(dataset.promoters.map((p) => p.family))]
  const visible = dataset.promoters.filter(
    (p) => (family === 'All' || p.family === family) && p.id.toLowerCase().includes(search.toLowerCase()),
  )
  const promoter = dataset.promoters.find((p) => p.id === selected) ?? dataset.promoters[0]
  const excludedCount =
    dataset.in_vitro.filter((r) => r.qc_flag && qc.excludedFlags.has(r.qc_flag)).length +
    dataset.in_vivo.filter((r) => r.qc_flag && qc.excludedFlags.has(r.qc_flag)).length

  const openProfile = (id: string) => {
    setSelected(id)
    setTab('profile')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Promoter Screen Explorer</h1>
          <p className="tagline">
            Which promoters have been tested, where, and how did they do? <span className="badge">Synthetic demo data</span>
          </p>
        </div>
        <nav className="tabs" role="tablist">
          {(
            [
              ['coverage', 'Coverage'],
              ['profile', 'Promoter profile'],
              ['compare', 'Compare'],
              ['qc', `QC review (${excludedCount} excluded)`],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="filters">
        <label>
          Family
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            {families.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. SP-01" />
        </label>
        <label>
          In vivo timepoint
          <select value={timepoint} onChange={(e) => setTimepoint(e.target.value)}>
            {dataset.meta.timepoints.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {tab === 'profile' && (
          <label>
            Promoter
            <select value={promoter.id} onChange={(e) => setSelected(e.target.value)}>
              {visible.map((p) => (
                <option key={p.id}>{p.id}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <main>
        {tab === 'coverage' && (
          <CoverageMatrix
            promoters={visible}
            cellLines={dataset.meta.cell_lines}
            tissues={dataset.meta.tissues}
            vitro={vitro}
            vivo={vivo}
            timepoint={timepoint}
            onSelect={openProfile}
          />
        )}
        {tab === 'profile' && (
          <PromoterProfile
            promoter={promoter}
            dataset={dataset}
            vitro={vitro}
            vivo={vivo}
            qc={qc}
            timepoint={timepoint}
            onAddToCompare={(id) => {
              if (!compareIds.includes(id) && compareIds.length < 6) setCompareIds([...compareIds, id])
              setTab('compare')
            }}
          />
        )}
        {tab === 'compare' && (
          <Compare dataset={dataset} selected={compareIds} setSelected={setCompareIds} vitro={vitro} vivo={vivo} timepoint={timepoint} />
        )}
        {tab === 'qc' && <QcReview dataset={dataset} qc={qc} setQc={setQc} />}
      </main>

      <footer className="foot">
        All data is synthetic, generated by <code>scripts/generate_data.py</code>. {dataset.meta.normalization}
      </footer>
    </div>
  )
}
