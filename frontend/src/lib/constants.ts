// ============================================================
// constants.ts - Shared constant values used across the frontend
// ============================================================

export const ACCOUNT_TYPES = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
] as const

export const CURRENCIES = [
  // Major
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "AUD",
  "CAD",
  "NZD",
  // Europe
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "TRY",
  // Middle East
  "AED",
  "SAR",
  "QAR",
  "KWD",
  "BHD",
  "OMR",
  "EGP",
  // Asia
  "SGD",
  "HKD",
  "CNY",
  "INR",
  "KRW",
  "MYR",
  "PHP",
  "THB",
  "TWD",
  "IDR",
  "VND",
  "PKR",
  "BDT",
  "LKR",
  "MMK",
  // Americas
  "BRL",
  "MXN",
  "CLP",
  "COP",
  "ARS",
  "PEN",
  // Africa
  "ZAR",
  "NGN",
  "KES",
  "GHS",
  // Crypto
  "BTC",
  "ETH",
] as const

export const TRANSACTION_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "cleared", label: "Cleared" },
  { value: "reconciled", label: "Reconciled" },
] as const

export const CARD_TYPES = [
  { value: "credit", label: "Credit" },
  { value: "debit", label: "Debit" },
] as const

export const CARD_NETWORKS = [
  // Global networks
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
  { value: "unionpay", label: "UnionPay" },
  { value: "discover", label: "Discover" },
  { value: "diners_club", label: "Diners Club" },
  { value: "jcb", label: "JCB" },
  { value: "maestro", label: "Maestro" },
  // Regional networks
  { value: "rupay", label: "RuPay (India)" },
  { value: "elo", label: "Elo (Brazil)" },
  { value: "mir", label: "Mir (Russia)" },
  { value: "bc_card", label: "BC Card (South Korea)" },
  { value: "troy", label: "Troy (Turkey)" },
  { value: "verve", label: "Verve (Nigeria)" },
  { value: "mada", label: "mada (Saudi Arabia)" },
  { value: "meeza", label: "Meeza (Egypt)" },
  { value: "napas", label: "NAPAS (Vietnam)" },
  { value: "nets", label: "NETS (Singapore)" },
  { value: "bancontact", label: "Bancontact (Belgium)" },
  { value: "dankort", label: "Dankort (Denmark)" },
  { value: "carte_bancaire", label: "Carte Bancaire (France)" },
  { value: "girocard", label: "Girocard (Germany)" },
  { value: "interac", label: "Interac (Canada)" },
  { value: "eftpos", label: "eftpos (Australia)" },
  // Other
  { value: "other", label: "Other" },
] as const

export const RECURRING_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const
