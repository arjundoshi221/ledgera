import type { MonthlyProjection } from "@/lib/types"

// ── Types ──

export interface YearlyDisplayRow {
  year: number
  incomeAfterTax: number
  livingExpenses: number
  inflationRate: number
  investableIncome: number
  amountInvested: number
  amountSpentRecreation: number
}

export interface FundYearlyRow {
  year: number
  fundName: string
  amountToInvest: number
  openingCapital: number
  pctInvestableIncome: number
  pctRevenue: number
  bankRate: number
  closingCapital: number
}

export interface AggregateResult {
  summaryRows: YearlyDisplayRow[]
  fundRows: Record<string, FundYearlyRow[]>
  fundNames: string[]
  totalWealthFinal: number
}

// ── Aggregation ──

export function aggregateToYearly(
  projections: MonthlyProjection[],
  fundReturns: Record<string, number>,   // percentages 0-100
  fundWeights: Record<string, number>,   // percentages 0-100
  inflationRate: number                  // decimal e.g. 0.03
): AggregateResult {
  if (projections.length === 0) {
    return { summaryRows: [], fundRows: {}, fundNames: [], totalWealthFinal: 0 }
  }

  // Group by year
  const byYear = new Map<number, MonthlyProjection[]>()
  for (const p of projections) {
    const yearStr = p.period.split("-")[0] ?? ""
    const year = parseInt(yearStr)
    let bucket = byYear.get(year)
    if (!bucket) {
      bucket = []
      byYear.set(year, bucket)
    }
    bucket.push(p)
  }

  const years = Array.from(byYear.keys()).sort()
  const firstProjection = projections[0]
  const fundNames = firstProjection ? Object.keys(firstProjection.bucket_allocations ?? {}) : []

  // Determine which funds are "recreation" (return = 0) vs "investment" (return > 0)
  const recreationFunds = new Set(
    fundNames.filter((f) => (Number(fundReturns[f]) || 0) === 0)
  )

  const summaryRows: YearlyDisplayRow[] = []
  const fundRows: Record<string, FundYearlyRow[]> = {}
  for (const f of fundNames) fundRows[f] = []

  let prevYearEndBalances: Record<string, number> = {}

  for (const year of years) {
    const months = byYear.get(year)
    if (!months || months.length === 0) continue

    // Aggregate flows
    let incomeAfterTax = 0
    let livingExpenses = 0
    let investableIncome = 0
    let amountInvested = 0
    let amountSpentRecreation = 0
    const fundContributions: Record<string, number> = {}
    for (const f of fundNames) fundContributions[f] = 0

    for (const m of months) {
      incomeAfterTax += m.net_income
      livingExpenses += m.expenses
      investableIncome += m.savings

      for (const f of fundNames) {
        const alloc = m.bucket_allocations?.[f] ?? 0
        fundContributions[f] = (fundContributions[f] ?? 0) + alloc
        if (recreationFunds.has(f)) {
          amountSpentRecreation += alloc
        } else {
          amountInvested += alloc
        }
      }
    }

    summaryRows.push({
      year,
      incomeAfterTax,
      livingExpenses,
      inflationRate,
      investableIncome,
      amountInvested,
      amountSpentRecreation,
    })

    // Per-fund rows
    const lastMonth = months[months.length - 1]
    if (!lastMonth) continue
    for (const f of fundNames) {
      const opening = prevYearEndBalances[f] ?? 0
      const closing = lastMonth.bucket_balances?.[f] ?? 0
      const contributions = fundContributions[f] ?? 0
      const revenue = closing - opening - contributions
      const pctRevenue = opening > 0 ? (revenue / opening) * 100 : 0

      const rows = fundRows[f]
      if (!rows) continue
      rows.push({
        year,
        fundName: f,
        amountToInvest: contributions,
        openingCapital: opening,
        pctInvestableIncome: Number(fundWeights[f]) || 0,
        pctRevenue,
        bankRate: Number(fundReturns[f]) || 0,
        closingCapital: closing,
      })
    }

    // Carry forward end-of-year balances
    prevYearEndBalances = { ...(lastMonth.bucket_balances ?? {}) }
  }

  // Total wealth = sum of all fund closing balances in the final year
  const totalWealthFinal = fundNames.reduce((s, f) => {
    const rows = fundRows[f]
    if (!rows || rows.length === 0) return s
    const last = rows[rows.length - 1]
    return s + (last ? last.closingCapital : 0)
  }, 0)

  return { summaryRows, fundRows, fundNames, totalWealthFinal }
}
