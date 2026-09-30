"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  useAccounts, useTransactions, useNetWorth, useWorkspace,
  useIncomeAllocation, useActiveScenario, useScenarioDefaults,
} from "@/lib/hooks"
import { VerificationBanner } from "@/components/verification-banner"
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2, HelpCircle, Upload, Plus, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReconciliationPanel } from "@/components/reconciliation-panel"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** F2 dashboard — projection-first monthly control loop.
 *
 *  Replaces the pre-F2 database-summary page. Answers the daily questions:
 *  what did I earn/spend this month, am I on track vs plan, is my ledger
 *  reconciled with my banks, what needs my attention. See
 *  development/features/F2-projection-first-dashboard.md.
 *
 *  Version marker: rendered as an HTML comment so we can grep the served
 *  HTML for "F2-live-YYYYMMDD" to verify a Railway deploy actually landed
 *  the new bundle vs. serving a stale build. */
const F2_VERSION = "F2-live-20260930"
export default function DashboardPage() {
  const router = useRouter()
  const { data: workspace } = useWorkspace()
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const { data: netWorth } = useNetWorth(1)
  const { data: allocation } = useIncomeAllocation(1)
  const { data: activeScenario } = useActiveScenario()
  const { data: defaults } = useScenarioDefaults(3)
  const { data: transactions = [] } = useTransactions()

  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const baseCurrency = workspace?.base_currency ?? "SGD"

  // Current month row from the income-allocation table — has the arithmetic
  // we need for "income received," "spent so far," "WC balance."
  const currentMonthRow = useMemo(() => {
    if (!allocation) return null
    return allocation.rows.find(r => r.year === currentYear && r.month === currentMonth) ?? null
  }, [allocation, currentYear, currentMonth])

  const previousMonthRow = useMemo(() => {
    if (!allocation) return null
    const py = currentMonth === 1 ? currentYear - 1 : currentYear
    const pm = currentMonth === 1 ? 12 : currentMonth - 1
    return allocation.rows.find(r => r.year === py && r.month === pm) ?? null
  }, [allocation, currentYear, currentMonth])

  // Sort transactions by timestamp desc and take the latest 5.
  const recentTxns = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
  }, [transactions])

  // Uncategorized count — needs attention.
  const uncategorizedCount = useMemo(() => {
    return transactions.filter(t => !t.category_id && (t.type === null || t.type === undefined)).length
  }, [transactions])

  // F3 drift alert deferred: comparing actual income to `budget_benchmark`
  // fires falsely because that field is `active_scenario.monthly_expenses_total`
  // (analytics.py:477), NOT the assumed monthly income. Correct drift needs
  // parsing scenario.assumptions_json for the income assumption. Punted to a
  // follow-up so the "Needs your attention" band doesn't yell false positives.

  if (accountsLoading) {
    return <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
  }

  const userAccounts = accounts.filter(a => a.name !== "External")
  const hasAnyAccount = userAccounts.length > 0
  const hasAnyTxn = transactions.length > 0

  return (
    <div className="space-y-6" data-dashboard-version={F2_VERSION}>
      <VerificationBanner />

      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeScenario ? (
              <>Budget model: <span className="font-medium text-foreground">{activeScenario.name}</span></>
            ) : (
              <>No active budget — <Link href="/projections" className="underline">create one</Link></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/transactions")}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => router.push("/transactions")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add transaction
          </Button>
        </div>
      </div>

      {/* Onboarding empty state */}
      {!hasAnyAccount && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">No accounts yet. Add your first bank/brokerage account to begin.</p>
            <Button onClick={() => router.push("/settings?tab=accounts")}>Set up accounts</Button>
          </CardContent>
        </Card>
      )}

      {hasAnyAccount && (
        <>
          {/* Top row: net worth + this month */}
          <div className="grid gap-4 md:grid-cols-3">
            <NetWorthCard netWorth={netWorth?.total_net_worth ?? 0} currency={netWorth?.base_currency ?? baseCurrency} />
            <ThisMonthIncomeCard
              income={Number(currentMonthRow?.current_month_income ?? 0)}
              previous={Number(previousMonthRow?.current_month_income ?? 0)}
              currency={baseCurrency}
            />
            <ThisMonthSpendCard
              actual={Number(currentMonthRow?.actual_fixed_cost ?? 0)}
              budget={Number(currentMonthRow?.allocated_fixed_cost ?? 0) || (allocation?.budget_benchmark ?? 0)}
              currency={baseCurrency}
            />
          </div>

          {/* Attention row */}
          {uncategorizedCount > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="py-3 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Needs your attention
                </div>
                <div className="text-sm text-amber-900/90 dark:text-amber-100/90">
                  <span className="font-medium">{uncategorizedCount}</span> uncategorized transaction{uncategorizedCount !== 1 ? "s" : ""}.{" "}
                  <Link href="/transactions" className="underline">Categorize</Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reconciliation + recent transactions */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ReconciliationPanel accounts={userAccounts} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent transactions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {!hasAnyTxn ? (
                  <p className="text-sm text-muted-foreground py-4">No transactions yet. Import your first CSV to begin.</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentTxns.map(tx => (
                      <Link
                        key={tx.id}
                        href="/transactions"
                        className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{tx.payee || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(tx.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn(
                            "font-mono font-medium",
                            (tx.postings?.[0]?.amount ?? 0) < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {(tx.postings?.[0]?.amount ?? 0).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {tx.postings?.[0]?.currency ?? baseCurrency}
                          </div>
                        </div>
                      </Link>
                    ))}
                    <div className="pt-1">
                      <Link href="/transactions" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom row: quick links */}
          <div className="grid gap-4 md:grid-cols-3">
            <QuickLink href="/income-allocation" title="Income Allocation" subtitle="See your monthly plan" icon={TrendingUp} />
            <QuickLink href="/projections" title="Projections" subtitle="Model your trajectory" icon={TrendingUp} />
            <QuickLink href="/portfolio" title="Portfolio" subtitle="Net worth over time" icon={TrendingUp} />
          </div>
        </>
      )}
    </div>
  )
}

/* ── Subcomponents ── */

function NetWorthCard({ netWorth, currency }: { netWorth: number; currency: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Net worth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-mono">
          {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{currency}</div>
      </CardContent>
    </Card>
  )
}

function ThisMonthIncomeCard({ income, previous, currency }: { income: number; previous: number; currency: string }) {
  const rel = previous > 0 ? (income - previous) / previous : null
  const up = rel !== null && rel > 0
  const down = rel !== null && rel < 0
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Income this month</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-mono">
          {income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <span>{currency}</span>
          {rel !== null && (
            <span className={cn(
              "flex items-center gap-0.5",
              up && "text-emerald-600 dark:text-emerald-400",
              down && "text-red-600 dark:text-red-400"
            )}>
              {up && <ArrowUpRight className="h-3 w-3" />}
              {down && <ArrowDownRight className="h-3 w-3" />}
              {(rel * 100).toFixed(0)}% vs last month
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ThisMonthSpendCard({ actual, budget, currency }: { actual: number; budget: number; currency: string }) {
  const pct = budget > 0 ? (actual / budget) * 100 : 0
  const over = pct > 100
  const near = pct > 85 && pct <= 100
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Spent this month</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-mono">
          {actual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {budget > 0 ? (
          <>
            <div className="text-xs text-muted-foreground mt-1">
              of {budget.toFixed(0)} budget · <span className={cn(
                over && "text-red-600 dark:text-red-400 font-medium",
                near && "text-amber-600 dark:text-amber-400 font-medium",
              )}>{pct.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  over ? "bg-red-500" : near ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground mt-1">No budget set · {currency}</div>
        )}
      </CardContent>
    </Card>
  )
}

function QuickLink({ href, title, subtitle, icon: Icon }: { href: string; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
        <CardContent className="py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{title}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/** Small marker component so imports don't get tree-shaken if we later add
 *  linter rules; keeps the "unused" tokens usable in downstream badges. */
export const _iconExports = { CheckCircle2, HelpCircle }
