"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isLoggedIn } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowDownToLine,
  TrendingUp,
  RefreshCw,
  Globe,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  X,
} from "lucide-react"

const systemLayers = [
  {
    icon: ArrowDownToLine,
    title: "Income Allocation Engine",
    description:
      "Programmable rules that split income the moment it arrives. Percentage or rule-based flows across accounts and investment vehicles. No more residual investing.",
  },
  {
    icon: TrendingUp,
    title: "Projection-First Modeling",
    description:
      "Define income streams, allocations, and growth assumptions. Model multi-year trajectories. Adjust dynamically. Recompute instantly. A rolling financial model of your life.",
  },
  {
    icon: RefreshCw,
    title: "Monthly Control Loop",
    description:
      "Each month is a cycle: income realized, allocations executed, actuals vs projections evaluated, adjustments made. Portfolio rebalancing — applied to your entire financial life.",
  },
  {
    icon: Globe,
    title: "Multi-Currency Architecture",
    description:
      "SGD, USD, INR, AED — natively handled. FX-aware accounting, cross-border flows, account-level currency integrity. Not an add-on. A first-class design constraint.",
  },
]

const comparisons = [
  { others: "Expense trackers (backward-looking)", ledgera: "Projection engine (forward-looking)" },
  { others: "Robo-advisors (advisory-driven)", ledgera: "User-controlled allocation rules" },
  { others: "Brokerages (execution platforms)", ledgera: "Allocation infrastructure" },
  { others: "Black-box recommendations", ledgera: "Transparent framework for thinking" },
]

export default function Home() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/dashboard")
    } else {
      setReady(true)
    }
  }, [router])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Ledgera
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login?tab=signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center md:py-32">
          <Badge variant="secondary" className="mb-6">
            Projection-Driven Personal Finance
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Structure your income
            <br />
            <span className="text-muted-foreground">before you invest it.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Ledgera is a forward-looking allocation system. Define how your income
            flows into investments, savings, and expenses — then model your financial
            trajectory years ahead. No black box. No advisors. Just your rules,
            executed consistently.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/login?tab=signup">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#problem">
                See How It Works
                <ChevronRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>

        {/* Problem Statement */}
        <section id="problem" className="border-t bg-muted/40 py-24">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              The problem isn&apos;t knowledge. It&apos;s structure.
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div>
                <h3 className="text-lg font-semibold">You know what to do</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Most people understand they should invest, save, and control expenses.
                  Access to brokerages and information isn&apos;t the bottleneck.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">But income flows are ad-hoc</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Money arrives, bills get paid, and &quot;whatever is left&quot; goes to
                  investments. There&apos;s no system — just residual allocation.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Ledgera fixes the flow</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Define deterministic allocation rules. Percentage-based splits across
                  investments, savings, expenses, and multi-currency accounts. Executed
                  every month.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* System Layers */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                A system, not an app
              </h2>
              <p className="mt-4 text-muted-foreground">
                Four layers that turn income into structured capital deployment.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {systemLayers.map((layer) => (
                <Card key={layer.title}>
                  <CardContent className="pt-6">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <layer.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{layer.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {layer.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Positioning: What Ledgera is not */}
        <section className="border-t bg-muted/40 py-24">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              Forward-looking allocation,
              <br />
              not backward-looking tracking
            </h2>
            <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-lg border bg-card">
              <div className="grid grid-cols-2 border-b bg-muted/60 px-6 py-3 text-sm font-semibold">
                <div>Other tools</div>
                <div>Ledgera</div>
              </div>
              {comparisons.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-2 px-6 py-4 text-sm ${
                    i < comparisons.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <X className="h-3.5 w-3.5 shrink-0 text-destructive/70" />
                    {row.others}
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {row.ledgera}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-muted-foreground">
              We don&apos;t touch your money. We structure how you think about it.
            </p>
          </div>
        </section>

        {/* Security / Trust */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight">
              Explicit trust boundary
            </h2>
            <div className="mx-auto mt-6 flex max-w-xl flex-col gap-3">
              <p className="text-sm text-muted-foreground">No bank login integrations</p>
              <Separator />
              <p className="text-sm text-muted-foreground">No OTP access or credential ingestion</p>
              <Separator />
              <p className="text-sm text-muted-foreground">Fully user-controlled data input</p>
            </div>
            <p className="mt-8 font-medium">
              Your data, your rules, your control.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t bg-muted/40 py-24">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Model first. Allocate second.
              <br />
              Execute consistently.
            </h2>
            <Button size="lg" className="mt-8" asChild>
              <Link href="/login?tab=signup">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between">
          <p className="text-sm font-semibold">Ledgera</p>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Ledgera. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
