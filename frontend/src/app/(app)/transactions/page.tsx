"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { getAccounts, getTransactions, createTransaction, updateTransaction, deleteTransaction, getCategories, getSubcategories, getFunds } from "@/lib/api"
import { TRANSACTION_STATUSES } from "@/lib/constants"
import { useToast } from "@/components/ui/use-toast"
import type { Account, Transaction, Posting, Category, Subcategory, Fund } from "@/lib/types"

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Reference data
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [funds, setFunds] = useState<Fund[]>([])

  // Form state
  const [txType, setTxType] = useState<"income" | "expense" | "transfer">("expense")
  const [txTimestamp, setTxTimestamp] = useState("")
  const [payee, setPayee] = useState("")
  const [memo, setMemo] = useState("")
  const [txStatus, setTxStatus] = useState("pending")
  const [categoryId, setCategoryId] = useState("")
  const [subcategoryId, setSubcategoryId] = useState("")
  const [fundId, setFundId] = useState("")

  // For income/expense (single account)
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("SGD")

  // For transfers (two accounts)
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferCurrency, setTransferCurrency] = useState("SGD")

  const [creating, setCreating] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      try {
        const [accts, cats, subs, fnds] = await Promise.all([
          getAccounts(),
          getCategories(),
          getSubcategories(),
          getFunds(),
        ])
        setAccounts(accts)
        setCategories(cats)
        setSubcategories(subs)
        setFunds(fnds)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Load all transactions from workspace (deduplicated)
  async function loadAllTransactions() {
    try {
      const txs = await getTransactions() // No account ID = get all for workspace
      // Sort by timestamp descending (newest first)
      txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setTransactions(txs)
    } catch {
      setTransactions([])
    }
  }

  useEffect(() => {
    if (accounts.length > 0) {
      loadAllTransactions()
    }
  }, [accounts])

  // Filter subcategories by selected category
  const filteredSubcategories = subcategories.filter((s) => s.category_id === categoryId)

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategoryId("")
  }, [categoryId])

  // Find External account
  const externalAccount = accounts.find((a) => a.name === "External")

  // Filter out External account from regular account dropdowns
  const regularAccounts = accounts.filter((a) => a.name !== "External")

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const amt = parseFloat(txType === "transfer" ? transferAmount : amount) || 0
    if (amt <= 0) {
      toast({ variant: "destructive", title: "Enter a positive amount" })
      return
    }

    let postings: Posting[] = []

    if (txType === "income") {
      // Income: External (debit) → Account (credit)
      if (!accountId || !externalAccount) {
        toast({ variant: "destructive", title: "Select an account" })
        return
      }
      postings = [
        { account_id: externalAccount.id, amount: amt, currency, fx_rate: 1 },
        { account_id: accountId, amount: -amt, currency, fx_rate: 1 },
      ]
    } else if (txType === "expense") {
      // Expense: Account (debit) → External (credit)
      if (!accountId || !externalAccount) {
        toast({ variant: "destructive", title: "Select an account" })
        return
      }
      postings = [
        { account_id: accountId, amount: amt, currency, fx_rate: 1 },
        { account_id: externalAccount.id, amount: -amt, currency, fx_rate: 1 },
      ]
    } else {
      // Transfer: From (debit) → To (credit)
      if (!fromAccountId || !toAccountId) {
        toast({ variant: "destructive", title: "Select both accounts" })
        return
      }
      postings = [
        { account_id: fromAccountId, amount: amt, currency: transferCurrency, fx_rate: 1 },
        { account_id: toAccountId, amount: -amt, currency: transferCurrency, fx_rate: 1 },
      ]
    }

    setCreating(true)
    try {
      await createTransaction({
        timestamp: new Date(txTimestamp).toISOString(),
        payee,
        memo,
        status: txStatus,
        category_id: categoryId || undefined,
        subcategory_id: subcategoryId || undefined,
        fund_id: fundId || undefined,
        postings,
      })
      toast({ title: "Transaction created" })
      setShowForm(false)
      resetForm()
      // Reload all transactions
      await loadAllTransactions()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setTxTimestamp("")
    setPayee("")
    setMemo("")
    setCategoryId("")
    setSubcategoryId("")
    setFundId("")
    setAccountId("")
    setAmount("")
    setCurrency("SGD")
    setFromAccountId("")
    setToAccountId("")
    setTransferAmount("")
    setTransferCurrency("SGD")
  }

  function handleEditClick(tx: Transaction) {
    setEditingTransaction(tx)

    // Populate form fields from transaction
    setTxTimestamp(toLocalDatetime(new Date(tx.timestamp)))
    setPayee(tx.payee)
    setMemo(tx.memo || "")
    setTxStatus(tx.status)
    setCategoryId(tx.category_id || "")
    setSubcategoryId(tx.subcategory_id || "")
    setFundId(tx.fund_id || "")

    // Determine transaction type and populate account/amount fields
    const externalPosting = tx.postings?.find(p => {
      const acc = accounts.find(a => a.id === p.account_id)
      return acc && acc.name === "External"
    })
    const realPosting = tx.postings?.find(p => {
      const acc = accounts.find(a => a.id === p.account_id)
      return acc && acc.name !== "External"
    })

    if (externalPosting && realPosting) {
      const amt = Math.abs(Number(realPosting.amount))
      if (externalPosting.amount > 0) {
        // Income: External (debit) → Account (credit)
        setTxType("income")
        setAccountId(realPosting.account_id)
        setAmount(amt.toString())
        setCurrency(realPosting.currency)
      } else {
        // Expense: Account (debit) → External (credit)
        setTxType("expense")
        setAccountId(realPosting.account_id)
        setAmount(amt.toString())
        setCurrency(realPosting.currency)
      }
    } else if (tx.postings?.length === 2) {
      // Transfer
      setTxType("transfer")
      const fromPosting = tx.postings.find(p => Number(p.amount) > 0)
      const toPosting = tx.postings.find(p => Number(p.amount) < 0)
      if (fromPosting && toPosting) {
        setFromAccountId(fromPosting.account_id)
        setToAccountId(toPosting.account_id)
        setTransferAmount(Math.abs(Number(fromPosting.amount)).toString())
        setTransferCurrency(fromPosting.currency)
      }
    }

    setEditDialogOpen(true)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()

    if (!editingTransaction) return

    const amt = parseFloat(txType === "transfer" ? transferAmount : amount) || 0
    if (amt <= 0) {
      toast({ variant: "destructive", title: "Enter a positive amount" })
      return
    }

    let postings: Posting[] = []

    if (txType === "income") {
      if (!accountId || !externalAccount) {
        toast({ variant: "destructive", title: "Select an account" })
        return
      }
      postings = [
        { account_id: externalAccount.id, amount: amt, currency, fx_rate: 1 },
        { account_id: accountId, amount: -amt, currency, fx_rate: 1 },
      ]
    } else if (txType === "expense") {
      if (!accountId || !externalAccount) {
        toast({ variant: "destructive", title: "Select an account" })
        return
      }
      postings = [
        { account_id: accountId, amount: amt, currency, fx_rate: 1 },
        { account_id: externalAccount.id, amount: -amt, currency, fx_rate: 1 },
      ]
    } else {
      if (!fromAccountId || !toAccountId) {
        toast({ variant: "destructive", title: "Select both accounts" })
        return
      }
      postings = [
        { account_id: fromAccountId, amount: amt, currency: transferCurrency, fx_rate: 1 },
        { account_id: toAccountId, amount: -amt, currency: transferCurrency, fx_rate: 1 },
      ]
    }

    setUpdating(true)
    try {
      await updateTransaction(editingTransaction.id, {
        timestamp: new Date(txTimestamp).toISOString(),
        payee,
        memo,
        status: txStatus,
        category_id: categoryId || undefined,
        subcategory_id: subcategoryId || undefined,
        fund_id: fundId || undefined,
        postings,
      })
      toast({ title: "Transaction updated" })
      setEditDialogOpen(false)
      setEditingTransaction(null)
      resetForm()
      await loadAllTransactions()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteTransaction(txId: string) {
    try {
      await deleteTransaction(txId)
      toast({ title: "Transaction deleted" })
      setDeletingTxId(null)
      await loadAllTransactions()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  function getCategoryName(id: string | null) {
    if (!id) return null
    const cat = categories.find((c) => c.id === id)
    return cat ? `${cat.emoji || ""} ${cat.name}`.trim() : null
  }

  function getFundName(id: string | null) {
    if (!id) return null
    const fund = funds.find((f) => f.id === id)
    return fund ? `${fund.emoji || ""} ${fund.name}`.trim() : null
  }

  function getAccountName(id: string) {
    const acc = accounts.find((a) => a.id === id)
    return acc?.name ?? id
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading...</div>
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Create accounts first before adding transactions.
          </CardContent>
        </Card>
      </div>
    )
  }

  const displayAmount = parseFloat(txType === "transfer" ? transferAmount : amount) || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button onClick={() => {
          setShowForm(!showForm)
          if (!showForm) setTxTimestamp(toLocalDatetime(new Date()))
        }}>
          {showForm ? "Cancel" : "+ New Transaction"}
        </Button>
      </div>

      {/* New transaction form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-5">
              {/* Transaction Type */}
              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <Tabs value={txType} onValueChange={(v) => setTxType(v as "income" | "expense" | "transfer")}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="income">💰 Income</TabsTrigger>
                    <TabsTrigger value="expense">💸 Expense</TabsTrigger>
                    <TabsTrigger value="transfer">🔄 Transfer</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" value={txTimestamp} onChange={(e) => setTxTimestamp(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Payee</Label>
                  <Input value={payee} onChange={(e) => setPayee(e.target.value)} required placeholder={txType === "income" ? "From whom" : "To whom"} />
                </div>
                <div className="space-y-2">
                  <Label>Memo</Label>
                  <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={txStatus} onValueChange={setTxStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category, Subcategory, Fund - only for income/expense */}
              {txType !== "transfer" && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="_none" disabled>No categories - create in Settings</SelectItem>
                        ) : (
                          categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.emoji} {c.name} ({c.type})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subcategory</Label>
                    <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId}>
                      <SelectTrigger><SelectValue placeholder={categoryId ? "Optional" : "Select category first"} /></SelectTrigger>
                      <SelectContent>
                        {filteredSubcategories.length === 0 ? (
                          <SelectItem value="_none" disabled>No subcategories</SelectItem>
                        ) : (
                          filteredSubcategories.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fund</Label>
                    <Select value={fundId} onValueChange={setFundId}>
                      <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                      <SelectContent>
                        {funds.length === 0 ? (
                          <SelectItem value="_none" disabled>No funds - create in Settings</SelectItem>
                        ) : (
                          funds.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.emoji} {f.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Separator />

              {/* Income/Expense Form */}
              {txType !== "transfer" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {regularAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer Form */}
              {txType === "transfer" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From Account</Label>
                      <Select value={fromAccountId} onValueChange={setFromAccountId}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {regularAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>To Account</Label>
                      <Select value={toAccountId} onValueChange={setToAccountId}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {regularAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input value={transferCurrency} onChange={(e) => setTransferCurrency(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={creating || displayAmount <= 0} className="w-full">
                {creating ? "Creating..." : `Create ${txType === "income" ? "Income" : txType === "expense" ? "Expense" : "Transfer"} (${displayAmount.toFixed(2)})`}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit transaction dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-5">
            {/* Transaction Type */}
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Tabs value={txType} onValueChange={(v) => setTxType(v as "income" | "expense" | "transfer")}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="income">💰 Income</TabsTrigger>
                  <TabsTrigger value="expense">💸 Expense</TabsTrigger>
                  <TabsTrigger value="transfer">🔄 Transfer</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={txTimestamp} onChange={(e) => setTxTimestamp(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Payee</Label>
                <Input value={payee} onChange={(e) => setPayee(e.target.value)} required placeholder={txType === "income" ? "From whom" : "To whom"} />
              </div>
              <div className="space-y-2">
                <Label>Memo</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={txStatus} onValueChange={setTxStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category, Subcategory, Fund - only for income/expense */}
            {txType !== "transfer" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <SelectItem value="_none" disabled>No categories - create in Settings</SelectItem>
                      ) : (
                        categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.emoji} {c.name} ({c.type})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId}>
                    <SelectTrigger><SelectValue placeholder={categoryId ? "Optional" : "Select category first"} /></SelectTrigger>
                    <SelectContent>
                      {filteredSubcategories.length === 0 ? (
                        <SelectItem value="_none" disabled>No subcategories</SelectItem>
                      ) : (
                        filteredSubcategories.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fund</Label>
                  <Select value={fundId} onValueChange={setFundId}>
                    <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                    <SelectContent>
                      {funds.length === 0 ? (
                        <SelectItem value="_none" disabled>No funds - create in Settings</SelectItem>
                      ) : (
                        funds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.emoji} {f.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Separator />

            {/* Income/Expense Form */}
            {txType !== "transfer" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {regularAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Form */}
            {txType === "transfer" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Account</Label>
                    <Select value={fromAccountId} onValueChange={setFromAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {regularAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Account</Label>
                    <Select value={toAccountId} onValueChange={setToAccountId}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {regularAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value={transferCurrency} onChange={(e) => setTransferCurrency(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" disabled={updating || displayAmount <= 0} className="w-full">
              {updating ? "Updating..." : "Update Transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No transactions for this account.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  // Find the non-External posting to show the real account
                  const realPosting = tx.postings?.find((p) => {
                    const acc = accounts.find((a) => a.id === p.account_id)
                    return acc && acc.name !== "External"
                  })
                  const amt = realPosting ? Number(realPosting.amount) : 0
                  const accountName = realPosting ? getAccountName(realPosting.account_id) : "-"

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">{new Date(tx.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{tx.payee}</TableCell>
                      <TableCell className="text-sm">
                        {getCategoryName(tx.category_id) || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getFundName(tx.fund_id) || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{tx.memo}</TableCell>
                      <TableCell><Badge variant="secondary">{tx.status}</Badge></TableCell>
                      <TableCell className="text-sm">{accountName}</TableCell>
                      <TableCell className={`text-right font-mono ${amt < 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {amt < 0 ? "+" : "-"}{Math.abs(amt).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(tx)}>
                            Edit
                          </Button>
                          <Dialog
                            open={deletingTxId === tx.id}
                            onOpenChange={(open) => !open && setDeletingTxId(null)}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingTxId(tx.id)}>
                                Delete
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Transaction?</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                Delete this transaction from {tx.payee}? This cannot be undone.
                              </p>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeletingTxId(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={() => handleDeleteTransaction(tx.id)}>Delete</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
