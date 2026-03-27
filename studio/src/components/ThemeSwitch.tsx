"use client";

import { Switch } from "@heroui/switch";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <Switch
      aria-label="Toggle dark mode"
      isSelected={isDark}
      size="sm"
      onValueChange={(selected) => setTheme(selected ? "dark" : "light")}
    >
      <span className="sr-only">{isDark ? "Dark" : "Light"} mode</span>
    </Switch>
  );
}
