import type { ClientWorkService } from "../pages";

export type ReturnScreen = "login" | "signup";

export type ProfileReturnScreen =
  | "profileChoice"
  | "professionalSetup"
  | "professionalHome"
  | "clientHome"
  | "clientSearch"
  | "clientAds"
  | "clientServiceDetails"
  | "clientServiceMessage"
  | "clientSettings"
  | "clientProfile";

export type ClientWorkReturnScreen = "clientHome" | "clientSearch" | "clientAds";

export type ClientProfileReturnScreen = "clientHome" | "clientSearch" | "clientWork";

export type AuthScreen = ReturnScreen | "terms" | "privacy";

export type ClientScreen =
  | "clientHome"
  | "clientSearch"
  | "clientWork"
  | "clientAds"
  | "clientServiceDetails"
  | "clientServiceMessage"
  | "clientSettings"
  | "clientProfile";

export type ProfessionalScreen = "professionalSetup" | "professionalHome";

export type Screen =
  | AuthScreen
  | "profileChoice"
  | "accountProfile"
  | ClientScreen
  | ProfessionalScreen;

export type { ClientWorkService };

/** Telas do fluxo de autenticacao / escolha de perfil. */
export function isAuthContextScreen(
  screen: Screen,
): screen is AuthScreen | "profileChoice" {
  return (
    screen === "login" ||
    screen === "signup" ||
    screen === "terms" ||
    screen === "privacy" ||
    screen === "profileChoice"
  );
}

/** Telas do fluxo do cliente. */
export function isClientContextScreen(screen: Screen): screen is ClientScreen {
  return (
    screen === "clientHome" ||
    screen === "clientSearch" ||
    screen === "clientWork" ||
    screen === "clientAds" ||
    screen === "clientServiceDetails" ||
    screen === "clientServiceMessage" ||
    screen === "clientSettings" ||
    screen === "clientProfile"
  );
}

/** Telas do fluxo do profissional. */
export function isProfessionalContextScreen(
  screen: Screen,
): screen is ProfessionalScreen {
  return screen === "professionalSetup" || screen === "professionalHome";
}
