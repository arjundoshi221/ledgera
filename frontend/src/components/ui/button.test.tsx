import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"

describe("Button", () => {
  it("renders its children inside a real <button> element", () => {
    render(<Button>Save transaction</Button>)

    const btn = screen.getByRole("button", { name: "Save transaction" })
    expect(btn).toBeInTheDocument()
    expect(btn.tagName).toBe("BUTTON")
  })

  it("forwards disabled prop to the underlying element", () => {
    render(<Button disabled>Locked</Button>)

    expect(screen.getByRole("button", { name: "Locked" })).toBeDisabled()
  })
})
