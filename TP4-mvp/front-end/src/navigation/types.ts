import type { ClientWorkService } from "../pages";

export type ReturnScreen = "login" | "signup";

export type ProfileReturnScreen =
  | "professionalSetup"
  | "professionalHome"
  | "clientHome"
  | "clientOrders"
  | "clientSearch"
  | "clientAds"
  | "clientServiceDetails"
  | "clientServiceMessage"
  | "clientSettings"
  | "clientProfile"
  | "storeOwnerSetup"
  | "storeOwnerEdit"
  | "storeOwnerDashboard"
  | "storeOwnerList"
  | "storeReviews";

export type ClientWorkReturnScreen = "clientHome" | "clientSearch" | "clientAds";

export type ClientProfileReturnScreen = "clientHome" | "clientSearch" | "clientWork";

export type AuthScreen = ReturnScreen | "terms" | "privacy";

export type ClientScreen =
  | "clientHome"
  | "clientOrders"
  | "clientSearch"
  | "clientWork"
  | "clientAds"
  | "clientServiceDetails"
  | "clientServiceMessage"
  | "clientSettings"
  | "clientProfile";

export type ProfessionalScreen = "professionalSetup" | "professionalHome";
export type StoreOwnerScreen = "storeOwnerSetup" | "storeOwnerEdit" | "storeOwnerPreview" | "storeOwnerDashboard" | "storeOwnerList" | "storeProducts" | "storeProductForm" | "storeReviews";

export type Screen =
  | AuthScreen
  | "profileChoice"
  | "accountProfile"
  | ClientScreen
  | ProfessionalScreen
  | StoreOwnerScreen;

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
    screen === "clientOrders" ||
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

export function isStoreOwnerContextScreen(screen: Screen): screen is StoreOwnerScreen {
  return screen === "storeOwnerSetup" || screen === "storeOwnerEdit" || screen === "storeOwnerPreview" || screen === "storeOwnerDashboard" || screen === "storeOwnerList" || screen === "storeProducts" || screen === "storeProductForm" || screen === "storeReviews";
}
