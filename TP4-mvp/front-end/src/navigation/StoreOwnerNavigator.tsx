import { StoreOwnerScreen } from "../pages/lojista/StoreOwnerScreen";
import { StoreOwnerSetupScreen } from "../pages/lojista/StoreOwnerSetupScreen";
import { StoreOwnerEditScreen } from "../pages/lojista/StoreOwnerEditScreen";
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
  switch (screen) {
    case "storeOwnerSetup":
      return <StoreOwnerSetupScreen onBack={switchProfile} onComplete={() => { navigation.markStoreRegistered(); dashboard(); }} onSwitchProfile={switchProfile} onSignOut={signOut} />;
    case "storeOwnerEdit":
      return <StoreOwnerEditScreen onBack={dashboard} onPreview={() => navigation.setScreen("storeOwnerPreview")} onAccount={() => navigation.openAccountProfile("storeOwnerEdit")} onSwitchProfile={switchProfile} onSignOut={signOut} />;
    case "storeOwnerPreview":
      return <StoreOwnerPreviewScreen onBack={() => navigation.setScreen("storeOwnerEdit")} />;
    case "storeOwnerDashboard":
      return <StoreOwnerScreen onEditStore={() => navigation.setScreen("storeOwnerEdit")} onSwitchProfile={switchProfile} onSignOut={signOut} onStoreMissing={() => { navigation.markStoreMissing(); navigation.setScreen("storeOwnerSetup"); }} onOpenList={(kind) => openList(kind, "storeOwnerDashboard")} onOpenOrders={(status) => openList("orders", "storeOwnerDashboard", status)} />;
    case "storeOwnerList":
      return <StoreOwnerListScreen
        kind={navigation.storeListKind}
        status={navigation.storeListStatus}
        avatarUrl={navigation.authUser?.avatarUrl}
        onBack={() => navigation.setScreen("storeOwnerDashboard")}
        onSwitchProfile={() => navigation.setScreen("profileChoice")}
        onOpenProfile={() => navigation.openAccountProfile("storeOwnerDashboard")}
        onOrders={() => { navigation.setStoreListKind("orders"); navigation.setStoreListStatus(undefined); navigation.setScreen("storeOwnerList"); }}
        onProducts={() => navigation.setScreen("storeProducts")}
        onSettings={() => navigation.setScreen("storeOwnerEdit")}
      />;
    case "storeProducts":
      return <StoreProductsScreen filters={navigation.productFilters} onChangeFilters={navigation.setProductFilters} initialNotice={navigation.productNotice} onNoticeSeen={() => navigation.setProductNotice(null)} onBack={() => navigation.setScreen("storeOwnerDashboard")} onOpenOrders={() => { navigation.setStoreListKind("orders"); navigation.setStoreListStatus(undefined); navigation.setScreen("storeOwnerList"); }} onOpenPromotions={() => { navigation.setStoreListKind("promotions"); navigation.setStoreListStatus(undefined); navigation.setScreen("storeOwnerList"); }} onOpenSettings={() => navigation.setScreen("storeOwnerEdit")} onCreate={() => { navigation.setSelectedProductId(null); navigation.setScreen("storeProductForm"); }} onEdit={(id) => { navigation.setSelectedProductId(id); navigation.setScreen("storeProductForm"); }} />;
    case "storeProductForm":
      return <StoreProductFormScreen productId={navigation.selectedProductId} onBack={() => navigation.setScreen("storeProducts")} onSaved={(message) => { navigation.setProductNotice(message); navigation.setScreen("storeProducts"); }} />;
  }
}
