export type Promoter = {
  id: string
  family: string
  length_bp: number
  design_round: string
  is_control: boolean
  notes: string
}

export type InVitroRecord = {
  experiment_id: string
  promoter_id: string
  context: string
  replicate: number
  relative_expression: number
  pct_positive: number
  qc_flag: string | null
}

export type InVivoRecord = {
  study_id: string
  route: string
  animal_id: string
  promoter_id: string
  context: string
  timepoint: string
  radiance: number
  qc_flag: string | null
}

export type Dataset = {
  meta: {
    description: string
    seed: number
    normalization: string
    qc_flags: Record<string, string>
    cell_lines: string[]
    tissues: string[]
    timepoints: string[]
  }
  promoters: Promoter[]
  in_vitro: InVitroRecord[]
  in_vivo: InVivoRecord[]
}

/** One summarized value for a promoter in one context (cell line or tissue). */
export type Summary = {
  promoterId: string
  context: string
  kind: 'in vitro' | 'in vivo'
  /** mean log2 expression relative to CTRL-POS (0 = equal to reference) */
  log2Rel: number
  /** standard deviation of log2 values across replicates / animals */
  sd: number
  n: number
  /** number of records dropped by the QC filter */
  excluded: number
  sources: string[]
}

export type QcSettings = {
  /** flag codes whose records are excluded */
  excludedFlags: Set<string>
}
