"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, firebaseLogin } from "@/lib/api"
import { setAuth } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"
import { signInWithEmailAndPassword } from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      let res

      try {
        // Try Firebase login first
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password)
        const idToken = await cred.user.getIdToken()
        res = await firebaseLogin({ id_token: idToken })
      } catch (fbErr: any) {
        // If Firebase fails (user not in Firebase), fall back to legacy login
        console.log("[Login] Firebase login failed, falling back to legacy:", fbErr.code)
        res = await login({ email, password })
      }

      setAuth(res.access_token, res.user_id, res.workspace_id, res.profile_completed, res.is_admin)

      if (res.profile_completed) {
        router.push("/dashboard")
      } else {
        router.push("/onboarding")
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: err.message || "Invalid credentials",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  )
}
