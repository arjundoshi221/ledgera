"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Category, CategoryBudget, Subcategory, SubcategoryBudget } from "@/lib/types"

interface CategoryBudgetEditorProps {
  categories: Category[]
  subcategories: Subcategory[]
  budgets: CategoryBudget[]
  onChange: (budgets: CategoryBudget[]) => void
  inflationRate: string
  onCreateRecurring?: (data: { name: string; amount: number; category_id: string; subcategory_id?: string }) => void
}

export function CategoryBudgetEditor({
  categories,
  subcategories,
  budgets,
  onChange,
  inflationRate,
  onCreateRecurring,
}: CategoryBudgetEditorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  if (categories.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No expense categories.{" "}
        <a href="/settings" className="underline">
          Create them in Settings
        </a>
        .
      </p>
    )
  }

  function toggleExpand(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  // Ensure every category has an entry in budgets
  const effectiveBudgets: CategoryBudget[] = categories.map((cat) => {
    const existing = budgets.find((b) => b.category_id === cat.id)
    return existing ?? { category_id: cat.id, monthly_amount: 0 }
  })

  function updateAmount(categoryId: string, value: string) {
    const amount = parseFloat(value) || 0
    const updated = effectiveBudgets.map((b) =>
      b.category_id === categoryId ? { ...b, monthly_amount: amount } : b
    )
    onChange(updated)
  }

  function updateInflationOverride(categoryId: string, value: string) {
    const override = value === "" ? undefined : parseFloat(value) || 0
    const updated = effectiveBudgets.map((b) =>
      b.category_id === categoryId ? { ...b, inflation_override: override } : b
    )
    onChange(updated)
  }

  function updateSubcategoryAmount(categoryId: string, subcategoryId: string, value: string) {
    const amount = parseFloat(value) || 0
    const updated = effectiveBudgets.map((b) => {
      if (b.category_id !== categoryId) return b
      const subs = [...(b.subcategory_budgets || [])]
      const idx = subs.findIndex((sb) => sb.subcategory_id === subcategoryId)
      if (idx >= 0) {
        subs[idx] = { ...subs[idx], monthly_amount: amount }
      } else {
        subs.push({ subcategory_id: subcategoryId, monthly_amount: amount })
      }
      const catTotal = subs.reduce((s, sb) => s + sb.monthly_amount, 0)
      return { ...b, subcategory_budgets: subs, monthly_amount: catTotal }
    })
    onChange(updated)
  }

  function updateSubcategoryInflation(categoryId: string, subcategoryId: string, value: string) {
    const override = value === "" ? undefined : parseFloat(value) || 0
    const updated = effectiveBudgets.map((b) => {
      if (b.category_id !== categoryId) return b
      const subs = [...(b.subcategory_budgets || [])]
      const idx = subs.findIndex((sb) => sb.subcategory_id === subcategoryId)
      if (idx >= 0) {
        subs[idx] = { ...subs[idx], inflation_override: override }
      }
      return { ...b, subcategory_budgets: subs }
    })
    onChange(updated)
  }

  const total = effectiveBudgets.reduce((s, b) => s + b.monthly_amount, 0)
  const globalInflation = parseFloat(inflationRate) || 0
  const hasRecurring = !!onCreateRecurring
  const gridCols = hasRecurring ? "grid-cols-[1fr_80px_60px_28px]" : "grid-cols-[1fr_80px_60px]"

  return (
    <div className="space-y-2">
      <div className={`grid ${gridCols} gap-1 text-xs`}>
        <span className="text-muted-foreground font-medium">Category</span>
        <span className="text-muted-foreground font-medium text-right">Monthly $</span>
        <span className="text-muted-foreground font-medium text-right">Infl.%</span>
        {hasRecurring && <span />}
      </div>

      {categories.map((cat) => {
        const budget = effectiveBudgets.find((b) => b.category_id === cat.id)!
        const catSubs = subcategories.filter((s) => s.category_id === cat.id)
        const isExpanded = expandedCategories.has(cat.id)
        const hasSubBudgets = (budget.subcategory_budgets || []).some((sb) => sb.monthly_amount > 0)

        return (
          <div key={cat.id}>
            <div className={`grid ${gridCols} gap-1 items-center`}>
              <span className="text-xs truncate flex items-center gap-0.5">
                {catSubs.length > 0 && (
                  <button
                    type="button"
                    className="text-xs w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => toggleExpand(cat.id)}
                  >
                    {isExpanded ? "\u25BE" : "\u25B8"}
                  </button>
                )}
                {cat.emoji && <span className="mr-0.5">{cat.emoji}</span>}
                {cat.name}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={budget.monthly_amount || ""}
                onChange={(e) => updateAmount(cat.id, e.target.value)}
                placeholder="0"
                className={`h-7 text-xs text-right px-1 ${hasSubBudgets ? "bg-muted" : ""}`}
                readOnly={hasSubBudgets}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={budget.inflation_override ?? ""}
                onChange={(e) => updateInflationOverride(cat.id, e.target.value)}
                placeholder={(globalInflation * 100).toFixed(0) + "%"}
                className="h-7 text-xs text-right px-1"
              />
              {hasRecurring && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Create as recurring"
                  disabled={!budget.monthly_amount || budget.monthly_amount <= 0}
                  onClick={() => onCreateRecurring!({ name: cat.name, amount: budget.monthly_amount, category_id: cat.id })}
                >
                  &#x21BB;
                </Button>
              )}
            </div>

            {/* Subcategory rows */}
            {isExpanded && catSubs.map((sub) => {
              const subBudget = (budget.subcategory_budgets || []).find(
                (sb) => sb.subcategory_id === sub.id
              )
              return (
                <div key={sub.id} className={`grid ${gridCols} gap-1 items-center pl-5 mt-1`}>
                  <span className="text-xs truncate text-muted-foreground">
                    {sub.name}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={subBudget?.monthly_amount || ""}
                    onChange={(e) => updateSubcategoryAmount(cat.id, sub.id, e.target.value)}
                    placeholder="0"
                    className="h-7 text-xs text-right px-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={subBudget?.inflation_override ?? ""}
                    onChange={(e) => updateSubcategoryInflation(cat.id, sub.id, e.target.value)}
                    placeholder="cat"
                    className="h-7 text-xs text-right px-1"
                  />
                  {hasRecurring && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Create as recurring"
                      disabled={!subBudget?.monthly_amount || subBudget.monthly_amount <= 0}
                      onClick={() => onCreateRecurring!({
                        name: `${cat.name} - ${sub.name}`,
                        amount: subBudget?.monthly_amount || 0,
                        category_id: cat.id,
                        subcategory_id: sub.id,
                      })}
                    >
                      &#x21BB;
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      <div className="text-xs text-muted-foreground text-right">
        Total: <span className="font-medium">${total.toLocaleString()}/mo</span>
      </div>
    </div>
  )
}
