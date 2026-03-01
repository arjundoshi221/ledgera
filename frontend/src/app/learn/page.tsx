"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  HelpCircle,
  Lightbulb,
  Target,
  Eye,
  RefreshCw,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowDownToLine,
} from "lucide-react"

/* ── story data ────────────────────────────────────────────────── */

const SALARY = 5_000
const WC_PCT = 50
const INVEST_PCT = 20
const EMERGENCY_PCT = 15
const TRAVEL_PCT = 15

export default function LearnPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Ledgera
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/wiki">Guide</Link>
            </Button>
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
          <div className="absolute inset-0 wiki-grid-pattern opacity-40" />
          <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-violet-500/[0.03] blur-3xl" />

          <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
            <Link
              href="/wiki"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to guide
            </Link>

            <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between md:gap-16">
              {/* Text side */}
              <div className="text-center md:text-left max-w-xl">
                <Badge
                  variant="secondary"
                  className="gap-1.5 px-3 py-1 text-xs font-medium mb-6"
                >
                  <Sparkles className="h-3 w-3" />
                  A story about your money
                </Badge>

                <h1 className="text-4xl font-bold tracking-tight md:text-6xl wiki-gradient-text pb-1">
                  Meet Ledge.
                </h1>
                <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                  He makes good money. He just doesn&apos;t know where it all
                  goes. Follow his journey from &ldquo;I think I&apos;m doing
                  okay&rdquo; to actually knowing.
                </p>

                <div className="mt-8 flex items-center gap-3 justify-center md:justify-start">
                  <div className="flex items-center gap-2 rounded-full border bg-card/50 px-4 py-2">
                    <LedgeAvatar className="h-6 w-6" />
                    <span className="text-sm text-muted-foreground">
                      8 chapters
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    &middot; 5 min read
                  </div>
                </div>
              </div>

              {/* Character side */}
              <div className="learn-float w-52 md:w-64 shrink-0">
                <div className="relative">
                  {/* Soft glow behind character */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400/10 to-violet-400/10 blur-2xl scale-110" />
                  <LedgeCharacter className="relative w-full h-auto drop-shadow-lg" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Story content ── */}
        <div className="mx-auto max-w-3xl px-4 py-16">
          {/* ─── Chapter 1: The Paycheck ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={1}
              title="The Paycheck"
              subtitle="Ledge gets paid. Now what?"
            />

            <StoryText>
              Ledge is a software engineer. He earns{" "}
              <Strong>${SALARY.toLocaleString()}</Strong> a month, after tax.
              Not bad. He&apos;s been working for a couple of years, pays his
              rent, eats out sometimes, puts a little into investments when he
              remembers.
            </StoryText>

            <StoryText>
              Payday hits. He checks his bank account.
            </StoryText>

            {/* Bank balance visual */}
            <div className="my-8 rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                  <Banknote className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    DBS Savings Account
                  </p>
                  <p className="text-2xl font-bold">$12,340</p>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-start gap-3">
                  <LedgeAvatar className="h-8 w-8 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ledge looks at this number and thinks:{" "}
                    <em className="text-foreground">
                      &ldquo;Cool, I have twelve grand. I can spend
                      freely.&rdquo;
                    </em>
                  </p>
                </div>
              </div>
            </div>

            <StoryText>
              But can he? That $12,340 includes last month&apos;s rent he
              hasn&apos;t paid yet. It includes the emergency money he promised
              himself he&apos;d never touch. It includes the investments he
              keeps meaning to make. It&apos;s all in one number, and that
              number is lying to him.
            </StoryText>

            <Callout icon={AlertCircle} color="red">
              The problem isn&apos;t that Ledge doesn&apos;t earn enough.
              It&apos;s that his bank account shows him a single number with
              no context. He can&apos;t tell what&apos;s spendable and
              what&apos;s spoken for.
            </Callout>
          </section>

          {/* ─── Chapter 2: The Shift ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={2}
              title="The Shift"
              subtitle="What if money had labels?"
            />

            <StoryText>
              Ledge signs up for Ledgera. The first thing he does is create
              his accounts &mdash; just mirrors of his real bank accounts. His
              DBS savings. His Schwab brokerage. His credit card.
            </StoryText>

            <StoryText>
              Then comes the part that changes everything. Ledgera asks him:{" "}
              <Strong>
                &ldquo;What do you use your money for?&rdquo;
              </Strong>
            </StoryText>

            <StoryText>
              Not &ldquo;where is your money?&rdquo; &mdash; he already knows
              that. But what is it <em>for</em>? Ledge creates four funds:
            </StoryText>

            {/* Funds creation visual */}
            <div className="my-8 space-y-3">
              {[
                {
                  emoji: "🏠",
                  name: "Working Capital",
                  desc: "Rent, food, bills, daily life",
                  pct: WC_PCT,
                  color: "violet",
                },
                {
                  emoji: "📈",
                  name: "Investments",
                  desc: "Long-term growth",
                  pct: INVEST_PCT,
                  color: "emerald",
                },
                {
                  emoji: "🛡️",
                  name: "Emergency Fund",
                  desc: "Don't touch unless it's real",
                  pct: EMERGENCY_PCT,
                  color: "blue",
                },
                {
                  emoji: "✈️",
                  name: "Travel",
                  desc: "Japan trip next year",
                  pct: TRAVEL_PCT,
                  color: "amber",
                },
              ].map((fund) => (
                <div
                  key={fund.name}
                  className="flex items-center justify-between rounded-xl border bg-card px-5 py-4 transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{fund.emoji}</span>
                    <div>
                      <p className="font-semibold text-sm">{fund.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fund.desc}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {fund.pct}%
                  </Badge>
                </div>
              ))}
            </div>

            <StoryText>
              Now look at that same $12,340 through Ledge&apos;s new lens:
            </StoryText>

            {/* Reframed balance */}
            <div className="my-8 rounded-xl border bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Same bank account, but now with meaning
              </p>
              <div className="space-y-2">
                {[
                  {
                    label: "🏠 Working Capital",
                    amt: "$6,170",
                    note: "spendable",
                    color: "text-foreground",
                  },
                  {
                    label: "📈 Investments",
                    amt: "$2,468",
                    note: "move to brokerage",
                    color: "text-emerald-600 dark:text-emerald-400",
                  },
                  {
                    label: "🛡️ Emergency Fund",
                    amt: "$1,851",
                    note: "don't touch",
                    color: "text-blue-600 dark:text-blue-400",
                  },
                  {
                    label: "✈️ Travel",
                    amt: "$1,851",
                    note: "Japan fund",
                    color: "text-amber-600 dark:text-amber-400",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-sm"
                  >
                    <span>{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {row.note}
                      </span>
                      <span className={`font-semibold ${row.color}`}>
                        {row.amt}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-sm px-4">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">$12,340</span>
              </div>
            </div>

            <Callout icon={Lightbulb} color="primary">
              Same twelve grand. Same bank account. But now Ledge can see that
              only $6,170 is actually available to spend. The rest has a job.
              That single insight changes everything.
            </Callout>
          </section>

          {/* ─── Chapter 3: The Model ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={3}
              title="The Model"
              subtitle="Ledge decides where his money goes — before he spends it"
            />

            <StoryText>
              Next payday, Ledge&apos;s $5,000 salary hits. But this time,
              he&apos;s not guessing. He already told Ledgera how to split it:
            </StoryText>

            {/* Allocation flow */}
            <div className="my-8 rounded-xl border bg-card p-6">
              <div className="flex items-center justify-center mb-6">
                <div className="rounded-full border-2 border-primary/20 bg-primary/5 px-6 py-3">
                  <p className="text-xs text-muted-foreground">
                    Monthly salary
                  </p>
                  <p className="text-2xl font-bold text-center">$5,000</p>
                </div>
              </div>

              <div className="flex justify-center mb-4">
                <ArrowDownToLine className="h-5 w-5 text-muted-foreground/50" />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    emoji: "🏠",
                    name: "Working\nCapital",
                    amt: "$2,500",
                    pct: "50%",
                    border: "border-violet-500/20",
                    bg: "bg-violet-500/5",
                  },
                  {
                    emoji: "📈",
                    name: "Invest-\nments",
                    amt: "$1,000",
                    pct: "20%",
                    border: "border-emerald-500/20",
                    bg: "bg-emerald-500/5",
                  },
                  {
                    emoji: "🛡️",
                    name: "Emergency\nFund",
                    amt: "$750",
                    pct: "15%",
                    border: "border-blue-500/20",
                    bg: "bg-blue-500/5",
                  },
                  {
                    emoji: "✈️",
                    name: "Travel",
                    amt: "$750",
                    pct: "15%",
                    border: "border-amber-500/20",
                    bg: "bg-amber-500/5",
                  },
                ].map((f) => (
                  <div
                    key={f.name}
                    className={`rounded-lg border ${f.border} ${f.bg} p-4 text-center`}
                  >
                    <span className="text-lg">{f.emoji}</span>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line leading-tight">
                      {f.name}
                    </p>
                    <p className="text-lg font-bold mt-1">{f.amt}</p>
                    <p className="text-xs text-muted-foreground">{f.pct}</p>
                  </div>
                ))}
              </div>
            </div>

            <StoryText>
              That&apos;s it. Before Ledge buys a single coffee, every dollar
              already has a destination. He didn&apos;t &ldquo;budget&rdquo; in
              the traditional sense &mdash; he didn&apos;t list out every
              expense. He just decided the big picture:{" "}
              <Strong>
                half for living, half for the future.
              </Strong>
            </StoryText>

            <StoryText>
              This is the model. It&apos;s Ledge&apos;s plan for his money.
              Now he lives his life and sees what actually happens.
            </StoryText>
          </section>

          {/* ─── Chapter 4: Living It ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={4}
              title="Living It"
              subtitle="A month of real spending"
            />

            <StoryText>
              Over the next 30 days, Ledge lives normally. He logs his
              transactions as they happen &mdash; rent, groceries, a dinner
              out, his phone bill, a spontaneous weekend trip.
            </StoryText>

            {/* Transaction log visual */}
            <div className="my-8 rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/30">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ledge&apos;s March Transactions (sample)
                </p>
              </div>
              <div className="divide-y">
                {[
                  {
                    date: "Mar 1",
                    desc: "Rent",
                    fund: "🏠 WC",
                    amt: "-$1,400",
                  },
                  {
                    date: "Mar 3",
                    desc: "Groceries",
                    fund: "🏠 WC",
                    amt: "-$85",
                  },
                  {
                    date: "Mar 7",
                    desc: "Dinner with friends",
                    fund: "🏠 WC",
                    amt: "-$62",
                  },
                  {
                    date: "Mar 10",
                    desc: "Phone bill",
                    fund: "🏠 WC",
                    amt: "-$45",
                  },
                  {
                    date: "Mar 15",
                    desc: "Weekend trip (spontaneous!)",
                    fund: "✈️ Travel",
                    amt: "-$320",
                  },
                  {
                    date: "Mar 20",
                    desc: "More groceries",
                    fund: "🏠 WC",
                    amt: "-$70",
                  },
                  {
                    date: "Mar 25",
                    desc: "New headphones",
                    fund: "🏠 WC",
                    amt: "-$180",
                  },
                  {
                    date: "Mar 28",
                    desc: "Utilities",
                    fund: "🏠 WC",
                    amt: "-$120",
                  },
                ].map((tx, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-12">
                        {tx.date}
                      </span>
                      <span>{tx.desc}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium"
                      >
                        {tx.fund}
                      </Badge>
                      <span className="font-medium text-red-500 w-16 text-right">
                        {tx.amt}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <StoryText>
              Notice something? Every transaction is tagged to a fund. The
              groceries come from Working Capital. The spontaneous trip comes
              from Travel. Ledge doesn&apos;t just know <em>what</em> he
              spent &mdash; he knows <em>which bucket it came out of</em>.
            </StoryText>
          </section>

          {/* ─── Chapter 5: The Moment of Truth ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={5}
              title="The Moment of Truth"
              subtitle="Model vs reality — how did Ledge do?"
            />

            <StoryText>
              March ends. Ledge opens the Monthly Dashboard. Here&apos;s what
              he sees:
            </StoryText>

            {/* Comparison visual */}
            <div className="my-8 rounded-xl border bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-5">
                March Results
              </p>

              <div className="space-y-4">
                {/* WC */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">
                      🏠 Working Capital
                    </span>
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-500/30 text-xs"
                    >
                      Over by $62
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Model</p>
                      <p className="font-medium">$2,500</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Actual</p>
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        $2,562
                      </p>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: "102%" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Those headphones pushed him slightly over. Not a disaster.
                  </p>
                </div>

                {/* Travel */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">✈️ Travel</span>
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-500/30 text-xs"
                    >
                      Over by $320
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Monthly allocation
                      </p>
                      <p className="font-medium">$750</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Spent this month
                      </p>
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        $320
                      </p>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: "43%" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Used some of his travel fund early. The balance carries
                    forward &mdash; still building toward Japan.
                  </p>
                </div>

                {/* Investments & Emergency */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">📈 Investments</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      $1,000 allocated. Ready to transfer to brokerage.
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">🛡️ Emergency</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      $750 allocated. Untouched. Growing.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <StoryText>
              Before Ledgera, Ledge had no idea he overspent on daily expenses.
              The $62 would have just disappeared into the noise of a $12K
              balance. Now he can see it clearly. He can also see that his
              investments and emergency fund are on track &mdash; because the
              money was allocated <em>before</em> he started spending.
            </StoryText>

            <Callout icon={Target} color="primary">
              This is the whole point. You don&apos;t need perfect discipline.
              You need a model that shows you the gap between intention and
              reality. The gap is small and fixable. Without it, you&apos;re
              flying blind.
            </Callout>
          </section>

          {/* ─── Chapter 6: Getting Smarter ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={6}
              title="Getting Smarter"
              subtitle="Month 3 — Ledge discovers Optimize mode"
            />

            <StoryText>
              By month 3, Ledge has a pretty good sense of his spending
              patterns. He notices something: some months he spends $2,300.
              Other months $2,600. But his model gives Working Capital a flat
              $2,500 every time.
            </StoryText>

            <StoryText>
              He switches Working Capital to{" "}
              <Strong>Optimize mode</Strong>. Here&apos;s what changes:
            </StoryText>

            {/* Before/after comparison */}
            <div className="my-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-muted p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  Before (Model mode)
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WC budget</span>
                    <span className="font-medium">$2,500 (fixed)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Actually spent
                    </span>
                    <span className="font-medium">$2,300</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Unused in WC
                    </span>
                    <span className="font-medium text-muted-foreground">
                      $200 (just sits there)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      To savings
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      $2,500
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-4">
                  After (Optimize mode)
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WC budget</span>
                    <span className="font-medium">$2,300 (auto-adjusted)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Actually spent
                    </span>
                    <span className="font-medium">$2,300</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Unused in WC
                    </span>
                    <span className="font-medium text-muted-foreground">
                      $0 (swept out)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      To savings
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      $2,700 (+$200)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <StoryText>
              That $200 that used to sit idle in his expenses fund? Now it
              automatically goes to his investment and savings funds. Over a
              year, those small sweeps add up to{" "}
              <Strong>thousands of extra dollars saved</Strong> &mdash; without
              Ledge changing his lifestyle at all.
            </StoryText>

            <Callout icon={TrendingUp} color="emerald">
              Optimize mode doesn&apos;t ask Ledge to spend less. It just
              makes sure money that wasn&apos;t used doesn&apos;t sit
              around doing nothing. Every leftover dollar gets put to work.
            </Callout>
          </section>

          {/* ─── Chapter 7: The Rebalance ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={7}
              title="The Rebalance"
              subtitle="Making the real world match the plan"
            />

            <StoryText>
              There&apos;s one last piece. Ledge&apos;s funds say his Emergency
              Fund should have $4,500 by now. His Investments fund should have
              $6,000 in his brokerage. But all the money is still sitting in
              his DBS savings account.
            </StoryText>

            <StoryText>
              He opens the Fund Tracker. It tells him exactly what to do:
            </StoryText>

            {/* Transfer suggestions */}
            <div className="my-8 rounded-xl border bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Suggested transfers
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm flex-wrap">
                  <Badge
                    variant="outline"
                    className="border-blue-500/20 text-blue-600 dark:text-blue-400"
                  >
                    DBS Savings
                  </Badge>
                  <div className="flex items-center gap-1 text-muted-foreground/40">
                    <div className="h-px w-3 bg-current" />
                    <ArrowRight className="h-3 w-3" />
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  >
                    Schwab Brokerage
                  </Badge>
                  <span className="font-bold ml-auto">$3,000</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm flex-wrap">
                  <Badge
                    variant="outline"
                    className="border-blue-500/20 text-blue-600 dark:text-blue-400"
                  >
                    DBS Savings
                  </Badge>
                  <div className="flex items-center gap-1 text-muted-foreground/40">
                    <div className="h-px w-3 bg-current" />
                    <ArrowRight className="h-3 w-3" />
                  </div>
                  <Badge
                    variant="outline"
                    className="border-blue-500/20 text-blue-600 dark:text-blue-400"
                  >
                    DBS Fixed Deposit
                  </Badge>
                  <span className="font-bold ml-auto">$2,250</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Ledge logs into his banking apps, makes these two transfers,
                then confirms them in Ledgera. Done.
              </p>
            </div>

            <StoryText>
              Now his real bank accounts match his fund plan. His brokerage has
              the investment money. His savings has the emergency buffer and
              working capital. Everything is where it should be.
            </StoryText>
          </section>

          {/* ─── Chapter 8: The Loop ─── */}
          <section className="mb-20">
            <ChapterHeader
              number={8}
              title="The Loop"
              subtitle="Ledge's new monthly routine — 15 minutes"
            />

            <StoryText>
              Six months in, Ledge&apos;s routine looks like this:
            </StoryText>

            <div className="my-8 relative">
              <div className="absolute left-[18px] top-3 bottom-3 w-px wiki-timeline-line hidden sm:block" />
              <div className="space-y-5">
                {[
                  {
                    title: "Payday",
                    desc: "Salary arrives. Ledgera already knows the split. Nothing to do.",
                    icon: Banknote,
                  },
                  {
                    title: "During the month",
                    desc: "Log transactions as they happen. Takes 10 seconds each.",
                    icon: Eye,
                  },
                  {
                    title: "Month end",
                    desc: "Open Monthly Dashboard. See model vs actual. Notice patterns.",
                    icon: Target,
                  },
                  {
                    title: "Rebalance",
                    desc: "Check Fund Tracker. Make any suggested transfers. 5 minutes.",
                    icon: RefreshCw,
                  },
                  {
                    title: "Adjust",
                    desc: "Tweak next month's allocations if needed. Usually no changes.",
                    icon: TrendingUp,
                  },
                ].map((step, i) => (
                  <div key={i} className="flex gap-5 items-start">
                    <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-background shadow-sm">
                      <step.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="pt-1">
                      <h3 className="font-semibold text-sm mb-0.5">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <StoryText>
              That&apos;s it. No spreadsheets. No hour-long budget sessions.
              Just a quick check, a couple of taps, and Ledge knows exactly
              where he stands. His model gets more accurate each month. His
              savings grow on autopilot.
            </StoryText>
          </section>

          {/* ─── Epilogue ─── */}
          <section className="mb-16">
            <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] p-8 md:p-10 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary/5 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-primary/5 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <LedgeAvatar className="h-10 w-10" />
                  <div>
                    <h2 className="text-xl font-bold">
                      What changed for Ledge
                    </h2>
                    <p className="text-xs text-muted-foreground">Epilogue</p>
                  </div>
                </div>
                <div className="space-y-4 text-[15px] text-muted-foreground leading-relaxed">
                  <p>
                    Ledge didn&apos;t get a raise. He didn&apos;t cut out
                    coffee. He didn&apos;t install an app that yelled at him
                    for eating out.
                  </p>
                  <p>
                    He just started{" "}
                    <strong className="text-foreground">
                      deciding where his money goes before it gets spent
                    </strong>
                    , then checking if reality matched. That&apos;s it.
                  </p>
                  <p>
                    A year later, he&apos;s saved 30% more than the year before.
                    His emergency fund is fully built. His Japan trip is funded.
                    His investments are growing. And he still eats out with
                    friends every week.
                  </p>
                  <p className="text-lg text-foreground font-semibold mt-6 pt-4 border-t border-primary/10">
                    He didn&apos;t earn more. He just knew more.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* CTA */}
        <section className="relative border-t overflow-hidden">
          <div className="absolute inset-0 wiki-grid-pattern opacity-30" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative mx-auto max-w-3xl px-4 py-24 text-center">
            <div className="flex justify-center mb-4">
              <LedgeAvatar className="h-16 w-16" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Be like Ledge.
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Set up your model in 10 minutes. Know where every dollar goes.
            </p>
            <div className="flex items-center justify-center gap-3 mt-8">
              <Button size="lg" className="h-12 px-8 text-base" asChild>
                <Link href="/login?tab=signup">
                  Get Started Free
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="/wiki">
                  Read the full guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
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

/* ── sub-components ────────────────────────────────────────────── */

function ChapterHeader({
  number,
  title,
  subtitle,
}: {
  number: number
  title: string
  subtitle: string
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
        Chapter {number}
      </p>
      <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      <p className="text-muted-foreground mt-1">{subtitle}</p>
    </div>
  )
}

function StoryText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-muted-foreground leading-relaxed mb-5">
      {children}
    </p>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-foreground">{children}</strong>
}

function Callout({
  children,
  icon: Icon,
  color,
}: {
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  color: "primary" | "emerald" | "red"
}) {
  const colors = {
    primary: "border-primary/20 bg-primary/5 text-primary",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500",
    red: "border-red-500/20 bg-red-500/5 text-red-500",
  }
  const borderColor = colors[color].split(" ")[0]
  const bgColor = colors[color].split(" ")[1]
  const iconColor = colors[color].split(" ")[2]

  return (
    <div
      className={`my-8 rounded-xl border ${borderColor} ${bgColor} p-5`}
    >
      <div className="flex gap-3 items-start">
        <Icon className={`h-5 w-5 ${iconColor} mt-0.5 shrink-0`} />
        <p className="text-sm text-muted-foreground leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  )
}

/* ── Character illustrations ───────────────────────────────────── */

function LedgeCharacter({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 300" fill="none" className={className}>
      <defs>
        <linearGradient id="lc-skin" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#FBBE8A" />
          <stop offset="100%" stopColor="#E8A06C" />
        </linearGradient>
        <linearGradient id="lc-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3E2315" />
          <stop offset="100%" stopColor="#2A180E" />
        </linearGradient>
        <linearGradient id="lc-hoodie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="lc-hoodie-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7275E8" />
          <stop offset="100%" stopColor="#5558D8" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="100" cy="294" rx="48" ry="6" fill="#6366F1" opacity="0.08" />

      {/* ── Body ── */}
      <path
        d="M52 185 C52 158 76 148 100 148 C124 148 148 158 148 185 L150 275 C150 283 143 288 135 288 L65 288 C57 288 50 283 50 275Z"
        fill="url(#lc-hoodie)"
      />

      {/* Right arm (resting) */}
      <path d="M148 175 C162 182 170 205 166 232" stroke="url(#lc-hoodie)" strokeWidth="26" strokeLinecap="round" />
      <circle cx="166" cy="236" r="13" fill="url(#lc-skin)" />

      {/* Left arm (waving) */}
      <g className="learn-wave">
        <path d="M52 175 C34 166 22 148 28 126" stroke="url(#lc-hoodie)" strokeWidth="26" strokeLinecap="round" />
        <circle cx="30" cy="120" r="13" fill="url(#lc-skin)" />
        {/* Wave motion lines */}
        <path d="M10 108 Q5 103 10 98" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <path d="M4 114 Q-2 107 4 100" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      </g>

      {/* Hoodie V-neck */}
      <path d="M85 152 L100 170 L115 152" stroke="#A5B4FC" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      {/* Hoodie strings */}
      <line x1="93" y1="157" x2="90" y2="186" stroke="#A5B4FC" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="107" y1="157" x2="110" y2="186" stroke="#A5B4FC" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <circle cx="90" cy="188" r="2.5" fill="#A5B4FC" opacity="0.6" />
      <circle cx="110" cy="188" r="2.5" fill="#A5B4FC" opacity="0.6" />
      {/* Hoodie pocket */}
      <rect x="72" y="230" width="56" height="22" rx="8" fill="url(#lc-hoodie-d)" opacity="0.5" />

      {/* ── Neck ── */}
      <rect x="88" y="135" width="24" height="18" rx="6" fill="url(#lc-skin)" />

      {/* ── Head ── */}
      <ellipse cx="100" cy="82" rx="56" ry="60" fill="url(#lc-skin)" />

      {/* ── Hair ── */}
      <ellipse cx="100" cy="50" rx="58" ry="42" fill="url(#lc-hair)" />
      <path
        d="M42 72 C42 42 68 24 100 22 C132 24 158 42 158 72 C154 56 136 42 118 45 C106 47 102 55 96 52 C84 45 62 52 42 72Z"
        fill="url(#lc-hair)"
      />
      <path d="M44 72 C40 82 42 94 46 98" stroke="#2A180E" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M156 72 C160 82 158 94 154 98" stroke="#2A180E" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M70 38 C82 32 96 30 102 32" stroke="#4A3020" strokeWidth="2" strokeLinecap="round" opacity="0.35" />

      {/* ── Ears ── */}
      <ellipse cx="44" cy="90" rx="9" ry="13" fill="url(#lc-skin)" />
      <ellipse cx="44" cy="90" rx="5" ry="8" fill="#E09B6A" opacity="0.3" />
      <ellipse cx="156" cy="90" rx="9" ry="13" fill="url(#lc-skin)" />
      <ellipse cx="156" cy="90" rx="5" ry="8" fill="#E09B6A" opacity="0.3" />

      {/* ── Face ── */}
      {/* Eyes */}
      <ellipse cx="78" cy="88" rx="11" ry="12" fill="white" />
      <ellipse cx="122" cy="88" rx="11" ry="12" fill="white" />
      <ellipse cx="80" cy="90" rx="7" ry="8" fill="#1E1B2E" />
      <ellipse cx="124" cy="90" rx="7" ry="8" fill="#1E1B2E" />
      {/* Highlights */}
      <circle cx="83" cy="87" r="3" fill="white" opacity="0.85" />
      <circle cx="127" cy="87" r="3" fill="white" opacity="0.85" />
      <circle cx="78" cy="94" r="1.5" fill="white" opacity="0.4" />
      <circle cx="122" cy="94" r="1.5" fill="white" opacity="0.4" />

      {/* Eyebrows */}
      <path d="M64 74 C72 67 88 69 92 76" stroke="#2A180E" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M108 76 C112 69 128 67 136 74" stroke="#2A180E" strokeWidth="2.8" strokeLinecap="round" fill="none" />

      {/* Nose */}
      <path d="M98 98 C96 104 98 108 102 108 C105 108 106 104 104 98" fill="#E09B6A" opacity="0.4" />

      {/* Smile */}
      <path d="M82 114 C90 126 110 126 118 114" stroke="#C47D5E" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Cheek blush */}
      <ellipse cx="64" cy="108" rx="10" ry="6" fill="#F09090" opacity="0.22" />
      <ellipse cx="136" cy="108" rx="10" ry="6" fill="#F09090" opacity="0.22" />
    </svg>
  )
}

function LedgeAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="la-skin" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#FBBE8A" />
          <stop offset="100%" stopColor="#E8A06C" />
        </linearGradient>
        <linearGradient id="la-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3E2315" />
          <stop offset="100%" stopColor="#2A180E" />
        </linearGradient>
      </defs>

      {/* Background */}
      <circle cx="24" cy="24" r="23" className="fill-indigo-50 dark:fill-indigo-950/40" />

      {/* Head */}
      <ellipse cx="24" cy="27" rx="14" ry="15" fill="url(#la-skin)" />

      {/* Hair */}
      <ellipse cx="24" cy="17" rx="15" ry="11" fill="url(#la-hair)" />
      <path
        d="M9 24 C9 14 16 8 24 7 C32 8 39 14 39 24 C37 18 32 13 28 15 C24 16 23 19 21 17 C17 14 12 18 9 24Z"
        fill="url(#la-hair)"
      />

      {/* Ears */}
      <ellipse cx="10" cy="29" rx="2.5" ry="3.5" fill="url(#la-skin)" />
      <ellipse cx="38" cy="29" rx="2.5" ry="3.5" fill="url(#la-skin)" />

      {/* Eyes */}
      <ellipse cx="19" cy="28" rx="3.2" ry="3.5" fill="white" />
      <ellipse cx="29" cy="28" rx="3.2" ry="3.5" fill="white" />
      <circle cx="19.8" cy="28.5" r="2.2" fill="#1E1B2E" />
      <circle cx="29.8" cy="28.5" r="2.2" fill="#1E1B2E" />
      <circle cx="20.5" cy="27.5" r="0.9" fill="white" opacity="0.85" />
      <circle cx="30.5" cy="27.5" r="0.9" fill="white" opacity="0.85" />

      {/* Nose */}
      <circle cx="24" cy="32" r="1" fill="#E09B6A" opacity="0.4" />

      {/* Smile */}
      <path d="M20 34.5 C22 37 26 37 28 34.5" stroke="#C47D5E" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Cheeks */}
      <circle cx="15" cy="32" r="2.5" fill="#F09090" opacity="0.2" />
      <circle cx="33" cy="32" r="2.5" fill="#F09090" opacity="0.2" />
    </svg>
  )
}
