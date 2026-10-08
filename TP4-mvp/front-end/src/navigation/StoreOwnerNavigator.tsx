import { StoreOwnerScreen } from "../pages/lojista/StoreOwnerScreen";
import { StoreOwnerSetupScreen } from "../pages/lojista/StoreOwnerSetupScreen";
import { StoreOwnerEditScreen, type StoreSettingsDestination } from "../pages/lojista/StoreOwnerEditScreen";
import { StoreOwnerPreviewScreen } from "../pages/lojista/StoreOwnerPreviewScreen";
import { StoreOwnerListScreen } from "../pages/lojista/StoreOwnerListScreen";
import type { StoreDashboardList } from "../services/api";
import type { StoreOwnerScreen as StoreOwnerRoute } from "./types";
import type { AppNavigation } from "./useAppNavigation";

export function StoreOwnerNavigator({ screen, navigation }: { screen: StoreOwnerRoute; navigation: AppNavigation }) {
  const dashboard = () => navigation.setScreen("storeOwnerDashboard");
  const switchProfile = () => navigation.setScreen("profileChoice");
  const signOut = () => { void navigation.signOut(); };
  function openList(kind: StoreDashboardList, from: "storeOwnerEdit" | "storeOwnerDashboard", status?: string) {
    navigation.setStoreListKind(kind);
    navigation.setStoreListStatus(status);
    navigation.setStoreListReturnScreen(from);
    navigation.setScreen("storeOwnerList");
  }
  function navigateSettings(destination: StoreSettingsDestination) {
    if (destination === "dashboard") dashboard();
    else openList(destination === "catalog" ? "active-products" : destination === "messages" ? "messages" : "orders", "storeOwnerEdit", destination === "sales" ? "COMPLETED" : undefined);
  }
  switch (screen) {
    case "storeOwnerSetup":
      return <StoreOwnerSetupScreen onBack={switchProfile} onComplete={() => { navigation.markStoreRegistered(); dashboard(); }} onSwitchProfile={switchProfile} onSignOut={signOut} />;
    case "storeOwnerEdit":
      return <StoreOwnerEditScreen onBack={dashboard} onPreview={() => navigation.setScreen("storeOwnerPreview")} onAccount={() => navigation.openAccountProfile("storeOwnerEdit")} onNavigate={navigateSettings} onSwitchProfile={switchProfile} onSignOut={signOut} />;
    case "storeOwnerPreview":
      return <StoreOwnerPreviewScreen onBack={() => navigation.setScreen("storeOwnerEdit")} />;
    case "storeOwnerDashboard":
      return <StoreOwnerScreen onEditStore={() => navigation.setScreen("storeOwnerEdit")} onSwitchProfile={switchProfile} onSignOut={signOut} onStoreMissing={() => { navigation.markStoreMissing(); navigation.setScreen("storeOwnerSetup"); }} onOpenList={(kind) => openList(kind, "storeOwnerDashboard")} onOpenOrders={(status) => openList("orders", "storeOwnerDashboard", status)} />;
    case "storeOwnerList":
      return <StoreOwnerListScreen kind={navigation.storeListKind} status={navigation.storeListStatus} onBack={() => navigation.setScreen(navigation.storeListReturnScreen)} />;
  }
}
