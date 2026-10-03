import { StoreOwnerScreen } from "../pages/lojista/StoreOwnerScreen";
import { StoreOwnerSetupScreen } from "../pages/lojista/StoreOwnerSetupScreen";
import { StoreOwnerListScreen } from "../pages/lojista/StoreOwnerListScreen";
import type { StoreOwnerScreen as StoreOwnerRoute } from "./types";
import type { AppNavigation } from "./useAppNavigation";

export function StoreOwnerNavigator({ screen, navigation }: { screen: StoreOwnerRoute; navigation: AppNavigation }) {
  switch (screen) {
    case "storeOwnerSetup":
    case "storeOwnerEdit":
      return <StoreOwnerSetupScreen onComplete={() => { navigation.markStoreRegistered(); navigation.setScreen("storeOwnerDashboard"); }} onSwitchProfile={() => navigation.setScreen("profileChoice")} onSignOut={() => { void navigation.signOut(); }} />;
    case "storeOwnerDashboard":
      return <StoreOwnerScreen onEditStore={() => navigation.setScreen("storeOwnerEdit")} onSwitchProfile={() => navigation.setScreen("profileChoice")} onSignOut={() => { void navigation.signOut(); }} onStoreMissing={() => { navigation.markStoreMissing(); navigation.setScreen("storeOwnerSetup"); }} onOpenList={(kind) => { navigation.setStoreListKind(kind); navigation.setStoreListStatus(undefined); navigation.setScreen("storeOwnerList"); }} onOpenOrders={(status) => { navigation.setStoreListKind("orders"); navigation.setStoreListStatus(status); navigation.setScreen("storeOwnerList"); }} />;
    case "storeOwnerList":
      return <StoreOwnerListScreen kind={navigation.storeListKind} status={navigation.storeListStatus} onBack={() => navigation.setScreen("storeOwnerDashboard")} />;
  }
}
