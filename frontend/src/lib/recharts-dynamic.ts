"use client"

import dynamic from "next/dynamic"
import type { ComponentProps, ComponentType } from "react"
import type * as Recharts from "recharts"

// ssr: false because Recharts uses DOM APIs (SVG measurement) that break during
// server render. next/dynamic then emits a separate async chunk so non-chart
// pages don't ship the ~150-200KB Recharts + D3 payload.
//
// Each export is cast to ComponentType<ComponentProps<...>> because Recharts'
// legacy defaultProps declarations widen string-literal unions (e.g. "linear"
// -> string), which breaks next/dynamic's stricter Props inference. The cast
// preserves the public prop types consumers see while sidestepping the internal
// defaultProps mismatch.

export const AreaChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.AreaChart as ComponentType<ComponentProps<typeof Recharts.AreaChart>> })),
  { ssr: false }
)
export const Area = dynamic(
  () => import("recharts").then((m) => ({ default: m.Area as ComponentType<ComponentProps<typeof Recharts.Area>> })),
  { ssr: false }
)
export const BarChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.BarChart as ComponentType<ComponentProps<typeof Recharts.BarChart>> })),
  { ssr: false }
)
export const Bar = dynamic(
  () => import("recharts").then((m) => ({ default: m.Bar as ComponentType<ComponentProps<typeof Recharts.Bar>> })),
  { ssr: false }
)
export const LineChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.LineChart as ComponentType<ComponentProps<typeof Recharts.LineChart>> })),
  { ssr: false }
)
export const Line = dynamic(
  () => import("recharts").then((m) => ({ default: m.Line as ComponentType<ComponentProps<typeof Recharts.Line>> })),
  { ssr: false }
)
export const PieChart = dynamic(
  () => import("recharts").then((m) => ({ default: m.PieChart as ComponentType<ComponentProps<typeof Recharts.PieChart>> })),
  { ssr: false }
)
export const Pie = dynamic(
  () => import("recharts").then((m) => ({ default: m.Pie as ComponentType<ComponentProps<typeof Recharts.Pie>> })),
  { ssr: false }
)
export const Cell = dynamic(
  () => import("recharts").then((m) => ({ default: m.Cell as ComponentType<ComponentProps<typeof Recharts.Cell>> })),
  { ssr: false }
)
export const XAxis = dynamic(
  () => import("recharts").then((m) => ({ default: m.XAxis as ComponentType<ComponentProps<typeof Recharts.XAxis>> })),
  { ssr: false }
)
export const YAxis = dynamic(
  () => import("recharts").then((m) => ({ default: m.YAxis as ComponentType<ComponentProps<typeof Recharts.YAxis>> })),
  { ssr: false }
)
export const CartesianGrid = dynamic(
  () => import("recharts").then((m) => ({ default: m.CartesianGrid as ComponentType<ComponentProps<typeof Recharts.CartesianGrid>> })),
  { ssr: false }
)
export const Tooltip = dynamic(
  () => import("recharts").then((m) => ({ default: m.Tooltip as ComponentType<ComponentProps<typeof Recharts.Tooltip>> })),
  { ssr: false }
)
export const Legend = dynamic(
  () => import("recharts").then((m) => ({ default: m.Legend as ComponentType<ComponentProps<typeof Recharts.Legend>> })),
  { ssr: false }
)
export const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => ({ default: m.ResponsiveContainer as ComponentType<ComponentProps<typeof Recharts.ResponsiveContainer>> })),
  { ssr: false }
)
