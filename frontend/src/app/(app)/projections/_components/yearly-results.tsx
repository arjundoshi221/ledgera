"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AggregateResult } from "./yearly-aggregation"

interface YearlyResultsProps {
  data: AggregateResult
  usdRate: number
  baseCurrency: string
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString()
}

function pct(n: number): string {
  return n.toFixed(1) + "%"
}

export function YearlyResults({ data, usdRate, baseCurrency }: YearlyResultsProps) {
  const { summaryRows, fundRows, fundNames, totalWealthFinal } = data

  if (summaryRows.length === 0) return null

  return (
    <div className="space-y-4">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Savings</div>
            <div className="text-xl font-bold">
              {fmt(summaryRows.reduce((s, r) => s + r.investableIncome, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Wealth ({baseCurrency})</div>
            <div className="text-xl font-bold">{fmt(totalWealthFinal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Wealth (USD)</div>
            <div className="text-xl font-bold">{fmt(totalWealthFinal * usdRate)}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Table 1: Annual Summary ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Annual Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Income (after Tax)</TableHead>
                  <TableHead className="text-right">Living Expenses</TableHead>
                  <TableHead className="text-right">Inflation</TableHead>
                  <TableHead className="text-right">Investable Income</TableHead>
                  <TableHead className="text-right">Amount Invested</TableHead>
                  <TableHead className="text-right">Recreation Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryRows.map((r) => (
                  <TableRow key={r.year}>
                    <TableCell className="font-medium">{r.year}</TableCell>
                    <TableCell className="text-right">{fmt(r.incomeAfterTax)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(r.livingExpenses)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{pct(r.inflationRate * 100)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.investableIncome)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(r.amountInvested)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmt(r.amountSpentRecreation)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Table 2: Per-Fund Breakdown ── */}
      {fundNames.map((fundName) => {
        const rows = fundRows[fundName]
        if (!rows || rows.length === 0) return null
        return (
          <Card key={fundName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{fundName}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Amount to Invest</TableHead>
                      <TableHead className="text-right">Opening Capital</TableHead>
                      <TableHead className="text-right">% Income</TableHead>
                      <TableHead className="text-right">% Revenue</TableHead>
                      <TableHead className="text-right">Bank Rate</TableHead>
                      <TableHead className="text-right">Closing Capital</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.year}>
                        <TableCell className="font-medium">{r.year}</TableCell>
                        <TableCell className="text-right">{fmt(r.amountToInvest)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(r.openingCapital)}</TableCell>
                        <TableCell className="text-right">{pct(r.pctInvestableIncome)}</TableCell>
                        <TableCell className="text-right text-green-600">{pct(r.pctRevenue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{pct(r.bankRate)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(r.closingCapital)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* ── Table 3: Aggregate ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Wealth Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fund</TableHead>
                <TableHead className="text-right">Opening (Year 1)</TableHead>
                <TableHead className="text-right">Closing (Final Year)</TableHead>
                <TableHead className="text-right">Growth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fundNames.map((fundName) => {
                const rows = fundRows[fundName]
                if (!rows || rows.length === 0) return null
                const opening = rows[0].openingCapital
                const closing = rows[rows.length - 1].closingCapital
                const growth = closing - opening
                return (
                  <TableRow key={fundName}>
                    <TableCell className="font-medium">{fundName}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(opening)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(closing)}</TableCell>
                    <TableCell className="text-right text-green-600">+{fmt(growth)}</TableCell>
                  </TableRow>
                )
              })}
              {/* Totals */}
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Total Wealth ({baseCurrency})</TableCell>
                <TableCell />
                <TableCell className="text-right font-bold">{fmt(totalWealthFinal)}</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">Total Wealth (USD)</TableCell>
                <TableCell />
                <TableCell className="text-right font-bold">{fmt(totalWealthFinal * usdRate)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
