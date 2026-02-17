"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getAccounts, getTransactions } from "@/lib/api"
import type { Account, Transaction } from "@/lib/types"

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        const accts = await getAccounts()
        setAccounts(accts)
        if (accts.length > 0) {
          const txns = await getTransactions(accts[0].id)
          setRecentTxns(txns.slice(0, 5))
        }
      } catch {
        // ignore on dashboard
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const assets = accounts.filter((a) => a.type === "asset")
  const liabilities = accounts.filter((a) => a.type === "liability")
  const totalAssets = assets.length
  const totalLiabilities = liabilities.length

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Asset Accounts" value={totalAssets.toString()} />
        <StatCard title="Liability Accounts" value={totalLiabilities.toString()} />
        <StatCard title="Total Accounts" value={accounts.length.toString()} />
        <StatCard
          title="Net Account Types"
          value={`${totalAssets - totalLiabilities}`}
        />
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-muted-foreground">No accounts yet. Create one to get started.</p>
            <Button onClick={() => router.push("/accounts")}>Go to Accounts</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTxns.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{tx.payee}</TableCell>
                      <TableCell className="text-muted-foreground">{tx.memo}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{tx.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
