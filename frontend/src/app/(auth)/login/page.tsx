"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form"

export default function LoginPage() {
  const [tab, setTab] = useState("login")

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Ledgera</CardTitle>
        <CardDescription>Personal finance &amp; double-entry accounting</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
