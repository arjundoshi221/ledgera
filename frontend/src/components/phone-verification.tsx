"use client"

import { useState, useCallback } from "react"
import { RecaptchaVerifier, PhoneAuthProvider, linkWithCredential } from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase"
import { updateVerification } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface PhoneVerificationProps {
  phoneNumber: string  // E.164 format, e.g. "+6591234567"
  onVerified: () => void
}

export function PhoneVerification({ phoneNumber, onVerified }: PhoneVerificationProps) {
  const [codeSent, setCodeSent] = useState(false)
  const [otp, setOtp] = useState("")
  const [verificationId, setVerificationId] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const sendCode = useCallback(async () => {
    setLoading(true)
    try {
      const recaptcha = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
        size: "invisible",
      })

      const provider = new PhoneAuthProvider(firebaseAuth)
      const vId = await provider.verifyPhoneNumber(phoneNumber, recaptcha)
      setVerificationId(vId)
      setCodeSent(true)
      toast({ title: "Code sent", description: `Verification code sent to ${phoneNumber}` })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to send code",
        description: err.message || "Could not send verification code",
      })
    } finally {
      setLoading(false)
    }
  }, [phoneNumber, toast])

  async function verifyCode() {
    if (!otp.trim()) return
    setLoading(true)
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp)
      const currentUser = firebaseAuth.currentUser
      if (currentUser) {
        // Link phone to existing Firebase account
        await linkWithCredential(currentUser, credential)
        const idToken = await currentUser.getIdToken(true)
        await updateVerification(idToken)
      }
      toast({ title: "Phone verified", description: "Your phone number has been verified." })
      onVerified()
    } catch (err: any) {
      const message = err.code === "auth/invalid-verification-code"
        ? "Invalid code. Please try again."
        : err.message || "Verification failed"
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div id="recaptcha-container" />
      {!codeSent ? (
        <div className="space-y-3">
          <Label>Phone Number</Label>
          <p className="text-sm text-muted-foreground">{phoneNumber}</p>
          <Button onClick={sendCode} disabled={loading} className="w-full">
            {loading ? "Sending..." : "Send verification code"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Label htmlFor="otp-input">Enter verification code</Label>
          <Input
            id="otp-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={6}
            autoFocus
          />
          <div className="flex gap-2">
            <Button onClick={verifyCode} disabled={loading || !otp.trim()} className="flex-1">
              {loading ? "Verifying..." : "Verify"}
            </Button>
            <Button variant="outline" onClick={sendCode} disabled={loading}>
              Resend
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
