"use client"

import { Input } from "@/components/ui/input"
import type { Fund } from "@/lib/types"

interface FundAllocationEditorProps {
  funds: Fund[]
  weights: Record<string, number>
  returns: Record<string, number>
  onWeightsChange: (weights: Record<string, number>) => void
  onReturnsChange: (returns: Record<string, number>) => void
}

export function FundAllocationEditor({
  funds,
  weights,
  returns,
  onWeightsChange,
  onReturnsChange,
}: FundAllocationEditorProps) {
  const totalWeight = Object.values(weights).reduce((s, w) => s + (Number(w) || 0), 0)
  const isValid = Math.abs(totalWeight - 100) < 0.1

  if (funds.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No funds configured.{" "}
        <a href="/settings" className="underline">
          Create them in Settings
        </a>
        .
      </p>
    )
  }

  function updateWeight(fundName: string, value: string) {
    onWeightsChange({ ...weights, [fundName]: parseFloat(value) || 0 })
  }

  function updateReturn(fundName: string, value: string) {
    onReturnsChange({ ...returns, [fundName]: parseFloat(value) || 0 })
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_70px_70px] gap-1 text-xs">
        <span className="text-muted-foreground font-medium">Fund</span>
        <span className="text-muted-foreground font-medium text-right">Weight%</span>
        <span className="text-muted-foreground font-medium text-right">Return%</span>
      </div>

      {funds.map((fund) => {
        const key = fund.name
        return (
          <div key={fund.id} className="grid grid-cols-[1fr_70px_70px] gap-1 items-center">
            <span className="text-xs truncate">
              {fund.emoji && <span className="mr-1">{fund.emoji}</span>}
              {fund.name}
            </span>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={weights[key] ?? 0}
              onChange={(e) => updateWeight(key, e.target.value)}
              className="h-7 text-xs text-right px-1"
            />
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={returns[key] ?? 0}
              onChange={(e) => updateReturn(key, e.target.value)}
              className="h-7 text-xs text-right px-1"
            />
          </div>
        )
      })}

      <div className={`text-xs font-medium text-right ${isValid ? "text-green-600" : "text-red-500"}`}>
        Total: {totalWeight.toFixed(1)}%
        {!isValid && <span className="ml-1">(must equal 100%)</span>}
      </div>
    </div>
  )
}
