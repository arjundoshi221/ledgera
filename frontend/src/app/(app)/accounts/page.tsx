"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAccounts, createAccount } from "@/lib/api"
import { ACCOUNT_TYPES, CURRENCIES } from "@/lib/constants"
import { useToast } from "@/components/ui/use-toast"
import type { Account, AccountType } from "@/lib/types"

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("asset")
  const [currency, setCurrency] = useState("SGD")
  const [institution, setInstitution] = useState("")
  const [startingBalance, setStartingBalance] = useState("")
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  async function loadAccounts() {
    try {
      const data = await getAccounts()
      setAccounts(data)
    } catch {
      toast({ variant: "destructive", title: "Failed to load accounts" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await createAccount({
        name,
        type: type as AccountType,
        account_currency: currency,
        institution: institution || undefined,
        starting_balance: startingBalance ? parseFloat(startingBalance) : 0,
      })
      toast({ title: "Account created" })
      setDialogOpen(false)
      setName("")
      setInstitution("")
      setStartingBalance("")
      loadAccounts()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    } finally {
      setCreating(false)
    }
  }

  const typeBadgeVariant = (t: string) => {
    switch (t) {
      case "asset": return "default" as const
      case "liability": return "destructive" as const
      case "income": return "secondary" as const
      case "expense": return "outline" as const
      default: return "secondary" as const
    }
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading accounts...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>+ New Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Checking" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Institution (optional)</Label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. DBS Bank" />
              </div>
              <div className="space-y-2">
                <Label>Starting Balance</Label>
                <Input type="number" step="0.01" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} placeholder="0.00" />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.filter((a) => a.name !== "External").length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No accounts yet. Click &quot;+ New Account&quot; to create one.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Institution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.filter((a) => a.name !== "External").map((acct) => (
                  <TableRow key={acct.id}>
                    <TableCell className="font-medium">{acct.name}</TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant(acct.type)}>{acct.type}</Badge>
                    </TableCell>
                    <TableCell>{acct.account_currency}</TableCell>
                    <TableCell className="text-muted-foreground">{acct.institution || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
