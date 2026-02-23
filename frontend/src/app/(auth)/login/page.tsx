"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form"
import { TrendingUp, Globe, ShieldCheck, Sliders } from "lucide-react"

const highlights = [
  {
    icon: Sliders,
    text: "Structure income before you invest it",
  },
  {
    icon: TrendingUp,
    text: "Model your financial trajectory years ahead",
  },
  {
    icon: Globe,
    text: "Multi-currency, tax-aware, projection-first",
  },
  {
    icon: ShieldCheck,
    text: "Your rules. No black box.",
  },
]

function LoginContent() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get("tab") === "signup" ? "signup" : "login")

  return (
    <Card className="w-full max-w-4xl overflow-hidden">
      <div className="grid md:grid-cols-[2fr_3fr]">
        {/* Brand Panel — hidden on mobile */}
        <div className="hidden md:flex flex-col justify-between bg-primary text-primary-foreground p-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ledgera</h1>
            <p className="mt-1 text-sm text-primary-foreground/70">
              Projection-driven personal finance
            </p>
          </div>

          <div>
            <p className="text-xl font-semibold leading-snug">
              Allocation is
              <br />
              the strategy.
            </p>
            <div className="mt-6 space-y-4">
              {highlights.map((h) => (
                <div key={h.text} className="flex items-start gap-3">
                  <h.icon className="h-4 w-4 mt-0.5 shrink-0 text-primary-foreground/70" />
                  <p className="text-sm text-primary-foreground/80">{h.text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-primary-foreground/50">
            &copy; {new Date().getFullYear()} Ledgera
          </p>
        </div>

        {/* Form Panel */}
        <div className="p-6 sm:p-8">
          {/* Mobile-only header */}
          <div className="mb-6 text-center md:hidden">
            <h1 className="text-2xl font-bold">Ledgera</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Allocation is the strategy.
            </p>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup">
              <SignupForm onSuccess={() => setTab("login")} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
