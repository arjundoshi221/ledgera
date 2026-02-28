"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
  getScenario,
  saveScenario,
  updateScenario,
  activateScenario,
  deleteScenario,
  createRecurringTransaction,
} from "@/lib/api"
import { useCategories, useSubcategories, useFunds, useAccounts, useScenarios, useWorkspace, usePaymentMethods } from "@/lib/hooks"
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
  PaymentMethod,
} from "@/lib/types"
import { CategoryBudgetEditor } from "./_components/category-budget-editor"
import { OneTimeCostEditor } from "./_components/one-time-cost-editor"
import { FundAllocationEditor } from "./_components/fund-allocation-editor"
import { aggregateToYearly, type AggregateResult } from "./_components/yearly-aggregation"
import { YearlyResults } from "./_components/yearly-results"
import { SaveScenarioDialog } from "./_components/save-scenario-dialog"

export default function ProjectionsPage() {
  // Use SWR hooks for reference data
  const { data: expenseCategories = [], isLoading: categoriesLoading } = useCategories("expense")
  const { data: allSubcategories = [] } = useSubcategories()
  const expenseSubcategories = useMemo(() =>
    allSubcategories.filter((s: Subcategory) => expenseCategories.some((c: Category) => c.id === s.category_id)),
    [allSubcategories, expenseCategories]
  )
  const { data: funds = [] } = useFunds()
  const { data: projAccounts = [] } = useAccounts()
  const { data: workspace } = useWorkspace()
  const { data: scenarios = [] } = useScenarios()
  const { data: projPaymentMethods = [] } = usePaymentMethods()
  const { data: projAllCategories = [] } = useCategories()
  const projAllSubcategories = allSubcategories

  const baseCurrency = workspace?.base_currency ?? "SGD"
  const loadingRef = categoriesLoading

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

  // Fund allocation - initialize from loaded funds
  const [fundWeights, setFundWeights] = useState<Record<string, number>>({})
  const [fundReturns, setFundReturns] = useState<Record<string, number>>({})

  // Results
  const [yearlyData, setYearlyData] = useState<AggregateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Scenario management
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Assumptions panel collapse
  const [panelOpen, setPanelOpen] = useState(true)

  // Recurring transaction creation from projections
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false)
  const [recurringPrefill, setRecurringPrefill] = useState<Partial<CreateRecurringTransactionRequest> | null>(null)
  const [recurringAccountId, setRecurringAccountId] = useState("")
  const [recurringFundId, setRecurringFundId] = useState("")
  const [recurringSubcategoryId, setRecurringSubcategoryId] = useState("")
  const [recurringStartDate, setRecurringStartDate] = useState("")
  const [recurringEndDate, setRecurringEndDate] = useState("")
  const [recurringPayee, setRecurringPayee] = useState("")
  const [recurringMemo, setRecurringMemo] = useState("")
  const [recurringPaymentMethodId, setRecurringPaymentMethodId] = useState("")
  const [recurringCategoryId, setRecurringCategoryId] = useState("")
  const [creatingRecurring, setCreatingRecurring] = useState(false)

  // Filter categories by transaction type for recurring dialog
  const projFilteredCategories = useMemo(() => {
    if (!recurringPrefill?.transaction_type) return projAllCategories
    return projAllCategories.filter((c) => c.type === recurringPrefill.transaction_type)
  }, [projAllCategories, recurringPrefill?.transaction_type])

  // Filter accounts by selected fund for recurring dialog
  const projFilteredAccounts = useMemo(() => {
    if (!recurringFundId || recurringFundId === "none") return projAccounts.filter((a) => a.name !== "External")
    const fund = funds.find((f) => f.id === recurringFundId)
    if (!fund || !fund.linked_accounts || fund.linked_accounts.length === 0) {
      return projAccounts.filter((a) => a.name !== "External")
    }
    const linkedAccountIds = fund.linked_accounts.map((la) => la.id)
    return projAccounts.filter((a) => linkedAccountIds.includes(a.id) && a.name !== "External")
  }, [recurringFundId, funds, projAccounts])

  // Initialize fund weights and returns when funds load
  useEffect(() => {
    if (funds.length > 0 && Object.keys(fundWeights).length === 0) {
      const weights: Record<string, number> = {}
      const returns: Record<string, number> = {}
      for (const f of funds) {
        weights[f.name] = f.allocation_percentage ?? 0
        returns[f.name] = 5
      }
      setFundWeights(weights)
      setFundReturns(returns)
    }
  }, [funds, fundWeights])

  // Unsaved changes warning
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  // Reset recurring account when recurring fund changes
  useEffect(() => {
    if (recurringAccountId && recurringFundId && recurringFundId !== "none") {
      const isAccountInFiltered = projFilteredAccounts.some((a) => a.id === recurringAccountId)
      if (!isAccountInFiltered) {
        setRecurringAccountId("")
      }
    }
  }, [recurringFundId, projFilteredAccounts, recurringAccountId])

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
      // Note: scenarios will auto-refresh via SWR
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
      // Note: scenarios will auto-refresh via SWR
      toast({ title: "Simulation deleted" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  async function handleActivate(scenarioId: string) {
    try {
      await activateScenario(scenarioId)
      // Note: scenarios will auto-refresh via SWR
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
    setRecurringPayee("")
    setRecurringMemo("")
    setRecurringPaymentMethodId("")
    setRecurringCategoryId("")
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
    setRecurringPayee("")
    setRecurringMemo("")
    setRecurringPaymentMethodId("")
    setRecurringCategoryId(data.category_id || "")
    setRecurringStartDate(new Date().toISOString().slice(0, 10))
    setRecurringEndDate("")
    setRecurringDialogOpen(true)
  }

  async function handleCreateFromProjection() {
    if (!recurringPrefill || !recurringAccountId) {
      toast({ variant: "destructive", title: "Account is required" })
      return
    }
    if (!recurringCategoryId || recurringCategoryId === "none") {
      toast({ variant: "destructive", title: "Category is required" })
      return
    }
    if (!recurringFundId || recurringFundId === "none") {
      toast({ variant: "destructive", title: "Fund is required" })
      return
    }
    if (!recurringPrefill.amount || recurringPrefill.amount <= 0) {
      toast({ variant: "destructive", title: "Amount must be greater than 0" })
      return
    }
    setCreatingRecurring(true)
    try {
      await createRecurringTransaction({
        name: recurringPrefill.name!,
        transaction_type: recurringPrefill.transaction_type!,
        amount: recurringPrefill.amount!,
        currency: recurringPrefill.currency || baseCurrency,
        frequency: recurringPrefill.frequency!,
        account_id: recurringAccountId,
        payee: recurringPayee || undefined,
        memo: recurringMemo || undefined,
        payment_method_id: recurringPaymentMethodId && recurringPaymentMethodId !== "none" ? recurringPaymentMethodId : undefined,
        category_id: recurringCategoryId && recurringCategoryId !== "none"
          ? recurringCategoryId
          : recurringPrefill.category_id || undefined,
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

      <div className={`grid gap-6 ${panelOpen ? "lg:grid-cols-[minmax(280px,1fr)_2fr]" : ""}`}>
        {/* Assumptions form */}
        {panelOpen ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Assumptions</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Collapse panel"
              onClick={() => setPanelOpen(false)}
            >
              &#x2190;
            </Button>
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
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 self-start"
            onClick={() => setPanelOpen(true)}
          >
            &#x2192; Assumptions
          </Button>
        )}

        {/* Results */}
        <div className="space-y-4">
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
                  <Select value={recurringAccountId} onValueChange={setRecurringAccountId} required>
                    <SelectTrigger>
                      <SelectValue placeholder={recurringFundId && recurringFundId !== "none" ? `Select account (${projFilteredAccounts.length} linked)` : "Select account"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projFilteredAccounts.length === 0 ? (
                        <SelectItem value="_none" disabled>No accounts linked to this fund</SelectItem>
                      ) : (
                        projFilteredAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} {a.institution ? `(${a.institution})` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {recurringPrefill.transaction_type === "income" ? "Payer" : "Payee"}
                  </Label>
                  <Input
                    value={recurringPayee}
                    onChange={(e) => setRecurringPayee(e.target.value)}
                    placeholder={recurringPrefill.transaction_type === "income" ? "e.g. Employer" : "e.g. Landlord"}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category *</Label>
                  <Select
                    value={recurringCategoryId}
                    onValueChange={(v) => {
                      setRecurringCategoryId(v)
                      setRecurringSubcategoryId("")
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {projFilteredCategories.length === 0 ? (
                        <SelectItem value="_none" disabled>No {recurringPrefill?.transaction_type} categories</SelectItem>
                      ) : (
                        projFilteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subcategory</Label>
                  {(() => {
                    const activeCatId = recurringCategoryId && recurringCategoryId !== "none"
                      ? recurringCategoryId
                      : recurringPrefill?.category_id
                    const dialogSubs = projAllSubcategories.filter(
                      (s) => s.category_id === activeCatId
                    )
                    return (
                      <Select
                        value={recurringSubcategoryId}
                        onValueChange={setRecurringSubcategoryId}
                        disabled={dialogSubs.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={dialogSubs.length === 0 ? "No subcategories" : "Optional"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {dialogSubs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fund *</Label>
                  <Select value={recurringFundId} onValueChange={setRecurringFundId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fund" />
                    </SelectTrigger>
                    <SelectContent>
                      {funds.length === 0 ? (
                        <SelectItem value="_none" disabled>No funds - create in Settings</SelectItem>
                      ) : (
                        funds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.emoji ? `${f.emoji} ` : ""}{f.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={recurringPaymentMethodId} onValueChange={setRecurringPaymentMethodId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projPaymentMethods.map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>{pm.icon} {pm.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Memo</Label>
                <Input value={recurringMemo} onChange={(e) => setRecurringMemo(e.target.value)} placeholder="Optional" />
              </div>
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
