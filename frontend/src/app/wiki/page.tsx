"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  LayoutDashboard,
  Briefcase,
  ArrowLeftRight,
  PieChart,
  ArrowDownToLine,
  BarChart3,
  TrendingUp,
  Settings,
  ChevronRight,
  BookOpen,
  User,
  Landmark,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Code2,
  ArrowUpRight,
  Target,
  Eye,
  RefreshCw,
  Gauge,
  Lock,
  Wrench,
} from "lucide-react"

/* ── data ──────────────────────────────────────────────────────── */

const sections = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    subtitle: "First steps after signing up",
    accent: "from-violet-500 to-purple-600",
    accentBg: "violet",
    content: [
      {
        heading: "1. Create your accounts",
        text: "Head to Settings > Accounts and add your real-world bank accounts, investment accounts, and credit cards. Each account has a name, type (asset or liability), and currency.",
      },
      {
        heading: "2. Set up categories",
        text: "Go to Settings > Categories and create expense categories like Rent, Food, Transport, etc. You can add subcategories too (e.g. Food > Groceries, Food > Dining Out). Pick an emoji for each one to keep things visual.",
      },
      {
        heading: "3. Create your funds",
        text: 'Funds are buckets where your income flows. Common examples: "Working Capital" for monthly expenses, "Emergency Fund", "Investments", "Travel Fund". Go to Settings > Funds to set these up. Each fund gets an allocation percentage \u2014 that\'s the share of your income it receives.',
      },
      {
        heading: "4. Add payment methods",
        text: "Optionally set up cards and payment methods in Settings so you can tag transactions with how you paid.",
      },
    ],
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    subtitle: "Your home base",
    accent: "from-sky-500 to-blue-600",
    accentBg: "sky",
    content: [
      {
        heading: "What it shows",
        text: "A quick summary of your financial world: how many asset accounts you have, how many liability accounts, your total account count, and your most recent transactions. Think of it as the front page of your finances.",
      },
      {
        heading: "What you can do",
        text: "Check your latest transactions at a glance. If you haven't set up accounts yet, it'll nudge you toward Settings to get started.",
      },
    ],
  },
  {
    id: "portfolio",
    icon: Briefcase,
    title: "Portfolio",
    subtitle: "Your net worth at a glance",
    accent: "from-emerald-500 to-green-600",
    accentBg: "emerald",
    content: [
      {
        heading: "Net Worth Tracking",
        text: "See your total net worth, broken down into total assets and total liabilities. If you hold money in different currencies, Ledgera converts everything to your base currency and shows you the combined picture.",
      },
      {
        heading: "Net Worth Over Time",
        text: "A chart that tracks how your net worth has changed over 1 to 5 years. You'll see separate lines for assets, liabilities, and the net total so you can spot trends.",
      },
      {
        heading: "Accounts Table",
        text: "A detailed table showing every account: its balance in the original currency, the exchange rate used, and the value in your base currency. If you hold foreign currency, it also shows unrealized FX gains or losses.",
      },
      {
        heading: "Currency Allocation",
        text: "A donut chart showing how your money is split across currencies. Useful if you want to see how diversified (or concentrated) your holdings are.",
      },
    ],
  },
  {
    id: "transactions",
    icon: ArrowLeftRight,
    title: "Transactions",
    subtitle: "Where the data lives",
    accent: "from-amber-500 to-orange-600",
    accentBg: "amber",
    content: [
      {
        heading: "Recording transactions",
        text: "This is where you log every financial event \u2014 a purchase, a salary deposit, a transfer between accounts. Each transaction has a date, payee, amount, category, and the account it belongs to.",
      },
      {
        heading: "Multi-currency support",
        text: "If you're paying in a different currency from your account's currency, Ledgera handles the conversion. Just enter the amount in the transaction currency.",
      },
      {
        heading: "Recurring transactions",
        text: "For regular expenses like rent or subscriptions, set up recurring transactions so they're automatically created each month. No need to enter the same thing over and over.",
      },
      {
        heading: "Filtering and search",
        text: "Filter transactions by account, date range, or category to find exactly what you're looking for.",
      },
    ],
  },
  {
    id: "monthly-dashboard",
    icon: PieChart,
    title: "Monthly Dashboard",
    subtitle: "Where did the money go this month?",
    accent: "from-rose-500 to-pink-600",
    accentBg: "rose",
    content: [
      {
        heading: "Fund Breakdown",
        text: "A donut chart showing how your spending was distributed across your funds for any given month. Instantly see which fund is consuming the most. If a fund is over budget, it's highlighted in red.",
      },
      {
        heading: "Per-Fund Details",
        text: "Below the chart, each fund gets its own card with horizontal bars showing spending by category within that fund. You can see at a glance whether you're under or over your budget for each category.",
      },
      {
        heading: "Category Split",
        text: 'Switch to the "Category Split" tab to see all your spending grouped by category instead of by fund. Each category shows the total amount, what percentage of total spending it represents, and how many transactions it includes. Expand a category to see subcategory details.',
      },
      {
        heading: "Month and year selector",
        text: "Use the controls at the top to navigate to any month in the last 5 years.",
      },
    ],
  },
  {
    id: "income-allocation",
    icon: ArrowDownToLine,
    title: "Income Allocation",
    subtitle: "Tell your money where to go",
    accent: "from-teal-500 to-cyan-600",
    accentBg: "teal",
    content: [
      {
        heading: "The basic idea",
        text: "Every time you get paid, that money needs to go somewhere. Instead of figuring it out as you go, you set up rules in advance. \"50% of my income goes to monthly expenses, 20% to investments, 15% to emergency fund, 15% to travel.\" Ledgera splits it for you automatically.",
      },
      {
        heading: "The allocation table",
        text: "This page shows a grid \u2014 your funds are on the left, months are across the top. Click any cell to change the percentage for that fund in that month. The current month is highlighted so you always know where you are.",
      },
      {
        heading: "Working Capital is special",
        text: "Your expenses fund (Working Capital) can run in two modes. \"Model\" gives it a fixed amount you choose \u2014 simple and predictable. \"Optimize\" is smarter: it looks at what you actually spent and only allocates that much, sweeping any leftover into savings. See the \"Model vs Optimize\" section above for a detailed breakdown with examples.",
      },
      {
        heading: "You can always override",
        text: "Had an unusual month? Just click the cell and type a specific number. Ledgera won't fight you \u2014 manual overrides always win. You can reset back to the automatic calculation anytime.",
      },
    ],
  },
  {
    id: "fund-tracker",
    icon: BarChart3,
    title: "Fund Tracker",
    subtitle: "Are your accounts in sync with your plan?",
    accent: "from-indigo-500 to-blue-600",
    accentBg: "indigo",
    content: [
      {
        heading: "Ledger View",
        text: 'The "Ledger" tab shows a detailed transaction history for each fund or each account. You can see every inflow and outflow, with running balances. Think of it as a statement for each fund.',
      },
      {
        heading: "Dashboard View",
        text: 'The "Dashboard" tab shows the big picture: a chart of fund balances over time, and a comparison of expected vs. actual balances for each account. If your actual balance doesn\'t match what the plan says it should be, you\'ll see the difference.',
      },
      {
        heading: "Transfer Suggestions",
        text: "This is one of the most useful features. Ledgera calculates exactly which transfers you need to make between accounts to bring everything back in line with your plan. It even handles cross-currency transfers by fetching current exchange rates. Just review and execute.",
      },
    ],
  },
  {
    id: "projections",
    icon: TrendingUp,
    title: "Projections",
    subtitle: "Look into the future",
    accent: "from-fuchsia-500 to-purple-600",
    accentBg: "fuchsia",
    content: [
      {
        heading: "Build a financial model",
        text: "Enter your income, expenses, tax rate, and inflation rate. Choose how many years to project. Ledgera runs the numbers and shows you a year-by-year forecast of your savings, fund balances, and overall financial trajectory.",
      },
      {
        heading: "Fund allocation & growth",
        text: "Define what percentage of savings goes into each fund and set expected return rates. See how your investments could grow over time under your assumptions.",
      },
      {
        heading: "One-time costs",
        text: "Planning a big purchase? Add one-time costs at specific points in the future (like buying a car in year 2 or a wedding in year 3) and see how they affect your trajectory.",
      },
      {
        heading: "Scenarios",
        text: 'Save different versions of your projections as scenarios. "Aggressive Savings" vs. "Comfortable Lifestyle" vs. "Early Retirement" \u2014 compare them side by side and activate the one you want to follow.',
      },
      {
        heading: "Create recurring transactions",
        text: "Once you're happy with a projection, you can create recurring transactions directly from it. This turns your plan into real tracked entries in the system.",
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings",
    subtitle: "Configure everything",
    accent: "from-slate-500 to-zinc-600",
    accentBg: "slate",
    content: [
      {
        heading: "Workspace",
        text: "Set your workspace name, choose your base currency (the currency everything gets converted to for reporting), and set your minimum working capital balance.",
      },
      {
        heading: "Accounts",
        text: "Create and manage your bank accounts, investment accounts, and credit cards. Each account has a type (asset or liability), currency, and optional institution name.",
      },
      {
        heading: "Categories & Subcategories",
        text: "Organize your spending and income into categories. Each category has a name, an emoji, and a type (expense or income). Subcategories let you get more granular.",
      },
      {
        heading: "Funds",
        text: "Create the buckets your income flows into. Set each fund's name, emoji, allocation percentage, and which accounts are linked to it.",
      },
      {
        heading: "Cards & Payment Methods",
        text: "Track which card or payment method you used for each transaction. Add credit cards, debit cards, digital wallets, or custom payment methods.",
      },
    ],
  },
]

const concepts = [
  {
    term: "Account",
    icon: Landmark,
    definition:
      "A real-world financial account \u2014 your bank account, credit card, brokerage account, etc. Each one has a currency and a type (asset or liability).",
  },
  {
    term: "Fund",
    icon: Layers,
    definition:
      "A virtual bucket that your income is allocated to. Funds don't hold money directly \u2014 they represent how much of your total money is earmarked for a specific purpose (expenses, savings, investing, etc.).",
  },
  {
    term: "Category",
    icon: PieChart,
    definition:
      "A label for what money was spent on or earned from. Expense categories: Rent, Food, Transport. Income categories: Salary, Freelance, Interest.",
  },
  {
    term: "Allocation",
    icon: ArrowDownToLine,
    definition:
      "The percentage of your income that goes to each fund. If your Investments fund has a 20% allocation, it receives 20% of every income payment.",
  },
  {
    term: "Working Capital",
    icon: Zap,
    definition:
      "The fund that covers your day-to-day expenses. It's typically your largest fund and has special modes for how its amount is calculated each month.",
  },
  {
    term: "Base Currency",
    icon: Globe,
    definition:
      "The currency used for all reports and totals. If you have accounts in USD, SGD, and INR, your base currency determines how they're all converted for the combined view.",
  },
  {
    term: "Net Worth",
    icon: TrendingUp,
    definition:
      "Total assets minus total liabilities, all converted to your base currency. This is the single number that represents your overall financial position.",
  },
  {
    term: "Projection",
    icon: Sparkles,
    definition:
      "A forward-looking financial model. You set assumptions (income, expenses, growth rates) and Ledgera calculates what your finances could look like years from now.",
  },
  {
    term: "Scenario",
    icon: BarChart3,
    definition:
      "A saved set of projection assumptions. You can create multiple scenarios to compare different financial strategies.",
  },
]

const workflowSteps = [
  {
    title: "Income arrives",
    description:
      "Log it as a transaction. Ledgera automatically knows how to split it based on your allocation rules.",
  },
  {
    title: "Check the Monthly Dashboard",
    description:
      "See how your spending compares to what was planned for each fund and category.",
  },
  {
    title: "Review the Fund Tracker",
    description:
      "See if your account balances match what the plan expects. If not, use the suggested transfers to rebalance.",
  },
  {
    title: "Execute transfers",
    description:
      "Move money between accounts in real life, then confirm the transfers in Ledgera.",
  },
  {
    title: "Adjust if needed",
    description:
      "If your situation changed, update your allocation percentages or projections. The system adapts.",
  },
]

/* ── component ─────────────────────────────────────────────────── */

export default function WikiPage() {
  const [activeId, setActiveId] = useState<string>("")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const ids = [
      ...sections.map((s) => s.id),
      "funds-vs-accounts",
      "model-vs-optimize",
      "concepts",
      "workflow",
      "about",
    ]

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    )

    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [])

  const allNavItems = [
    ...sections.map((s) => ({ id: s.id, label: s.title, icon: s.icon })),
    { id: "funds-vs-accounts", label: "Funds vs Accounts", icon: Layers },
    { id: "model-vs-optimize", label: "Model vs Optimize", icon: Gauge },
    { id: "concepts", label: "Key Concepts", icon: BookOpen },
    { id: "workflow", label: "Monthly Workflow", icon: Zap },
    { id: "about", label: "About", icon: User },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
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
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b">
          {/* Background pattern */}
          <div className="absolute inset-0 wiki-grid-pattern opacity-50" />
          {/* Gradient orbs */}
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative mx-auto max-w-4xl px-4 py-20 md:py-28">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to home
            </Link>

            <div className="flex items-center gap-2 mb-6">
              <Badge
                variant="secondary"
                className="gap-1.5 px-3 py-1 text-xs font-medium"
              >
                <BookOpen className="h-3 w-3" />
                User Guide
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight md:text-6xl wiki-gradient-text pb-1">
              How Ledgera Works
            </h1>
            <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              A complete guide to every feature. No jargon, no formulas &mdash;
              just a clear walkthrough of what each page does and how to use it.
            </p>

            <div className="mt-6">
              <Link
                href="/learn"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Or follow Ledge&apos;s story to see it in action
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 mt-10">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">9 Pages</p>
                  <p className="text-xs text-muted-foreground">Covered</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">9 Concepts</p>
                  <p className="text-xs text-muted-foreground">Explained</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Multi-Currency</p>
                  <p className="text-xs text-muted-foreground">Native</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Body: sidebar + content ── */}
        <div className="mx-auto max-w-6xl px-4 py-12 lg:flex lg:gap-10">
          {/* Sticky sidebar (desktop) */}
          <aside className="hidden lg:block lg:w-56 shrink-0">
            <nav className="sticky top-20 space-y-0.5 max-h-[calc(100vh-6rem)] overflow-y-auto pb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">
                On this page
              </p>
              {allNavItems.map((item) => {
                const Icon = item.icon
                const isActive = activeId === item.id
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all ${
                      isActive
                        ? "bg-primary/10 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                    {item.label}
                  </a>
                )
              })}
            </nav>
          </aside>

          {/* Mobile quick nav */}
          <div className="lg:hidden mb-10">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Jump to a section
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {allNavItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        {item.label}
                      </a>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content column */}
          <div className="flex-1 min-w-0 max-w-4xl">
            {/* ── The Big Idea / USP ── */}
            <section className="mb-16">
              <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] p-8 md:p-10 overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-primary/5 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold">
                      What Makes Ledgera Different
                    </h2>
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-[15px] mb-8">
                    Most finance apps look backward &mdash; you spend money,
                    then look at charts of what happened. Ledgera works the
                    other way around.{" "}
                    <strong className="text-foreground">
                      You build a model of how your money should flow first.
                    </strong>{" "}
                    Then you live your life and track what actually happens.
                    At the end of each month, you compare the two. That&apos;s
                    the whole system.
                  </p>

                  {/* The 3-step loop */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-primary/10 bg-background/60 p-5 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-bold text-sm mb-1">1. Model</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Set up how your income should be split. How much for
                        expenses, how much for savings, how much for each goal.
                        This is your plan.
                      </p>
                    </div>
                    <div className="rounded-xl border border-primary/10 bg-background/60 p-5 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Eye className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-bold text-sm mb-1">2. Track</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Log your transactions as you go. Every purchase, every
                        transfer, every payment &mdash; tagged to the right
                        fund and category.
                      </p>
                    </div>
                    <div className="rounded-xl border border-primary/10 bg-background/60 p-5 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <RefreshCw className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-bold text-sm mb-1">3. Compare</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        See how reality matched your model. Overspent
                        somewhere? Underspent? Adjust next month&apos;s plan.
                        Rinse and repeat.
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mt-6 leading-relaxed">
                    This loop is the core of Ledgera. You&apos;re not just
                    recording history &mdash; you&apos;re running a continuous
                    feedback system on your financial life. Every month you get
                    better at predicting and controlling where your money goes.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Funds vs Accounts ── */}
            <section id="funds-vs-accounts" className="mb-20 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                  <Layers className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    Funds vs Accounts
                  </h2>
                </div>
              </div>
              <p className="text-muted-foreground mb-8 ml-12">
                The most important concept in Ledgera
              </p>

              <p className="text-muted-foreground leading-relaxed mb-8">
                This is the one idea worth understanding before you use anything
                else. Ledgera separates{" "}
                <em>where your money physically sits</em> from{" "}
                <em>what it&apos;s meant for</em>.
              </p>

              {/* Two-column visual */}
              <div className="grid gap-5 md:grid-cols-2 mb-8">
                <div className="group relative rounded-xl border border-blue-500/20 bg-gradient-to-b from-blue-500/[0.06] to-transparent p-6 transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <Landmark className="h-4 w-4 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-lg">Accounts</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Where your money{" "}
                    <strong className="text-foreground">physically lives</strong>.
                  </p>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {[
                      "Your DBS savings account",
                      "Your Schwab brokerage",
                      "Your credit card",
                      "Your fixed deposit in India",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 pt-4 border-t border-blue-500/10">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Each has a real balance, a real currency, and belongs to a
                      real institution. These are the accounts you log into at
                      your bank.
                    </p>
                  </div>
                </div>

                <div className="group relative rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-6 transition-all hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Layers className="h-4 w-4 text-emerald-500" />
                    </div>
                    <h3 className="font-bold text-lg">Funds</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    What your money is{" "}
                    <strong className="text-foreground">meant for</strong>.
                  </p>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {[
                      "Working Capital (monthly expenses)",
                      "Emergency Fund",
                      "Long-Term Investments",
                      "Travel Fund",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 pt-4 border-t border-emerald-500/10">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Funds are virtual labels. They don&apos;t exist at any
                      bank. They&apos;re your way of saying &ldquo;this portion
                      of my money is earmarked for this purpose.&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {/* Connection card */}
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <h3 className="font-bold mb-2 text-base">How they connect</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Each fund is{" "}
                  <strong className="text-foreground">
                    linked to one or more accounts
                  </strong>
                  . This is how Ledgera knows where each fund&apos;s money
                  actually sits. A single account can serve multiple funds, and
                  a single fund can span multiple accounts.
                </p>

                <div className="rounded-xl border bg-muted/30 p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                      <Zap className="h-3 w-3 text-primary" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Example
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground mb-5">
                    Say you earn{" "}
                    <strong className="text-foreground">$5,000/month</strong>{" "}
                    and set up three funds:
                  </p>

                  <div className="space-y-2 mb-6">
                    {[
                      { name: "Working Capital", pct: "50%", amt: "$2,500" },
                      { name: "Emergency Fund", pct: "20%", amt: "$1,000" },
                      { name: "Investments", pct: "30%", amt: "$1,500" },
                    ].map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between rounded-lg bg-background px-4 py-2.5 text-sm border border-border/50"
                      >
                        <span className="font-medium">{f.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{f.pct}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                          <span className="font-semibold">{f.amt}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-muted-foreground mb-5">
                    Now here&apos;s where funds meet accounts. You link them:
                  </p>

                  <div className="space-y-3 text-sm">
                    {[
                      { fund: "Working Capital", account: "DBS Savings" },
                      { fund: "Emergency Fund", account: "DBS Savings" },
                      { fund: "Investments", account: "Schwab Brokerage" },
                    ].map((link) => (
                      <div
                        key={link.fund}
                        className="flex items-center gap-3 flex-wrap"
                      >
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 font-medium">
                          {link.fund}
                        </Badge>
                        <div className="flex items-center gap-1 text-muted-foreground/40">
                          <div className="h-px w-4 bg-current" />
                          <ArrowRight className="h-3 w-3" />
                        </div>
                        <Badge
                          variant="outline"
                          className="border-blue-500/20 text-blue-600 dark:text-blue-400 font-medium"
                        >
                          {link.account}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-5 border-t border-border/50">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your DBS savings account has{" "}
                      <strong className="text-foreground">$3,500</strong> in it
                      &mdash; but Ledgera knows that $2,500 of that is Working
                      Capital and $1,000 is your Emergency Fund.{" "}
                      <strong className="text-foreground">
                        Same bank account, two different purposes.
                      </strong>{" "}
                      The Fund Tracker page tells you if the real balances match
                      the plan, and suggests transfers if they don&apos;t.
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mt-6">
                  This separation is what makes Ledgera more than a tracker. You
                  always know <em>why</em> money is somewhere, not just{" "}
                  <em>that</em> it&apos;s there.
                </p>
              </div>

              {/* Why funds drive the system */}
              <div className="mt-8 relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.03] to-primary/[0.06] p-6 md:p-8 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-primary/5 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-base">
                      Why funds drive the system &mdash; not accounts
                    </h3>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    This is a deliberate design choice and it&apos;s the reason
                    Ledgera works differently from every other finance app.
                  </p>

                  <div className="space-y-4 mb-6">
                    <div className="flex gap-4 items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 mt-0.5">
                        <span className="text-red-500 text-xs font-bold">&#10007;</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">
                          The account-first approach (what most apps do)
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          &ldquo;I have $3,500 in my DBS account.&rdquo; Okay,
                          but how much of that can you actually spend? How much
                          is earmarked for rent next week? How much is your
                          emergency buffer? The account balance alone doesn&apos;t
                          tell you. You end up spending money that was meant for
                          something else because it all looks like one big number.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5">
                        <span className="text-emerald-500 text-xs font-bold">&#10003;</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">
                          The fund-first approach (what Ledgera does)
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          &ldquo;I have $2,500 in Working Capital, $1,000 in my
                          Emergency Fund.&rdquo; Now you know exactly what&apos;s
                          available to spend and what&apos;s off-limits.
                          The fact that both happen to sit in the same DBS account
                          doesn&apos;t matter &mdash; they have different jobs.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/10 bg-background/60 p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Think of it this way:</strong>{" "}
                      accounts are just containers. They don&apos;t have opinions.
                      A bank account doesn&apos;t know if the money in it is for
                      groceries or retirement. Funds are the ones with purpose.
                      They define your financial behavior &mdash; how much you
                      spend, how much you save, what you&apos;re building toward.
                      That&apos;s why every report, every chart, and every
                      decision in Ledgera starts with{" "}
                      <strong className="text-foreground">
                        which fund
                      </strong>
                      , not which account.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Model vs Optimize ── */}
            <section id="model-vs-optimize" className="mb-20 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm">
                  <Gauge className="h-4 w-4" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Model vs Optimize
                </h2>
              </div>
              <p className="text-muted-foreground mb-8 ml-12">
                The two ways to run your Working Capital
              </p>

              <p className="text-muted-foreground leading-relaxed mb-6">
                Your Working Capital fund is the money you live on each month
                &mdash; rent, groceries, bills, everything. Ledgera gives you
                two ways to decide how much goes into it. Think of them as two
                philosophies:
              </p>

              {/* Two-mode comparison */}
              <div className="grid gap-5 md:grid-cols-2 mb-8">
                {/* MODEL mode */}
                <div className="group rounded-xl border border-violet-500/20 bg-gradient-to-b from-violet-500/[0.06] to-transparent p-6 transition-all hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                      <Lock className="h-4 w-4 text-violet-500" />
                    </div>
                    <h3 className="font-bold text-lg">Model Mode</h3>
                  </div>
                  <p className="text-xs font-medium text-violet-500 mb-4 ml-[42px]">
                    &ldquo;I know what I need&rdquo;
                  </p>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    You tell Ledgera a{" "}
                    <strong className="text-foreground">
                      fixed amount
                    </strong>{" "}
                    for your monthly expenses. Every month, that exact amount
                    goes to Working Capital. The rest goes to your savings and
                    investment funds.
                  </p>

                  <div className="rounded-lg border border-violet-500/10 bg-background/60 p-4 mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Example
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Income</span>
                        <span className="font-medium">$5,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          WC (fixed model)
                        </span>
                        <span className="font-semibold text-violet-600 dark:text-violet-400">
                          $2,800
                        </span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Left for savings
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          $2,200
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                      <span>Predictable &mdash; same amount every month</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                      <span>Simple &mdash; no calculation needed</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                      <span>
                        Best when your expenses are steady and you just want
                        a fixed number
                      </span>
                    </div>
                  </div>
                </div>

                {/* OPTIMIZE mode */}
                <div className="group rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent p-6 transition-all hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                      <Wrench className="h-4 w-4 text-amber-500" />
                    </div>
                    <h3 className="font-bold text-lg">Optimize Mode</h3>
                  </div>
                  <p className="text-xs font-medium text-amber-500 mb-4 ml-[42px]">
                    &ldquo;Maximize my savings automatically&rdquo;
                  </p>

                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Ledgera looks at what you{" "}
                    <strong className="text-foreground">
                      actually spent
                    </strong>{" "}
                    and gives Working Capital only what it needs. If you
                    underspent, the surplus gets swept into savings. If you
                    overspent, it covers the shortfall first.
                  </p>

                  <div className="rounded-lg border border-amber-500/10 bg-background/60 p-4 mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Example
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Income</span>
                        <span className="font-medium">$5,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Actually spent
                        </span>
                        <span className="font-medium">$2,400</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          WC (optimized)
                        </span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          $2,400
                        </span>
                      </div>
                      <Separator className="my-1" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Swept to savings
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          $2,600
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-amber-500/10">
                      You budgeted $2,800 but only spent $2,400. The extra
                      $400 automatically goes to savings instead of sitting
                      idle.
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span>
                        Adaptive &mdash; adjusts to your real spending
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span>
                        Maximizes savings &mdash; unused money doesn&apos;t
                        just sit there
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                      <span>
                        Best when your expenses vary and you want to save as
                        much as possible
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* How the comparison works */}
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <h3 className="font-bold mb-2 text-base">
                  How the comparison works
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  Whichever mode you pick, the magic happens at the end of the
                  month when you compare your model to reality:
                </p>

                <div className="rounded-xl border bg-muted/30 p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                      <Eye className="h-3 w-3 text-primary" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      End-of-month check
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Scenario: on track */}
                    <div className="flex gap-4 items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5">
                        <span className="text-emerald-500 text-sm">&#10003;</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-0.5">
                          Spent less than planned
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Great &mdash; in Optimize mode, the extra
                          automatically goes to savings. In Model mode, it
                          stays in your WC balance for next month.
                        </p>
                      </div>
                    </div>

                    {/* Scenario: over */}
                    <div className="flex gap-4 items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 mt-0.5">
                        <span className="text-amber-500 text-sm">!</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-0.5">
                          Spent more than planned
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          No panic &mdash; Ledgera shows you exactly where you
                          went over, in which fund and which category. You can
                          either adjust your model for next month or try to
                          tighten spending.
                        </p>
                      </div>
                    </div>

                    {/* Scenario: rebalance */}
                    <div className="flex gap-4 items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 mt-0.5">
                        <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-0.5">
                          Accounts are out of balance
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          The Fund Tracker tells you exactly which transfers
                          to make between your bank accounts to get everything
                          back in line. One click to see the list, then go
                          execute them in your real banking apps.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mt-6">
                  Over time, you build an increasingly accurate model of your
                  financial life. Month 1 might be a rough guess. By month 6,
                  your model is dialed in and you&apos;re saving more than
                  you thought possible &mdash; because you&apos;re not
                  guessing anymore.
                </p>
              </div>
            </section>

            {/* ── Feature sections ── */}
            {sections.map((section, sectionIdx) => {
              const Icon = section.icon
              return (
                <section
                  key={section.id}
                  id={section.id}
                  className="mb-20 scroll-mt-20"
                >
                  {/* Section header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${section.accent} text-white shadow-sm`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">
                        {section.title}
                      </h2>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-8 ml-12">
                    {section.subtitle}
                  </p>

                  {/* Content items */}
                  <div className="space-y-5">
                    {section.content.map((item, i) => (
                      <div
                        key={i}
                        className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-sm"
                      >
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                            {i + 1}
                          </div>
                          {item.heading.replace(/^\d+\.\s*/, "")}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed text-[15px] ml-7">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {sectionIdx < sections.length - 1 && (
                    <Separator className="mt-16" />
                  )}
                </section>
              )
            })}

            {/* ── Key Concepts ── */}
            <section id="concepts" className="mb-20 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Key Concepts
                </h2>
              </div>
              <p className="text-muted-foreground mb-8 ml-12">
                Terms you&apos;ll see throughout the app
              </p>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {concepts.map((c) => {
                  const CIcon = c.icon
                  return (
                    <div
                      key={c.term}
                      className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-primary/10">
                          <CIcon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                        </div>
                        <p className="font-semibold">{c.term}</p>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {c.definition}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Monthly Workflow ── */}
            <section id="workflow" className="mb-20 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  A Typical Monthly Workflow
                </h2>
              </div>
              <p className="text-muted-foreground mb-10 ml-12">
                Five steps, every month
              </p>

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[18px] top-3 bottom-3 w-px wiki-timeline-line hidden sm:block" />

                <div className="space-y-6">
                  {workflowSteps.map((step, i) => (
                    <div key={i} className="flex gap-5 items-start">
                      {/* Dot */}
                      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-background text-sm font-bold text-primary shadow-sm">
                        {i + 1}
                      </div>
                      {/* Content */}
                      <div className="pt-1 pb-2">
                        <h3 className="font-semibold mb-1">{step.title}</h3>
                        <p className="text-muted-foreground text-[15px] leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── About the Developer ── */}
            <section id="about" className="mb-20 scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  About the Developer
                </h2>
              </div>
              <p className="text-muted-foreground mb-8 ml-12">
                The story behind Ledgera
              </p>

              {/* Developer card */}
              <div className="relative rounded-2xl border overflow-hidden">
                {/* Gradient top strip */}
                <div className="h-1 bg-gradient-to-r from-violet-500 via-primary to-sky-500" />

                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xl font-bold text-primary">
                      AD
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Arjun Doshi</h3>
                      <p className="text-sm text-muted-foreground">
                        Software Engineer &amp; Creator of Ledgera
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">
                      The Problem
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Every personal finance app out there does the same thing:
                      it looks backward. You spend money, then you categorize
                      it, then you feel bad about it. Budgeting apps tell you
                      what you already did. Robo-advisors tell you what to
                      invest in but don&apos;t care about the rest of your
                      financial life. Spreadsheets can do anything but
                      they&apos;re fragile, manual, and nobody else can use
                      yours.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">
                      The Idea
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      What if you could treat your personal finances the way a
                      portfolio manager treats a fund? Allocate income the
                      moment it arrives. Model the future with real assumptions.
                      Run a monthly control loop: plan, execute, compare,
                      adjust. That&apos;s what Ledgera does. It&apos;s not an
                      expense tracker with charts. It&apos;s an allocation
                      engine with a built-in feedback loop.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                      What Makes It Different
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          icon: TrendingUp,
                          title: "Forward-looking by design",
                          desc: "Projections and allocations come first. Tracking is just the feedback mechanism.",
                        },
                        {
                          icon: Globe,
                          title: "Multi-currency from day one",
                          desc: "Built for people who earn, spend, and invest across borders.",
                        },
                        {
                          icon: Settings,
                          title: "You own the rules",
                          desc: "No black-box recommendations. You decide how your money flows.",
                        },
                        {
                          icon: Zap,
                          title: "Built for real life",
                          desc: "Handles multiple bank accounts, credit cards, currencies, and changing plans.",
                        },
                      ].map((d) => (
                        <div
                          key={d.title}
                          className="rounded-lg border border-border/50 bg-muted/30 p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <d.icon className="h-4 w-4 text-primary" />
                            <p className="font-semibold text-sm">{d.title}</p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {d.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">
                      Built With
                    </h4>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Ledgera is a full-stack application built from scratch
                      &mdash; a Next.js frontend, a FastAPI backend, and a
                      double-entry accounting engine under the hood. Every
                      feature, from the projection engine to the fund
                      rebalancing suggestions, was designed and implemented by
                      Arjun to solve problems he personally ran into while
                      managing finances across multiple countries and currencies.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Next.js",
                        "React",
                        "TypeScript",
                        "FastAPI",
                        "Python",
                        "SQLAlchemy",
                        "PostgreSQL",
                        "Tailwind CSS",
                        "Recharts",
                      ].map((tech) => (
                        <Badge
                          key={tech}
                          variant="secondary"
                          className="text-xs font-medium"
                        >
                          <Code2 className="h-3 w-3 mr-1" />
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ── CTA ── */}
        <section className="relative border-t overflow-hidden">
          <div className="absolute inset-0 wiki-grid-pattern opacity-30" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative mx-auto max-w-4xl px-4 py-24 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Ready to take control of your finances?
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Set up your workspace in a few minutes and start allocating.
            </p>
            <Button size="lg" className="mt-8 h-12 px-8 text-base" asChild>
              <Link href="/login?tab=signup">
                Get Started Free
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
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
