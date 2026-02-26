"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { signup } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { COUNTRIES, PHONE_CODES, searchCountries, getCountryName } from "@/lib/countries"
import { CURRENCIES } from "@/lib/constants"
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react"

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex ml-1 align-middle text-muted-foreground hover:text-foreground transition-colors">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function CountryMultiSelect({
  label,
  selected,
  onChange,
  required = false,
  infoTip,
}: {
  label: string
  selected: string[]
  onChange: (codes: string[]) => void
  required?: boolean
  infoTip?: string
}) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const filtered = search ? searchCountries(search) : COUNTRIES

  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code))
    } else {
      onChange([...selected, code])
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
        {infoTip && <InfoTip text={infoTip} />}
      </Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((code) => (
            <Badge key={code} variant="secondary" className="text-xs">
              {getCountryName(code)}
              <button
                type="button"
                className="ml-1 hover:text-destructive"
                onClick={() => onChange(selected.filter((c) => c !== code))}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-sm font-normal"
        onClick={() => setOpen(!open)}
      >
        {selected.length === 0
          ? "Select countries..."
          : `${selected.length} selected`}
      </Button>
      {open && (
        <div className="border rounded-md p-2 space-y-2">
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filtered.slice(0, 50).map((country) => (
              <label
                key={country.code}
                className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(country.code)}
                  onChange={() => toggle(country.code)}
                  className="rounded"
                />
                <span>{country.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {country.code}
                </span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No matches
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const STEPS = [
  { label: "Account", number: 1 },
  { label: "Personal", number: 2 },
  { label: "Address", number: 3 },
  { label: "Terms", number: 4 },
]

interface SignupFormProps {
  onSuccess: () => void
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [nationalities, setNationalities] = useState<string[]>([])
  const [taxResidencies, setTaxResidencies] = useState<string[]>([])
  const [countriesOfInterest, setCountriesOfInterest] = useState<string[]>([])
  const [phoneCountryCode, setPhoneCountryCode] = useState("+65")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [addressCity, setAddressCity] = useState("")
  const [addressState, setAddressState] = useState("")
  const [addressPostalCode, setAddressPostalCode] = useState("")
  const [addressCountry, setAddressCountry] = useState("")
  const [taxIdNumber, setTaxIdNumber] = useState("")
  const [baseCurrency, setBaseCurrency] = useState("USD")
  const [tosAccepted, setTosAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  function computeAge(dobStr: string): number {
    const dob = new Date(dobStr)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    return age
  }

  function validateStep(): boolean {
    if (step === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        toast({ variant: "destructive", title: "First and last name are required" })
        return false
      }
      if (!email.trim()) {
        toast({ variant: "destructive", title: "Email is required" })
        return false
      }
      if (password.length < 8) {
        toast({ variant: "destructive", title: "Password must be at least 8 characters" })
        return false
      }
    }
    if (step === 2) {
      if (!dateOfBirth) {
        toast({ variant: "destructive", title: "Date of birth is required" })
        return false
      }
      if (computeAge(dateOfBirth) < 18) {
        toast({ variant: "destructive", title: "You must be at least 18 years old" })
        return false
      }
      if (!phoneNumber.trim()) {
        toast({ variant: "destructive", title: "Phone number is required" })
        return false
      }
      if (nationalities.length === 0) {
        toast({ variant: "destructive", title: "At least one nationality is required" })
        return false
      }
      if (taxResidencies.length === 0) {
        toast({ variant: "destructive", title: "At least one tax residency is required" })
        return false
      }
    }
    if (step === 3) {
      if (!addressLine1.trim()) {
        toast({ variant: "destructive", title: "Address line 1 is required" })
        return false
      }
      if (!addressCity.trim()) {
        toast({ variant: "destructive", title: "City is required" })
        return false
      }
      if (!addressPostalCode.trim()) {
        toast({ variant: "destructive", title: "Postal code is required" })
        return false
      }
    }
    if (step === 4) {
      if (!tosAccepted) {
        toast({ variant: "destructive", title: "You must accept the Terms of Service" })
        return false
      }
      if (!privacyAccepted) {
        toast({ variant: "destructive", title: "You must accept the Privacy Policy" })
        return false
      }
    }
    return true
  }

  function handleNext() {
    if (validateStep()) {
      setStep(step + 1)
    }
  }

  function handleBack() {
    setStep(step - 1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep()) return

    setLoading(true)
    try {
      await signup({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        nationalities,
        tax_residencies: taxResidencies,
        countries_of_interest: countriesOfInterest,
        phone_country_code: phoneCountryCode,
        phone_number: phoneNumber,
        address_line1: addressLine1,
        address_line2: addressLine2,
        address_city: addressCity,
        address_state: addressState,
        address_postal_code: addressPostalCode,
        address_country: addressCountry,
        tax_id_number: taxIdNumber,
        is_us_person: false,
        tos_accepted: tosAccepted,
        privacy_accepted: privacyAccepted,
        base_currency: baseCurrency,
      })
      toast({
        title: "Account created",
        description: "You can now sign in.",
      })
      onSuccess()
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: err.message || "Could not create account",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <form onSubmit={handleSubmit} className="space-y-6 pt-4">
        {/* Step indicator */}
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s) => (
            <div key={s.number} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  step > s.number
                    ? "bg-primary text-primary-foreground"
                    : step === s.number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.number ? <Check className="h-4 w-4" /> : s.number}
              </div>
              <span
                className={`text-xs ${
                  step >= s.number ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Account */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create your credentials to get started.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="signup-first">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="signup-first"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-last">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="signup-last"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="Min 8 chars, upper + lower + digit"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
        )}

        {/* Step 2: Personal */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This helps us tailor projections and allocation models to your situation.
            </p>

            <div className="space-y-2">
              <Label htmlFor="signup-dob">
                Date of Birth <span className="text-destructive">*</span>
                <InfoTip text="Used to calculate age-based financial milestones and retirement projections." />
              </Label>
              <Input
                id="signup-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>
                Phone Number <span className="text-destructive">*</span>
                <InfoTip text="Used for multi-factor authentication (MFA). We'll send verification codes to this number to secure your account." />
              </Label>
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_CODES.map((p) => (
                      <SelectItem key={p.code} value={p.dial}>
                        {p.dial} {p.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  placeholder="Phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <CountryMultiSelect
              label="Nationalities / Citizenships"
              selected={nationalities}
              onChange={setNationalities}
              required
              infoTip="Which passports do you hold? This determines tax treaty eligibility and cross-border financial planning options."
            />

            <CountryMultiSelect
              label="Tax Residencies"
              selected={taxResidencies}
              onChange={setTaxResidencies}
              required
              infoTip="Where are you tax-resident? Ledgera uses this to model tax brackets, obligations, and optimize your allocation structure."
            />
          </div>
        )}

        {/* Step 3: Address & Preferences */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Used for tax calculations and regulatory compliance.
            </p>

            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Address <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Address line 1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                required
              />
              <Input
                placeholder="Address line 2 (optional)"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="City"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  required
                />
                <Input
                  placeholder="State / Province"
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Postal code"
                  value={addressPostalCode}
                  onChange={(e) => setAddressPostalCode(e.target.value)}
                  required
                />
                <Select
                  value={addressCountry || "__all__"}
                  onValueChange={(v) => setAddressCountry(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Select country</SelectItem>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-tin">
                Tax Identification Number (optional)
                <InfoTip text="Optional. Stored securely for your records and export reports only." />
              </Label>
              <Input
                id="signup-tin"
                placeholder="TIN / SSN / Tax ID"
                value={taxIdNumber}
                onChange={(e) => setTaxIdNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-base-currency">
                Base Currency <span className="text-destructive">*</span>
                <InfoTip text="Your primary reporting currency. All projections and portfolio values will be converted to this currency." />
              </Label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger id="signup-base-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((ccy) => (
                    <SelectItem key={ccy} value={ccy}>
                      {ccy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CountryMultiSelect
              label="Countries of Interest"
              selected={countriesOfInterest}
              onChange={setCountriesOfInterest}
              infoTip="Countries you may relocate to or invest in. Helps Ledgera surface relevant tax and FX considerations."
            />
          </div>
        )}

        {/* Step 4: Terms */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review and accept the terms below to create your account.
            </p>
            <div className="space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="rounded mt-0.5"
                />
                <span className="text-sm">
                  I agree to the Terms of Service <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="rounded mt-0.5"
                />
                <span className="text-sm">
                  I agree to the Privacy Policy <span className="text-destructive">*</span>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" className="flex-1" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button type="button" className="flex-1" onClick={handleNext}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          )}
        </div>
      </form>
    </TooltipProvider>
  )
}
