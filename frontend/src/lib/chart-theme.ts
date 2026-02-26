"use client"

import { useTheme } from "@/components/theme-provider"

export const CHART_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#f97316", "#10b981",
]

export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return {
    isDark,
    colors: CHART_COLORS,
    tooltipStyle: {
      backgroundColor: isDark ? "hsl(0, 0%, 12%)" : "hsl(0, 0%, 100%)",
      border: `1px solid ${isDark ? "hsl(0, 0%, 18%)" : "hsl(214.3, 31.8%, 91.4%)"}`,
      color: isDark ? "hsl(0, 0%, 95%)" : "hsl(222.2, 84%, 4.9%)",
      borderRadius: "6px",
      fontSize: 12,
    },
    gridStroke: isDark ? "hsl(0, 0%, 18%)" : "hsl(214.3, 31.8%, 91.4%)",
    tickStyle: {
      fill: isDark ? "hsl(0, 0%, 64%)" : "hsl(215.4, 16.3%, 46.9%)",
      fontSize: 11,
    },
  }
}
