"use client"

import { Fragment, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getIncomeAllocation, createOrUpdateAllocationOverride } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { IncomeAllocationResponse } from "@/lib/types"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

export default function IncomeAllocationPage() {
  const [data, setData] = useState<IncomeAllocationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [years, setYears] = useState("1")
  const { toast } = useToast()

  // Track which cell is being edited: key = "year-month-fundId"
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const result = await getIncomeAllocation(parseInt(years))
      setData(result)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load income allocation", description: err.message })
    } finally {
      setLoading(false)
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
      await loadData() // Reload to show updated values
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

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading income allocation...</div>
  }

  const fundsHeaders = data?.funds_meta ?? []
  const currentMonthRow = data?.rows.find(r => !r.is_locked)
  const allocSumInvalid = currentMonthRow
    ? Math.abs(Number(currentMonthRow.total_fund_allocation_pct) - 100) > 0.1
    : false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Income Allocation</h1>
        <div className="flex items-center gap-3">
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
                    (S${Number(data.budget_benchmark).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo)
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

      {data && data.rows.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 z-10">Year</th>
                    <th className="px-3 py-2 text-left font-medium">Month</th>
                    <th className="px-3 py-2 text-right font-medium">Net Income</th>
                    <th className="px-3 py-2 text-right font-medium">Allocated Fixed Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Actual Fixed Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Fixed Cost Opt.</th>
                    <th className="px-3 py-2 text-right font-medium">Savings Remainder</th>
                    {fundsHeaders.map((f) => (
                      <th key={f.fund_id} colSpan={2} className="px-3 py-2 text-center font-medium border-l">
                        {f.emoji} {f.fund_name}
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
                    {fundsHeaders.map((f) => (
                      <Fragment key={f.fund_id}>
                        <th className="px-3 py-1 text-right border-l">Amount</th>
                        <th className="px-3 py-1 text-right">%</th>
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
                        <td className="px-3 py-2 text-right font-mono">{fmt(row.net_income)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(row.allocated_fixed_cost)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(row.actual_fixed_cost)}</td>
                        <td className={`px-3 py-2 text-right font-mono ${optColor}`}>{fmt(row.fixed_cost_optimization)}</td>
                        <td className={`px-3 py-2 text-right font-mono ${savColor}`}>{fmt(row.savings_remainder)}</td>
                        {row.fund_allocations.map((fa) => {
                          const cellKey = `${row.year}-${row.month}-${fa.fund_id}`
                          const isEditing = editingCell === cellKey
                          const isEditable = !row.is_locked && !fa.is_auto

                          return (
                            <Fragment key={fa.fund_id}>
                              <td className="px-3 py-2 text-right font-mono border-l">
                                {fmt(fa.allocated_amount)}
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right",
                                  fa.is_auto
                                    ? "text-muted-foreground/60 italic"
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
                                ) : fa.is_auto ? (
                                  <div className="text-[11px] leading-tight">
                                    <div>{fmtPct(row.working_capital_pct_of_income)} inc</div>
                                    <div>{fmtPct(row.savings_pct_of_income)} sav</div>
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
  )
}
