"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getNetWorth } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { NetWorthResponse } from "@/lib/types"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

const PIE_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#f97316", "#10b981",
]

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtCcy(n: number, ccy: string): string {
  return `${ccy} ${fmt(n, 2)}`
}

export default function PortfolioPage() {
  const [data, setData] = useState<NetWorthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [years, setYears] = useState("1")

  async function loadData() {
    setLoading(true)
    try {
      const result = await getNetWorth(parseInt(years))
      setData(result)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [years])

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading portfolio...</div>
  }

  if (!data) {
    return <div className="text-muted-foreground">Unable to load portfolio data.</div>
  }

  const base = data.base_currency

  // Chart data
  const historyChartData = data.history.map((h) => ({
    label: `${MONTH_NAMES[h.month - 1]} ${h.year}`,
    net_worth: h.net_worth,
    assets: h.assets,
    liabilities: h.liabilities,
  }))

  // Pie data
  const pieData = data.currency_breakdown
    .filter((c) => c.base_equivalent > 0)
    .map((c) => ({
      name: c.currency,
      value: Math.round(c.base_equivalent),
      percentage: c.percentage,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <Select value={years} onValueChange={setYears}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 5].map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y} {y === 1 ? "Year" : "Years"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtCcy(data.total_net_worth, base)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmtCcy(data.total_assets, base)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{fmtCcy(data.total_liabilities, base)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unrealized FX Gain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              data.total_unrealized_fx_gain >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {data.total_unrealized_fx_gain >= 0 ? "+" : ""}{fmtCcy(data.total_unrealized_fx_gain, base)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Over Time */}
      {historyChartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Net Worth Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={historyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
                <Tooltip formatter={(v: number) => fmtCcy(v, base)} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="assets"
                  name="Assets"
                  stackId="1"
                  stroke="#16a34a"
                  fill="#bbf7d0"
                />
                <Area
                  type="monotone"
                  dataKey="liabilities"
                  name="Liabilities"
                  stackId="2"
                  stroke="#dc2626"
                  fill="#fecaca"
                />
                <Area
                  type="monotone"
                  dataKey="net_worth"
                  name="Net Worth"
                  stroke="#6366f1"
                  fill="none"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Accounts Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Native Balance</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Base Value ({base})</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead className="text-right">FX Gain</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accounts.map((acc) => {
                    const isSameCcy = acc.account_currency === base
                    return (
                      <TableRow key={acc.account_id}>
                        <TableCell>
                          <div className="font-medium">{acc.account_name}</div>
                          {acc.institution && (
                            <div className="text-xs text-muted-foreground">{acc.institution}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={acc.account_type === "asset" ? "default" : "destructive"}>
                            {acc.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{acc.account_currency}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtCcy(acc.native_balance, acc.account_currency)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {isSameCcy ? "—" : acc.fx_rate_to_base.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtCcy(acc.base_value, base)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtCcy(acc.cost_basis, base)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right",
                          isSameCcy ? "text-muted-foreground" :
                            acc.unrealized_fx_gain >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {isSameCcy
                            ? "—"
                            : `${acc.unrealized_fx_gain >= 0 ? "+" : ""}${fmtCcy(acc.unrealized_fx_gain, base)}`
                          }
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Currency Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Currency Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      label={({ name, percentage }) => `${name} ${percentage.toFixed(0)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtCcy(v, base)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {data.currency_breakdown.map((c, i) => (
                    <div key={c.currency} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="font-medium">{c.currency}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {fmtCcy(c.base_equivalent, base)} ({c.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rates Footer */}
      {Object.keys(data.fx_rates_used).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Rates used:{" "}
          {Object.entries(data.fx_rates_used)
            .map(([pair, rate]) => `1 ${pair.split("/")[0]} = ${rate.toFixed(4)} ${pair.split("/")[1]}`)
            .join(", ")}
        </p>
      )}
    </div>
  )
}
