import {
  ClientAdsPage,
  ClientHomePage,
  ClientMyWorkPage,
  ClientProfilePage,
  ClientSearchPage,
  ClientSettingsScreen,
} from "../pages";
import { ClientMessageScreen } from "../pages/cliente/mensagem-profissional";
import { ClientProductsPage, ClientStoresPage, ClientProductDetailPage, ClientStoreDetailPage } from "../pages/cliente/catalog";
import { CommerceHomePage, CommerceSearchPage, CommerceCartPage, CommerceOrdersPage } from "../pages/cliente/commerce";
import { useEffect } from "react";
import { BackHandler } from "react-native";
import type { ClientNavKey } from "../components/cliente";
import { ServiceDetailsScreen } from "../pages/profissional";
import { toProfessionalService } from "./serviceMapping";
import type { ClientScreen } from "./types";
import type { AppNavigation } from "./useAppNavigation";

type ClientNavigatorProps = {
  screen: ClientScreen;
  navigation: AppNavigation;
  isDarkMode: boolean;
  onToggleDarkMode: (value: boolean) => void;
};

export function ClientNavigator({
  screen,
  navigation,
  isDarkMode,
  onToggleDarkMode,
}: ClientNavigatorProps) {
  useEffect(() => {
    if (navigation.clientMode === "commerce" && !navigation.catalogRoute && screen !== "clientCommerceHome") {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => { navigation.openCommerceTab("home"); return true; });
      return () => subscription.remove();
    }
    if (!navigation.catalogRoute || navigation.catalogRoute.screen !== screen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      navigation.backCatalog();
      return true;
    });
    return () => subscription.remove();
  }, [screen, navigation.catalogRoute, navigation.backCatalog, navigation.clientMode]);
  const {
    setScreen,
    openClientTab,
    openAccountProfile,
    clientWorkReturnScreen,
    clientProfileReturnScreen,
    setClientProfileReturnScreen,
    selectedClientService,
    setSelectedClientService,
    selectedProfessionalId,
    setSelectedProfessionalId,
    contractedClientServices,
    setContractedClientServices,
  } = navigation;

  const commerceFrame = { onBack: () => screen === "clientCommerceHome" ? setScreen("profileChoice") : navigation.openCommerceTab("home"), onProfilePress: () => openAccountProfile(screen === "clientCommerceSearch" || screen === "clientCart" || screen === "clientOrders" ? screen : "clientCommerceHome") };
  const commerceLinks = {
    onStores: () => navigation.openCatalog({ screen: "clientStores" }),
    onProducts: (filters?: import("../services/public-catalog").ProductQuery) => navigation.openCatalog({ screen: "clientProducts", filters }),
    onStore: (id: string) => navigation.openCatalog({ screen: "clientStoreDetail", id }),
    onProduct: (id: string) => navigation.openCatalog({ screen: "clientProductDetail", id }),
  };

  switch (screen) {
    case "clientCommerceHome": return <CommerceHomePage {...commerceFrame} {...commerceLinks} />;
    case "clientCommerceSearch": return <CommerceSearchPage {...commerceFrame} {...commerceLinks} userId={navigation.authUser?.id} state={navigation.commerceSearch} onChange={(state) => navigation.setCommerceSearch({ ...state, domain: state.domain === "stores" ? "stores" : "products" })} />;
    case "clientCart": return <CommerceCartPage {...commerceFrame} {...commerceLinks} />;
    case "clientOrders": return <CommerceOrdersPage {...commerceFrame} />;
    case "clientStores":
    case "clientProducts":
    case "clientStoreDetail":
    case "clientProductDetail": {
      const route = navigation.catalogRoute;
      if (!route || route.screen !== screen) return null;
      const frame = {
        onBack: navigation.backCatalog,
        onProfilePress: () => openAccountProfile(screen),
        onNavigate: (tab: ClientNavKey) => openClientTab(tab, navigation.catalogOrigin === "clientSearch" ? "clientSearch" : "clientHome"),
        active: navigation.catalogOrigin === "clientSearch" ? "search" as const : "home" as const,
      };
      const onStore = (id: string) => navigation.openCatalog({ screen: "clientStoreDetail", id });
      const onProduct = (id: string) => navigation.openCatalog({ screen: "clientProductDetail", id });
      if (route.screen === "clientStoreDetail") return <ClientStoreDetailPage key={route.id} id={route.id} filters={route.filters} onFiltersChange={(filters) => navigation.updateCatalogRoute({ ...route, filters })} onProduct={onProduct} {...frame} />;
      if (route.screen === "clientProductDetail") return <ClientProductDetailPage key={route.id} id={route.id} onStore={onStore} {...frame} />;
      if (route.screen === "clientStores") return <ClientStoresPage {...frame} userId={navigation.authUser?.id} filters={route.filters ?? {}} onChange={(filters) => navigation.updateCatalogRoute({ screen: "clientStores", filters })} onStore={onStore} onProduct={onProduct} />;
      return <ClientProductsPage {...frame} userId={navigation.authUser?.id} filters={route.filters ?? {}} onChange={(filters) => navigation.updateCatalogRoute({ screen: "clientProducts", filters })} onProduct={onProduct} onStore={onStore} />;
    }
    case "clientHome":
      return (
        <ClientHomePage
          userId={navigation.authUser?.id}
          onOpenStores={() => navigation.openCatalog({ screen: "clientStores" })}
          onOpenProducts={(filters) => navigation.openCatalog({ screen: "clientProducts", filters })}
          onOpenStore={(id) => navigation.openCatalog({ screen: "clientStoreDetail", id })}
          onOpenProduct={(id) => navigation.openCatalog({ screen: "clientProductDetail", id })}
          onNavigate={(tab) => openClientTab(tab, "clientHome")}
          onOpenProfessional={(professionalId) => {
            setSelectedProfessionalId(professionalId);
            setClientProfileReturnScreen("clientHome");
            setScreen("clientProfile");
          }}
          onProfilePress={() => openAccountProfile("clientHome")}
          onBack={() => setScreen("profileChoice")}
        />
      );

    case "clientSearch":
      return (
        <ClientSearchPage
          userId={navigation.authUser?.id}
          searchState={navigation.clientSearch}
          onSearchStateChange={navigation.setClientSearch}
          onOpenStore={(id) => navigation.openCatalog({ screen: "clientStoreDetail", id })}
          onOpenProduct={(id) => navigation.openCatalog({ screen: "clientProductDetail", id })}
          onBack={() => setScreen("clientHome")}
          onNavigate={(tab) => openClientTab(tab, "clientSearch")}
          onOpenProfessional={(professionalId) => {
            setSelectedProfessionalId(professionalId);
            setClientProfileReturnScreen("clientSearch");
            setScreen("clientProfile");
          }}
          onProfilePress={() => openAccountProfile("clientSearch")}
        />
      );

    case "clientAds":
      return (
        <ClientAdsPage
          onContractService={(service) => {
            setContractedClientServices((current) => {
              if (current.some((item) => item.id === service.id)) {
                return current;
              }
              return [service, ...current];
            });
          }}
          onNavigate={(tab) => openClientTab(tab, "clientAds")}
          onBack={() => setScreen("clientHome")}
          onProfilePress={() => openAccountProfile("clientAds")}
        />
      );

    case "clientSettings":
      return (
        <ClientSettingsScreen
          onNavigate={(tab) => openClientTab(tab)}
          onBack={() => setScreen("clientHome")}
          onProfilePress={() => openAccountProfile("clientSettings")}
          onSignOut={() => { void navigation.signOut(); }}
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
        />
      );

    case "clientWork":
      return (
        <ClientMyWorkPage
          extraServices={contractedClientServices}
          onChangeExtraServiceStatus={(id, status) => {
            setContractedClientServices((current) =>
              current.map((service) =>
                service.id === id ? { ...service, status } : service,
              ),
            );
          }}
          onNavigate={(tab) => openClientTab(tab)}
          onProfilePress={() => openAccountProfile("clientHome")}
          onOpenProfessional={(professionalId) => {
            setSelectedProfessionalId(professionalId);
            setClientProfileReturnScreen("clientWork");
            setScreen("clientProfile");
          }}
          onOpenDetail={(service) => {
            setSelectedClientService(service);
            setScreen("clientServiceDetails");
          }}
          onBack={() => setScreen(clientWorkReturnScreen)}
        />
      );

    case "clientServiceDetails":
      if (!selectedClientService) {
        return null;
      }
      return (
        <ServiceDetailsScreen
          service={toProfessionalService(selectedClientService)}
          participantLabel="Profissional contratado"
          onBack={() => setScreen("clientWork")}
          onMessage={() => setScreen("clientServiceMessage")}
          onProfilePress={() => openAccountProfile("clientServiceDetails")}
          onStatusAction={() => setScreen("clientWork")}
        />
      );

    case "clientServiceMessage":
      if (!selectedClientService) {
        return null;
      }
      return (
        <ClientMessageScreen
          conversationId={selectedClientService.conversationId}
          professionalName={selectedClientService.professionalName}
          onBack={() => setScreen("clientServiceDetails")}
          onProfilePress={() => openAccountProfile("clientServiceMessage")}
        />
      );

    case "clientProfile":
      return (
        <ClientProfilePage
          professionalId={selectedProfessionalId ?? undefined}
          onBack={() => setScreen(clientProfileReturnScreen)}
          onNavigate={(tab) => openClientTab(tab)}
          onProfilePress={() => openAccountProfile("clientProfile")}
        />
      );

    default:
      return null;
  }
}
