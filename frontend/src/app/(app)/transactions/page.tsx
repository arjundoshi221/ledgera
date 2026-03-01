"use client"

import { useMemo, useState, useEffect } from "react"
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
import { createTransaction, createTransfer, updateTransaction, deleteTransaction, getPrice, createRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, confirmRecurring, skipRecurring, readFileHeaders, parseTransactionsFile } from "@/lib/api"
import { useAccounts, useTransactions, useCategories, useSubcategories, useFunds, usePaymentMethods, useRecurringTransactions, usePendingInstances, useWorkspace, useTransactionMutations, useRecurringMutations } from "@/lib/hooks"
import { invalidateTransactions, invalidateRecurring, invalidatePendingInstances } from "@/lib/cache"
import { TRANSACTION_STATUSES, RECURRING_FREQUENCIES } from "@/lib/constants"
import { useToast } from "@/components/ui/use-toast"
import type { Account, Transaction, Posting, Category, Subcategory, Fund, PaymentMethod, RecurringTransaction, PendingInstance, RecurringFrequency, FileHeadersResponse, ParsedTransaction, FileParseResult, ColumnMapping } from "@/lib/types"
import { Upload, FileText, Check } from "lucide-react"
import { cn } from "@/lib/utils"

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TransactionsPage() {
  const [showForm, setShowForm] = useState(false)

  // Use SWR hooks for automatic caching
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const { data: rawTransactions = [], isLoading: txnsLoading, mutate: mutateTransactions } = useTransactions()
  const { data: categories = [] } = useCategories()
  const { data: subcategories = [] } = useSubcategories()
  const { data: funds = [] } = useFunds()
  const { data: paymentMethods = [] } = usePaymentMethods()
  const { data: workspace } = useWorkspace()
  const baseCurrency = workspace?.base_currency ?? "SGD"

  // Sort transactions by timestamp descending (newest first)
  const transactions = useMemo(() => {
    return [...rawTransactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [rawTransactions])

  const loading = accountsLoading || txnsLoading

  // Form state
  const [txType, setTxType] = useState<"income" | "expense" | "transfer">("expense")
  const [txTimestamp, setTxTimestamp] = useState("")
  const [payee, setPayee] = useState("")
  const [memo, setMemo] = useState("")
  const [txStatus, setTxStatus] = useState("pending")
  const [categoryId, setCategoryId] = useState("")
  const [subcategoryId, setSubcategoryId] = useState("")
  const [fundId, setFundId] = useState("")
  const [paymentMethodId, setPaymentMethodId] = useState("")

  // For income/expense (single account)
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState(baseCurrency)

  // For transfers (two accounts)
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferCurrency, setTransferCurrency] = useState(baseCurrency)
  const [sourceFundId, setSourceFundId] = useState("")
  const [destFundId, setDestFundId] = useState("")
  const [fxRate, setFxRate] = useState("1")
  const [toCurrency, setToCurrency] = useState("")
  const [transferFee, setTransferFee] = useState("")

  const [creating, setCreating] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [updating, setUpdating] = useState(false)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)
  const { toast } = useToast()

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [filterCategoryId, setFilterCategoryId] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterPayee, setFilterPayee] = useState("")

  const hasActiveFilters = !!(filterDateFrom || filterDateTo || filterCategoryId || filterType || filterStatus || filterPayee)

  // Main tab
  const [activeMainTab, setActiveMainTab] = useState<"transactions" | "recurring">("transactions")

  // Recurring - use SWR hooks
  const { data: recurringTemplates = [] } = useRecurringTransactions()
  const { data: pendingInstances = [] } = usePendingInstances()
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [recName, setRecName] = useState("")
  const [recTxType, setRecTxType] = useState<"income" | "expense" | "transfer">("expense")
  const [recPayee, setRecPayee] = useState("")
  const [recMemo, setRecMemo] = useState("")
  const [recAmount, setRecAmount] = useState("")
  const [recCurrency, setRecCurrency] = useState(baseCurrency)
  const [recCategoryId, setRecCategoryId] = useState("")
  const [recSubcategoryId, setRecSubcategoryId] = useState("")
  const [recFundId, setRecFundId] = useState("")
  const [recPaymentMethodId, setRecPaymentMethodId] = useState("")
  const [recAccountId, setRecAccountId] = useState("")
  const [recFromAccountId, setRecFromAccountId] = useState("")
  const [recToAccountId, setRecToAccountId] = useState("")
  const [recFrequency, setRecFrequency] = useState<RecurringFrequency>("monthly")
  const [recStartDate, setRecStartDate] = useState("")
  const [recEndDate, setRecEndDate] = useState("")
  const [recSourceFundId, setRecSourceFundId] = useState("")
  const [recDestFundId, setRecDestFundId] = useState("")
  const [creatingRecurring, setCreatingRecurring] = useState(false)
  const [deletingRecId, setDeletingRecId] = useState<string | null>(null)

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1)
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [filePreview, setFilePreview] = useState<Record<string, string>[]>([])
  const [fileType, setFileType] = useState<'csv' | 'xlsx'>('csv')
  const [sheetName, setSheetName] = useState<string | undefined>(undefined)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([])
  const [editedTransactions, setEditedTransactions] = useState<Map<number, Partial<ParsedTransaction>>>(new Map())
  const [creatingImportTx, setCreatingImportTx] = useState<Set<number>>(new Set())
  const [createdTx, setCreatedTx] = useState<Set<number>>(new Set())
  const [loadingHeaders, setLoadingHeaders] = useState(false)
  const [parsingFile, setParsingFile] = useState(false)

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterDateFrom) {
        const txDate = new Date(tx.timestamp).toISOString().slice(0, 10)
        if (txDate < filterDateFrom) return false
      }
      if (filterDateTo) {
        const txDate = new Date(tx.timestamp).toISOString().slice(0, 10)
        if (txDate > filterDateTo) return false
      }
      if (filterCategoryId && tx.category_id !== filterCategoryId) return false
      if (filterType) {
        if (filterType === "transfer") {
          if (tx.type !== "transfer") return false
        } else {
          if (tx.type === "transfer") return false
          const realPosting = tx.postings?.find((p: Posting) => {
            const acc = accounts.find((a) => a.id === p.account_id)
            return acc && acc.name !== "External"
          })
          if (filterType === "income" && (!realPosting || Number(realPosting.amount) <= 0)) return false
          if (filterType === "expense" && (!realPosting || Number(realPosting.amount) >= 0)) return false
        }
      }
      if (filterStatus && tx.status !== filterStatus) return false
      if (filterPayee && !tx.payee.toLowerCase().includes(filterPayee.toLowerCase())) return false
      return true
    })
  }, [transactions, accounts, filterDateFrom, filterDateTo, filterCategoryId, filterType, filterStatus, filterPayee])

  function clearAllFilters() {
    setFilterDateFrom("")
    setFilterDateTo("")
    setFilterCategoryId("")
    setFilterType("")
    setFilterStatus("")
    setFilterPayee("")
  }


  // Filter categories by transaction type
  const filteredCategories = useMemo(() => {
    if (txType === "transfer") return []
    return categories.filter((c) => c.type === txType)
  }, [categories, txType])

  const recFilteredCategories = useMemo(() => {
    if (recTxType === "transfer") return []
    return categories.filter((c) => c.type === recTxType)
  }, [categories, recTxType])

  // Filter subcategories by selected category
  const filteredSubcategories = subcategories.filter((s) => s.category_id === categoryId)
  const recFilteredSubcategories = subcategories.filter((s) => s.category_id === recCategoryId)

  // Filter out External account from regular account dropdowns
  const regularAccounts = accounts.filter((a) => a.name !== "External")

  // Filter accounts by selected fund
  const filteredAccounts = useMemo(() => {
    if (!fundId) return regularAccounts
    const fund = funds.find((f) => f.id === fundId)
    if (!fund || !fund.linked_accounts || fund.linked_accounts.length === 0) return regularAccounts
    const linkedAccountIds = fund.linked_accounts.map((la) => la.id)
    return regularAccounts.filter((a) => linkedAccountIds.includes(a.id))
  }, [fundId, funds, regularAccounts])

  const recFilteredAccounts = useMemo(() => {
    if (!recFundId) return regularAccounts
    const fund = funds.find((f) => f.id === recFundId)
    if (!fund || !fund.linked_accounts || fund.linked_accounts.length === 0) return regularAccounts
    const linkedAccountIds = fund.linked_accounts.map((la) => la.id)
    return regularAccounts.filter((a) => linkedAccountIds.includes(a.id))
  }, [recFundId, funds, regularAccounts])

  // Sync currency defaults when workspace base currency loads
  useEffect(() => {
    setCurrency(baseCurrency)
    setTransferCurrency(baseCurrency)
    setRecCurrency(baseCurrency)
  }, [baseCurrency])

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategoryId("")
  }, [categoryId])

  // Reset recurring subcategory when recurring category changes
  useEffect(() => {
    setRecSubcategoryId("")
  }, [recCategoryId])

  // Reset account when fund changes (if selected account is not in filtered list)
  useEffect(() => {
    if (accountId && fundId) {
      const isAccountInFiltered = filteredAccounts.some((a) => a.id === accountId)
      if (!isAccountInFiltered) {
        setAccountId("")
      }
    }
  }, [fundId, filteredAccounts, accountId])

  // Reset recurring account when recurring fund changes
  useEffect(() => {
    if (recAccountId && recFundId) {
      const isAccountInFiltered = recFilteredAccounts.some((a) => a.id === recAccountId)
      if (!isAccountInFiltered) {
        setRecAccountId("")
      }
    }
  }, [recFundId, recFilteredAccounts, recAccountId])

  // Auto-detect fund for an account (returns fund id if exactly one link, else "")
  function autoDetectFund(accountId: string): string {
    const linked = funds.filter((f) => f.linked_accounts?.some((la: any) => la.id === accountId))
    return linked.length === 1 ? linked[0].id : ""
  }

  // Detect if transfer is cross-currency
  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const isCrossCurrency = fromAccount && toAccount && fromAccount.account_currency !== toAccount.account_currency

  // Auto-fetch FX rate when cross-currency transfer is detected
  const [fetchingRate, setFetchingRate] = useState(false)
  useEffect(() => {
    if (!isCrossCurrency || !fromAccount || !toAccount) return
    let cancelled = false
    setFetchingRate(true)
    getPrice(fromAccount.account_currency, toAccount.account_currency)
      .then((res) => {
        if (!cancelled) {
          setFxRate(Number(res.rate).toFixed(6))
          setTransferCurrency(fromAccount.account_currency)
        }
      })
      .catch(() => {
        // Keep manual entry if fetch fails
      })
      .finally(() => {
        if (!cancelled) setFetchingRate(false)
      })
    return () => { cancelled = true }
  }, [fromAccountId, toAccountId, accounts.length])

  // Find External account
  const externalAccount = accounts.find((a) => a.name === "External")

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    const amt = parseFloat(txType === "transfer" ? transferAmount : amount) || 0
    if (amt <= 0) {
      toast({ variant: "destructive", title: "Amount must be greater than 0" })
      return
    }

    // Validate required fields for income/expense
    if (txType !== "transfer") {
      if (!categoryId) {
        toast({ variant: "destructive", title: "Category is required" })
        return
      }
      if (!fundId) {
        toast({ variant: "destructive", title: "Fund is required" })
        return
      }
      if (!accountId) {
        toast({ variant: "destructive", title: "Account is required" })
        return
      }
    }

    let postings: Posting[] = []

    if (txType === "income") {
      // Income: Bank increases (debit +), External decreases (credit -)
      if (!accountId || !externalAccount) {
        toast({ variant: "destructive", title: "Select an account" })
        return
      }
      postings = [
        { account_id: accountId, amount: amt, currency, fx_rate: 1 },
        { account_id: externalAccount.id, amount: -amt, currency, fx_rate: 1 },
      ]
    } else if (txType === "expense") {
      // Expense: Bank decreases (credit -), External increases (debit +)
      if (!accountId || !externalAccount) {
        toast({ variant: "destructive", title: "Select an account" })
        return
      }
      postings = [
        { account_id: accountId, amount: -amt, currency, fx_rate: 1 },
        { account_id: externalAccount.id, amount: amt, currency, fx_rate: 1 },
      ]
    } else {
      // Transfer: use dedicated transfer endpoint
      if (!fromAccountId || !toAccountId) {
        toast({ variant: "destructive", title: "Select both accounts" })
        return
      }
      setCreating(true)
      try {
        const effectiveToCurrency = isCrossCurrency ? (toAccount?.account_currency || transferCurrency) : transferCurrency
        await createTransfer({
          timestamp: new Date(txTimestamp).toISOString(),
          payee: payee || "Transfer",
          memo,
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: amt,
          from_currency: transferCurrency,
          to_currency: isCrossCurrency ? effectiveToCurrency : undefined,
          fx_rate: isCrossCurrency ? parseFloat(fxRate) || 1 : undefined,
          source_fund_id: sourceFundId || undefined,
          dest_fund_id: destFundId || undefined,
          payment_method_id: paymentMethodId || undefined,
          fee: parseFloat(transferFee) || undefined,
        })
        toast({ title: "Transfer created" })
        setShowForm(false)
        resetForm()
        await invalidateTransactions()
      } catch (err: any) {
        toast({ variant: "destructive", title: "Failed", description: err.message })
      } finally {
        setCreating(false)
      }
      return
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
        payment_method_id: paymentMethodId || undefined,
        postings,
      })
      toast({ title: "Transaction created" })
      setShowForm(false)
      resetForm()
      await invalidateTransactions()
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
    setPaymentMethodId("")
    setAccountId("")
    setAmount("")
    setCurrency(baseCurrency)
    setFromAccountId("")
    setToAccountId("")
    setTransferAmount("")
    setTransferCurrency(baseCurrency)
    setSourceFundId("")
    setDestFundId("")
    setFxRate("1")
    setToCurrency("")
    setTransferFee("")
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
    setPaymentMethodId(tx.payment_method_id || "")

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
      if (Number(realPosting.amount) > 0) {
        // Income: Bank posting is positive (debit)
        setTxType("income")
        setAccountId(realPosting.account_id)
        setAmount(amt.toString())
        setCurrency(realPosting.currency)
      } else {
        // Expense: Bank posting is negative (credit)
        setTxType("expense")
        setAccountId(realPosting.account_id)
        setAmount(amt.toString())
        setCurrency(realPosting.currency)
      }
    } else if (tx.postings?.length === 2) {
      // Transfer: From has negative amount, To has positive
      setTxType("transfer")
      const fromPosting = tx.postings.find(p => Number(p.amount) < 0)
      const toPosting = tx.postings.find(p => Number(p.amount) > 0)
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
        { account_id: accountId, amount: amt, currency, fx_rate: 1 },
        { account_id: externalAccount.id, amount: -amt, currency, fx_rate: 1 },
      ]
    } else if (txType === "expense") {
      if (!accountId || !externalAccount) {
        toast({ variant: "destructive", title: "Select an account" })
        return
      }
      postings = [
        { account_id: accountId, amount: -amt, currency, fx_rate: 1 },
        { account_id: externalAccount.id, amount: amt, currency, fx_rate: 1 },
      ]
    } else {
      if (!fromAccountId || !toAccountId) {
        toast({ variant: "destructive", title: "Select both accounts" })
        return
      }
      postings = [
        { account_id: fromAccountId, amount: -amt, currency: transferCurrency, fx_rate: 1 },
        { account_id: toAccountId, amount: amt, currency: transferCurrency, fx_rate: 1 },
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
        payment_method_id: paymentMethodId || undefined,
        postings,
      })
      toast({ title: "Transaction updated" })
      setEditDialogOpen(false)
      setEditingTransaction(null)
      resetForm()
      await invalidateTransactions()
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
      await invalidateTransactions()
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

  function getPaymentMethodName(id: string | null) {
    if (!id) return null
    const pm = paymentMethods.find((p) => p.id === id)
    return pm ? `${pm.icon || ""} ${pm.name}`.trim() : null
  }

  function getAccountName(id: string) {
    const acc = accounts.find((a) => a.id === id)
    return acc?.name ?? id
  }

  // ── Recurring handlers ──

  function resetRecurringForm() {
    setRecName("")
    setRecTxType("expense")
    setRecPayee("")
    setRecMemo("")
    setRecAmount("")
    setRecCurrency(baseCurrency)
    setRecCategoryId("")
    setRecSubcategoryId("")
    setRecFundId("")
    setRecPaymentMethodId("")
    setRecAccountId("")
    setRecFromAccountId("")
    setRecToAccountId("")
    setRecFrequency("monthly")
    setRecStartDate("")
    setRecEndDate("")
    setRecSourceFundId("")
    setRecDestFundId("")
  }

  async function handleCreateRecurring(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(recAmount) || 0
    if (amt <= 0) {
      toast({ variant: "destructive", title: "Amount must be greater than 0" })
      return
    }
    // Validate required fields for income/expense
    if (recTxType !== "transfer") {
      if (!recCategoryId) {
        toast({ variant: "destructive", title: "Category is required" })
        return
      }
      if (!recFundId) {
        toast({ variant: "destructive", title: "Fund is required" })
        return
      }
      if (!recAccountId) {
        toast({ variant: "destructive", title: "Account is required" })
        return
      }
    }
    setCreatingRecurring(true)
    try {
      await createRecurringTransaction({
        name: recName,
        transaction_type: recTxType,
        payee: recPayee || undefined,
        memo: recMemo || undefined,
        amount: amt,
        currency: recCurrency,
        category_id: recCategoryId || undefined,
        subcategory_id: recSubcategoryId || undefined,
        fund_id: recFundId || undefined,
        payment_method_id: recPaymentMethodId || undefined,
        account_id: recAccountId || undefined,
        from_account_id: recFromAccountId || undefined,
        to_account_id: recToAccountId || undefined,
        source_fund_id: recSourceFundId || undefined,
        dest_fund_id: recDestFundId || undefined,
        frequency: recFrequency,
        start_date: recStartDate,
        end_date: recEndDate || undefined,
      })
      toast({ title: "Recurring transaction created" })
      setShowRecurringForm(false)
      resetRecurringForm()
      await Promise.all([invalidateRecurring(), invalidatePendingInstances()])
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    } finally {
      setCreatingRecurring(false)
    }
  }

  async function handleConfirmRecurring(inst: PendingInstance) {
    try {
      await confirmRecurring(inst.recurring_id, { occurrence_date: inst.occurrence_date })
      toast({ title: `Confirmed: ${inst.name}` })
      await Promise.all([invalidateRecurring(), invalidatePendingInstances(), invalidateTransactions()])
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to confirm", description: err.message })
    }
  }

  async function handleSkipRecurring(inst: PendingInstance) {
    try {
      await skipRecurring(inst.recurring_id, { occurrence_date: inst.occurrence_date })
      toast({ title: `Skipped: ${inst.name}` })
      await Promise.all([invalidateRecurring(), invalidatePendingInstances()])
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to skip", description: err.message })
    }
  }

  async function toggleRecurringActive(t: RecurringTransaction) {
    try {
      await updateRecurringTransaction(t.id, { is_active: !t.is_active })
      toast({ title: t.is_active ? "Paused" : "Resumed" })
      await invalidateRecurring()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  async function handleDeleteRecurring(id: string) {
    try {
      await deleteRecurringTransaction(id)
      toast({ title: "Recurring transaction deleted" })
      setDeletingRecId(null)
      await Promise.all([invalidateRecurring(), invalidatePendingInstances()])
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  // Import handlers
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setLoadingHeaders(true)

    try {
      const result = await readFileHeaders(file)
      setFileHeaders(result.headers)
      setFilePreview(result.preview_rows)
      setFileType(result.file_type)
      setSheetName(result.sheet_name)
      setColumnMapping(result.suggested_mapping)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to read file", description: err.message })
      setSelectedFile(null)
    } finally {
      setLoadingHeaders(false)
    }
  }

  async function handleParseFile() {
    if (!selectedFile || !selectedAccountId) return

    setParsingFile(true)

    try {
      const result = await parseTransactionsFile(
        selectedFile,
        selectedAccountId,
        columnMapping,
        fileType,
        sheetName || undefined
      )
      setParsedTransactions(result.parsed_transactions)
      setImportStep(3)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to parse file", description: err.message })
    } finally {
      setParsingFile(false)
    }
  }

  async function confirmImportTransaction(rowNumber: number) {
    const parsedTx = parsedTransactions.find(tx => tx.row_number === rowNumber)
    if (!parsedTx || !parsedTx.timestamp) return

    const edited = editedTransactions.get(rowNumber) || {}
    const finalTx = { ...parsedTx, ...edited }

    setCreatingImportTx(prev => new Set(prev).add(rowNumber))

    try {
      // Determine second account based on transaction type
      let secondAccountId: string

      if (finalTx.transaction_type === 'transfer') {
        // For transfers, use the transfer_account_id
        if (!finalTx.transfer_account_id) {
          throw new Error("Transfer account must be selected for transfers")
        }
        secondAccountId = finalTx.transfer_account_id
      } else {
        // For income/expense, use External account
        const externalAccount = accounts.find(a => a.name === "External")
        if (!externalAccount) {
          throw new Error("External account not found")
        }
        secondAccountId = externalAccount.id
      }

      await createTransaction({
        timestamp: finalTx.timestamp!,
        payee: finalTx.payee,
        memo: finalTx.memo || "",
        status: "cleared",
        source: "csv_import",
        category_id: finalTx.category_id || undefined,
        subcategory_id: finalTx.subcategory_id || undefined,
        fund_id: finalTx.fund_id || undefined,
        payment_method_id: finalTx.payment_method_id || undefined,
        postings: [
          {
            account_id: finalTx.account_id,
            amount: finalTx.amount,
            currency: finalTx.currency,
            fx_rate: 1
          },
          {
            account_id: secondAccountId,
            amount: -finalTx.amount,
            currency: finalTx.currency,
            fx_rate: 1
          }
        ]
      })

      setCreatedTx(prev => new Set(prev).add(rowNumber))
      toast({ title: "Transaction created successfully" })
      await invalidateTransactions()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to create transaction", description: err.message })
    } finally {
      setCreatingImportTx(prev => {
        const next = new Set(prev)
        next.delete(rowNumber)
        return next
      })
    }
  }

  async function confirmAllValidTransactions() {
    const validTxs = parsedTransactions.filter(tx => !tx.has_errors && !createdTx.has(tx.row_number))
    for (const tx of validTxs) {
      await confirmImportTransaction(tx.row_number)
    }
  }

  function resetImportDialog() {
    setImportDialogOpen(false)
    setImportStep(1)
    setSelectedAccountId("")
    setSelectedFile(null)
    setFileHeaders([])
    setFilePreview([])
    setColumnMapping({})
    setParsedTransactions([])
    setEditedTransactions(new Map())
    setCreatingImportTx(new Set())
    setCreatedTx(new Set())
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
        {activeMainTab === "transactions" ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Bank Statement
            </Button>
            <Button onClick={() => {
              setShowForm(!showForm)
              if (!showForm) setTxTimestamp(toLocalDatetime(new Date()))
            }}>
              {showForm ? "Cancel" : "+ New Transaction"}
            </Button>
          </div>
        ) : (
          <Button onClick={() => {
            setShowRecurringForm(!showRecurringForm)
            if (!showRecurringForm) setRecStartDate(new Date().toISOString().slice(0, 10))
          }}>
            {showRecurringForm ? "Cancel" : "+ New Recurring"}
          </Button>
        )}
      </div>

      <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as "transactions" | "recurring")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="recurring">
            Recurring
            {pendingInstances.length > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{pendingInstances.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-6">

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
                  <Label>{txType === "income" ? "Payer" : "Payee"}</Label>
                  <Input value={payee} onChange={(e) => setPayee(e.target.value)} required placeholder={txType === "income" ? "e.g. Employer" : "e.g. Landlord"} />
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

              {/* Category, Subcategory, Fund, Payment Method - only for income/expense */}
              {txType !== "transfer" && (
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={categoryId} onValueChange={setCategoryId} required>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {filteredCategories.length === 0 ? (
                          <SelectItem value="_none" disabled>No {txType} categories - create in Settings</SelectItem>
                        ) : (
                          filteredCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.emoji} {c.name}
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
                    <Label>Fund *</Label>
                    <Select value={fundId} onValueChange={setFundId} required>
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
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethodId} onValueChange={(v) => {
                      setPaymentMethodId(v)
                      const pm = paymentMethods.find(p => p.id === v)
                      if (pm?.linked_account_id && !accountId) {
                        setAccountId(pm.linked_account_id)
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(p => p.is_active).map((pm) => (
                          <SelectItem key={pm.id} value={pm.id}>
                            {pm.icon} {pm.name}
                          </SelectItem>
                        ))}
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
                    <Label>Account *</Label>
                    <Select value={accountId} onValueChange={setAccountId} required>
                      <SelectTrigger><SelectValue placeholder={fundId ? `Select account (${filteredAccounts.length} linked to fund)` : "Select account"} /></SelectTrigger>
                      <SelectContent>
                        {filteredAccounts.length === 0 ? (
                          <SelectItem value="_none" disabled>No accounts linked to this fund</SelectItem>
                        ) : (
                          filteredAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency *</Label>
                      <Input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
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
                      <Select value={fromAccountId} onValueChange={(v) => {
                        setFromAccountId(v)
                        setSourceFundId(autoDetectFund(v))
                        const acc = accounts.find((a) => a.id === v)
                        if (acc) setTransferCurrency(acc.account_currency)
                      }}>
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
                      <Select value={toAccountId} onValueChange={(v) => {
                        setToAccountId(v)
                        setDestFundId(autoDetectFund(v))
                        const acc = accounts.find((a) => a.id === v)
                        if (acc) setToCurrency(acc.account_currency)
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                        <SelectContent>
                          {regularAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Fund selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Source Fund</Label>
                      <Select value={sourceFundId} onValueChange={setSourceFundId}>
                        <SelectTrigger><SelectValue placeholder="Auto-detected" /></SelectTrigger>
                        <SelectContent>
                          {funds.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.emoji} {f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Destination Fund</Label>
                      <Select value={destFundId} onValueChange={setDestFundId}>
                        <SelectTrigger><SelectValue placeholder="Auto-detected" /></SelectTrigger>
                        <SelectContent>
                          {funds.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.emoji} {f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.filter(p => p.is_active).map((pm) => (
                          <SelectItem key={pm.id} value={pm.id}>
                            {pm.icon} {pm.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Amount + Currency + FX */}
                  <div className={`grid gap-4 ${isCrossCurrency ? "grid-cols-4" : "grid-cols-2"}`}>
                    <div className="space-y-2">
                      <Label>Amount Sent</Label>
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
                    {isCrossCurrency && (
                      <>
                        <div className="space-y-2">
                          <Label>
                            FX Rate ({fromAccount?.account_currency}&rarr;{toAccount?.account_currency})
                            {fetchingRate && <span className="text-xs text-muted-foreground ml-1">fetching...</span>}
                          </Label>
                          <Input
                            type="number"
                            step="0.000001"
                            placeholder="1.0"
                            value={fxRate}
                            onChange={(e) => setFxRate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount Received ({toAccount?.account_currency})</Label>
                          <Input
                            disabled
                            value={((parseFloat(transferAmount) || 0) * (parseFloat(fxRate) || 1)).toFixed(2)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {/* Transfer fee (optional, shown for cross-currency) */}
                  {isCrossCurrency && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Transfer/FX Fee ({transferCurrency})</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00 (optional)"
                          value={transferFee}
                          onChange={(e) => setTransferFee(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
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
                <Label>{txType === "income" ? "Payer" : "Payee"}</Label>
                <Input value={payee} onChange={(e) => setPayee(e.target.value)} required placeholder={txType === "income" ? "e.g. Employer" : "e.g. Landlord"} />
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

            {/* Category, Subcategory, Fund, Payment Method - only for income/expense */}
            {txType !== "transfer" && (
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={categoryId} onValueChange={setCategoryId} required>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {filteredCategories.length === 0 ? (
                        <SelectItem value="_none" disabled>No {txType} categories - create in Settings</SelectItem>
                      ) : (
                        filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.emoji} {c.name}
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
                  <Label>Fund *</Label>
                  <Select value={fundId} onValueChange={setFundId} required>
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
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethodId} onValueChange={(v) => {
                    setPaymentMethodId(v)
                    const pm = paymentMethods.find(p => p.id === v)
                    if (pm?.linked_account_id && !accountId) {
                      setAccountId(pm.linked_account_id)
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.filter(p => p.is_active).map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>
                          {pm.icon} {pm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Payment Method for transfers */}
            {txType === "transfer" && (
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.filter(p => p.is_active).map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.icon} {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Income/Expense Form */}
            {txType !== "transfer" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account *</Label>
                  <Select value={accountId} onValueChange={setAccountId} required>
                    <SelectTrigger><SelectValue placeholder={fundId ? `Select account (${filteredAccounts.length} linked to fund)` : "Select account"} /></SelectTrigger>
                    <SelectContent>
                      {filteredAccounts.length === 0 ? (
                        <SelectItem value="_none" disabled>No accounts linked to this fund</SelectItem>
                      ) : (
                        filteredAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency *</Label>
                    <Input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
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

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? "Hide Filters" : "Show Filters"}
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {filteredTransactions.length} / {transactions.length}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearAllFilters}>
                Clear All Filters
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select
                  value={filterCategoryId || "__all__"}
                  onValueChange={(v) => setFilterCategoryId(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={filterType || "__all__"}
                  onValueChange={(v) => setFilterType(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All types</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={filterStatus || "__all__"}
                  onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All statuses</SelectItem>
                    {TRANSACTION_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payee</Label>
                <Input
                  type="text"
                  placeholder="Search payee..."
                  value={filterPayee}
                  onChange={(e) => setFilterPayee(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction list */}
      <Card>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {hasActiveFilters ? "No transactions match the current filters." : "No transactions yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => {
                  const isTransfer = tx.type === "transfer"
                  let amt = 0
                  let accountDisplay = "-"

                  if (isTransfer) {
                    const fromPosting = tx.postings?.find((p) => Number(p.amount) < 0)
                    const toPosting = tx.postings?.find((p) => Number(p.amount) > 0)
                    amt = toPosting ? Number(toPosting.amount) : 0
                    const fromName = fromPosting ? getAccountName(fromPosting.account_id) : "?"
                    const toName = toPosting ? getAccountName(toPosting.account_id) : "?"
                    accountDisplay = `${fromName} → ${toName}`
                  } else {
                    const realPosting = tx.postings?.find((p) => {
                      const acc = accounts.find((a) => a.id === p.account_id)
                      return acc && acc.name !== "External"
                    })
                    amt = realPosting ? Number(realPosting.amount) : 0
                    accountDisplay = realPosting ? getAccountName(realPosting.account_id) : "-"
                  }

                  const fundDisplay = isTransfer
                    ? [getFundName(tx.source_fund_id), getFundName(tx.dest_fund_id)].filter(Boolean).join(" → ") || "-"
                    : getFundName(tx.fund_id) || "-"

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">{new Date(tx.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{tx.payee}</TableCell>
                      <TableCell className="text-sm">
                        {isTransfer ? <Badge variant="outline">Transfer</Badge> : (getCategoryName(tx.category_id) || <span className="text-muted-foreground">-</span>)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {fundDisplay === "-" ? <span className="text-muted-foreground">-</span> : fundDisplay}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getPaymentMethodName(tx.payment_method_id) || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{tx.memo}</TableCell>
                      <TableCell><Badge variant="secondary">{tx.status}</Badge></TableCell>
                      <TableCell className="text-sm">{accountDisplay}</TableCell>
                      <TableCell className={`text-right font-mono ${isTransfer ? "text-blue-600 dark:text-blue-400" : amt > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {isTransfer ? "" : amt > 0 ? "+" : ""}{amt.toFixed(2)}
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
        </TabsContent>

        <TabsContent value="recurring" className="space-y-6">
          {/* New Recurring Form */}
          {showRecurringForm && (
            <Card>
              <CardHeader>
                <CardTitle>New Recurring Transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRecurring} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={recName} onChange={(e) => setRecName(e.target.value)} placeholder="e.g. Monthly Rent" required />
                    </div>
                    <div>
                      <Label>Frequency</Label>
                      <Select value={recFrequency} onValueChange={(v) => setRecFrequency(v as RecurringFrequency)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RECURRING_FREQUENCIES.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input type="date" value={recStartDate} onChange={(e) => setRecStartDate(e.target.value)} required />
                    </div>
                    <div>
                      <Label>End Date (optional)</Label>
                      <Input type="date" value={recEndDate} onChange={(e) => setRecEndDate(e.target.value)} />
                    </div>
                  </div>

                  <Separator />

                  <Tabs value={recTxType} onValueChange={(v) => setRecTxType(v as "income" | "expense" | "transfer")}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="income">Income</TabsTrigger>
                      <TabsTrigger value="expense">Expense</TabsTrigger>
                      <TabsTrigger value="transfer">Transfer</TabsTrigger>
                    </TabsList>

                    <TabsContent value="income" className="space-y-4 pt-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label>Category *</Label>
                          <Select value={recCategoryId} onValueChange={setRecCategoryId} required>
                            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              {recFilteredCategories.length === 0 ? (
                                <SelectItem value="_none" disabled>No income categories</SelectItem>
                              ) : (
                                recFilteredCategories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Subcategory</Label>
                          <Select value={recSubcategoryId} onValueChange={setRecSubcategoryId} disabled={!recCategoryId}>
                            <SelectTrigger><SelectValue placeholder={recCategoryId ? "Optional" : "Select category first"} /></SelectTrigger>
                            <SelectContent>
                              {recFilteredSubcategories.length === 0 ? (
                                <SelectItem value="_none" disabled>No subcategories</SelectItem>
                              ) : (
                                recFilteredSubcategories.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Fund *</Label>
                          <Select value={recFundId} onValueChange={setRecFundId} required>
                            <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                            <SelectContent>
                              {funds.filter((f) => f.is_active).map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.emoji} {f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Payment Method</Label>
                          <Select value={recPaymentMethodId} onValueChange={setRecPaymentMethodId}>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {paymentMethods.filter((pm) => pm.is_active).map((pm) => (
                                <SelectItem key={pm.id} value={pm.id}>{pm.icon} {pm.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Account *</Label>
                          <Select value={recAccountId} onValueChange={setRecAccountId} required>
                            <SelectTrigger><SelectValue placeholder={recFundId ? `Select account (${recFilteredAccounts.length} linked)` : "Select account"} /></SelectTrigger>
                            <SelectContent>
                              {recFilteredAccounts.length === 0 ? (
                                <SelectItem value="_none" disabled>No accounts linked to this fund</SelectItem>
                              ) : (
                                recFilteredAccounts.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Amount *</Label>
                          <Input type="number" step="0.01" min="0.01" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="0.00" required />
                        </div>
                        <div>
                          <Label>Payer</Label>
                          <Input value={recPayee} onChange={(e) => setRecPayee(e.target.value)} placeholder="e.g. Employer" />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="expense" className="space-y-4 pt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Category *</Label>
                          <Select value={recCategoryId} onValueChange={setRecCategoryId} required>
                            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              {recFilteredCategories.length === 0 ? (
                                <SelectItem value="_none" disabled>No expense categories</SelectItem>
                              ) : (
                                recFilteredCategories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Subcategory</Label>
                          <Select value={recSubcategoryId} onValueChange={setRecSubcategoryId} disabled={!recCategoryId}>
                            <SelectTrigger><SelectValue placeholder={recCategoryId ? "Optional" : "Select category first"} /></SelectTrigger>
                            <SelectContent>
                              {recFilteredSubcategories.length === 0 ? (
                                <SelectItem value="_none" disabled>No subcategories</SelectItem>
                              ) : (
                                recFilteredSubcategories.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Fund *</Label>
                          <Select value={recFundId} onValueChange={setRecFundId} required>
                            <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                            <SelectContent>
                              {funds.filter((f) => f.is_active).map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.emoji} {f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Account *</Label>
                          <Select value={recAccountId} onValueChange={setRecAccountId} required>
                            <SelectTrigger><SelectValue placeholder={recFundId ? `Select account (${recFilteredAccounts.length} linked)` : "Select account"} /></SelectTrigger>
                            <SelectContent>
                              {recFilteredAccounts.length === 0 ? (
                                <SelectItem value="_none" disabled>No accounts linked to this fund</SelectItem>
                              ) : (
                                recFilteredAccounts.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Amount *</Label>
                          <Input type="number" step="0.01" min="0.01" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="0.00" required />
                        </div>
                        <div>
                          <Label>Payee</Label>
                          <Input value={recPayee} onChange={(e) => setRecPayee(e.target.value)} placeholder="e.g. Landlord" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Payment Method</Label>
                          <Select value={recPaymentMethodId} onValueChange={setRecPaymentMethodId}>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {paymentMethods.filter((pm) => pm.is_active).map((pm) => (
                                <SelectItem key={pm.id} value={pm.id}>{pm.icon} {pm.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Memo</Label>
                          <Input value={recMemo} onChange={(e) => setRecMemo(e.target.value)} placeholder="Optional" />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="transfer" className="space-y-4 pt-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>From Account</Label>
                          <Select value={recFromAccountId} onValueChange={setRecFromAccountId}>
                            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {regularAccounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>To Account</Label>
                          <Select value={recToAccountId} onValueChange={setRecToAccountId}>
                            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {regularAccounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.name} ({a.account_currency})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Amount</Label>
                          <Input type="number" step="0.01" min="0" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="0.00" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Source Fund</Label>
                          <Select value={recSourceFundId} onValueChange={setRecSourceFundId}>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {funds.filter((f) => f.is_active).map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.emoji} {f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Destination Fund</Label>
                          <Select value={recDestFundId} onValueChange={setRecDestFundId}>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {funds.filter((f) => f.is_active).map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.emoji} {f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Payment Method</Label>
                          <Select value={recPaymentMethodId} onValueChange={setRecPaymentMethodId}>
                            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                            <SelectContent>
                              {paymentMethods.filter((pm) => pm.is_active).map((pm) => (
                                <SelectItem key={pm.id} value={pm.id}>{pm.icon} {pm.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" className="w-full" disabled={creatingRecurring}>
                    {creatingRecurring ? "Creating..." : "Create Recurring Transaction"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Pending Instances */}
          {pendingInstances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Action Required ({pendingInstances.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInstances.map((inst, idx) => (
                      <TableRow key={`${inst.recurring_id}-${inst.occurrence_date}-${idx}`}>
                        <TableCell className="text-sm">{new Date(inst.occurrence_date + "T00:00:00").toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{inst.name}</TableCell>
                        <TableCell>
                          <Badge variant={inst.transaction_type === "income" ? "default" : inst.transaction_type === "expense" ? "destructive" : "outline"}>
                            {inst.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{inst.payee || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{inst.amount.toFixed(2)} {inst.currency}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" onClick={() => handleConfirmRecurring(inst)}>Confirm</Button>
                            <Button size="sm" variant="outline" onClick={() => handleSkipRecurring(inst)}>Skip</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Recurring Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recurring Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recurringTemplates.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No recurring transactions yet. Create one to automate repeating transactions.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Next Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringTemplates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{t.transaction_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {RECURRING_FREQUENCIES.find((f) => f.value === t.frequency)?.label || t.frequency}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.payee || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{t.amount.toFixed(2)} {t.currency}</TableCell>
                        <TableCell className="text-sm">
                          {t.is_active ? new Date(t.next_occurrence + "T00:00:00").toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.is_active ? "default" : "secondary"}>
                            {t.is_active ? "Active" : "Paused"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => toggleRecurringActive(t)}>
                              {t.is_active ? "Pause" : "Resume"}
                            </Button>
                            <Dialog
                              open={deletingRecId === t.id}
                              onOpenChange={(open) => !open && setDeletingRecId(null)}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingRecId(t.id)}>
                                  Delete
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Recurring Transaction?</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                  Delete &quot;{t.name}&quot;? This cannot be undone.
                                </p>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setDeletingRecId(null)}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => handleDeleteRecurring(t.id)}>Delete</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Bank Statement Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        if (!open) resetImportDialog()
        setImportDialogOpen(open)
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Import Bank Statement
            </DialogTitle>
          </DialogHeader>

          {/* Visual Step Indicator */}
          <div className="flex items-center justify-between px-4 py-4">
            {[
              { step: 1, name: "Account" },
              { step: 2, name: "Upload & Map" },
              { step: 3, name: "Review & Import" }
            ].map(({ step, name }, idx) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    importStep === step
                      ? "border-primary bg-primary text-primary-foreground"
                      : importStep > step
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground text-muted-foreground"
                  )}>
                    {importStep > step ? <Check className="h-5 w-5" /> : step}
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    importStep >= step ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {name}
                  </span>
                </div>
                {idx < 2 && <div className={cn(
                  "h-0.5 flex-1 mx-4 transition-colors",
                  importStep > step ? "bg-primary" : "bg-border"
                )} />}
              </div>
            ))}
          </div>

          {/* Step 1: Select Account */}
          {importStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-account">Which account is this statement for?</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger id="import-account">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.name !== "External").map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.account_currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={() => setImportStep(2)} disabled={!selectedAccountId}>
                  Next
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Upload & Map Columns */}
          {importStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-file">Upload File</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileUpload}
                />
              </div>

              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>{selectedFile.name}</span>
                  <Badge>{fileType.toUpperCase()}</Badge>
                  {sheetName && <span className="text-xs">Sheet: {sheetName}</span>}
                </div>
              )}

              {loadingHeaders && (
                <div className="text-sm text-muted-foreground">Reading file...</div>
              )}

              {fileHeaders.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Preview (first 5 rows)</Label>
                    <div className="border rounded-md overflow-x-auto max-h-40 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {fileHeaders.map((header, idx) => (
                              <TableHead key={idx}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filePreview.map((row, idx) => (
                            <TableRow key={idx}>
                              {fileHeaders.map((header, cellIdx) => (
                                <TableCell key={cellIdx} className="text-xs">
                                  {row[header]}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Map Columns</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="map-date" className="text-sm">Date Column *</Label>
                        <Select
                          value={columnMapping.date || ""}
                          onValueChange={(v) => setColumnMapping({ ...columnMapping, date: v })}
                        >
                          <SelectTrigger id="map-date">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {fileHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="map-payee" className="text-sm">Description/Payee Column *</Label>
                        <Select
                          value={columnMapping.payee || ""}
                          onValueChange={(v) => setColumnMapping({ ...columnMapping, payee: v })}
                        >
                          <SelectTrigger id="map-payee">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {fileHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="map-debit" className="text-sm">Debit Column (optional)</Label>
                        <Select
                          value={columnMapping.debit || "_none"}
                          onValueChange={(v) => setColumnMapping({ ...columnMapping, debit: v === "_none" ? undefined : v })}
                        >
                          <SelectTrigger id="map-debit">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {fileHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="map-credit" className="text-sm">Credit Column (optional)</Label>
                        <Select
                          value={columnMapping.credit || "_none"}
                          onValueChange={(v) => setColumnMapping({ ...columnMapping, credit: v === "_none" ? undefined : v })}
                        >
                          <SelectTrigger id="map-credit">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {fileHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="map-amount" className="text-sm">Amount Column (optional)</Label>
                        <Select
                          value={columnMapping.amount || "_none"}
                          onValueChange={(v) => setColumnMapping({ ...columnMapping, amount: v === "_none" ? undefined : v })}
                        >
                          <SelectTrigger id="map-amount">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {fileHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="map-memo" className="text-sm">Memo/Reference (optional)</Label>
                        <Select
                          value={columnMapping.memo || "_none"}
                          onValueChange={(v) => setColumnMapping({ ...columnMapping, memo: v === "_none" ? undefined : v })}
                        >
                          <SelectTrigger id="map-memo">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {fileHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setImportStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={handleParseFile}
                  disabled={!columnMapping.date || !columnMapping.payee || (!columnMapping.debit && !columnMapping.credit && !columnMapping.amount) || parsingFile}
                >
                  {parsingFile ? "Parsing..." : "Parse Transactions"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {importStep === 3 && (
            <div className="space-y-4">
              {/* Progress Summary Header */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">
                    {parsedTransactions.length} transaction{parsedTransactions.length !== 1 ? 's' : ''} found
                  </div>
                  {createdTx.size > 0 && (
                    <Badge variant="default">{createdTx.size} imported</Badge>
                  )}
                  {parsedTransactions.filter(tx => tx.has_errors).length > 0 && (
                    <Badge variant="destructive">
                      {parsedTransactions.filter(tx => tx.has_errors).length} error{parsedTransactions.filter(tx => tx.has_errors).length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={confirmAllValidTransactions}
                  disabled={parsedTransactions.filter(tx => !tx.has_errors && !createdTx.has(tx.row_number)).length === 0}
                >
                  Confirm Valid ({parsedTransactions.filter(tx => !tx.has_errors && !createdTx.has(tx.row_number)).length})
                </Button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {parsedTransactions.map(tx => {
                  const currentTxType = editedTransactions.get(tx.row_number)?.transaction_type ?? tx.transaction_type
                  const currentCategoryId = editedTransactions.get(tx.row_number)?.category_id ?? tx.category_id
                  const selectedCategory = categories.find(c => c.id === currentCategoryId)
                  const availableSubcategories = subcategories.filter(sc => sc.category_id === currentCategoryId)

                  return (
                    <Card key={tx.row_number} className={cn(
                      "transition-all duration-200",
                      createdTx.has(tx.row_number) && "opacity-50 bg-muted",
                      tx.has_errors && "border-destructive"
                    )}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={currentTxType === "income" ? "default" : currentTxType === "expense" ? "secondary" : "outline"}>
                              Row {tx.row_number}
                            </Badge>
                            {tx.has_errors && <Badge variant="destructive">Has Errors</Badge>}
                            {createdTx.has(tx.row_number) && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">✓ Imported</Badge>}
                          </div>
                          <div className="text-sm font-semibold">
                            {Math.abs(tx.amount).toFixed(2)} {tx.currency}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {/* Row 1: Basic Info */}
                        <div className="grid grid-cols-5 gap-3 mb-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Date</Label>
                            <div className="text-sm font-medium">
                              {(() => { if (!tx.timestamp) return tx.date_str; try { const date = new Date(tx.timestamp); return !isNaN(date.getTime()) ? date.toLocaleDateString() : tx.date_str; } catch { return tx.date_str; } })()}
                            </div>
                          </div>

                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs text-muted-foreground">Payee / Description</Label>
                            <Input
                              value={editedTransactions.get(tx.row_number)?.payee ?? tx.payee}
                              onChange={(e) => {
                                const edited = new Map(editedTransactions)
                                edited.set(tx.row_number, { ...edited.get(tx.row_number), payee: e.target.value })
                                setEditedTransactions(edited)
                              }}
                              className="h-8 text-sm"
                              disabled={createdTx.has(tx.row_number)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Transaction Type</Label>
                            <Select
                              value={currentTxType}
                              onValueChange={(v) => {
                                const edited = new Map(editedTransactions)
                                edited.set(tx.row_number, {
                                  ...edited.get(tx.row_number),
                                  transaction_type: v as 'income' | 'expense' | 'transfer',
                                  // Clear category/subcategory when switching types
                                  category_id: undefined,
                                  subcategory_id: undefined
                                })
                                setEditedTransactions(edited)
                              }}
                              disabled={createdTx.has(tx.row_number)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Income</SelectItem>
                                <SelectItem value="expense">Expense</SelectItem>
                                <SelectItem value="transfer">Transfer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Amount</Label>
                            <div className="text-sm font-medium flex items-center h-8">
                              {Math.abs(tx.amount).toFixed(2)} {tx.currency}
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Categorization */}
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          {currentTxType !== 'transfer' ? (
                            <>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Category *</Label>
                                <Select
                                  value={currentCategoryId ?? "_none"}
                                  onValueChange={(v) => {
                                    const edited = new Map(editedTransactions)
                                    edited.set(tx.row_number, {
                                      ...edited.get(tx.row_number),
                                      category_id: v === "_none" ? undefined : v,
                                      subcategory_id: undefined // Clear subcategory when category changes
                                    })
                                    setEditedTransactions(edited)
                                  }}
                                  disabled={createdTx.has(tx.row_number)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_none">None</SelectItem>
                                    {categories
                                      .filter(c => c.type === currentTxType)
                                      .map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                          {c.emoji} {c.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Subcategory</Label>
                                <Select
                                  value={editedTransactions.get(tx.row_number)?.subcategory_id ?? tx.subcategory_id ?? "_none"}
                                  onValueChange={(v) => {
                                    const edited = new Map(editedTransactions)
                                    edited.set(tx.row_number, { ...edited.get(tx.row_number), subcategory_id: v === "_none" ? undefined : v })
                                    setEditedTransactions(edited)
                                  }}
                                  disabled={!currentCategoryId || createdTx.has(tx.row_number)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="None" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="_none">None</SelectItem>
                                    {availableSubcategories.map(sc => (
                                      <SelectItem key={sc.id} value={sc.id}>
                                        {sc.emoji} {sc.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          ) : (
                            <div className="space-y-1 col-span-2">
                              <Label className="text-xs text-muted-foreground">Transfer To/From Account *</Label>
                              <Select
                                value={editedTransactions.get(tx.row_number)?.transfer_account_id ?? tx.transfer_account_id ?? "_none"}
                                onValueChange={(v) => {
                                  const edited = new Map(editedTransactions)
                                  edited.set(tx.row_number, { ...edited.get(tx.row_number), transfer_account_id: v === "_none" ? undefined : v })
                                  setEditedTransactions(edited)
                                }}
                                disabled={createdTx.has(tx.row_number)}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Select account..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_none">None</SelectItem>
                                  {accounts.filter(a => a.id !== tx.account_id && a.name !== "External").map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                      {acc.name} ({acc.account_currency})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Fund</Label>
                            <Select
                              value={editedTransactions.get(tx.row_number)?.fund_id ?? tx.fund_id ?? "_none"}
                              onValueChange={(v) => {
                                const edited = new Map(editedTransactions)
                                edited.set(tx.row_number, { ...edited.get(tx.row_number), fund_id: v === "_none" ? undefined : v })
                                setEditedTransactions(edited)
                              }}
                              disabled={createdTx.has(tx.row_number)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">None</SelectItem>
                                {funds.map(f => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.emoji} {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Payment Method</Label>
                            <Select
                              value={editedTransactions.get(tx.row_number)?.payment_method_id ?? tx.payment_method_id ?? "_none"}
                              onValueChange={(v) => {
                                const edited = new Map(editedTransactions)
                                edited.set(tx.row_number, { ...edited.get(tx.row_number), payment_method_id: v === "_none" ? undefined : v })
                                setEditedTransactions(edited)
                              }}
                              disabled={createdTx.has(tx.row_number)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">None</SelectItem>
                                {paymentMethods.filter(pm => pm.is_active).map(pm => (
                                  <SelectItem key={pm.id} value={pm.id}>
                                    {pm.icon} {pm.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Row 3: Memo */}
                        <div className="grid grid-cols-1 gap-3 mb-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Memo</Label>
                            <Input
                              value={editedTransactions.get(tx.row_number)?.memo ?? tx.memo ?? ""}
                              onChange={(e) => {
                                const edited = new Map(editedTransactions)
                                edited.set(tx.row_number, { ...edited.get(tx.row_number), memo: e.target.value })
                                setEditedTransactions(edited)
                              }}
                              className="h-8 text-sm"
                              placeholder="Optional"
                              disabled={createdTx.has(tx.row_number)}
                            />
                          </div>
                        </div>

                        {/* Row 3: Warnings & Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            {tx.warnings.length > 0 && (
                              <div className="text-xs text-destructive space-y-1">
                                {tx.warnings.map((warning, idx) => (
                                  <div key={idx}>⚠️ {warning}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => confirmImportTransaction(tx.row_number)}
                            disabled={tx.has_errors || creatingImportTx.has(tx.row_number) || createdTx.has(tx.row_number)}
                          >
                            {createdTx.has(tx.row_number) ? "✓ Created" : creatingImportTx.has(tx.row_number) ? "Creating..." : "Confirm"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setImportStep(2)}>
                  Back
                </Button>
                <Button variant="outline" onClick={resetImportDialog}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
