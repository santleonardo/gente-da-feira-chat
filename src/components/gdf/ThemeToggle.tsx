"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Palette } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const themes = [
  {
    value: "light",
    label: "Claro",
    icon: Sun,
    description: "Fundo branco com detalhes quentes",
  },
  {
    value: "dark",
    label: "Escuro",
    icon: Moon,
    description: "Fundo escuro com neon",
  },
  {
    value: "auto",
    label: "Mesclado",
    icon: Palette,
    description: "Segue o sistema",
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () =>
      document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = themes.find((t) => t.value === theme) || themes[2];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
          "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        )}
        aria-label="Alternar tema"
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border bg-popover p-1.5 shadow-lg">
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Tema do app
          </p>
          {themes.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => {
                  setTheme(t.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  theme === t.value
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">{t.label}</div>
                  <div
                    className={cn(
                      "text-xs",
                      theme === t.value
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {t.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
