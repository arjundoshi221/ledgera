"use client"

import { Fragment, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getFundTracker, createTransfer, getPrice } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { FundTrackerResponse, TransferSuggestion } from "@/lib/types"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from "recharts"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

const FUND_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#f97316", "#10b981",
]

export default function FundTrackerPage() {
  const [data, setData] = useState<FundTrackerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [years, setYears] = useState("1")
  const [view, setView] = useState("ledger")
  const [ledgerSub, setLedgerSub] = useState("funds")
  const [executingTransfer, setExecutingTransfer] = useState<number | null>(null)
  const [fxRateInput, setFxRateInput] = useState<{ index: number; rate: string; fee: string } | null>(null)
  const [fetchingRate, setFetchingRate] = useState(false)
  const { toast } = useToast()

  function isCrossCurrencySuggestion(s: TransferSuggestion): boolean {
    return !!(s.from_currency && s.to_currency && s.from_currency !== s.to_currency)
  }

  // Auto-fetch FX rate when FX input form opens (decoupled from click handler)
  useEffect(() => {
    if (!fxRateInput || !data) return
    const s = data.summary.transfer_suggestions[fxRateInput.index]
    if (!s || !isCrossCurrencySuggestion(s)) return
    if (fxRateInput.rate) return // Already has a rate, don't re-fetch

    let cancelled = false
    setFetchingRate(true)
    getPrice(s.from_currency, s.to_currency)
      .then((res) => {
        if (!cancelled) {
          setFxRateInput((prev) =>
            prev && prev.index === fxRateInput.index
              ? { ...prev, rate: Number(res.rate).toFixed(6) }
              : prev
          )
        }
      })
      .catch(() => { /* keep manual entry if fetch fails */ })
      .finally(() => {
        if (!cancelled) setFetchingRate(false)
      })
    return () => { cancelled = true }
  }, [fxRateInput?.index])

  async function handleExecuteTransfer(s: TransferSuggestion, index: number, fxRate?: number, fee?: number) {
    // For cross-currency: show FX rate + fee input (rate is auto-fetched by useEffect)
    if (isCrossCurrencySuggestion(s) && !fxRate) {
      setFxRateInput({ index, rate: "", fee: "" })
      return
    }

    setExecutingTransfer(index)
    setFxRateInput(null)
    try {
      const isCross = isCrossCurrencySuggestion(s)
      await createTransfer({
        timestamp: new Date().toISOString(),
        payee: "Fund Rebalancing",
        memo: `Transfer to ${s.to_account_name}`,
        from_account_id: s.from_account_id,
        to_account_id: s.to_account_id,
        amount: s.amount,
        from_currency: s.from_currency || s.currency,
        to_currency: isCross ? s.to_currency : undefined,
        fx_rate: isCross ? fxRate : undefined,
        fee: fee && fee > 0 ? fee : undefined,
        source_fund_id: s.source_fund_id || undefined,
        dest_fund_id: s.dest_fund_id || undefined,
      })
      toast({ title: "Transfer executed", description: `${s.from_currency} ${s.amount.toFixed(2)} transferred to ${s.to_account_name}` })
      await loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Transfer failed", description: err.message })
    } finally {
      setExecutingTransfer(null)
    }
  }

  async function loadData() {
    try {
      setLoading(true)
      const result = await getFundTracker(parseInt(years))
      setData(result)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load fund tracker", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [years])

  function fmt(val: number) {
    if (val === 0) return "-"
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtCompact(val: number) {
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`
    return val.toFixed(0)
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading fund tracker...</div>
  }

  // Prepare chart data
  const chartData = data ? (() => {
    const monthMap = new Map<string, Record<string, number>>()
    for (const fl of data.fund_ledgers) {
      for (const m of fl.months) {
        const key = `${MONTH_NAMES[m.month - 1]} ${m.year}`
        if (!monthMap.has(key)) monthMap.set(key, { month: 0 })
        const row = monthMap.get(key)!
        row[fl.fund_name] = m.closing_balance
      }
    }
    return Array.from(monthMap.entries()).map(([label, values]) => ({ label, ...values }))
  })() : []

  const accountChartData = data ? data.account_summaries.map(a => ({
    name: a.account_name,
    expected: a.prev_month_balance + a.current_month_expected,
    actual: a.actual_balance,
  })) : []

  // Current-month summary computed from account data
  const currentMonthTotalExpected = data
    ? data.account_summaries.reduce((sum, a) => sum + a.prev_month_balance + a.current_month_expected, 0)
    : 0
  const currentMonthTotalActual = data
    ? data.account_summaries.reduce((sum, a) => sum + a.actual_balance, 0)
    : 0
  const currentMonthDifference = currentMonthTotalActual - currentMonthTotalExpected

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fund & Account Tracker</h1>
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

      {data && (
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          {/* ── Ledger View ── */}
          <TabsContent value="ledger" className="space-y-6">
            <Tabs value={ledgerSub} onValueChange={setLedgerSub}>
              <TabsList>
                <TabsTrigger value="funds">By Fund</TabsTrigger>
                <TabsTrigger value="accounts">By Account</TabsTrigger>
              </TabsList>

              {/* By Fund */}
              <TabsContent value="funds" className="space-y-6">
                {data.fund_ledgers.length > 0 ? (
                  data.fund_ledgers.map((fl) => (
                    <Card key={fl.fund_id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {fl.emoji} {fl.fund_name}
                              {fl.is_self_funding && (
                                <Badge variant="secondary" className="ml-2 text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  {fl.self_funding_percentage === 100 ? "Self-Funding" : `${fl.self_funding_percentage}% Self-Funding`}
                                </Badge>
                              )}
                            </CardTitle>
                            {fl.linked_accounts.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {fl.linked_accounts.map(acc => (
                                  <Badge key={acc.id} variant="outline" className="text-[10px]">
                                    {acc.name}
                                    {fl.linked_accounts.length > 1 && (
                                      <span className="ml-1 text-muted-foreground">({acc.allocation_percentage}%)</span>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{fmt(fl.current_balance)}</p>
                            <p className="text-xs text-muted-foreground">Current Balance</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-3 py-2 text-left font-medium">Month</th>
                                <th className="px-3 py-2 text-right font-medium">Opening</th>
                                <th className="px-3 py-2 text-right font-medium">Expected</th>
                                <th className="px-3 py-2 text-right font-medium">Credits</th>
                                <th className="px-3 py-2 text-right font-medium">Debits</th>
                                <th className="px-3 py-2 text-right font-medium">
                                  <div>Fund Income</div>
                                  <div className="text-[9px] font-normal text-muted-foreground">Extra cash from growth</div>
                                </th>
                                <th className="px-3 py-2 text-right font-medium">Closing</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fl.months.map((m, idx) => (
                                <tr key={idx} className="border-b hover:bg-muted/20">
                                  <td className="px-3 py-2 font-medium">{MONTH_NAMES[m.month - 1]} {m.year}</td>
                                  <td className="px-3 py-2 text-right font-mono">{fmt(m.opening_balance)}</td>
                                  <td className={cn(
                                    "px-3 py-2 text-right font-mono",
                                    m.contribution > 0 ? "text-green-600 dark:text-green-400" : ""
                                  )}>
                                    {fmt(m.contribution)}
                                  </td>
                                  <td className={cn(
                                    "px-3 py-2 text-right font-mono",
                                    m.actual_credits > 0 ? "text-green-600 dark:text-green-400" : ""
                                  )}>
                                    {(m.actual_credits > 0 || (fl.fund_name === "Working Capital" && m.self_funding_credits > 0)) ? (
                                      <div>
                                        {m.actual_credits > 0 && <span>+{fmt(m.actual_credits)}</span>}
                                        {fl.fund_name === "Working Capital" && m.self_funding_credits > 0 && (
                                          <div className="text-[9px] text-purple-600 dark:text-purple-400 mt-0.5">
                                            -{fmt(m.self_funding_credits)} self-funding
                                          </div>
                                        )}
                                      </div>
                                    ) : "-"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {m.actual_debits > 0 ? (
                                      <div>
                                        <span className="text-red-600 dark:text-red-400">-{fmt(m.actual_debits)}</span>
                                        {m.charge_details.length > 0 && (
                                          <div className="mt-0.5 space-y-px">
                                            {m.charge_details.map((c, ci) => (
                                              <div key={ci} className="text-[10px] text-muted-foreground leading-tight">
                                                {c.category_emoji} {c.category_name}: {fmt(c.amount)}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : "-"}
                                  </td>
                                  <td className={cn(
                                    "px-3 py-2 text-right font-mono",
                                    m.fund_income > 0 ? "text-blue-600 dark:text-blue-400" : ""
                                  )}>
                                    {fmt(m.fund_income)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(m.closing_balance)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-muted/30 font-semibold">
                                <td className="px-3 py-2">Total</td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 text-right font-mono text-green-600 dark:text-green-400">
                                  {fmt(fl.total_contributions)}
                                </td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 text-right font-mono text-blue-600 dark:text-blue-400">
                                  {fmt(fl.total_fund_income)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">{fmt(fl.current_balance)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No funds found. Create funds in Settings to see tracking data.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* By Account */}
              <TabsContent value="accounts" className="space-y-6">
                {/* Summary table */}
                {data.account_summaries.length > 0 && (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-3 py-2 text-left font-medium">Account</th>
                              <th className="px-3 py-2 text-left font-medium">Institution</th>
                              <th className="px-3 py-2 text-center font-medium">Currency</th>
                              <th className="px-3 py-2 text-right font-medium">Native Balance</th>
                              <th className="px-3 py-2 text-right font-medium">Total Expected</th>
                              <th className="px-3 py-2 text-right font-medium">Prev Month Balance</th>
                              <th className="px-3 py-2 text-right font-medium">This Month Expected</th>
                              <th className="px-3 py-2 text-right font-medium">Actual (Base)</th>
                              <th className="px-3 py-2 text-right font-medium">Difference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.account_summaries.map((a) => {
                              const isForeign = a.current_fx_rate !== 1
                              return (
                                <tr key={a.account_id} className="border-b hover:bg-muted/20">
                                  <td className="px-3 py-2 font-medium">{a.account_name}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{a.institution || "—"}</td>
                                  <td className="px-3 py-2 text-center">
                                    <Badge variant="outline" className="text-xs">{a.account_currency}</Badge>
                                    {isForeign && (
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        @{a.current_fx_rate.toFixed(4)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold">
                                    <div>{a.account_currency} {fmt(a.native_balance)}</div>
                                    {isForeign && (
                                      <div className="text-[10px] text-muted-foreground">
                                        ≈ {fmt(a.market_value_base)} base
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">{fmt(a.expected_contributions)}</td>
                                  <td className="px-3 py-2 text-right font-mono">{fmt(a.prev_month_balance)}</td>
                                  <td className="px-3 py-2 text-right font-mono">{fmt(a.current_month_expected)}</td>
                                  <td className="px-3 py-2 text-right font-mono">{fmt(a.actual_balance)}</td>
                                  <td className={cn(
                                    "px-3 py-2 text-right font-mono font-semibold",
                                    a.difference >= 0
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-red-600 dark:text-red-400"
                                  )}>
                                    {a.difference >= 0 ? "+" : ""}{fmt(a.difference)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Monthly ledger per account */}
                {data.account_ledgers && data.account_ledgers.length > 0 ? (
                  data.account_ledgers.map((al) => {
                    const isForeign = al.current_fx_rate !== 1
                    const totalExpected = al.months.reduce((s, m) => s + m.expected, 0)
                    return (
                      <Card key={al.account_id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">
                                {al.account_name}
                                {al.institution && (
                                  <span className="ml-2 text-sm font-normal text-muted-foreground">{al.institution}</span>
                                )}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">{al.account_currency}</Badge>
                                {isForeign && (
                                  <span className="text-[10px] text-muted-foreground">@{al.current_fx_rate.toFixed(4)}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{fmt(al.current_balance)}</p>
                              <p className="text-xs text-muted-foreground">Current Balance</p>
                              {isForeign && (
                                <p className="text-[10px] text-muted-foreground">
                                  {al.account_currency} {fmt(al.native_balance)} ≈ {fmt(al.market_value_base)} base
                                </p>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="px-3 py-2 text-left font-medium">Month</th>
                                  <th className="px-3 py-2 text-right font-medium">Opening</th>
                                  <th className="px-3 py-2 text-right font-medium">Expected</th>
                                  <th className="px-3 py-2 text-right font-medium">Credits</th>
                                  <th className="px-3 py-2 text-right font-medium">Debits</th>
                                  <th className="px-3 py-2 text-right font-medium">Closing</th>
                                </tr>
                              </thead>
                              <tbody>
                                {al.months.map((m, idx) => (
                                  <tr key={idx} className="border-b hover:bg-muted/20">
                                    <td className="px-3 py-2 font-medium">{MONTH_NAMES[m.month - 1]} {m.year}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmt(m.opening_balance)}</td>
                                    <td className={cn(
                                      "px-3 py-2 text-right font-mono",
                                      m.expected > 0 ? "text-green-600 dark:text-green-400" : ""
                                    )}>
                                      {fmt(m.expected)}
                                    </td>
                                    <td className={cn(
                                      "px-3 py-2 text-right font-mono",
                                      m.actual_credits > 0 ? "text-green-600 dark:text-green-400" : ""
                                    )}>
                                      {m.actual_credits > 0 ? `+${fmt(m.actual_credits)}` : "-"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">
                                      {m.actual_debits > 0 ? (
                                        <span className="text-red-600 dark:text-red-400">-{fmt(m.actual_debits)}</span>
                                      ) : "-"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(m.closing_balance)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-muted/30 font-semibold">
                                  <td className="px-3 py-2">Total</td>
                                  <td className="px-3 py-2" />
                                  <td className="px-3 py-2 text-right font-mono text-green-600 dark:text-green-400">
                                    {fmt(totalExpected)}
                                  </td>
                                  <td className="px-3 py-2" />
                                  <td className="px-3 py-2" />
                                  <td className="px-3 py-2 text-right font-mono">{fmt(al.current_balance)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No accounts found.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Dashboard View ── */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Expected</p>
                  <p className="text-lg font-bold">{fmtCompact(currentMonthTotalExpected)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Total Actual</p>
                  <p className="text-lg font-bold">{fmtCompact(currentMonthTotalActual)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p className={cn(
                    "text-lg font-bold",
                    currentMonthDifference >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {currentMonthDifference >= 0 ? "+" : ""}{fmtCompact(currentMonthDifference)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">YTD Contributions</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {fmtCompact(data.summary.ytd_contributions)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">YTD Fund Income</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {fmtCompact(data.summary.ytd_fund_income)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">WC Surplus</p>
                  <p className={cn(
                    "text-lg font-bold",
                    data.summary.ytd_wc_surplus >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {data.summary.ytd_wc_surplus >= 0 ? "+" : ""}{fmtCompact(data.summary.ytd_wc_surplus)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">Unallocated</p>
                  <p className={cn(
                    "text-lg font-bold",
                    data.summary.unallocated_remainder > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}>
                    {fmtCompact(data.summary.unallocated_remainder)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Transfer Suggestions */}
            {data.summary.transfer_suggestions && data.summary.transfer_suggestions.length > 0 && (
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Suggested Transfers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.summary.transfer_suggestions.map((s, i) => {
                      const isCross = isCrossCurrencySuggestion(s)
                      const showFxInput = fxRateInput?.index === i

                      return (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{s.from_account_name || "Working Capital"}</span>
                              {isCross && <Badge variant="secondary" className="text-xs">{s.from_currency}</Badge>}
                              <span className="text-muted-foreground">&rarr;</span>
                              <span className="font-medium">{s.to_account_name}</span>
                              {isCross && <Badge variant="secondary" className="text-xs">{s.to_currency}</Badge>}
                              <span className="text-orange-600 dark:text-orange-400 font-medium">
                                {s.from_currency || s.currency} {fmt(s.amount)}
                              </span>
                              {s.note && (
                                <span className="text-[10px] text-muted-foreground ml-1" title={s.note}>
                                  (allocation only)
                                </span>
                              )}
                            </div>
                            {s.note && (
                              <p className="text-[11px] text-muted-foreground pl-0.5">{s.note}</p>
                            )}
                            {!showFxInput && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={executingTransfer === i}
                                onClick={() => handleExecuteTransfer(s, i)}
                              >
                                {executingTransfer === i ? "Executing..." : "Execute"}
                              </Button>
                            )}
                          </div>
                          {/* FX Rate input for cross-currency transfers */}
                          {showFxInput && (
                            <div className="flex items-center gap-2 pl-4">
                              <Label className="text-sm whitespace-nowrap">
                                FX Rate ({s.from_currency}&rarr;{s.to_currency}):
                                {fetchingRate && <span className="text-xs text-muted-foreground ml-1">fetching...</span>}
                              </Label>
                              <Input
                                type="number"
                                step="0.000001"
                                placeholder={fetchingRate ? "Fetching..." : "Enter rate"}
                                className="w-32"
                                value={fxRateInput.rate}
                                onChange={(e) => setFxRateInput({ ...fxRateInput, rate: e.target.value })}
                                autoFocus
                              />
                              {fxRateInput.rate && (
                                <span className="text-xs text-muted-foreground">
                                  = {s.to_currency} {((s.amount) * (parseFloat(fxRateInput.rate) || 0)).toFixed(2)}
                                </span>
                              )}
                              <Label className="text-sm whitespace-nowrap ml-2">Fee ({s.from_currency}):</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="w-24"
                                value={fxRateInput.fee}
                                onChange={(e) => setFxRateInput({ ...fxRateInput, fee: e.target.value })}
                              />
                              <Button
                                size="sm"
                                disabled={!fxRateInput.rate || parseFloat(fxRateInput.rate) <= 0 || executingTransfer === i}
                                onClick={() => handleExecuteTransfer(s, i, parseFloat(fxRateInput.rate), parseFloat(fxRateInput.fee || "0"))}
                              >
                                {executingTransfer === i ? "Executing..." : "Confirm"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setFxRateInput(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* WC Optimization */}
            {data.summary.wc_optimization && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-green-700 dark:text-green-400">
                    Working Capital Optimization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    WC balance of{" "}
                    <span className="font-semibold">{fmt(data.summary.wc_optimization.wc_balance)}</span>{" "}
                    exceeds the budget benchmark by{" "}
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      {fmt(data.summary.wc_optimization.surplus)}
                    </span>.
                    Consider investing the surplus.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Fund Growth Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fund Balances Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => fmt(value)}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Legend />
                      {data.fund_ledgers.map((fl, i) => (
                        <Area
                          key={fl.fund_id}
                          type="monotone"
                          dataKey={fl.fund_name}
                          stackId="1"
                          fill={FUND_COLORS[i % FUND_COLORS.length]}
                          stroke={FUND_COLORS[i % FUND_COLORS.length]}
                          fillOpacity={0.6}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Expected vs Actual by Account */}
            {accountChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Expected vs Actual by Account (Current Month)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={accountChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => fmt(value)}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Legend />
                      <Bar dataKey="expected" name="Expected" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {!data && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No data available. Create funds and link accounts in Settings to get started.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
