"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SaveScenarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string, description: string, setAsActive: boolean) => void
  saving: boolean
  defaultName?: string
  isUpdate?: boolean
}

export function SaveScenarioDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  defaultName = "",
  isUpdate = false,
}: SaveScenarioDialogProps) {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState("")
  const [setAsActive, setSetAsActive] = useState(true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(name, description, setAsActive)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update Simulation" : "Save Simulation"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Budget 2026"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Conservative scenario with 3% inflation"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="rounded"
            />
            Set as active budget benchmark
          </label>
          <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
            {saving ? "Saving..." : isUpdate ? "Update" : "Save Simulation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
