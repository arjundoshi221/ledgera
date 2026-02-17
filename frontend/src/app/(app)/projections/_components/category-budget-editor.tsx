"use client"

import { Input } from "@/components/ui/input"
import type { Category, CategoryBudget } from "@/lib/types"

interface CategoryBudgetEditorProps {
  categories: Category[]
  budgets: CategoryBudget[]
  onChange: (budgets: CategoryBudget[]) => void
  inflationRate: string
}

export function CategoryBudgetEditor({
  categories,
  budgets,
  onChange,
  inflationRate,
}: CategoryBudgetEditorProps) {
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

  const total = effectiveBudgets.reduce((s, b) => s + b.monthly_amount, 0)
  const globalInflation = parseFloat(inflationRate) || 0

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_60px] gap-1 text-xs">
        <span className="text-muted-foreground font-medium">Category</span>
        <span className="text-muted-foreground font-medium text-right">Monthly $</span>
        <span className="text-muted-foreground font-medium text-right">Infl.%</span>
      </div>

      {categories.map((cat) => {
        const budget = effectiveBudgets.find((b) => b.category_id === cat.id)!
        return (
          <div key={cat.id} className="grid grid-cols-[1fr_80px_60px] gap-1 items-center">
            <span className="text-xs truncate">
              {cat.emoji && <span className="mr-1">{cat.emoji}</span>}
              {cat.name}
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={budget.monthly_amount || ""}
              onChange={(e) => updateAmount(cat.id, e.target.value)}
              placeholder="0"
              className="h-7 text-xs text-right px-1"
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
          </div>
        )
      })}

      <div className="text-xs text-muted-foreground text-right">
        Total: <span className="font-medium">${total.toLocaleString()}/mo</span>
      </div>
    </div>
  )
}
