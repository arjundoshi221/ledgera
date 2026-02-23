"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  runProjection,
  getCategories,
  getSubcategories,
  getFunds,
  getAccounts,
  getScenarios,
  getScenario,
  saveScenario,
  updateScenario,
  activateScenario,
  deleteScenario,
  createRecurringTransaction,
  getWorkspace,
} from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import type {
  ProjectionAssumptions,
  Category,
  Subcategory,
  Fund,
  Account,
  CategoryBudget,
  OneTimeCost,
  ScenarioListItem,
  CreateRecurringTransactionRequest,
} from "@/lib/types"
import { CategoryBudgetEditor } from "./_components/category-budget-editor"
import { OneTimeCostEditor } from "./_components/one-time-cost-editor"
import { FundAllocationEditor } from "./_components/fund-allocation-editor"
import { aggregateToYearly, type AggregateResult } from "./_components/yearly-aggregation"
import { YearlyResults } from "./_components/yearly-results"
import { SaveScenarioDialog } from "./_components/save-scenario-dialog"

export default function ProjectionsPage() {
  // Workspace currency
  const [baseCurrency, setBaseCurrency] = useState("SGD")

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
  const [expenseSubcategories, setExpenseSubcategories] = useState<Subcategory[]>([])
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

  // Recurring transaction creation from projections
  const [projAccounts, setProjAccounts] = useState<Account[]>([])
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false)
  const [recurringPrefill, setRecurringPrefill] = useState<Partial<CreateRecurringTransactionRequest> | null>(null)
  const [recurringAccountId, setRecurringAccountId] = useState("")
  const [recurringFundId, setRecurringFundId] = useState("")
  const [recurringSubcategoryId, setRecurringSubcategoryId] = useState("")
  const [recurringStartDate, setRecurringStartDate] = useState("")
  const [recurringEndDate, setRecurringEndDate] = useState("")
  const [creatingRecurring, setCreatingRecurring] = useState(false)

  // Load categories, funds & scenarios on mount
  useEffect(() => {
    async function loadRefData() {
      try {
        const [cats, fnds, scns, accts, subs, ws] = await Promise.all([
          getCategories("expense"),
          getFunds(),
          getScenarios(),
          getAccounts(),
          getSubcategories(),
          getWorkspace(),
        ])
        setBaseCurrency(ws.base_currency)
        setExpenseCategories(cats)
        setExpenseSubcategories(subs.filter((s: Subcategory) => cats.some((c: Category) => c.id === s.category_id)))
        setFunds(fnds)
        setScenarios(scns)
        setProjAccounts(accts.filter((a: Account) => a.name !== "External"))

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
      base_currency: baseCurrency,
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
  }, [baseCurrency, salary, bonus, otherIncome, taxRate, inflation, useCategoryBudgets, categoryBudgets, expenses, oneTimeCosts, fundWeights, fundReturns])

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
        // Ensure numeric values (old scenarios may have Decimal-as-string in JSON)
        setCategoryBudgets(a.category_budgets.map((b: any) => ({
          ...b,
          monthly_amount: Number(b.monthly_amount) || 0,
          inflation_override: b.inflation_override != null ? Number(b.inflation_override) : undefined,
          subcategory_budgets: (b.subcategory_budgets || []).map((sb: any) => ({
            subcategory_id: sb.subcategory_id,
            monthly_amount: Number(sb.monthly_amount) || 0,
            inflation_override: sb.inflation_override != null ? Number(sb.inflation_override) : undefined,
          })),
        })))
        setExpenses("3000")
      } else {
        setUseCategoryBudgets(false)
        setExpenses(String(Number(a.monthly_expenses) || 3000))
      }

      if (a.one_time_costs) {
        setOneTimeCosts(a.one_time_costs.map((c: any) => ({
          ...c,
          amount: Number(c.amount) || 0,
          month_index: Number(c.month_index) || 0,
        })))
      } else {
        setOneTimeCosts([])
      }

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

  // Open recurring creation dialog pre-filled from a projection item
  function openRecurringFromIncome(name: string, amount: string, frequency: "monthly" | "yearly") {
    const parsed = parseFloat(amount) || 0
    if (parsed <= 0) {
      toast({ variant: "destructive", title: "Enter an amount first" })
      return
    }
    setRecurringPrefill({
      name,
      transaction_type: "income",
      amount: parsed,
      currency: baseCurrency,
      frequency,
    })
    setRecurringAccountId("")
    setRecurringFundId("")
    setRecurringSubcategoryId("")
    setRecurringStartDate(new Date().toISOString().slice(0, 10))
    setRecurringEndDate("")
    setRecurringDialogOpen(true)
  }

  function openRecurringFromExpense(data: { name: string; amount: number; category_id: string; subcategory_id?: string }) {
    setRecurringPrefill({
      name: data.name,
      transaction_type: "expense",
      amount: data.amount,
      currency: baseCurrency,
      frequency: "monthly",
      category_id: data.category_id,
      subcategory_id: data.subcategory_id,
    })
    setRecurringAccountId("")
    setRecurringFundId("")
    setRecurringSubcategoryId(data.subcategory_id || "")
    setRecurringStartDate(new Date().toISOString().slice(0, 10))
    setRecurringEndDate("")
    setRecurringDialogOpen(true)
  }

  async function handleCreateFromProjection() {
    if (!recurringPrefill || !recurringAccountId) return
    setCreatingRecurring(true)
    try {
      await createRecurringTransaction({
        name: recurringPrefill.name!,
        transaction_type: recurringPrefill.transaction_type!,
        amount: recurringPrefill.amount!,
        currency: recurringPrefill.currency || baseCurrency,
        frequency: recurringPrefill.frequency!,
        account_id: recurringAccountId,
        category_id: recurringPrefill.category_id,
        subcategory_id: recurringSubcategoryId && recurringSubcategoryId !== "none"
          ? recurringSubcategoryId
          : recurringPrefill.subcategory_id || undefined,
        fund_id: recurringFundId && recurringFundId !== "none" ? recurringFundId : undefined,
        start_date: recurringStartDate,
        end_date: recurringEndDate || undefined,
      } as CreateRecurringTransactionRequest)
      toast({ title: `Created recurring "${recurringPrefill.name}"` })
      setRecurringDialogOpen(false)
      setRecurringPrefill(null)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to create recurring", description: err.message })
    } finally {
      setCreatingRecurring(false)
    }
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
                      {baseCurrency} {Number(s.monthly_expenses_total).toFixed(0)}/mo
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
                <div className="flex gap-1">
                  <Input type="number" step="0.01" value={salary} onChange={(e) => { setSalary(e.target.value); markDirty() }} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Create as recurring"
                    onClick={() => openRecurringFromIncome("Monthly Salary", salary, "monthly")}
                  >
                    &#x21BB;
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Annual Bonus</Label>
                <div className="flex gap-1">
                  <Input type="number" step="0.01" value={bonus} onChange={(e) => { setBonus(e.target.value); markDirty() }} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Create as recurring"
                    onClick={() => openRecurringFromIncome("Annual Bonus", bonus, "yearly")}
                  >
                    &#x21BB;
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other Income (monthly)</Label>
                <div className="flex gap-1">
                  <Input type="number" step="0.01" value={otherIncome} onChange={(e) => { setOtherIncome(e.target.value); markDirty() }} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Create as recurring"
                    onClick={() => openRecurringFromIncome("Other Income", otherIncome, "monthly")}
                  >
                    &#x21BB;
                  </Button>
                </div>
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
                  subcategories={expenseSubcategories}
                  budgets={categoryBudgets}
                  onChange={(b) => { setCategoryBudgets(b); markDirty() }}
                  inflationRate={inflation}
                  onCreateRecurring={openRecurringFromExpense}
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
                      ({oneTimeCosts.length} item{oneTimeCosts.length !== 1 ? "s" : ""},{" "}
                      {baseCurrency} {oneTimeCosts.reduce((s, c) => s + c.amount, 0).toLocaleString()})
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
                <Label className="text-xs">{baseCurrency} &rarr; USD Rate</Label>
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
            <YearlyResults data={yearlyData} usdRate={parseFloat(usdRate) || 0} baseCurrency={baseCurrency} />
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

      {/* Create Recurring from Projection Dialog */}
      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Recurring Transaction</DialogTitle>
          </DialogHeader>
          {recurringPrefill && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={recurringPrefill.name ?? ""} readOnly className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Input value={recurringPrefill.transaction_type ?? ""} readOnly className="bg-muted capitalize" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <Input value={recurringPrefill.frequency ?? ""} readOnly className="bg-muted capitalize" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input value={recurringPrefill.amount?.toLocaleString() ?? ""} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Input value={recurringPrefill.currency ?? baseCurrency} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Account *</Label>
                  <Select value={recurringAccountId} onValueChange={setRecurringAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} {a.institution ? `(${a.institution})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fund</Label>
                  <Select value={recurringFundId} onValueChange={setRecurringFundId}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {funds.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.emoji ? `${f.emoji} ` : ""}{f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const dialogSubs = expenseSubcategories.filter(
                  (s) => s.category_id === recurringPrefill?.category_id
                )
                return dialogSubs.length > 0 ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Subcategory</Label>
                    <Select value={recurringSubcategoryId} onValueChange={setRecurringSubcategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {dialogSubs.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={recurringStartDate} onChange={(e) => setRecurringStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date (optional)</Label>
                  <Input type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFromProjection} disabled={creatingRecurring || !recurringAccountId}>
              {creatingRecurring ? "Creating..." : "Create Recurring"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
