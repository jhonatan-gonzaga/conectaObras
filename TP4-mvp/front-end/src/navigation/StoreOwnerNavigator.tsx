import { StoreOwnerScreen } from "../pages/lojista/StoreOwnerScreen";
import { StoreOwnerSetupScreen } from "../pages/lojista/StoreOwnerSetupScreen";
import { StoreOwnerListScreen } from "../pages/lojista/StoreOwnerListScreen";
import { StoreProductsScreen } from "../pages/lojista/StoreProductsScreen";
import { StoreProductFormScreen } from "../pages/lojista/StoreProductFormScreen";
import type { StoreOwnerScreen as StoreOwnerRoute } from "./types";
import type { AppNavigation } from "./useAppNavigation";

export function StoreOwnerNavigator({ screen, navigation }: { screen: StoreOwnerRoute; navigation: AppNavigation }) {
  switch (screen) {
    case "storeOwnerSetup":
    case "storeOwnerEdit":
      return <StoreOwnerSetupScreen onComplete={() => { navigation.markStoreRegistered(); navigation.setScreen("storeOwnerDashboard"); }} onSwitchProfile={() => navigation.setScreen("profileChoice")} onSignOut={() => { void navigation.signOut(); }} />;
    case "storeOwnerDashboard":
      return <StoreOwnerScreen userName={navigation.authUser?.name} avatarUrl={navigation.authUser?.avatarUrl} onEditStore={() => navigation.setScreen("storeOwnerEdit")} onOpenProfile={() => navigation.openAccountProfile("storeOwnerDashboard")} onSwitchProfile={() => navigation.setScreen("profileChoice")} onSignOut={() => { void navigation.signOut(); }} onStoreMissing={() => { navigation.markStoreMissing(); navigation.setScreen("storeOwnerSetup"); }} onOpenProducts={() => navigation.setScreen("storeProducts")} onOpenList={(kind) => { navigation.setStoreListKind(kind); navigation.setStoreListStatus(undefined); navigation.setScreen("storeOwnerList"); }} onOpenOrders={(status) => { navigation.setStoreListKind("orders"); navigation.setStoreListStatus(status); navigation.setScreen("storeOwnerList"); }} />;
    case "storeOwnerList":
      return <StoreOwnerListScreen kind={navigation.storeListKind} status={navigation.storeListStatus} onBack={() => navigation.setScreen("storeOwnerDashboard")} />;
    case "storeProducts":
      return <StoreProductsScreen filters={navigation.productFilters} onChangeFilters={navigation.setProductFilters} initialNotice={navigation.productNotice} onNoticeSeen={() => navigation.setProductNotice(null)} onBack={() => navigation.setScreen("storeOwnerDashboard")} onOpenOrders={() => { navigation.setStoreListKind("orders"); navigation.setStoreListStatus(undefined); navigation.setScreen("storeOwnerList"); }} onOpenPromotions={() => { navigation.setStoreListKind("promotions"); navigation.setStoreListStatus(undefined); navigation.setScreen("storeOwnerList"); }} onOpenSettings={() => navigation.setScreen("storeOwnerEdit")} onCreate={() => { navigation.setSelectedProductId(null); navigation.setScreen("storeProductForm"); }} onEdit={(id) => { navigation.setSelectedProductId(id); navigation.setScreen("storeProductForm"); }} />;
    case "storeProductForm":
      return <StoreProductFormScreen productId={navigation.selectedProductId} onBack={() => navigation.setScreen("storeProducts")} onSaved={(message) => { navigation.setProductNotice(message); navigation.setScreen("storeProducts"); }} />;
  }
}
