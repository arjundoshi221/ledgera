"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { signup } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { COUNTRIES, PHONE_CODES, searchCountries, getCountryName } from "@/lib/countries"

function CountryMultiSelect({
  label,
  selected,
  onChange,
  required = false,
}: {
  label: string
  selected: string[]
  onChange: (codes: string[]) => void
  required?: boolean
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

interface SignupFormProps {
  onSuccess: () => void
}

export function SignupForm({ onSuccess }: SignupFormProps) {
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
  const [isUsPerson, setIsUsPerson] = useState(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (!dateOfBirth) {
      toast({ variant: "destructive", title: "Date of birth is required" })
      setLoading(false)
      return
    }
    if (computeAge(dateOfBirth) < 18) {
      toast({ variant: "destructive", title: "You must be at least 18 years old" })
      setLoading(false)
      return
    }
    if (nationalities.length === 0) {
      toast({ variant: "destructive", title: "At least one nationality is required" })
      setLoading(false)
      return
    }
    if (taxResidencies.length === 0) {
      toast({ variant: "destructive", title: "At least one tax residency is required" })
      setLoading(false)
      return
    }
    if (!tosAccepted) {
      toast({ variant: "destructive", title: "You must accept the Terms of Service" })
      setLoading(false)
      return
    }
    if (!privacyAccepted) {
      toast({ variant: "destructive", title: "You must accept the Privacy Policy" })
      setLoading(false)
      return
    }

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
        is_us_person: isUsPerson,
        tos_accepted: tosAccepted,
        privacy_accepted: privacyAccepted,
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
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      {/* Name */}
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

      {/* Email */}
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

      {/* Password */}
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

      {/* Date of Birth */}
      <div className="space-y-2">
        <Label htmlFor="signup-dob">
          Date of Birth <span className="text-destructive">*</span>
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

      {/* Phone */}
      <div className="space-y-2">
        <Label>
          Phone Number <span className="text-destructive">*</span>
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

      {/* Nationalities */}
      <CountryMultiSelect
        label="Nationalities / Citizenships"
        selected={nationalities}
        onChange={setNationalities}
        required
      />

      {/* Tax Residencies */}
      <CountryMultiSelect
        label="Tax Residencies"
        selected={taxResidencies}
        onChange={setTaxResidencies}
        required
      />

      {/* Countries of Interest */}
      <CountryMultiSelect
        label="Countries of Interest"
        selected={countriesOfInterest}
        onChange={setCountriesOfInterest}
      />

      {/* Address */}
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

      {/* Tax ID */}
      <div className="space-y-2">
        <Label htmlFor="signup-tin">Tax Identification Number (optional)</Label>
        <Input
          id="signup-tin"
          placeholder="TIN / SSN / Tax ID"
          value={taxIdNumber}
          onChange={(e) => setTaxIdNumber(e.target.value)}
        />
      </div>

      {/* US Person */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isUsPerson}
          onChange={(e) => setIsUsPerson(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm">
          I am a US Person (US citizen, green card holder, or US tax resident)
        </span>
      </label>

      {/* Consent */}
      <div className="space-y-3 border-t pt-4">
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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  )
}
