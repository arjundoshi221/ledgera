"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  runProjection,
  getCategories,
  getFunds,
  getScenarios,
  getScenario,
  saveScenario,
  updateScenario,
  activateScenario,
  deleteScenario,
} from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import type {
  ProjectionAssumptions,
  Category,
  Fund,
  CategoryBudget,
  OneTimeCost,
  ScenarioListItem,
} from "@/lib/types"
import { CategoryBudgetEditor } from "./_components/category-budget-editor"
import { OneTimeCostEditor } from "./_components/one-time-cost-editor"
import { FundAllocationEditor } from "./_components/fund-allocation-editor"
import { aggregateToYearly, type AggregateResult } from "./_components/yearly-aggregation"
import { YearlyResults } from "./_components/yearly-results"
import { SaveScenarioDialog } from "./_components/save-scenario-dialog"

export default function ProjectionsPage() {
  // Income & general
  const [years, setYears] = useState(5)
  const [salary, setSalary] = useState("5000")
  const [bonus, setBonus] = useState("0")
  const [otherIncome, setOtherIncome] = useState("0")
  const [taxRate, setTaxRate] = useState("0.20")
  const [inflation, setInflation] = useState("0.03")
  const [usdRate, setUsdRate] = useState("0.74")

  // Expenses
  const [expenses, setExpenses] = useState("3000")
  const [useCategoryBudgets, setUseCategoryBudgets] = useState(false)
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([])

  // One-time costs
  const [oneTimeCosts, setOneTimeCosts] = useState<OneTimeCost[]>([])

  // Fund allocation
  const [fundWeights, setFundWeights] = useState<Record<string, number>>({ cash: 40, invest: 60 })
  const [fundReturns, setFundReturns] = useState<Record<string, number>>({ cash: 2, invest: 7 })

  // Reference data
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [loadingRef, setLoadingRef] = useState(true)

  // Results
  const [yearlyData, setYearlyData] = useState<AggregateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Scenario management
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load categories, funds & scenarios on mount
  useEffect(() => {
    async function loadRefData() {
      try {
        const [cats, fnds, scns] = await Promise.all([
          getCategories("expense"),
          getFunds(),
          getScenarios(),
        ])
        setExpenseCategories(cats)
        setFunds(fnds)
        setScenarios(scns)

        if (fnds.length > 0) {
          const weights: Record<string, number> = {}
          const returns: Record<string, number> = {}
          for (const f of fnds) {
            weights[f.name] = f.allocation_percentage ?? 0
            returns[f.name] = 5
          }
          setFundWeights(weights)
          setFundReturns(returns)
        }
      } catch {
        // Silently fall back to defaults if ref data fails
      } finally {
        setLoadingRef(false)
      }
    }
    loadRefData()
  }, [])

  // Unsaved changes warning
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  // Build current assumptions from form state
  const buildAssumptions = useCallback((): ProjectionAssumptions => {
    return {
      base_currency: "SGD",
      monthly_salary: parseFloat(salary),
      annual_bonus: parseFloat(bonus),
      other_income: parseFloat(otherIncome),
      tax_rate: parseFloat(taxRate),
      expense_inflation_rate: parseFloat(inflation),
      ...(useCategoryBudgets && categoryBudgets.length > 0
        ? { category_budgets: categoryBudgets.filter((b) => b.monthly_amount > 0) }
        : { monthly_expenses: parseFloat(expenses) }),
      one_time_costs: oneTimeCosts.length > 0 ? oneTimeCosts : undefined,
      allocation_weights: Object.fromEntries(
        Object.entries(fundWeights).map(([k, v]) => [k, (Number(v) || 0) / 100])
      ),
      bucket_returns: Object.fromEntries(
        Object.entries(fundReturns).map(([k, v]) => [k, (Number(v) || 0) / 100])
      ),
      minimum_cash_buffer_months: 6,
    }
  }, [salary, bonus, otherIncome, taxRate, inflation, useCategoryBudgets, categoryBudgets, expenses, oneTimeCosts, fundWeights, fundReturns])

  // Load a scenario's assumptions into the form
  async function loadScenario(scenarioId: string) {
    if (isDirty && !window.confirm("You have unsaved changes. Discard and load a different simulation?")) {
      return
    }
    try {
      const scenario = await getScenario(scenarioId)
      const a = scenario.assumptions
      setSalary(String(a.monthly_salary ?? "5000"))
      setBonus(String(a.annual_bonus ?? "0"))
      setOtherIncome(String(a.other_income ?? "0"))
      setTaxRate(String(a.tax_rate ?? "0.20"))
      setInflation(String(a.expense_inflation_rate ?? "0.03"))

      if (a.category_budgets && a.category_budgets.length > 0) {
        setUseCategoryBudgets(true)
        setCategoryBudgets(a.category_budgets)
        setExpenses("3000")
      } else {
        setUseCategoryBudgets(false)
        setExpenses(String(a.monthly_expenses ?? "3000"))
      }

      if (a.one_time_costs) setOneTimeCosts(a.one_time_costs)
      else setOneTimeCosts([])

      if (a.allocation_weights) {
        setFundWeights(Object.fromEntries(
          Object.entries(a.allocation_weights).map(([k, v]) => [k, (Number(v) || 0) * 100])
        ))
      }
      if (a.bucket_returns) {
        setFundReturns(Object.fromEntries(
          Object.entries(a.bucket_returns).map(([k, v]) => [k, (Number(v) || 0) * 100])
        ))
      }

      setCurrentScenarioId(scenarioId)
      setIsDirty(false)
      setYearlyData(null)
      toast({ title: `Loaded "${scenario.name}"` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load scenario", description: err.message })
    }
  }

  // Derived validation
  const totalWeight = Object.values(fundWeights).reduce((s, w) => s + (Number(w) || 0), 0)
  const weightsValid = Math.abs(totalWeight - 100) < 0.1
  const canSubmit = !loading && (funds.length === 0 || weightsValid)

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const assumptions = buildAssumptions()
      const months = years * 12
      const res = await runProjection(assumptions, months)

      const yearly = aggregateToYearly(
        res.projections,
        fundReturns,
        fundWeights,
        parseFloat(inflation)
      )
      setYearlyData(yearly)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Projection failed", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(name: string, description: string, setAsActive: boolean) {
    setSaving(true)
    try {
      const assumptions = buildAssumptions()
      if (currentScenarioId) {
        await updateScenario(currentScenarioId, { name, description, assumptions, is_active: setAsActive })
        toast({ title: `Updated "${name}"` })
      } else {
        const saved = await saveScenario({ name, description, assumptions, is_active: setAsActive })
        setCurrentScenarioId(saved.id)
        toast({ title: `Saved "${name}"` })
      }
      setIsDirty(false)
      setShowSaveDialog(false)
      // Refresh scenario list
      const scns = await getScenarios()
      setScenarios(scns)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to save", description: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(scenarioId: string) {
    if (!window.confirm("Delete this simulation?")) return
    try {
      await deleteScenario(scenarioId)
      if (currentScenarioId === scenarioId) {
        setCurrentScenarioId(null)
        setIsDirty(false)
      }
      const scns = await getScenarios()
      setScenarios(scns)
      toast({ title: "Simulation deleted" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  async function handleActivate(scenarioId: string) {
    try {
      await activateScenario(scenarioId)
      const scns = await getScenarios()
      setScenarios(scns)
      toast({ title: "Budget benchmark updated" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  // Mark dirty when any form value changes
  function markDirty() {
    if (currentScenarioId) setIsDirty(true)
  }

  const currentScenarioName = scenarios.find((s) => s.id === currentScenarioId)?.name

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Projections</h1>
          {currentScenarioName && (
            <Badge variant="outline">{currentScenarioName}{isDirty ? " *" : ""}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scenarios.length > 0 && (
            <Select
              value={currentScenarioId ?? ""}
              onValueChange={(v) => v && loadScenario(v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Load simulation..." />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.is_active ? "(active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
            Save
          </Button>
        </div>
      </div>

      {/* Saved Simulations List */}
      {scenarios.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Saved Simulations</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <div className="space-y-1">
              {scenarios.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {s.is_active && <Badge variant="default" className="text-xs">Active</Badge>}
                    <span className="text-muted-foreground text-xs">
                      S${Number(s.monthly_expenses_total).toFixed(0)}/mo
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => loadScenario(s.id)}
                    >
                      Load
                    </Button>
                    {!s.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => handleActivate(s.id)}
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-destructive"
                      onClick={() => handleDelete(s.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assumptions form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRun} className="space-y-3">
              {/* -- Income -- */}
              <div className="space-y-1">
                <Label className="text-xs">Monthly Salary</Label>
                <Input type="number" step="0.01" value={salary} onChange={(e) => { setSalary(e.target.value); markDirty() }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Annual Bonus</Label>
                <Input type="number" step="0.01" value={bonus} onChange={(e) => { setBonus(e.target.value); markDirty() }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other Income (monthly)</Label>
                <Input type="number" step="0.01" value={otherIncome} onChange={(e) => { setOtherIncome(e.target.value); markDirty() }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tax Rate</Label>
                <Input type="number" step="0.001" min="0" max="1" value={taxRate} onChange={(e) => { setTaxRate(e.target.value); markDirty() }} />
              </div>

              <Separator />

              {/* -- Expenses -- */}
              {!loadingRef && expenseCategories.length > 0 && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Expenses</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => { setUseCategoryBudgets(!useCategoryBudgets); markDirty() }}
                  >
                    {useCategoryBudgets ? "Use flat amount" : "Use per-category budgets"}
                  </button>
                </div>
              )}

              {useCategoryBudgets && expenseCategories.length > 0 ? (
                <CategoryBudgetEditor
                  categories={expenseCategories}
                  budgets={categoryBudgets}
                  onChange={(b) => { setCategoryBudgets(b); markDirty() }}
                  inflationRate={inflation}
                />
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Expenses</Label>
                  <Input type="number" step="0.01" value={expenses} onChange={(e) => { setExpenses(e.target.value); markDirty() }} />
                </div>
              )}

              <Separator />

              {/* -- One-Time Costs -- */}
              <details>
                <summary className="text-xs font-semibold cursor-pointer select-none">
                  One-Time Costs
                  {oneTimeCosts.length > 0 && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({oneTimeCosts.length} item{oneTimeCosts.length !== 1 ? "s" : ""}, $
                      {oneTimeCosts.reduce((s, c) => s + c.amount, 0).toLocaleString()})
                    </span>
                  )}
                </summary>
                <div className="mt-2">
                  <OneTimeCostEditor
                    costs={oneTimeCosts}
                    onChange={(c) => { setOneTimeCosts(c); markDirty() }}
                    categories={expenseCategories}
                    months={years * 12}
                  />
                </div>
              </details>

              <Separator />

              {/* -- Fund Allocation -- */}
              <details open={funds.length > 0}>
                <summary className="text-xs font-semibold cursor-pointer select-none">
                  Fund Allocation
                  {funds.length > 0 && (
                    <span className={`ml-1 font-normal ${weightsValid ? "text-muted-foreground" : "text-red-500"}`}>
                      ({totalWeight.toFixed(0)}%)
                    </span>
                  )}
                </summary>
                <div className="mt-2">
                  <FundAllocationEditor
                    funds={funds}
                    weights={fundWeights}
                    returns={fundReturns}
                    onWeightsChange={(w) => { setFundWeights(w); markDirty() }}
                    onReturnsChange={(r) => { setFundReturns(r); markDirty() }}
                  />
                </div>
              </details>

              <Separator />

              {/* -- General Settings -- */}
              <div className="space-y-1">
                <Label className="text-xs">Expense Inflation Rate</Label>
                <Input type="number" step="0.01" min="0" max="1" value={inflation} onChange={(e) => { setInflation(e.target.value); markDirty() }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Years to Project</Label>
                <Input type="number" min="1" max="30" value={years} onChange={(e) => { setYears(parseInt(e.target.value) || 5); markDirty() }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SGD &rarr; USD Rate</Label>
                <Input type="number" step="0.01" min="0" value={usdRate} onChange={(e) => setUsdRate(e.target.value)} />
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {loading ? "Running..." : "Run Projection"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4 lg:col-span-2">
          {yearlyData && yearlyData.summaryRows.length > 0 ? (
            <YearlyResults data={yearlyData} usdRate={parseFloat(usdRate) || 0} />
          ) : (
            !loading && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Set your assumptions and click &quot;Run Projection&quot; to see results.
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>

      <SaveScenarioDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSave}
        saving={saving}
        defaultName={currentScenarioName ?? ""}
        isUpdate={!!currentScenarioId}
      />
    </div>
  )
}
