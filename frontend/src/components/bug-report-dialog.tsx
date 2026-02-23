"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { submitBugReport } from "@/lib/api"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES = 5
const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,video/mp4,video/webm,video/quicktime"

interface BugReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  function addFiles(newFiles: File[]) {
    for (const f of newFiles) {
      if (f.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${f.name} exceeds 5 MB limit`,
        })
        return
      }
    }
    setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    addFiles(Array.from(e.target.files))
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function resetForm() {
    setTitle("")
    setDescription("")
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Title and description are required",
      })
      return
    }

    setSubmitting(true)
    try {
      await submitBugReport(title.trim(), description.trim(), files)
      toast({
        title: "Bug report submitted",
        description: "Thank you! We'll review your report and notify you when it's resolved.",
      })
      resetForm()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to submit bug report",
        description: err.message || "Something went wrong",
      })
    } finally {
      setSubmitting(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Help us improve Ledgera by reporting issues you encounter.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bug-title">Title</Label>
            <Input
              id="bug-title"
              placeholder="Brief summary of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bug-description">Description</Label>
            <textarea
              id="bug-description"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Steps to reproduce, expected behavior, what happened instead..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label>Screenshots / Media (optional)</Label>
            <div
              className="border-2 border-dashed rounded-md p-4 text-center text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              Click or drag files here (PNG, JPG, GIF, MP4 &mdash; max 5 MB each, up to {MAX_FILES} files)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-xs"
                  >
                    <span className="truncate max-w-[150px]">{f.name}</span>
                    <span className="text-muted-foreground">
                      ({(f.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-destructive hover:text-destructive/80 ml-1"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
