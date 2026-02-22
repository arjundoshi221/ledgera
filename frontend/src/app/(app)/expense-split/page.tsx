"use client"

import { Fragment, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { getMonthlyDashboard, getExpenseSplit } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { MonthlyDashboardResponse, MonthlyExpenseSplit, FundDashboardAnalysis } from "@/lib/types"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DONUT_COLORS = [
  "#3b82f6", "#f59e0b", "#ef4444", "#10b981",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
]

function fmt(val: number, currency: string = "S$") {
  if (val === 0) return "-"
  return `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Fund category horizontal bar chart ──
function FundCategoryChart({ fund, currency }: { fund: FundDashboardAnalysis; currency: string }) {
  const hasCategories = fund.categories.length > 0
  const hasBudget = fund.is_working_capital && fund.categories.some(c => c.budget_allocated > 0)

  if (!hasCategories && fund.total_spent === 0) {
    return (
      <div className="flex items-center justify-center h-[80px] text-sm text-muted-foreground">
        No transactions this month
      </div>
    )
  }

  // For non-WC funds: green bar = fund balance; for WC: green bar = budget
  const greenLabel = fund.is_working_capital ? "Budget" : "Balance"
  const greenTotal = fund.is_working_capital ? fund.total_budget : fund.fund_balance

  const catData = fund.categories.map(c => ({
    name: `${c.category_emoji} ${c.category_name}`.trim(),
    "Amount Spent": c.amount_spent,
    ...(hasBudget ? { [greenLabel]: c.budget_allocated } : {}),
  }))

  // Add total row
  const chartData = [
    ...catData,
    {
      name: "Total",
      "Amount Spent": fund.total_spent,
      [greenLabel]: greenTotal,
    },
  ]

  const maxValue = Math.max(
    ...chartData.map(d => Math.max(d["Amount Spent"], (d as any)[greenLabel] ?? 0)),
    1,
  )

  const barHeight = chartData.length * 50 + 60

  return (
    <ResponsiveContainer width="100%" height={Math.max(barHeight, 160)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
        <XAxis
          type="number"
          domain={[0, Math.ceil(maxValue * 1.1)]}
          tickFormatter={(v: number) => fmt(v, currency)}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: number) => fmt(value, currency)}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend />
        <Bar
          dataKey="Amount Spent"
          fill="#ef4444"
          radius={[0, 4, 4, 0]}
          barSize={16}
        />
        <Bar
          dataKey={greenLabel}
          fill="#22c55e"
          radius={[0, 4, 4, 0]}
          barSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Fund Extraction donut chart ──
function FundExtractionDonut({
  items,
  currency,
}: {
  items: MonthlyDashboardResponse["fund_extraction"]
  currency: string
}) {
  const activeItems = items.filter(i => i.amount > 0)

  if (activeItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
        No fund spending data this month
      </div>
    )
  }

  const data = activeItems.map(item => ({
    name: `${item.fund_emoji} ${item.fund_name}`.trim(),
    value: item.amount,
    pct: item.percentage,
  }))

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            label={({ name, pct }) => `${name} ${pct}%`}
            labelLine={{ strokeWidth: 1 }}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, _name: string, props: any) => [
              fmt(value, currency),
              props.payload.name,
            ]}
            contentStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-sm text-muted-foreground mt-1">
        Total Spent: {fmt(total, currency)}
      </p>
    </div>
  )
}

export default function ExpenseSplitPage() {
  const [dashboardData, setDashboardData] = useState<MonthlyDashboardResponse | null>(null)
  const [categoryData, setCategoryData] = useState<MonthlyExpenseSplit | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [tab, setTab] = useState("dashboard")
  const [visibleFunds, setVisibleFunds] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  async function loadData() {
    try {
      setLoading(true)
      const [dashboard, categories] = await Promise.all([
        getMonthlyDashboard(year, month),
        getExpenseSplit(year, month),
      ])
      setDashboardData(dashboard)
      setCategoryData(categories)
      // Default: all funds visible
      setVisibleFunds(new Set(dashboard.fund_analyses.map(f => f.fund_id)))
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load data", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [year, month])

  function toggleFundVisibility(fundId: string) {
    setVisibleFunds(prev => {
      const next = new Set(prev)
      if (next.has(fundId)) next.delete(fundId)
      else next.add(fundId)
      return next
    })
  }

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  const currencyPrefix = dashboardData?.currency
    ? `${dashboardData.currency === "SGD" ? "S$" : dashboardData.currency + " "}`
    : "S$"

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading monthly dashboard...</div>
  }

  const filteredFunds = dashboardData?.fund_analyses.filter(f => visibleFunds.has(f.fund_id)) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monthly Dashboard</h1>
        <div className="flex items-center gap-3">
          <Label>Month:</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="categories">Category Split</TabsTrigger>
        </TabsList>

        {/* ── Dashboard Tab ── */}
        <TabsContent value="dashboard" className="space-y-6">
          {dashboardData && (
            <>
              {/* Fund Extraction */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Fund Extraction - {MONTH_NAMES[month - 1]} {year}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FundExtractionDonut items={dashboardData.fund_extraction} currency={currencyPrefix} />
                </CardContent>
              </Card>

              {/* Fund filter checkboxes */}
              {dashboardData.fund_analyses.length > 1 && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Show funds:</span>
                  {dashboardData.fund_analyses.map(fund => (
                    <label
                      key={fund.fund_id}
                      className="flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={visibleFunds.has(fund.fund_id)}
                        onChange={() => toggleFundVisibility(fund.fund_id)}
                        className="h-4 w-4 rounded border-gray-300 accent-primary"
                      />
                      <span className="text-sm">
                        {fund.fund_emoji} {fund.fund_name}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Per-fund analyses */}
              {filteredFunds.map((fund) => (
                <Card key={fund.fund_id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {fund.fund_emoji} {fund.fund_name}
                      </CardTitle>
                      <div className="flex gap-6 text-sm">
                        <div className="text-right">
                          <span className="text-muted-foreground">Spent: </span>
                          <span className={cn(
                            "font-mono font-semibold",
                            fund.is_working_capital && fund.total_spent > fund.total_budget && fund.total_budget > 0
                              ? "text-red-600 dark:text-red-400"
                              : ""
                          )}>
                            {fmt(fund.total_spent, currencyPrefix)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">
                            {fund.is_working_capital ? "Budget: " : "Balance: "}
                          </span>
                          <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                            {fund.is_working_capital
                              ? fmt(fund.total_budget, currencyPrefix)
                              : fmt(fund.fund_balance, currencyPrefix)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <FundCategoryChart fund={fund} currency={currencyPrefix} />
                  </CardContent>
                </Card>
              ))}

              {filteredFunds.length === 0 && dashboardData.fund_analyses.length > 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No funds selected. Use the checkboxes above to show funds.
                  </CardContent>
                </Card>
              )}

              {dashboardData.fund_analyses.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No funds found. Create funds in Settings to see the dashboard.
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Category Split Tab ── */}
        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {MONTH_NAMES[month - 1]} {year} - Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {fmt(categoryData?.total_expenses || 0, currencyPrefix)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {categoryData?.categories.length || 0} categories
              </p>
            </CardContent>
          </Card>

          {categoryData && categoryData.categories.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.categories.map((cat) => {
                      const percentage = (Number(cat.total_amount) / Number(categoryData.total_expenses)) * 100
                      const isExpanded = expandedCategories.has(cat.category_id)
                      const hasSubcategories = cat.subcategories && cat.subcategories.length > 0

                      return (
                        <Fragment key={cat.category_id}>
                          <TableRow
                            className={hasSubcategories ? "cursor-pointer hover:bg-muted/50" : ""}
                            onClick={() => hasSubcategories && toggleCategory(cat.category_id)}
                          >
                            <TableCell className="font-medium">
                              {hasSubcategories && (
                                <span className="mr-1 text-xs text-muted-foreground">
                                  {isExpanded ? "\u25BC" : "\u25B6"}
                                </span>
                              )}
                              <span className="mr-2">{cat.emoji}</span>
                              {cat.category_name}
                              {hasSubcategories && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({cat.subcategories.length} sub)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {fmt(Number(cat.total_amount), currencyPrefix)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {cat.transaction_count}
                            </TableCell>
                          </TableRow>

                          {isExpanded && cat.subcategories?.map((sub) => {
                            const subPct = (Number(sub.total_amount) / Number(categoryData.total_expenses)) * 100
                            return (
                              <TableRow key={sub.subcategory_id ?? "uncat"} className="bg-muted/30">
                                <TableCell className="pl-10 text-sm text-muted-foreground">
                                  {sub.subcategory_name}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {fmt(Number(sub.total_amount), currencyPrefix)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className="text-xs">{subPct.toFixed(1)}%</Badge>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground text-sm">
                                  {sub.transaction_count}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No expenses recorded for {MONTH_NAMES[month - 1]} {year}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {!dashboardData && !categoryData && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No data available. Ensure you have funds, transactions, and an active budget scenario.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
