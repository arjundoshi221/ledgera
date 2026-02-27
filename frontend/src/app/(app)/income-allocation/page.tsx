"use client"

import { Fragment, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getIncomeAllocation, createOrUpdateAllocationOverride, deleteAllocationOverride, getWorkspace } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { IncomeAllocationResponse } from "@/lib/types"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="inline-block ml-1 h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function IncomeAllocationPage() {
  const [data, setData] = useState<IncomeAllocationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [years, setYears] = useState("1")
  const [baseCurrency, setBaseCurrency] = useState("")
  const [minWcBalance, setMinWcBalance] = useState(0)
  const { toast } = useToast()

  // Track which cell is being edited: key = "year-month-fundId"
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Track WC amount editing
  const [editingWcCell, setEditingWcCell] = useState<string | null>(null)
  const [editWcValue, setEditWcValue] = useState("")

  async function loadData(silent = false) {
    try {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      const [result, ws] = await Promise.all([
        getIncomeAllocation(parseInt(years)),
        getWorkspace(),
      ])
      setData(result)
      setBaseCurrency(ws.base_currency)
      setMinWcBalance(ws.min_wc_balance ?? 0)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load income allocation", description: err.message })
    } finally {
      if (silent) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadData()
  }, [years])

  function fmt(val: number | string) {
    const n = typeof val === "string" ? parseFloat(val) : val
    if (n === 0) return "-"
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtPct(val: number | string) {
    const n = typeof val === "string" ? parseFloat(val) : val
    return `${n.toFixed(1)}%`
  }

  // --- Non-WC fund percentage editing ---

  function handleCellClick(year: number, month: number, fundId: string, currentPct: number) {
    const key = `${year}-${month}-${fundId}`
    setEditingCell(key)
    setEditValue(currentPct.toFixed(1))
  }

  async function handleCellBlur(year: number, month: number, fundId: string, originalPct: number) {
    const newPct = parseFloat(editValue)

    // If unchanged or invalid, just cancel edit
    if (isNaN(newPct) || newPct === originalPct) {
      setEditingCell(null)
      return
    }

    // Validate range
    if (newPct < 0 || newPct > 100) {
      toast({ variant: "destructive", title: "Percentage must be between 0 and 100" })
      setEditingCell(null)
      return
    }

    setSaving(true)
    try {
      await createOrUpdateAllocationOverride({
        fund_id: fundId,
        year,
        month,
        allocation_percentage: newPct,
      })
      toast({ title: "Allocation updated" })
      setEditingCell(null)
      await loadData(true) // Reload to show updated values
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to save", description: err.message })
    } finally {
      setSaving(false)
    }
  }

  function handleCellKeyDown(e: React.KeyboardEvent, year: number, month: number, fundId: string, originalPct: number) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleCellBlur(year, month, fundId, originalPct)
    } else if (e.key === "Escape") {
      setEditingCell(null)
    }
  }

  // --- Working Capital amount editing ---

  function handleWcCellClick(year: number, month: number, fundId: string, currentAmount: number) {
    const key = `${year}-${month}-${fundId}`
    setEditingWcCell(key)
    setEditWcValue(currentAmount.toFixed(2))
  }

  async function handleWcCellBlur(year: number, month: number, fundId: string, originalAmount: number) {
    const newAmount = parseFloat(editWcValue)

    if (isNaN(newAmount) || newAmount === originalAmount) {
      setEditingWcCell(null)
      return
    }

    if (newAmount < 0) {
      toast({ variant: "destructive", title: "Amount must be >= 0" })
      setEditingWcCell(null)
      return
    }

    setSaving(true)
    try {
      await createOrUpdateAllocationOverride({
        fund_id: fundId,
        year,
        month,
        override_amount: newAmount,
      })
      toast({ title: "Working Capital updated" })
      setEditingWcCell(null)
      await loadData(true)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to save", description: err.message })
    } finally {
      setSaving(false)
    }
  }

  function handleWcCellKeyDown(e: React.KeyboardEvent, year: number, month: number, fundId: string, originalAmount: number) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleWcCellBlur(year, month, fundId, originalAmount)
    } else if (e.key === "Escape") {
      setEditingWcCell(null)
    }
  }

  async function handleUseModelAmount(year: number, month: number, fundId: string) {
    setSaving(true)
    try {
      await deleteAllocationOverride(fundId, year, month)
      toast({ title: "Reset to model amount" })
      await loadData(true)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to reset", description: err.message })
    } finally {
      setSaving(false)
    }
  }

  /** Compute optimized WC target using projected balance.
   *  Projects WC balance after income & expenses. If it stays above minimum,
   *  just cover actual costs (maximize savings). If below, add the shortfall. */
  function computeOptimizedWcTarget(row: typeof data extends null ? never : NonNullable<typeof data>["rows"][0]) {
    const A = Number(row.actual_fixed_cost)
    const projected = Number(row.wc_prev_closing_balance) + Number(row.net_income) - A
    const shortfall = Math.max(0, minWcBalance - projected)
    const target = A + shortfall
    return Math.max(Math.round(target * 100) / 100, 0)
  }

  async function handleOptimize(year: number, month: number, fundId: string, actualFixedCost: number) {
    const row = data?.rows.find(r => r.year === year && r.month === month)
    const target = row ? computeOptimizedWcTarget(row) : actualFixedCost + minWcBalance

    setSaving(true)
    try {
      await createOrUpdateAllocationOverride({
        fund_id: fundId,
        year,
        month,
        override_amount: target,
      })
      toast({ title: "Optimized to actual costs" })
      await loadData(true)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to optimize", description: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading income allocation...</div>
  }

  const fundsHeaders = data?.funds_meta ?? []
  const currentMonthRow = data?.rows.find(r => !r.is_locked)
  const allocSumInvalid = currentMonthRow
    ? Math.abs(Number(currentMonthRow.total_fund_allocation_pct) - 100) > 0.1
    : false

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Income Allocation</h1>
          <div className="flex items-center gap-3">
            {refreshing && (
              <span className="text-xs text-muted-foreground animate-pulse">Refreshing...</span>
            )}
            <Label>History:</Label>
            <Select value={years} onValueChange={setYears}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Year</SelectItem>
                <SelectItem value="2">2 Years</SelectItem>
                <SelectItem value="3">3 Years</SelectItem>
                <SelectItem value="5">5 Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Budget Benchmark Banner */}
        {data && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardContent className="py-3">
              {data.active_scenario_name ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Budget Model: </span>
                    <span className="text-sm">{data.active_scenario_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({baseCurrency} {Number(data.budget_benchmark).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo)
                    </span>
                  </div>
                  <a href="/projections" className="text-xs underline text-blue-600 dark:text-blue-400">
                    Change
                  </a>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No active budget simulation.{" "}
                  <a href="/projections" className="underline text-blue-600 dark:text-blue-400">
                    Create one in Projections
                  </a>{" "}
                  to set allocated fixed costs.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 100% Validation Warning */}
        {allocSumInvalid && currentMonthRow && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardContent className="py-3">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                Fund allocations for {MONTH_NAMES[currentMonthRow.month - 1]} {currentMonthRow.year} sum to{" "}
                <span className="font-semibold">
                  {Number(currentMonthRow.total_fund_allocation_pct).toFixed(1)}%
                </span>{" "}
                instead of 100%. Click a fund percentage to adjust.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Self-Funding Detection Warning */}
        {data && data.self_funding_warnings && data.self_funding_warnings.length > 0 && (
          <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
            <CardContent className="py-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  Self-Funding Detected
                </div>
                {data.self_funding_warnings.map((w) => (
                  <div key={w.fund_id} className="text-sm text-purple-700 dark:text-purple-300">
                    {w.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data && data.rows.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm [&_td]:align-top">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 z-10">Year</th>
                      <th className="px-3 py-2 text-left font-medium">Month</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Net Income
                        <InfoTooltip text="Only includes income assigned to Working Capital" />
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Allocated Budget
                        <InfoTooltip text="Previous month's Net Income" />
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Allocated Fixed Cost
                        <InfoTooltip text="From budget model" />
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Actual Fixed Costs</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Fixed Cost Opt.
                        <InfoTooltip text="Working Capital - Actual Fixed Costs" />
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Savings Remainder
                        <InfoTooltip text="Allocated Budget - Working Capital" />
                      </th>
                      {fundsHeaders.map((f) => (
                        <th key={f.fund_id} colSpan={2} className="px-3 py-2 text-center font-medium border-l">
                          <div>{f.emoji} {f.fund_name}</div>
                          {f.linked_account_names && f.linked_account_names.length > 0 && (
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {f.linked_account_names.join(", ")}
                            </div>
                          )}
                          {f.is_self_funding && (
                            <Badge variant="secondary" className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 mt-0.5">
                              {f.self_funding_percentage === 100 ? "Self-Funding" : `${f.self_funding_percentage}% Self-Funding`}
                            </Badge>
                          )}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="sticky left-0 bg-muted/30 z-10" />
                      <th />
                      <th />
                      <th />
                      <th />
                      <th />
                      <th />
                      <th />
                      {fundsHeaders.map((f) => (
                        <Fragment key={f.fund_id}>
                          <th className="px-3 py-1 text-right border-l">Amount</th>
                          <th className="px-3 py-1 text-right">{f.fund_name === "Working Capital" ? "%" : "% of Sav"}</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, idx) => {
                      const optColor = Number(row.fixed_cost_optimization) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                      const savColor = Number(row.savings_remainder) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                      const rowAllocInvalid = !row.is_locked && Math.abs(Number(row.total_fund_allocation_pct) - 100) > 0.1
                      return (
                        <tr
                          key={idx}
                          className={cn(
                            "border-b hover:bg-muted/20",
                            rowAllocInvalid && "bg-amber-50 dark:bg-amber-950/20"
                          )}
                        >
                          <td className="px-3 py-2 font-medium sticky left-0 bg-background z-10">{row.year}</td>
                          <td className="px-3 py-2">
                            {MONTH_NAMES[row.month - 1]}
                            {!row.is_locked && (
                              <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1">
                                Current
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(row.current_month_income)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(row.net_income)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(row.allocated_fixed_cost)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmt(row.actual_fixed_cost)}</td>
                          <td className={`px-3 py-2 text-right font-mono ${optColor}`}>
                            <div>{fmt(row.fixed_cost_optimization)}</div>
                            {!row.is_locked && Number(row.fixed_cost_optimization) > 0 && (
                              <div className="text-[9px] text-green-600/70 dark:text-green-400/70 mt-0.5">
                                Transfer surplus to savings
                              </div>
                            )}
                            {!row.is_locked && Number(row.fixed_cost_optimization) < 0 && (
                              <div className="text-[9px] text-red-600/70 dark:text-red-400/70 mt-0.5">
                                Top up WC or cut costs
                              </div>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono ${savColor}`}>
                            <div>{fmt(row.savings_remainder)}</div>
                            <div className="text-[10px] text-muted-foreground/60">
                              {fmtPct(row.savings_pct_of_income)} of inc
                            </div>
                          </td>
                          {row.fund_allocations.map((fa) => {
                            const cellKey = `${row.year}-${row.month}-${fa.fund_id}`
                            const isWc = fa.fund_name === "Working Capital"
                            const isEditing = editingCell === cellKey
                            const isEditingWc = editingWcCell === cellKey
                            const isEditable = !row.is_locked && !isWc
                            const isWcEditable = !row.is_locked && isWc

                            return (
                              <Fragment key={fa.fund_id}>
                                {/* Amount column */}
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right font-mono border-l",
                                    isWcEditable && "cursor-pointer hover:bg-muted/50"
                                  )}
                                  onClick={() => !saving && isWcEditable && handleWcCellClick(row.year, row.month, fa.fund_id, Number(fa.allocated_amount))}
                                >
                                  {isEditingWc ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editWcValue}
                                      onChange={(e) => setEditWcValue(e.target.value)}
                                      onBlur={() => handleWcCellBlur(row.year, row.month, fa.fund_id, Number(fa.allocated_amount))}
                                      onKeyDown={(e) => handleWcCellKeyDown(e, row.year, row.month, fa.fund_id, Number(fa.allocated_amount))}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className="w-24 h-7 text-right"
                                      autoFocus
                                      disabled={saving}
                                    />
                                  ) : (
                                    <div>
                                      <div className="text-right">{fmt(fa.allocated_amount)}</div>
                                      {!isWc && fa.is_self_funding && Number(fa.self_funding_amount) > 0 && (
                                        <div className="text-[9px] text-purple-600 dark:text-purple-400 mt-0.5 text-right">
                                          {fa.self_funding_percentage === 100
                                            ? "Stays in WC account"
                                            : `${fmt(fa.self_funding_amount ?? 0)} stays in WC`}
                                        </div>
                                      )}
                                      {isWc && (() => {
                                        const projected = Number(row.wc_prev_closing_balance) + Number(row.net_income) - Number(row.actual_fixed_cost)
                                        const shortfall = Math.max(0, minWcBalance - projected)
                                        return (
                                          <div className="text-[9px] text-muted-foreground/60 mt-0.5 text-right">
                                            Proj: {fmt(projected)} | Min: {fmt(minWcBalance)}{shortfall > 0 ? ` | Shortfall: ${fmt(shortfall)}` : ""}
                                          </div>
                                        )
                                      })()}
                                      {isWc && isWcEditable && (
                                        <div className="flex justify-end gap-1 mt-0.5">
                                          {fa.override_amount != null && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-5 px-1.5 text-[10px] text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 whitespace-nowrap"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleUseModelAmount(row.year, row.month, fa.fund_id)
                                              }}
                                              disabled={saving}
                                            >
                                              Use Model
                                            </Button>
                                          )}
                                          {Math.abs(Number(fa.allocated_amount) - computeOptimizedWcTarget(row)) > 0.01 && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-5 px-1.5 text-[10px] text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 whitespace-nowrap"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleOptimize(row.year, row.month, fa.fund_id, Number(row.actual_fixed_cost))
                                              }}
                                              disabled={saving}
                                            >
                                              Optimize
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                {/* Percentage column */}
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right",
                                    isWc
                                      ? "text-muted-foreground/60"
                                      : isEditable
                                        ? "text-muted-foreground cursor-pointer hover:bg-muted/50"
                                        : "text-muted-foreground/60"
                                  )}
                                  onClick={() => !saving && isEditable && handleCellClick(row.year, row.month, fa.fund_id, Number(fa.allocation_percentage))}
                                >
                                  {isEditing ? (
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => handleCellBlur(row.year, row.month, fa.fund_id, Number(fa.allocation_percentage))}
                                      onKeyDown={(e) => handleCellKeyDown(e, row.year, row.month, fa.fund_id, Number(fa.allocation_percentage))}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className="w-20 h-7 text-right"
                                      autoFocus
                                      disabled={saving}
                                    />
                                  ) : isWc ? (
                                    <div className="text-[10px] leading-tight text-muted-foreground/60">
                                      <div><span className="text-muted-foreground/40">Inc</span> {fmtPct(row.working_capital_pct_of_income)}</div>
                                    </div>
                                  ) : (
                                    fmtPct(fa.allocation_percentage)
                                  )}
                                </td>
                              </Fragment>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No income allocation data. Create funds in Settings and add income transactions to see allocations.
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}
