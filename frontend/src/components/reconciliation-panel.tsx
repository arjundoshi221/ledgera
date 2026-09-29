"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAccountReconciliation, createReconciliationCheckpoint } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { errorMessage } from "@/lib/errors"
import type { Account } from "@/lib/types"

type ReconStatus = "reconciled" | "drifted" | "never_reconciled" | "loading" | "error"

interface ReconRow {
  accountId: string
  accountName: string
  currency: string
  status: ReconStatus
  computedBalance: number
  reportedBalance: number | null
  diff: number | null
  latestDate: string | null
}

/** F6: per-account reconciliation status on the dashboard. Uses B55 L3's
 *  GET /accounts/{id}/reconciliation endpoint. Never-reconciled is visually
 *  distinct from Reconciled — the whole point is to not paint unverified
 *  accounts green. */
export function ReconciliationPanel({ accounts }: { accounts: Account[] }) {
  // Recon data keyed by account_id. Populated by the fetch effect below.
  // React 19 hooks rule: no setState in an effect body when the goal is
  // "derive from prop." So we keep a map + version counter so consumers
  // re-render only when new data arrives — not on every render.
  const [reconMap, setReconMap] = useState<Map<string, Omit<ReconRow, "accountId" | "accountName" | "currency">>>(new Map())
  const fetchedFor = useRef<string>("")  // account-id list signature that has been fetched

  const [checkpointAccount, setCheckpointAccount] = useState<ReconRow | null>(null)
  const [checkpointBalance, setCheckpointBalance] = useState("")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const accountsSignature = useMemo(
    () => accounts.map(a => a.id).sort().join(","),
    [accounts]
  )

  useEffect(() => {
    // Effect body only kicks off the fetch — it does NOT setState synchronously
    // for account changes. State updates happen inside the async callback when
    // network data arrives (a legitimate "external system update" effect).
    if (fetchedFor.current === accountsSignature) return
    fetchedFor.current = accountsSignature

    let cancelled = false
    async function loadAll() {
      const results = await Promise.allSettled(
        accounts.map(a => getAccountReconciliation(a.id))
      )
      if (cancelled) return

      const next = new Map<string, Omit<ReconRow, "accountId" | "accountName" | "currency">>()
      accounts.forEach((a, i) => {
        const r = results[i]
        if (!r || r.status === "rejected") {
          next.set(a.id, {
            status: "error", computedBalance: 0, reportedBalance: null,
            diff: null, latestDate: null,
          })
          return
        }
        next.set(a.id, {
          status: r.value.status as ReconStatus,
          computedBalance: r.value.computed_balance,
          reportedBalance: r.value.reported_balance,
          diff: r.value.diff,
          latestDate: r.value.latest_checkpoint?.as_of_date ?? null,
        })
      })
      setReconMap(next)
    }
    loadAll()
    return () => { cancelled = true }
  }, [accountsSignature, accounts])

  // Derive rows from accounts + reconMap. Sort inline.
  const rows = useMemo<ReconRow[]>(() => {
    const built: ReconRow[] = accounts.map(a => {
      const data = reconMap.get(a.id)
      if (!data) {
        return {
          accountId: a.id, accountName: a.name, currency: a.account_currency,
          status: "loading", computedBalance: 0, reportedBalance: null,
          diff: null, latestDate: null,
        }
      }
      return {
        accountId: a.id, accountName: a.name, currency: a.account_currency,
        ...data,
      }
    })
    const order: Record<ReconStatus, number> = {
      drifted: 0, error: 1, never_reconciled: 2, reconciled: 3, loading: 4,
    }
    return built.sort((a, b) => order[a.status] - order[b.status])
  }, [accounts, reconMap])

  async function handleSaveCheckpoint() {
    if (!checkpointAccount) return
    const value = parseFloat(checkpointBalance)
    if (isNaN(value)) {
      toast({ variant: "destructive", title: "Enter a valid balance" })
      return
    }
    setSaving(true)
    try {
      await createReconciliationCheckpoint(checkpointAccount.accountId, {
        as_of_date: new Date().toISOString(),
        reported_balance: value,
        source: "manual",
        notes: "Reconciled from dashboard",
      })
      toast({ title: "Checkpoint saved" })
      setCheckpointAccount(null)
      setCheckpointBalance("")

      // Refresh the row inline.
      try {
        const fresh = await getAccountReconciliation(checkpointAccount.accountId)
        setReconMap(prev => {
          const next = new Map(prev)
          next.set(checkpointAccount.accountId, {
            status: fresh.status as ReconStatus,
            computedBalance: fresh.computed_balance,
            reportedBalance: fresh.reported_balance,
            diff: fresh.diff,
            latestDate: fresh.latest_checkpoint?.as_of_date ?? null,
          })
          return next
        })
      } catch { /* no-op */ }
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to save", description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No accounts to reconcile yet.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map(row => {
                const statusLabel = row.status === "reconciled"
                  ? "reconciled"
                  : row.status === "drifted"
                    ? `drifted by ${row.diff?.toFixed(2) ?? 0} ${row.currency}`
                    : row.status === "never_reconciled"
                      ? "never reconciled"
                      : "status unknown"
                const ariaLabel = `${row.accountName}: ${row.computedBalance.toFixed(2)} ${row.currency}, ${statusLabel}. Click to record a bank-reported balance.`
                return (
                <button
                  key={row.accountId}
                  onClick={() => {
                    setCheckpointAccount(row)
                    setCheckpointBalance(row.computedBalance.toFixed(2))
                  }}
                  className="w-full flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60 text-sm text-left"
                  aria-label={ariaLabel}
                  title="Click to record a bank-reported balance"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <StatusIcon status={row.status} />
                    <span className="font-medium truncate">{row.accountName}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs">
                      {row.computedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {row.currency}
                    </div>
                    <StatusText row={row} />
                  </div>
                </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={checkpointAccount !== null} onOpenChange={o => !o && setCheckpointAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconcile {checkpointAccount?.accountName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Ledgera says this account has <span className="font-mono font-medium text-foreground">{checkpointAccount?.computedBalance.toFixed(2)} {checkpointAccount?.currency}</span> as of today. Enter what your bank shows to verify.
            </div>
            <div>
              <Label>Bank-reported balance</Label>
              <Input
                type="number"
                step="0.01"
                value={checkpointBalance}
                onChange={e => setCheckpointBalance(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckpointAccount(null)}>Cancel</Button>
            <Button onClick={handleSaveCheckpoint} disabled={saving}>
              {saving ? "Saving..." : "Save checkpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StatusIcon({ status }: { status: ReconStatus }) {
  if (status === "reconciled") return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
  if (status === "drifted") return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
  if (status === "never_reconciled") return <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
  if (status === "loading") return <div className="h-4 w-4 rounded-full bg-muted animate-pulse shrink-0" />
  return <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
}

function StatusText({ row }: { row: ReconRow }) {
  if (row.status === "reconciled") {
    return (
      <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
        Reconciled{row.latestDate ? ` ${new Date(row.latestDate).toLocaleDateString()}` : ""}
      </div>
    )
  }
  if (row.status === "drifted" && row.diff !== null) {
    return (
      <div className={cn("text-[10px]", "text-red-600 dark:text-red-400")}>
        Drifted {row.diff > 0 ? "+" : ""}{row.diff.toFixed(2)}
      </div>
    )
  }
  if (row.status === "never_reconciled") {
    return <div className="text-[10px] text-muted-foreground">Never reconciled</div>
  }
  if (row.status === "loading") {
    return <div className="text-[10px] text-muted-foreground">Loading...</div>
  }
  return <div className="text-[10px] text-muted-foreground">—</div>
}

/** Re-export the icons the dashboard imports, so the "unused" symbol strip
 *  is stable across future refactors. */
export const _panelIcons = { CheckCircle2, AlertTriangle, HelpCircle }
