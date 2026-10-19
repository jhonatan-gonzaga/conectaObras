import { StoreProductsScreen } from "../pages/lojista/StoreProductsScreen";
import { StoreProductFormScreen } from "../pages/lojista/StoreProductFormScreen";
import { StorePromotionsScreen } from "../pages/lojista/StorePromotionsScreen";
import { StorePromotionFormScreen } from "../pages/lojista/StorePromotionFormScreen";
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
  const promotions = () => navigation.setScreen("storeOwnerPromotions");
  const products = () => navigation.setScreen("storeProducts");
  const settings = () => navigation.setScreen("storeOwnerEdit");
  function editPromotion(id: string | null) {
    navigation.setSelectedPromotionId(id);
    navigation.setScreen("storeOwnerPromotionForm");
  }
  function editProduct(id: string | null) {
    navigation.setSelectedProductId(id);
    navigation.setScreen("storeProductForm");
  }
  function openList(kind: StoreDashboardList, from: "storeOwnerEdit" | "storeOwnerDashboard", status?: string) {
    if (kind === "promotions") { promotions(); return; }
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
      return <StoreOwnerScreen onOpenProducts={products} onOpenProfile={() => navigation.openAccountProfile("storeOwnerDashboard")} userName={navigation.authUser?.name} avatarUrl={navigation.authUser?.avatarUrl} onEditStore={() => navigation.setScreen("storeOwnerEdit")} onSwitchProfile={switchProfile} onSignOut={signOut} onStoreMissing={() => { navigation.markStoreMissing(); navigation.setScreen("storeOwnerSetup"); }} onOpenList={(kind) => openList(kind, "storeOwnerDashboard")} onOpenOrders={(status) => openList("orders", "storeOwnerDashboard", status)} />;
    case "storeOwnerPromotions":
      return <StorePromotionsScreen onBack={dashboard} onCreate={() => editPromotion(null)} onEdit={editPromotion} onProducts={products} onOrders={() => openList("orders", "storeOwnerDashboard")} onSettings={settings} />;
    case "storeOwnerPromotionForm":
      return <StorePromotionFormScreen id={navigation.selectedPromotionId} onBack={promotions} onSaved={promotions} />;
    case "storeProducts":
      return <StoreProductsScreen filters={navigation.productFilters} onChangeFilters={navigation.setProductFilters} initialNotice={navigation.productNotice} onNoticeSeen={() => navigation.setProductNotice(null)} onBack={dashboard} onCreate={() => editProduct(null)} onEdit={editProduct} onOpenOrders={() => openList("orders", "storeOwnerDashboard")} onOpenPromotions={promotions} onOpenSettings={settings} />;
    case "storeProductForm":
      return <StoreProductFormScreen productId={navigation.selectedProductId} onBack={products} onSaved={(message) => { navigation.setProductNotice(message); products(); }} />;
    case "storeOwnerList":
      return <StoreOwnerListScreen kind={navigation.storeListKind} status={navigation.storeListStatus} onBack={() => navigation.setScreen(navigation.storeListReturnScreen)} />;
  }
}
