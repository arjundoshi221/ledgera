"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { sendEmailVerification } from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase"
import { useVerificationStatus } from "@/lib/hooks"
import { AlertTriangle, CheckCircle2, Mail, Phone } from "lucide-react"

export function VerificationBanner() {
  const { data: status } = useVerificationStatus()
  const [resending, setResending] = useState(false)
  const { toast } = useToast()

  if (!status) return null
  // Only check email for now; phone verification requires Firebase Blaze plan
  if (status.email_verified) return null

  async function handleResendEmail() {
    setResending(true)
    try {
      const user = firebaseAuth.currentUser
      if (user) {
        await sendEmailVerification(user)
        toast({ title: "Email sent", description: "Verification email has been resent." })
      } else {
        toast({
          variant: "destructive",
          title: "Not signed in",
          description: "Please sign in again to resend verification email.",
        })
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not send email",
        description: err.message || "Please try again later.",
      })
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Complete your account verification
          </p>
          <div className="space-y-1">
            {!status.email_verified && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <Mail className="h-4 w-4" />
                  <span>Email not verified</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="h-7 text-xs"
                >
                  {resending ? "Sending..." : "Resend email"}
                </Button>
              </div>
            )}
            {status.email_verified && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>Email verified</span>
              </div>
            )}
            {/* TODO: Re-enable phone verification once Firebase Blaze plan is activated
            {!status.phone_verified && (
              <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <Phone className="h-4 w-4" />
                <span>Phone not verified — verify in Settings</span>
              </div>
            )}
            {status.phone_verified && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>Phone verified</span>
              </div>
            )}
            */}
          </div>
        </div>
      </div>
    </div>
  )
}
