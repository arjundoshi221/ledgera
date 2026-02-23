"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { getCountryName } from "@/lib/countries"
import { useToast } from "@/components/ui/use-toast"
import {
  getWorkspace,
  updateWorkspace,
  getMe,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getFunds,
  createFund,
  updateFund,
  deleteFund,
  getCards,
  createCard,
  updateCard,
  deleteCard,
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from "@/lib/api"
import { clearAuth } from "@/lib/auth"
import { useRouter, useSearchParams } from "next/navigation"
import { CURRENCIES, ACCOUNT_TYPES, CARD_TYPES, CARD_NETWORKS } from "@/lib/constants"
import type { Workspace, UserResponse, Account, AccountType, Category, Subcategory, Fund, Card as CardType, PaymentMethod } from "@/lib/types"

export default function SettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "workspace")
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [user, setUser] = useState<UserResponse | null>(null)
  const [wsName, setWsName] = useState("")
  const [wsCurrency, setWsCurrency] = useState("SGD")
  const [saving, setSaving] = useState(false)

  // Accounts
  const [accounts, setAccounts] = useState<Account[]>([])
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [accName, setAccName] = useState("")
  const [accType, setAccType] = useState("asset")
  const [accCurrency, setAccCurrency] = useState("SGD")
  const [accInstitution, setAccInstitution] = useState("")
  const [accStartingBalance, setAccStartingBalance] = useState("")

  // Categories
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [catName, setCatName] = useState("")
  const [catEmoji, setCatEmoji] = useState("")
  const [catType, setCatType] = useState<"expense" | "income">("expense")
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)

  // Subcategories
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [subName, setSubName] = useState("")
  const [subCategoryId, setSubCategoryId] = useState("")
  const [deletingSubcategoryId, setDeletingSubcategoryId] = useState<string | null>(null)

  // Funds
  const [funds, setFunds] = useState<Fund[]>([])
  const [fundDialogOpen, setFundDialogOpen] = useState(false)
  const [editingFund, setEditingFund] = useState<Fund | null>(null)
  const [fundName, setFundName] = useState("")
  const [fundEmoji, setFundEmoji] = useState("")
  const [fundAllocation, setFundAllocation] = useState("0")
  const [fundAccountAllocations, setFundAccountAllocations] = useState<{ account_id: string; allocation_percentage: number }[]>([])
  const [deletingFundId, setDeletingFundId] = useState<string | null>(null)

  // Cards
  const [cards, setCards] = useState<CardType[]>([])
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CardType | null>(null)
  const [cardName, setCardName] = useState("")
  const [cardType, setCardType] = useState<"credit" | "debit">("debit")
  const [cardNetwork, setCardNetwork] = useState("")
  const [cardCustomNetwork, setCardCustomNetwork] = useState("")
  const [cardLastFour, setCardLastFour] = useState("")
  const [cardAccountId, setCardAccountId] = useState("")
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null)

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [pmDialogOpen, setPmDialogOpen] = useState(false)
  const [editingPm, setEditingPm] = useState<PaymentMethod | null>(null)
  const [pmName, setPmName] = useState("")
  const [pmIcon, setPmIcon] = useState("")
  const [pmMethodType, setPmMethodType] = useState<"digital_wallet" | "custom">("custom")
  const [pmLinkedAccountId, setPmLinkedAccountId] = useState("")
  const [deletingPmId, setDeletingPmId] = useState<string | null>(null)

  async function loadData(isInitial = false) {
    try {
      if (isInitial) setLoading(true)
      const [ws, me, accts, cats, subs, fnds, crds, pms] = await Promise.all([
        getWorkspace(),
        getMe(),
        getAccounts(),
        getCategories(),
        getSubcategories(),
        getFunds(),
        getCards(),
        getPaymentMethods(),
      ])
      setWorkspace(ws)
      setUser(me)
      setWsName(ws.name)
      setWsCurrency(ws.base_currency)
      setAccounts(accts)
      setCategories(cats)
      setSubcategories(subs)
      setFunds(fnds)
      setCards(crds)
      setPaymentMethods(pms)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load settings", description: err.message })
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  useEffect(() => {
    loadData(true)
  }, [])

  // ── Workspace ──

  async function handleSaveWorkspace(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateWorkspace({ name: wsName, base_currency: wsCurrency })
      setWorkspace(updated)
      toast({ title: "Settings saved" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    } finally {
      setSaving(false)
    }
  }

  // ── Accounts ──

  async function handleDeleteAccount(accountId: string) {
    try {
      await deleteAccount(accountId)
      toast({ title: "Account deleted" })
      setDeleteAccountId(null)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete account", description: err.message })
    }
  }

  function openCreateAccount() {
    setEditingAccount(null)
    setAccName("")
    setAccType("asset")
    setAccCurrency("SGD")
    setAccInstitution("")
    setAccStartingBalance("")
    setAccountDialogOpen(true)
  }

  function openEditAccount(acc: Account) {
    setEditingAccount(acc)
    setAccName(acc.name)
    setAccType(acc.type)
    setAccCurrency(acc.account_currency)
    setAccInstitution(acc.institution || "")
    setAccStartingBalance(acc.starting_balance ? acc.starting_balance.toString() : "0")
    setAccountDialogOpen(true)
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        name: accName,
        type: accType as AccountType,
        account_currency: accCurrency,
        institution: accInstitution || undefined,
        starting_balance: accStartingBalance ? parseFloat(accStartingBalance) : 0,
      }
      if (editingAccount) {
        await updateAccount(editingAccount.id, data)
        toast({ title: "Account updated" })
      } else {
        await createAccount(data)
        toast({ title: "Account created" })
      }
      setAccountDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  // ── Categories ──

  function openCreateCategory(type: "expense" | "income") {
    setEditingCategory(null)
    setCatName("")
    setCatEmoji("")
    setCatType(type)
    setCategoryDialogOpen(true)
  }

  function openEditCategory(cat: Category) {
    setEditingCategory(cat)
    setCatName(cat.name)
    setCatEmoji(cat.emoji || "")
    setCatType(cat.type)
    setCategoryDialogOpen(true)
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = { name: catName, emoji: catEmoji, type: catType }
      if (editingCategory) {
        await updateCategory(editingCategory.id, data)
        toast({ title: "Category updated" })
      } else {
        await createCategory(data)
        toast({ title: "Category created" })
      }
      setCategoryDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      await deleteCategory(id)
      toast({ title: "Category deleted" })
      setDeletingCategoryId(null)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  // ── Subcategories ──

  function openCreateSubcategory(categoryId: string) {
    setEditingSubcategory(null)
    setSubName("")
    setSubCategoryId(categoryId)
    setSubcategoryDialogOpen(true)
  }

  function openEditSubcategory(sub: Subcategory) {
    setEditingSubcategory(sub)
    setSubName(sub.name)
    setSubCategoryId(sub.category_id)
    setSubcategoryDialogOpen(true)
  }

  async function handleSaveSubcategory(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = { category_id: subCategoryId, name: subName }
      if (editingSubcategory) {
        await updateSubcategory(editingSubcategory.id, data)
        toast({ title: "Subcategory updated" })
      } else {
        await createSubcategory(data)
        toast({ title: "Subcategory created" })
      }
      setSubcategoryDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  async function handleDeleteSubcategory(id: string) {
    try {
      await deleteSubcategory(id)
      toast({ title: "Subcategory deleted" })
      setDeletingSubcategoryId(null)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  // ── Funds ──

  function openCreateFund() {
    setEditingFund(null)
    setFundName("")
    setFundEmoji("")
    setFundAllocation("0")
    setFundAccountAllocations([])
    setFundDialogOpen(true)
  }

  function openEditFund(fund: Fund) {
    setEditingFund(fund)
    setFundName(fund.name)
    setFundEmoji(fund.emoji || "")
    setFundAllocation(String(fund.allocation_percentage))
    setFundAccountAllocations(
      (fund.linked_accounts || []).map(a => ({
        account_id: a.id,
        allocation_percentage: Number(a.allocation_percentage) || 100,
      }))
    )
    setFundDialogOpen(true)
  }

  async function handleSaveFund(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        name: fundName,
        emoji: fundEmoji,
        allocation_percentage: parseFloat(fundAllocation) || 0,
        account_allocations: fundAccountAllocations,
      }
      if (editingFund) {
        await updateFund(editingFund.id, data)
        toast({ title: "Fund updated" })
      } else {
        await createFund(data)
        toast({ title: "Fund created" })
      }
      setFundDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  async function handleDeleteFund(id: string) {
    try {
      await deleteFund(id)
      toast({ title: "Fund deleted" })
      setDeletingFundId(null)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  // ── Cards ──

  function openCreateCard() {
    setEditingCard(null)
    setCardName("")
    setCardType("debit")
    setCardNetwork("")
    setCardCustomNetwork("")
    setCardLastFour("")
    setCardAccountId("")
    setCardDialogOpen(true)
  }

  function openEditCard(card: CardType) {
    setEditingCard(card)
    setCardName(card.card_name)
    setCardType(card.card_type)
    const knownNetwork = CARD_NETWORKS.some(n => n.value === card.card_network)
    if (card.card_network && !knownNetwork) {
      setCardNetwork("other")
      setCardCustomNetwork(card.card_network)
    } else {
      setCardNetwork(card.card_network || "")
      setCardCustomNetwork("")
    }
    setCardLastFour(card.last_four || "")
    setCardAccountId(card.account_id)
    setCardDialogOpen(true)
  }

  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault()
    try {
      const resolvedNetwork = cardNetwork === "other" ? cardCustomNetwork.trim() : cardNetwork
      const data = {
        account_id: cardAccountId,
        card_name: cardName,
        card_type: cardType,
        card_network: resolvedNetwork || undefined,
        last_four: cardLastFour || undefined,
      }
      if (editingCard) {
        await updateCard(editingCard.id, data)
        toast({ title: "Card updated" })
      } else {
        await createCard(data)
        toast({ title: "Card created" })
      }
      setCardDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  async function handleDeleteCard(id: string) {
    try {
      await deleteCard(id)
      toast({ title: "Card deleted" })
      setDeletingCardId(null)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  // ── Payment Methods ──

  function openCreatePm() {
    setEditingPm(null)
    setPmName("")
    setPmIcon("")
    setPmMethodType("custom")
    setPmLinkedAccountId("")
    setPmDialogOpen(true)
  }

  function openEditPm(pm: PaymentMethod) {
    setEditingPm(pm)
    setPmName(pm.name)
    setPmIcon(pm.icon || "")
    setPmMethodType(pm.method_type as "digital_wallet" | "custom")
    setPmLinkedAccountId(pm.linked_account_id || "")
    setPmDialogOpen(true)
  }

  async function handleSavePm(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        name: pmName,
        method_type: pmMethodType,
        icon: pmIcon || undefined,
        linked_account_id: pmLinkedAccountId || undefined,
      }
      if (editingPm) {
        await updatePaymentMethod(editingPm.id, data)
        toast({ title: "Payment method updated" })
      } else {
        await createPaymentMethod(data)
        toast({ title: "Payment method created" })
      }
      setPmDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message })
    }
  }

  async function handleDeletePm(id: string) {
    try {
      await deletePaymentMethod(id)
      toast({ title: "Payment method deleted" })
      setDeletingPmId(null)
      loadData()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  function handleLogout() {
    clearAuth()
    toast({ title: "Logged out successfully" })
    router.push("/")
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading settings...</div>
  }

  // ── Render helper for a category section ──
  function renderCategorySection(type: "expense" | "income") {
    const isExpense = type === "expense"
    const filtered = categories.filter((c) => c.type === type)

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{isExpense ? "💸 Expense" : "💰 Income"} Categories</CardTitle>
            <CardDescription>Manage {type} categories and subcategories</CardDescription>
          </div>
          <Button onClick={() => openCreateCategory(type)}>+ Category</Button>
        </CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((cat) => {
                const subs = subcategories.filter((s) => s.category_id === cat.id)
                return (
                  <div key={cat.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">
                        {cat.emoji} {cat.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge>{subs.length} items</Badge>
                        <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                          Edit
                        </Button>
                        {cat.is_system ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">System</Badge>
                        ) : (
                          <Dialog
                            open={deletingCategoryId === cat.id}
                            onOpenChange={(open) => !open && setDeletingCategoryId(null)}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingCategoryId(cat.id)}>
                                Delete
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Category?</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                Delete &quot;{cat.name}&quot; and all its subcategories? This cannot be undone.
                              </p>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeletingCategoryId(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={() => handleDeleteCategory(cat.id)}>Delete</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {subs.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between ml-4 py-1 text-sm text-muted-foreground">
                          <span>• {sub.name}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openEditSubcategory(sub)}>
                              Edit
                            </Button>
                            <Dialog
                              open={deletingSubcategoryId === sub.id}
                              onOpenChange={(open) => !open && setDeletingSubcategoryId(null)}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setDeletingSubcategoryId(sub.id)}>
                                  Delete
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Subcategory?</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">Delete &quot;{sub.name}&quot;?</p>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setDeletingSubcategoryId(null)}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => handleDeleteSubcategory(sub.id)}>Delete</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => openCreateSubcategory(cat.id)}
                    >
                      + Add Subcategory
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No {type} categories yet</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace, accounts, categories, and funds</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="funds">Funds</TabsTrigger>
        </TabsList>

        {/* Workspace Tab */}
        <TabsContent value="workspace">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>Configure your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveWorkspace} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Workspace Name</Label>
                    <Input value={wsName} onChange={(e) => setWsName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Base Currency</Label>
                    <Select value={wsCurrency} onValueChange={setWsCurrency}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <p className="text-sm font-medium">{user.email}</p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <p className="text-sm font-medium">
                        {user.first_name || user.last_name
                          ? `${user.first_name} ${user.last_name}`.trim()
                          : "Not set"}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                      <p className="text-sm font-medium">{user.date_of_birth || "Not set"}</p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <p className="text-sm font-medium">
                        {user.phone_country_code && user.phone_number
                          ? `${user.phone_country_code} ${user.phone_number}`
                          : "Not set"}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      <p className="text-sm font-medium">
                        {user.address_line1
                          ? [
                              user.address_line1,
                              user.address_line2,
                              [user.address_city, user.address_state].filter(Boolean).join(", "),
                              user.address_postal_code,
                              user.address_country ? getCountryName(user.address_country) : null,
                            ].filter(Boolean).join(", ")
                          : "Not set"}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Nationalities</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.nationalities && user.nationalities.length > 0
                          ? user.nationalities.map((code) => (
                              <Badge key={code} variant="secondary" className="text-xs">
                                {getCountryName(code)}
                              </Badge>
                            ))
                          : <p className="text-sm text-muted-foreground">Not set</p>
                        }
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Tax Residencies</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.tax_residencies && user.tax_residencies.length > 0
                          ? user.tax_residencies.map((code) => (
                              <Badge key={code} variant="secondary" className="text-xs">
                                {getCountryName(code)}
                              </Badge>
                            ))
                          : <p className="text-sm text-muted-foreground">Not set</p>
                        }
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Countries of Interest</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.countries_of_interest && user.countries_of_interest.length > 0
                          ? user.countries_of_interest.map((code) => (
                              <Badge key={code} variant="secondary" className="text-xs">
                                {getCountryName(code)}
                              </Badge>
                            ))
                          : <p className="text-sm text-muted-foreground">None</p>
                        }
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Tax ID Number</Label>
                      <p className="text-sm font-medium">
                        {user.tax_id_number
                          ? `${"*".repeat(Math.max(0, user.tax_id_number.length - 4))}${user.tax_id_number.slice(-4)}`
                          : "Not set"}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Terms of Service</Label>
                      <p className="text-sm font-medium">
                        {user.tos_accepted_at
                          ? `Accepted on ${new Date(user.tos_accepted_at).toLocaleDateString()} (v${user.tos_version || "1.0"})`
                          : "Not accepted"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Privacy Policy</Label>
                      <p className="text-sm font-medium">
                        {user.privacy_accepted_at
                          ? `Accepted on ${new Date(user.privacy_accepted_at).toLocaleDateString()}`
                          : "Not accepted"}
                      </p>
                    </div>
                    <Separator />
                    <Button variant="destructive" onClick={handleLogout} className="w-full">
                      Logout
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Could not load user profile</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bank & Investment Accounts</CardTitle>
                <CardDescription>Manage your accounts</CardDescription>
              </div>
              <Button onClick={openCreateAccount}>+ New Account</Button>
            </CardHeader>
            <CardContent>
              {accounts.filter((a) => a.name !== "External").length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.filter((a) => a.name !== "External").map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{acc.type}</Badge>
                        </TableCell>
                        <TableCell>{acc.account_currency}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {acc.institution || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditAccount(acc)}>
                            Edit
                          </Button>
                          <Dialog
                            open={deleteAccountId === acc.id}
                            onOpenChange={(open) => !open && setDeleteAccountId(null)}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteAccountId(acc.id)}>
                                Delete
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Account?</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                Are you sure? This will delete &quot;{acc.name}&quot; and all associated transactions.
                              </p>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteAccountId(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={() => handleDeleteAccount(acc.id)}>Delete</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">No accounts yet. Click &quot;+ New Account&quot; to create one.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cards Tab */}
        <TabsContent value="cards">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Credit & Debit Cards</CardTitle>
                <CardDescription>Manage cards linked to your accounts</CardDescription>
              </div>
              <Button onClick={openCreateCard}>+ Add Card</Button>
            </CardHeader>
            <CardContent>
              {cards.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Last 4</TableHead>
                      <TableHead>Linked Account</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((card) => {
                      const linkedAcc = accounts.find((a) => a.id === card.account_id)
                      return (
                        <TableRow key={card.id}>
                          <TableCell className="font-medium">{card.card_name}</TableCell>
                          <TableCell>
                            <Badge variant={card.card_type === "credit" ? "default" : "secondary"}>
                              {card.card_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {card.card_network || "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {card.last_four ? `****${card.last_four}` : "\u2014"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {linkedAcc ? linkedAcc.name : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditCard(card)}>
                                Edit
                              </Button>
                              <Dialog
                                open={deletingCardId === card.id}
                                onOpenChange={(open) => !open && setDeletingCardId(null)}
                              >
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingCardId(card.id)}>
                                    Delete
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Card?</DialogTitle>
                                  </DialogHeader>
                                  <p className="text-sm text-muted-foreground">
                                    Delete &quot;{card.card_name}&quot;? Its associated payment method will also be removed.
                                  </p>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeletingCardId(null)}>Cancel</Button>
                                    <Button variant="destructive" onClick={() => handleDeleteCard(card.id)}>Delete</Button>
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
              ) : (
                <p className="text-muted-foreground text-center py-8">No cards yet. Add one to get started!</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment-methods">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Manage how you pay for transactions</CardDescription>
              </div>
              <Button onClick={openCreatePm}>+ Add Method</Button>
            </CardHeader>
            <CardContent>
              {paymentMethods.filter(pm => pm.is_active).length > 0 ? (
                <div className="space-y-3">
                  {paymentMethods.filter(pm => pm.is_active).map((pm) => {
                    const linkedAcc = pm.linked_account_id ? accounts.find(a => a.id === pm.linked_account_id) : null
                    return (
                      <div key={pm.id} className="flex items-center justify-between border rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{pm.icon || "\U0001f4b0"}</span>
                          <div>
                            <p className="font-medium">{pm.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{pm.method_type.replace("_", " ")}</Badge>
                              {pm.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                              {pm.card_id && <Badge variant="secondary" className="text-xs">Card</Badge>}
                              {linkedAcc && (
                                <span className="text-xs text-muted-foreground">{linkedAcc.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!pm.is_system && !pm.card_id && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEditPm(pm)}>Edit</Button>
                              <Dialog
                                open={deletingPmId === pm.id}
                                onOpenChange={(open) => !open && setDeletingPmId(null)}
                              >
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingPmId(pm.id)}>
                                    Delete
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Payment Method?</DialogTitle>
                                  </DialogHeader>
                                  <p className="text-sm text-muted-foreground">Delete &quot;{pm.name}&quot;?</p>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeletingPmId(null)}>Cancel</Button>
                                    <Button variant="destructive" onClick={() => handleDeletePm(pm.id)}>Delete</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No payment methods yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <div className="space-y-6">
            {renderCategorySection("expense")}
            {renderCategorySection("income")}
          </div>
        </TabsContent>

        {/* Funds Tab */}
        <TabsContent value="funds">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Allocation Funds</CardTitle>
                <CardDescription>Create and manage funds for income allocation</CardDescription>
              </div>
              <Button onClick={openCreateFund}>+ Create Fund</Button>
            </CardHeader>
            <CardContent>
              {funds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {funds.map((fund) => (
                    <div key={fund.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold">
                          {fund.emoji} {fund.name}
                        </h3>
                        <Badge variant="secondary">{fund.allocation_percentage}%</Badge>
                      </div>
                      {fund.description && (
                        <p className="text-sm text-muted-foreground mb-3">{fund.description}</p>
                      )}
                      {fund.linked_accounts && fund.linked_accounts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {fund.linked_accounts.map(acc => (
                            <Badge key={acc.id} variant="outline" className="text-xs">
                              {acc.name}
                              {fund.linked_accounts.length > 1 && (
                                <span className="ml-1 text-muted-foreground">({acc.allocation_percentage}%)</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(fund.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditFund(fund)}>
                            Edit
                          </Button>
                          {fund.is_system ? (
                            <Badge variant="outline" className="text-xs text-muted-foreground">System</Badge>
                          ) : (
                            <Dialog
                              open={deletingFundId === fund.id}
                              onOpenChange={(open) => !open && setDeletingFundId(null)}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeletingFundId(fund.id)}>
                                  Delete
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Fund?</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">Delete &quot;{fund.name}&quot;? This cannot be undone.</p>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setDeletingFundId(null)}>Cancel</Button>
                                  <Button variant="destructive" onClick={() => handleDeleteFund(fund.id)}>Delete</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No funds yet. Create one to get started!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Shared Dialogs ── */}

      {/* Account create/edit dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Create Account"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAccount} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={accName} onChange={(e) => setAccName(e.target.value)} required />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={accType} onValueChange={setAccType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={accCurrency} onValueChange={setAccCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Institution (optional)</Label>
              <Input value={accInstitution} onChange={(e) => setAccInstitution(e.target.value)} placeholder="e.g. DBS Bank" />
            </div>
            <div>
              <Label>Starting Balance</Label>
              <Input type="number" step="0.01" value={accStartingBalance} onChange={(e) => setAccStartingBalance(e.target.value)} placeholder="0.00" />
            </div>
            <Button type="submit" className="w-full">{editingAccount ? "Save Changes" : "Create Account"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category create/edit dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Create Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Housing" required />
            </div>
            <div>
              <Label>Emoji (optional)</Label>
              <Input value={catEmoji} onChange={(e) => setCatEmoji(e.target.value)} placeholder="e.g. 🏠" maxLength={2} />
            </div>
            <Button type="submit" className="w-full">
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subcategory create/edit dialog */}
      <Dialog open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSubcategory ? "Edit Subcategory" : "Add Subcategory"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSubcategory} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Rent" required />
            </div>
            <Button type="submit" className="w-full">
              {editingSubcategory ? "Save Changes" : "Add Subcategory"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Card create/edit dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Card" : "Add Card"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCard} className="space-y-4">
            <div>
              <Label>Card Name</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="e.g. DBS Visa Debit" required />
            </div>
            <div>
              <Label>Card Type</Label>
              <Select value={cardType} onValueChange={(v) => setCardType(v as "credit" | "debit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Card Network (optional)</Label>
              <Select value={cardNetwork} onValueChange={(v) => { setCardNetwork(v); if (v !== "other") setCardCustomNetwork("") }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
                <SelectContent>
                  {CARD_NETWORKS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cardNetwork === "other" && (
                <Input
                  className="mt-2"
                  value={cardCustomNetwork}
                  onChange={(e) => setCardCustomNetwork(e.target.value)}
                  placeholder="Enter card network name"
                />
              )}
            </div>
            <div>
              <Label>Last 4 Digits (optional)</Label>
              <Input value={cardLastFour} onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" maxLength={4} />
            </div>
            <div>
              <Label>Linked Account</Label>
              <Select value={cardAccountId} onValueChange={setCardAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.name !== "External").map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.account_currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              {editingCard ? "Save Changes" : "Add Card"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Method create/edit dialog */}
      <Dialog open={pmDialogOpen} onOpenChange={setPmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPm ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePm} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={pmName} onChange={(e) => setPmName(e.target.value)} placeholder="e.g. PayNow, UPI" required />
            </div>
            <div>
              <Label>Icon (optional emoji)</Label>
              <Input value={pmIcon} onChange={(e) => setPmIcon(e.target.value)} placeholder="e.g. \U0001f4f1" maxLength={2} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={pmMethodType} onValueChange={(v) => setPmMethodType(v as "digital_wallet" | "custom")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked Account (optional)</Label>
              <Select value={pmLinkedAccountId} onValueChange={setPmLinkedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {accounts.filter(a => a.name !== "External").map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.account_currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              {editingPm ? "Save Changes" : "Add Payment Method"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fund create/edit dialog */}
      <Dialog open={fundDialogOpen} onOpenChange={setFundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFund ? "Edit Fund" : "Create Fund"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveFund} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={fundName} onChange={(e) => setFundName(e.target.value)} placeholder="e.g. Investments" required />
            </div>
            <div>
              <Label>Emoji (optional)</Label>
              <Input value={fundEmoji} onChange={(e) => setFundEmoji(e.target.value)} placeholder="e.g. 📈" maxLength={2} />
            </div>
            <div>
              <Label>Default Allocation %</Label>
              <Input type="number" value={fundAllocation} onChange={(e) => setFundAllocation(e.target.value)} placeholder="80" min="0" max="100" step="0.1" />
            </div>
            <div>
              <Label>Linked Accounts</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-start font-normal">
                    {fundAccountAllocations.length === 0
                      ? "Select accounts..."
                      : `${fundAccountAllocations.length} account${fundAccountAllocations.length > 1 ? "s" : ""} selected`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[300px]">
                  <DropdownMenuLabel>Accounts</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {accounts
                    .filter(a => a.name !== "External")
                    .map(acc => {
                      const isChecked = fundAccountAllocations.some(a => a.account_id === acc.id)
                      return (
                        <DropdownMenuCheckboxItem
                          key={acc.id}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFundAccountAllocations(prev => [...prev, { account_id: acc.id, allocation_percentage: 100 }])
                            } else {
                              setFundAccountAllocations(prev => prev.filter(a => a.account_id !== acc.id))
                            }
                          }}
                        >
                          {acc.name}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {acc.institution || acc.account_currency}
                          </span>
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
              {fundAccountAllocations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {fundAccountAllocations.map(alloc => {
                    const acc = accounts.find(a => a.id === alloc.account_id)
                    return acc ? (
                      <Badge key={alloc.account_id} variant="secondary" className="text-xs">
                        {acc.name}
                        <button
                          type="button"
                          className="ml-1 hover:text-destructive"
                          onClick={() => setFundAccountAllocations(prev => prev.filter(a => a.account_id !== alloc.account_id))}
                        >
                          x
                        </button>
                      </Badge>
                    ) : null
                  })}
                </div>
              )}
              {fundAccountAllocations.length > 1 && (
                <div className="space-y-2 mt-3">
                  <Label className="text-xs text-muted-foreground">
                    Allocation Split (must sum to 100%)
                  </Label>
                  {fundAccountAllocations.map((alloc, idx) => {
                    const acc = accounts.find(a => a.id === alloc.account_id)
                    return (
                      <div key={alloc.account_id} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate">{acc?.name || "Unknown"}</span>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={alloc.allocation_percentage}
                          onChange={(e) => {
                            const updated = [...fundAccountAllocations]
                            updated[idx] = { ...updated[idx], allocation_percentage: parseFloat(e.target.value) || 0 }
                            setFundAccountAllocations(updated)
                          }}
                          className="w-20 text-right"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    )
                  })}
                  <p className="text-xs text-muted-foreground">
                    Total: {fundAccountAllocations.reduce((s, a) => s + Number(a.allocation_percentage), 0).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full">
              {editingFund ? "Save Changes" : "Create Fund"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
