"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import {
  getAuthProviderBreakdown, getProfileCompletion, getGeographicDistribution,
  getAgeBreakdown, getConversionFunnel, getFeatureAdoption, getRetentionCohorts,
} from "@/lib/admin-api"
import type {
  AuthProviderBreakdown, AgeBracket, RetentionCohort, ConversionFunnel, FeatureAdoption,
} from "@/lib/admin-types"
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts"
import { useChartTheme, CHART_COLORS } from "@/lib/chart-theme"

const COLORS = CHART_COLORS

export default function AdminAnalyticsPage() {
  const { toast } = useToast()
  const { tooltipStyle, gridStroke, tickStyle } = useChartTheme()
  const [loading, setLoading] = useState(true)
  const [authProviders, setAuthProviders] = useState<AuthProviderBreakdown[]>([])
  const [profileStats, setProfileStats] = useState<{ completed: number; incomplete: number } | null>(null)
  const [geoData, setGeoData] = useState<Array<{ country: string; count: number }>>([])
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null)
  const [adoption, setAdoption] = useState<FeatureAdoption | null>(null)
  const [ageData, setAgeData] = useState<AgeBracket[]>([])
  const [cohorts, setCohorts] = useState<RetentionCohort[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [ap, ps, geo, age, fn, fa, co] = await Promise.all([
          getAuthProviderBreakdown(),
          getProfileCompletion(),
          getGeographicDistribution(),
          getAgeBreakdown(),
          getConversionFunnel(),
          getFeatureAdoption(),
          getRetentionCohorts(12),
        ])
        setAuthProviders(ap)
        setProfileStats(ps)
        setGeoData(geo)
        setAgeData(age)
        setFunnel(fn)
        setAdoption(fa)
        setCohorts(co)
      } catch (err: any) {
        toast({ variant: "destructive", title: "Failed to load analytics", description: err.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
  }

  const providerChartData = authProviders.map((a) => ({
    name: a.provider === "email" ? "Email" : "Google",
    value: a.count,
  }))

  const profileChartData = profileStats ? [
    { name: "Completed", value: profileStats.completed },
    { name: "Incomplete", value: profileStats.incomplete },
  ] : []

  const funnelChartData = funnel ? [
    { stage: "Signups", count: funnel.total_signups, rate: "100%" },
    { stage: "Profile Done", count: funnel.profile_completed, rate: `${funnel.signup_to_profile_rate}%` },
    { stage: "Active", count: funnel.active_users, rate: `${funnel.signup_to_active_rate}%` },
  ] : []

  const adoptionChartData = adoption ? [
    { feature: "Projections", count: adoption.projections.count, rate: adoption.projections.rate },
    { feature: "Custom Funds", count: adoption.custom_funds.count, rate: adoption.custom_funds.rate },
    { feature: "Recurring Txns", count: adoption.recurring_transactions.count, rate: adoption.recurring_transactions.rate },
  ] : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
        </TabsList>

        {/* User Analytics Tab */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Auth Provider Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Auth Provider Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {providerChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={providerChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                        dataKey="value"
                      >
                        {providerChartData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Profile Completion */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile Completion</CardTitle>
              </CardHeader>
              <CardContent>
                {profileChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={profileChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Geographic Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Geographic Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {geoData.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No geographic data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, geoData.length * 35)}>
                    <BarChart data={geoData} layout="vertical" margin={{ left: 40, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis type="number" allowDecimals={false} tick={tickStyle} />
                      <YAxis type="category" dataKey="country" tick={tickStyle} width={50} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Age Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Age Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {ageData.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No age data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, ageData.length * 35)}>
                    <BarChart data={ageData} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis type="number" allowDecimals={false} tick={tickStyle} />
                      <YAxis type="category" dataKey="bracket" tick={tickStyle} width={50} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Marketing Tab */}
        <TabsContent value="marketing" className="space-y-4 mt-4">
          {/* Conversion Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {funnelChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={funnelChartData} margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="stage" tick={tickStyle} />
                    <YAxis allowDecimals={false} tick={tickStyle} />
                    <Tooltip
                      formatter={(value: number, name: string) => [value, "Users"]}
                      labelFormatter={(label) => {
                        const item = funnelChartData.find((d) => d.stage === label)
                        return `${label} (${item?.rate || ""})`
                      }}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {funnel && (
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">Signup to Profile</div>
                    <div className="text-xl font-bold text-green-600">{funnel.signup_to_profile_rate}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Profile to Active</div>
                    <div className="text-xl font-bold text-blue-600">{funnel.profile_to_active_rate}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Signup to Active</div>
                    <div className="text-xl font-bold text-purple-600">{funnel.signup_to_active_rate}%</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feature Adoption */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature Adoption</CardTitle>
            </CardHeader>
            <CardContent>
              {adoptionChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={adoptionChartData} margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="feature" tick={tickStyle} />
                    <YAxis allowDecimals={false} tick={tickStyle} />
                    <Tooltip
                      formatter={(value: number, name: string) => [value, "Users"]}
                      labelFormatter={(label) => {
                        const item = adoptionChartData.find((d) => d.feature === label)
                        return `${label} (${item?.rate || 0}%)`
                      }}
                      contentStyle={tooltipStyle}
                    />
                    <Legend />
                    <Bar dataKey="count" name="Users" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Cohort Retention</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cohorts.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No cohort data yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cohort</TableHead>
                      <TableHead>Total Signups</TableHead>
                      <TableHead>Retained (Logged In)</TableHead>
                      <TableHead>Retention Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cohorts.map((c) => (
                      <TableRow key={c.cohort}>
                        <TableCell className="font-medium">{c.cohort}</TableCell>
                        <TableCell>{c.total}</TableCell>
                        <TableCell>{c.retained}</TableCell>
                        <TableCell>
                          <span className={c.retention_rate >= 50 ? "text-green-600 font-medium" : c.retention_rate >= 25 ? "text-yellow-600 font-medium" : "text-red-600 font-medium"}>
                            {c.retention_rate}%
                          </span>
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
    </div>
  )
}
