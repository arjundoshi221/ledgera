import { describe, it, expect } from "vitest"
import { ApiError } from "./api"

describe("ApiError", () => {
  it("parses structured {code, message} envelopes from AppError handler (B15)", () => {
    const err = new ApiError(422, {
      code: "validation_error",
      message: "Amount must be positive",
      field: "amount",
    })

    expect(err.name).toBe("ApiError")
    expect(err.status).toBe(422)
    expect(err.code).toBe("validation_error")
    expect(err.message).toBe("Amount must be positive")
    expect(err.extra).toEqual({ field: "amount" })
  })

  it("falls back to legacy {detail} shape from HTTPException responses", () => {
    const err = new ApiError(404, { detail: "Transaction not found" })

    expect(err.status).toBe(404)
    expect(err.message).toBe("Transaction not found")
    expect(err.code).toBeUndefined()
    expect(err.extra).toBeUndefined()
  })

  it("uses a generic message when body has no recognized shape", () => {
    const err = new ApiError(500, "internal server error")

    expect(err.status).toBe(500)
    expect(err.message).toBe("API error 500")
    expect(err.body).toBe("internal server error")
  })
})
