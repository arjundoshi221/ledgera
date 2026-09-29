"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  createCategorizationRule,
  deleteCategorizationRule,
  updateCategorizationRule,
  applyCategorizationRuleToExisting,
} from "@/lib/api"
import { useCategorizationRules, useCategories, useSubcategories, useFunds } from "@/lib/hooks"
import { invalidateCategorizationRules, invalidateTransactions } from "@/lib/cache"
import { errorMessage } from "@/lib/errors"
import type { RuleMatchType, RuleMatchField, RuleTypeOverride, CategorizationRule } from "@/lib/types"

/** Import-time categorization rules (B53). Runs during CSV parse to auto-fill
 *  category/subcategory/fund, rewrite noisy bank payees to clean merchant
 *  names, and optionally override B52's transfer classification. */
export function RulesTab() {
  const { toast } = useToast()
  const { data: rules = [], isLoading } = useCategorizationRules()
  const { data: categories = [] } = useCategories()
  const { data: subcategories = [] } = useSubcategories()
  const { data: funds = [] } = useFunds()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CategorizationRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [matchValue, setMatchValue] = useState("")
  const [matchType, setMatchType] = useState<RuleMatchType>("contains")
  const [matchField, setMatchField] = useState<RuleMatchField>("payee_or_memo")
  const [normalizedPayee, setNormalizedPayee] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [subcategoryId, setSubcategoryId] = useState("")
  const [fundId, setFundId] = useState("")
  const [typeOverride, setTypeOverride] = useState<RuleTypeOverride | "">("")
  const [priority, setPriority] = useState("100")
  const [isActive, setIsActive] = useState(true)

  const availableSubcategories = subcategories.filter(sc => sc.category_id === categoryId)

  function openNewDialog() {
    setEditingRule(null)
    setMatchValue("")
    setMatchType("contains")
    setMatchField("payee_or_memo")
    setNormalizedPayee("")
    setCategoryId("")
    setSubcategoryId("")
    setFundId("")
    setTypeOverride("")
    setPriority("100")
    setIsActive(true)
    setDialogOpen(true)
  }

  function openEditDialog(rule: CategorizationRule) {
    setEditingRule(rule)
    setMatchValue(rule.match_value)
    setMatchType(rule.match_type)
    setMatchField(rule.match_field)
    setNormalizedPayee(rule.normalized_payee ?? "")
    setCategoryId(rule.category_id ?? "")
    // Only keep subcategory if it actually belongs to the category being edited
    // — protects against the stored rule pointing at an orphaned pair (created
    // in an older UI, or by an API caller). Prevents saving orphan state back.
    const storedSub = subcategories.find(sc => sc.id === rule.subcategory_id)
    const subMatchesCategory = storedSub && storedSub.category_id === rule.category_id
    setSubcategoryId(subMatchesCategory ? (rule.subcategory_id ?? "") : "")
    setFundId(rule.fund_id ?? "")
    setTypeOverride(rule.transaction_type_override ?? "")
    setPriority(String(rule.priority))
    setIsActive(rule.is_active)
    setDialogOpen(true)
  }

  /** Wrap the category setter so changing it always clears any stale
   *  subcategory, even mid-edit. Mirror pattern used in transactions.page.tsx. */
  function handleCategoryChange(newValue: string) {
    const next = newValue === "_none" ? "" : newValue
    if (next !== categoryId) {
      setSubcategoryId("")
    }
    setCategoryId(next)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!matchValue.trim()) {
      toast({ variant: "destructive", title: "Match value is required" })
      return
    }
    const parsedPriority = parseInt(priority, 10)
    if (isNaN(parsedPriority)) {
      toast({ variant: "destructive", title: "Priority must be a number" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        match_value: matchValue.trim(),
        match_type: matchType,
        match_field: matchField,
        normalized_payee: normalizedPayee.trim() || null,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        fund_id: fundId || null,
        transaction_type_override: typeOverride || null,
        priority: parsedPriority,
        is_active: isActive,
      }
      if (editingRule) {
        await updateCategorizationRule(editingRule.id, payload)
        toast({ title: "Rule updated" })
      } else {
        await createCategorizationRule(payload)
        toast({ title: "Rule created" })
      }
      setDialogOpen(false)
      await invalidateCategorizationRules()
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to save rule", description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ruleId: string) {
    setDeletingId(ruleId)
    try {
      await deleteCategorizationRule(ruleId)
      toast({ title: "Rule deleted" })
      await invalidateCategorizationRules()
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to delete", description: errorMessage(err) })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleApplyToExisting(ruleId: string) {
    setApplyingId(ruleId)
    try {
      const result = await applyCategorizationRuleToExisting(ruleId)
      const skipped = result.matched_count - result.updated_count
      toast({
        title: "Rule applied",
        description: `${result.updated_count} of ${result.matched_count} matching transactions updated${
          skipped > 0 ? ` (${skipped} skipped — already categorized)` : ""
        }`,
      })
      await Promise.all([invalidateCategorizationRules(), invalidateTransactions()])
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to apply", description: errorMessage(err) })
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Categorization Rules</CardTitle>
              <CardDescription className="mt-1">
                Auto-categorize transactions at CSV import. Rules are matched in priority order (lower priority runs first); first match wins.
              </CardDescription>
            </div>
            <Button onClick={openNewDialog} size="sm">Add Rule</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground animate-pulse">Loading rules...</div>
          ) : rules.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No rules yet. Add one to auto-categorize future imports, or click &quot;Save rule from this&quot; on any imported transaction.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Priority</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Rewrites payee to</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-20">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => {
                  const category = categories.find(c => c.id === rule.category_id)
                  const fund = funds.find(f => f.id === rule.fund_id)
                  return (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-xs">{rule.priority}</TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">{rule.match_value}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {rule.match_type} · {rule.match_field}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{rule.normalized_payee ?? "—"}</TableCell>
                      <TableCell className="text-xs">{category?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fund?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {rule.transaction_type_override ? (
                          <Badge variant="outline" className="text-[10px]">
                            {rule.transaction_type_override}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Badge variant="default" className="text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleApplyToExisting(rule.id)}
                          disabled={applyingId === rule.id}
                        >
                          {applyingId === rule.id ? "Applying..." : "Apply to existing"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => openEditDialog(rule)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive"
                          onClick={() => handleDelete(rule.id)}
                          disabled={deletingId === rule.id}
                        >
                          {deletingId === rule.id ? "..." : "Delete"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit rule" : "Create rule"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Match value *</Label>
                <Input
                  value={matchValue}
                  onChange={e => setMatchValue(e.target.value)}
                  placeholder="e.g. GRAB"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Case-insensitive. For &quot;contains&quot;, the substring anywhere in payee/memo triggers the rule.
                </p>
              </div>
              <div>
                <Label>Match type</Label>
                <Select value={matchType} onValueChange={v => setMatchType(v as RuleMatchType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="starts_with">starts with</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="regex">regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Match field</Label>
                <Select value={matchField} onValueChange={v => setMatchField(v as RuleMatchField)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payee_or_memo">payee or memo</SelectItem>
                    <SelectItem value="payee">payee only</SelectItem>
                    <SelectItem value="memo">memo only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Rewrite payee to (optional)</Label>
                <Input
                  value={normalizedPayee}
                  onChange={e => setNormalizedPayee(e.target.value)}
                  placeholder="e.g. Grab"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={categoryId || "_none"} onValueChange={handleCategoryChange}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subcategory</Label>
                <Select
                  value={subcategoryId || "_none"}
                  onValueChange={v => setSubcategoryId(v === "_none" ? "" : v)}
                  disabled={!categoryId}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {availableSubcategories.map(sc => (
                      <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fund</Label>
                <Select value={fundId || "_none"} onValueChange={v => setFundId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {funds.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Override type</Label>
                <Select
                  value={typeOverride || "_none"}
                  onValueChange={v => setTypeOverride(v === "_none" ? "" : v as RuleTypeOverride)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— No override —</SelectItem>
                    <SelectItem value="income">income</SelectItem>
                    <SelectItem value="expense">expense</SelectItem>
                    <SelectItem value="transfer">transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Lower runs first.</p>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={isActive ? "active" : "inactive"} onValueChange={v => setIsActive(v === "active")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingRule ? "Save" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
