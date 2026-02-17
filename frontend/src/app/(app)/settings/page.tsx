"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import {
  getWorkspace,
  updateWorkspace,
  getMe,
  getAccounts,
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
} from "@/lib/api"
import { clearAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { CURRENCIES, ACCOUNT_TYPES } from "@/lib/constants"
import type { Workspace, UserResponse, Account, AccountType, Category, Subcategory, Fund } from "@/lib/types"

export default function SettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("workspace")
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
  const [deletingFundId, setDeletingFundId] = useState<string | null>(null)

  async function loadData(isInitial = false) {
    try {
      if (isInitial) setLoading(true)
      const [ws, me, accts, cats, subs, fnds] = await Promise.all([
        getWorkspace(),
        getMe(),
        getAccounts(),
        getCategories(),
        getSubcategories(),
        getFunds(),
      ])
      setWorkspace(ws)
      setUser(me)
      setWsName(ws.name)
      setWsCurrency(ws.base_currency)
      setAccounts(accts)
      setCategories(cats)
      setSubcategories(subs)
      setFunds(fnds)
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
    if (!editingAccount) return
    try {
      await updateAccount(editingAccount.id, {
        name: accName,
        type: accType as AccountType,
        account_currency: accCurrency,
        institution: accInstitution || undefined,
        starting_balance: accStartingBalance ? parseFloat(accStartingBalance) : 0,
      })
      toast({ title: "Account updated" })
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
    setFundDialogOpen(true)
  }

  function openEditFund(fund: Fund) {
    setEditingFund(fund)
    setFundName(fund.name)
    setFundEmoji(fund.emoji || "")
    setFundAllocation(String(fund.allocation_percentage))
    setFundDialogOpen(true)
  }

  async function handleSaveFund(e: React.FormEvent) {
    e.preventDefault()
    try {
      const data = {
        name: fundName,
        emoji: fundEmoji,
        allocation_percentage: parseFloat(fundAllocation) || 0,
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
                      <Label className="text-xs text-muted-foreground">Display Name</Label>
                      <p className="text-sm font-medium">{user.display_name || "Not set"}</p>
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
            <CardHeader>
              <CardTitle>Bank & Investment Accounts</CardTitle>
              <CardDescription>Manage your accounts</CardDescription>
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
                <p className="text-muted-foreground text-center py-8">No accounts. Create one in the Accounts page.</p>
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
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(fund.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditFund(fund)}>
                            Edit
                          </Button>
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

      {/* Account edit dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
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
            <Button type="submit" className="w-full">Save Changes</Button>
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
            <Button type="submit" className="w-full">
              {editingFund ? "Save Changes" : "Create Fund"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
