"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category, OneTimeCost } from "@/lib/types"

interface OneTimeCostEditorProps {
  costs: OneTimeCost[]
  onChange: (costs: OneTimeCost[]) => void
  categories: Category[]
  months: number
}

const EMPTY_COST: OneTimeCost = { name: "", amount: 0, month_index: 0 }

export function OneTimeCostEditor({
  costs,
  onChange,
  categories,
  months,
}: OneTimeCostEditorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<OneTimeCost>(EMPTY_COST)

  function openAdd() {
    setDraft(EMPTY_COST)
    setEditingIndex(null)
    setDialogOpen(true)
  }

  function openEdit(index: number) {
    setDraft({ ...costs[index] })
    setEditingIndex(index)
    setDialogOpen(true)
  }

  function handleSave() {
    if (!draft.name || draft.amount <= 0) return
    if (editingIndex !== null) {
      const updated = [...costs]
      updated[editingIndex] = draft
      onChange(updated)
    } else {
      onChange([...costs, draft])
    }
    setDialogOpen(false)
  }

  function handleDelete(index: number) {
    onChange(costs.filter((_, i) => i !== index))
  }

  const totalCost = costs.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-2">
      {costs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one-time costs added.</p>
      ) : (
        <div className="space-y-1">
          {costs.map((cost, i) => (
            <div key={i} className="flex items-center gap-1 text-xs">
              <span className="flex-1 truncate">
                Mo {cost.month_index + 1}: {cost.name} - ${cost.amount.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => openEdit(i)}
                className="text-muted-foreground hover:text-foreground shrink-0"
                title="Edit"
              >
                &#9998;
              </button>
              <button
                type="button"
                onClick={() => handleDelete(i)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title="Delete"
              >
                &times;
              </button>
            </div>
          ))}
          <div className="text-xs text-muted-foreground text-right">
            Total: <span className="font-medium">${totalCost.toLocaleString()}</span>
          </div>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={openAdd}>
        + Add One-Time Cost
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Edit Cost" : "Add One-Time Cost"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Vacation, Insurance"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                step="100"
                min="0"
                value={draft.amount || ""}
                onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month (1 = first month, max {months})</Label>
              <Input
                type="number"
                min="1"
                max={months}
                value={draft.month_index + 1}
                onChange={(e) =>
                  setDraft({ ...draft, month_index: Math.max(0, (parseInt(e.target.value) || 1) - 1) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value || undefined })}
                placeholder="Any details"
              />
            </div>
            {categories.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Category (optional)</Label>
                <Select
                  value={draft.category_id ?? "none"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, category_id: v === "none" ? undefined : v })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.emoji && `${cat.emoji} `}{cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!draft.name || draft.amount <= 0}>
              {editingIndex !== null ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
