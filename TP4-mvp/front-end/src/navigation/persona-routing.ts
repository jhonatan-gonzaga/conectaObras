import type { UserRole } from "../services/api";
import type { Screen } from "./types";

export type PersonaRoute = "client" | "professional" | "storeOwner" | "unsupported";

export function personaForRole(role: UserRole): PersonaRoute {
  switch (role) {
    case "CLIENTE": return "client";
    case "PROFISSIONAL": return "professional";
    case "LOJISTA": return "storeOwner";
    case "SUPORTE": return "unsupported";
  }
}

export function initialScreenForRole(role: UserRole, hasStore: boolean): Screen {
  switch (personaForRole(role)) {
    case "client": return "clientHome";
    case "professional": return "professionalHome";
    case "storeOwner": return hasStore ? "storeOwnerDashboard" : "storeOwnerSetup";
    case "unsupported": return "login";
  }
}

export function guardPersonaScreen(screen: Screen, role: UserRole | null, hasStore = false): Screen {
  if (!role) return screen === "login" || screen === "signup" || screen === "profileChoice" || screen === "terms" || screen === "privacy" ? screen : "login";
  if (screen === "login" || screen === "signup") return initialScreenForRole(role, hasStore);
  if (screen === "profileChoice" && role !== "CLIENTE" && role !== "PROFISSIONAL") return initialScreenForRole(role, hasStore);
  const isClientScreen = screen.startsWith("client");
  const isProfessionalScreen = screen.startsWith("professional");
  const isStoreScreen = screen.startsWith("storeOwner");
  if ((isClientScreen && role !== "CLIENTE") || (isProfessionalScreen && role !== "PROFISSIONAL") || (isStoreScreen && role !== "LOJISTA")) return initialScreenForRole(role, hasStore);
  if (role === "LOJISTA" && hasStore && screen === "storeOwnerSetup") return "storeOwnerDashboard";
  if (role === "LOJISTA" && !hasStore && (screen === "storeOwnerDashboard" || screen === "storeOwnerList")) return "storeOwnerSetup";
  return screen;
}
