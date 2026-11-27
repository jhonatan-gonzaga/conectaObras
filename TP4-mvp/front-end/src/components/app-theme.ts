import { vars } from "nativewind";
import { createContext } from "react";

export const appThemeStyles = {
  light: vars({
    "--color-background": "251 246 247",
    "--color-card": "255 255 255",
    "--color-foreground": "15 23 32",
    "--color-primary": "185 75 80",
    "--color-muted": "245 238 239",
    "--color-muted-foreground": "122 101 104",
    "--color-input-border": "0 0 0",
    "--color-input-border-alpha": "0.1",
  }),
  dark: vars({
    "--color-background": "15 18 24",
    "--color-card": "26 30 38",
    "--color-foreground": "246 247 249",
    "--color-primary": "218 92 98",
    "--color-muted": "49 55 66",
    "--color-muted-foreground": "189 196 205",
    "--color-input-border": "255 255 255",
    "--color-input-border-alpha": "0.14",
  }),
};

// Modal portals on Web need the same variables as the application root.
export const AppThemeContext = createContext(appThemeStyles.light);
