import type { ClientWorkService } from "../pages";
import type { CatalogDomain, ProductQuery, StoreQuery } from "../services/public-catalog";

export type CatalogRoute =
  | { screen: "clientStores"; filters?: StoreQuery }
  | { screen: "clientProducts"; filters?: ProductQuery }
  | { screen: "clientStoreDetail"; id: string; filters?: ProductQuery }
  | { screen: "clientProductDetail"; id: string };
export type ClientSearchState = { domain: CatalogDomain; query: string; stores: StoreQuery; products: ProductQuery };
export type CommerceTab = "home" | "search" | "cart" | "orders";
export type CommerceScreen = "clientCommerceHome" | "clientCommerceSearch" | "clientCart" | "clientOrders";
export const emptyClientSearch = (): ClientSearchState => ({ domain: "professionals", query: "", stores: {}, products: {} });

export type ReturnScreen = "login" | "signup";

export type ProfileReturnScreen =
  | CommerceScreen
  | "professionalSetup"
  | "professionalHome"
  | "clientHome"
  | "clientSearch"
  | "clientAds"
  | "clientServiceDetails"
  | "clientServiceMessage"
  | "clientSettings"
  | "clientProfile"
  | CatalogRoute["screen"]
  | "storeOwnerSetup"
  | "storeOwnerEdit"
  | "storeOwnerDashboard";

export type ClientWorkReturnScreen = "clientHome" | "clientSearch" | "clientAds";

export type ClientProfileReturnScreen = "clientHome" | "clientSearch" | "clientWork";

export type AuthScreen = ReturnScreen | "terms" | "privacy";

export type ClientScreen =
  | CommerceScreen
  | CatalogRoute["screen"]
  | "clientHome"
  | "clientSearch"
  | "clientWork"
  | "clientAds"
  | "clientServiceDetails"
  | "clientServiceMessage"
  | "clientSettings"
  | "clientProfile";

export type ProfessionalScreen = "professionalSetup" | "professionalHome";
export type StoreOwnerScreen = "storeOwnerSetup" | "storeOwnerEdit" | "storeOwnerPreview" | "storeOwnerDashboard" | "storeOwnerList" | "storeProducts" | "storeProductForm";

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
    screen === "clientCommerceHome" || screen === "clientCommerceSearch" || screen === "clientCart" || screen === "clientOrders" ||
    screen === "clientHome" ||
    screen === "clientSearch" ||
    screen === "clientWork" ||
    screen === "clientAds" ||
    screen === "clientServiceDetails" ||
    screen === "clientServiceMessage" ||
    screen === "clientSettings" ||
    screen === "clientProfile" ||
    screen === "clientStores" ||
    screen === "clientProducts" ||
    screen === "clientStoreDetail" ||
    screen === "clientProductDetail"
  );
}

/** Telas do fluxo do profissional. */
export function isProfessionalContextScreen(
  screen: Screen,
): screen is ProfessionalScreen {
  return screen === "professionalSetup" || screen === "professionalHome";
}

export function isStoreOwnerContextScreen(screen: Screen): screen is StoreOwnerScreen {
  return screen === "storeOwnerSetup" || screen === "storeOwnerEdit" || screen === "storeOwnerPreview" || screen === "storeOwnerDashboard" || screen === "storeOwnerList" || screen === "storeProducts" || screen === "storeProductForm";
}
