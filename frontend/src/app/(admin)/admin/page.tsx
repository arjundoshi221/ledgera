"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSystemStats, useSignupGrowth, useDAU, useMAU } from "@/lib/hooks"
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"
import { useChartTheme } from "@/lib/chart-theme"

export default function AdminDashboardPage() {
  const { tooltipStyle, gridStroke, tickStyle } = useChartTheme()

  // Use SWR hooks for automatic caching
  const { data: stats, isLoading: statsLoading } = useSystemStats()
  const { data: signups = [], isLoading: signupsLoading } = useSignupGrowth(90)
  const { data: dau = [], isLoading: dauLoading } = useDAU(30)
  const { data: mau = [], isLoading: mauLoading } = useMAU(12)
  const loading = statsLoading || signupsLoading || dauLoading || mauLoading

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
  }

  const statCards = stats ? [
    { label: "Total Users", value: stats.total_users, color: "text-blue-600" },
    { label: "Active Users", value: stats.active_users, color: "text-green-600" },
    { label: "Total Transactions", value: stats.total_transactions, color: "text-purple-600" },
    { label: "Total Workspaces", value: stats.total_workspaces, color: "text-orange-600" },
    { label: "Total Accounts", value: stats.total_accounts, color: "text-cyan-600" },
    { label: "Admin Users", value: stats.admin_users, color: "text-red-600" },
  ] : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">{card.label}</div>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Signup Growth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signups (Last 90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {signups.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
              No signup data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={signups}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" tick={tickStyle} />
                <YAxis allowDecimals={false} tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* DAU & MAU side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Active Users (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {dau.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                No login data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dau}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={tickStyle} />
                  <YAxis allowDecimals={false} tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Active Users (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {mau.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                No login data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mau}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="month" tick={tickStyle} />
                  <YAxis allowDecimals={false} tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
