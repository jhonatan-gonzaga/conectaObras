import {
  ClientAdsPage,
  ClientHomePage,
  ClientMyWorkPage,
  ClientProfilePage,
  ClientSearchPage,
  ClientSettingsScreen,
} from "../pages";
import { ClientMessageScreen } from "../pages/cliente/mensagem-profissional";
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

  switch (screen) {
    case "clientHome":
      return (
        <ClientHomePage
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
          onSignOut={() => setScreen("login")}
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
