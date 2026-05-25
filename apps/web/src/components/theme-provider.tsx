"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = Exclude<ThemeMode, "system">

const STORAGE_KEY = "fluxora-theme"
const LIGHT_THEME_COLOR = "#f7f5ef"
const DARK_THEME_COLOR = "#081018"

type ThemeContextValue = {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: ThemeMode): ResolvedTheme {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme

  if (typeof document === "undefined") {
    return resolvedTheme
  }

  const root = document.documentElement
  const themeColor = resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')

  root.classList.toggle("dark", resolvedTheme === "dark")
  root.dataset.theme = resolvedTheme
  root.style.colorScheme = resolvedTheme
  metaThemeColor?.setAttribute("content", themeColor)

  return resolvedTheme
}

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "system"
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)

  if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
    return storedTheme
  }

  return "system"
}

export const themeInitScript = `
(() => {
  try {
    const storageKey = "${STORAGE_KEY}";
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
      ? storedTheme
      : "system";
    const resolvedTheme = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    const root = document.documentElement;
    const themeColor = resolvedTheme === "dark" ? "${DARK_THEME_COLOR}" : "${LIGHT_THEME_COLOR}";
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    metaThemeColor?.setAttribute("content", themeColor);
  } catch (_) {}
})();
`

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const initialTheme = getStoredTheme()
    return initialTheme === "system" ? getSystemTheme() : initialTheme
  })
  const themeRef = useRef<ThemeMode>(theme)

  useEffect(() => {
    setResolvedTheme(applyTheme(themeRef.current))

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const syncSystemTheme = () => {
      if (themeRef.current === "system") {
        setResolvedTheme(applyTheme("system"))
      }
    }

    if ("addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", syncSystemTheme)
      return () => mediaQuery.removeEventListener("change", syncSystemTheme)
    }

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener: (listener: (event: MediaQueryListEvent) => void) => void
      removeListener: (listener: (event: MediaQueryListEvent) => void) => void
    }

    legacyMediaQuery.addListener(syncSystemTheme)
    return () => legacyMediaQuery.removeListener(syncSystemTheme)
  }, [])

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    themeRef.current = nextTheme
    setThemeState(nextTheme)
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    setResolvedTheme(applyTheme(nextTheme))
  }, [])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.")
  }

  return context
}
