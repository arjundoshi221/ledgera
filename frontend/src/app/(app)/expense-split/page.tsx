"use client"

import { Fragment, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getExpenseSplit } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import type { MonthlyExpenseSplit } from "@/lib/types"

export default function ExpenseSplitPage() {
  const [data, setData] = useState<MonthlyExpenseSplit | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  async function loadExpenseSplit() {
    try {
      setLoading(true)
      const split = await getExpenseSplit(year, month)
      setData(split)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load expense split", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExpenseSplit()
  }, [year, month])

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading expense split...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expense Split</h1>
        <div className="flex gap-4">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
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
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {monthNames[month - 1]} {year} - Total Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            S${Number(data?.total_expenses || 0).toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {data?.categories.length || 0} categories
          </p>
        </CardContent>
      </Card>

      {data && data.categories.length > 0 ? (
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
                {data.categories.map((cat) => {
                  const percentage = (Number(cat.total_amount) / Number(data.total_expenses)) * 100
                  const isExpanded = expandedCategories.has(cat.category_id)
                  const hasSubcategories = cat.subcategories && cat.subcategories.length > 0

                  return (
                    <Fragment key={cat.category_id}>
                      {/* Category row */}
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
                          S${Number(cat.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {cat.transaction_count}
                        </TableCell>
                      </TableRow>

                      {/* Subcategory rows */}
                      {isExpanded && cat.subcategories?.map((sub) => {
                        const subPct = (Number(sub.total_amount) / Number(data.total_expenses)) * 100
                        return (
                          <TableRow key={sub.subcategory_id ?? "uncat"} className="bg-muted/30">
                            <TableCell className="pl-10 text-sm text-muted-foreground">
                              {sub.subcategory_name}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              S${Number(sub.total_amount).toFixed(2)}
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
            No expenses recorded for {monthNames[month - 1]} {year}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
