import "./global.css";

import { StatusBar } from "expo-status-bar";
import { vars } from "nativewind";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ClientNavKey } from "./components/cliente";
import { ProfessionalHomeScreen, ProfessionalSetupScreen } from "./components/profissional";
import type { ProfessionalService, ServiceStatus } from "./components/profissional/types";
import {
  AccountProfileScreen,
  ClientAdsPage,
  ClientHomePage,
  ClientMyWorkPage,
  ClientProfilePage,
  ClientSettingsScreen,
  ClientSearchPage,
  type ClientWorkService,
  LegalDocumentScreen,
  LoginScreen,
  ProfileChoiceScreen,
  SignupScreen,
} from "./pages";
import { ClientMessageScreen } from "./pages/cliente/mensagem-profissional";
import { ServiceDetailsScreen } from "./pages/profissional";
import { api } from "./services/api";

/* ------------------------------------------------------------------------
 * NAVIGATION TYPES
 * Todas as telas do app, agrupadas por contexto (auth / cliente /
 * profissional) + o mapa que diz a qual grupo cada tela pertence. É esse
 * mapa que substitui a cadeia gigante de ternários por um switch de 3 casos.
 * ---------------------------------------------------------------------- */

type ReturnScreen = "login" | "signup";

type ProfileReturnScreen =
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

type ClientWorkReturnScreen = "clientHome" | "clientSearch" | "clientAds";

type ClientProfileReturnScreen = "clientHome" | "clientSearch" | "clientWork";

type AuthScreen =
  | ReturnScreen
  | "profileChoice"
  | "accountProfile"
  | "privacy"
  | "terms";

type ClientScreen =
  | "clientHome"
  | "clientSearch"
  | "clientWork"
  | "clientAds"
  | "clientServiceDetails"
  | "clientServiceMessage"
  | "clientSettings"
  | "clientProfile";

type ProfessionalScreen = "professionalSetup" | "professionalHome";

type Screen = AuthScreen | ClientScreen | ProfessionalScreen;

type ScreenGroup = "auth" | "client" | "professional";

const screenGroups: Record<Screen, ScreenGroup> = {
  login: "auth",
  signup: "auth",
  privacy: "auth",
  terms: "auth",
  profileChoice: "auth",
  accountProfile: "auth",

  clientHome: "client",
  clientSearch: "client",
  clientWork: "client",
  clientAds: "client",
  clientServiceDetails: "client",
  clientServiceMessage: "client",
  clientSettings: "client",
  clientProfile: "client",

  professionalSetup: "professional",
  professionalHome: "professional",
};

/* ------------------------------------------------------------------------
 * THEME
 * ---------------------------------------------------------------------- */

const lightThemeVars = vars({
  "--color-background": "251 246 247",
  "--color-card": "255 255 255",
  "--color-foreground": "15 23 32",
  "--color-primary": "185 75 80",
  "--color-muted": "245 238 239",
  "--color-muted-foreground": "122 101 104",
  "--color-input-border": "0 0 0",
  "--color-input-border-alpha": "0.1",
});

const darkThemeVars = vars({
  "--color-background": "15 18 24",
  "--color-card": "26 30 38",
  "--color-foreground": "246 247 249",
  "--color-primary": "218 92 98",
  "--color-muted": "49 55 66",
  "--color-muted-foreground": "189 196 205",
  "--color-input-border": "255 255 255",
  "--color-input-border-alpha": "0.14",
});

/* ------------------------------------------------------------------------
 * CLIENT UTILS
 * Regra de conversão de dados do domínio "cliente" — não é decisão de
 * navegação, só mora perto porque só é usada aqui.
 * ---------------------------------------------------------------------- */

const clientStatusToProfessionalStatus: Record<
  ClientWorkService["status"],
  ServiceStatus
> = {
  em_andamento: "inProgress",
  aguardando_aprovacao: "pending",
  concluido: "completed",
  reabrir_servico: "inProgress",
};

function toServiceDetailsItem(service: ClientWorkService): ProfessionalService {
  return {
    title: service.title,
    status: clientStatusToProfessionalStatus[service.status],
    order: service.id,
    customer: service.professionalName,
    price: service.price ?? "A combinar",
    date: service.dateValue,
    time: service.time ?? "A combinar",
    deadline: service.deadline ?? "A combinar",
    address: service.address,
    category: service.categoryLabel,
    description: service.description,
    imageUrls: service.imageUrls,
    hasReview: service.hasReview,
    messageCount: service.unreadMessages
      ? String(service.unreadMessages)
      : undefined,
  };
}

/* ------------------------------------------------------------------------
 * NAVIGATION STATE HOOK
 * Único lugar com o estado de navegação e as regras de transição entre
 * telas (quem volta pra onde, o que fica selecionado, etc). Os
 * sub-navegadores abaixo só consomem o que esse hook devolve.
 * ---------------------------------------------------------------------- */

function useAppNavigation() {
  const [screen, setScreen] = useState<Screen>("login");
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [profileReturnScreen, setProfileReturnScreen] =
    useState<ProfileReturnScreen>("profileChoice");
  const [clientWorkReturnScreen, setClientWorkReturnScreen] =
    useState<ClientWorkReturnScreen>("clientHome");
  const [clientProfileReturnScreen, setClientProfileReturnScreen] =
    useState<ClientProfileReturnScreen>("clientHome");
  const [legalReturnScreen, setLegalReturnScreen] =
    useState<ReturnScreen>("login");

  const [selectedClientService, setSelectedClientService] =
    useState<ClientWorkService | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] =
    useState<string | null>(null);
  const [contractedClientServices, setContractedClientServices] = useState<
    ClientWorkService[]
  >([]);

  const isProfessionalScreen =
    screen === "professionalSetup" || screen === "professionalHome";

  const openAccountProfile = (from: ProfileReturnScreen) => {
    setProfileReturnScreen(from);
    setScreen("accountProfile");
  };

  const openProfessionalArea = async () => {
    try {
      await api.professionalMe();
      setScreen("professionalHome");
    } catch {
      setScreen("professionalSetup");
    }
  };

  const openClientTab = (
    tab: ClientNavKey,
    from?: ClientWorkReturnScreen,
  ) => {
    if (tab === "search") {
      setScreen("clientSearch");
    } else if (tab === "ads") {
      setScreen("clientAds");
    } else if (tab === "settings") {
      setScreen("clientSettings");
    } else if (tab === "work") {
      if (from) {
        setClientWorkReturnScreen(from);
      }
      setScreen("clientWork");
    } else {
      setScreen("clientHome");
    }
  };

  const openClientProfile = (
    professionalId: string,
    from: ClientProfileReturnScreen,
  ) => {
    setSelectedProfessionalId(professionalId);
    setClientProfileReturnScreen(from);
    setScreen("clientProfile");
  };

  const openClientServiceDetails = (service: ClientWorkService) => {
    setSelectedClientService(service);
    setScreen("clientServiceDetails");
  };

  const openLegal = (type: "privacy" | "terms", from: ReturnScreen) => {
    setLegalReturnScreen(from);
    setScreen(type);
  };

  const addContractedService = (service: ClientWorkService) => {
    setContractedClientServices((current) => {
      if (current.some((item) => item.id === service.id)) {
        return current;
      }
      return [service, ...current];
    });
  };

  const updateContractedServiceStatus = (
    id: string,
    status: ClientWorkService["status"],
  ) => {
    setContractedClientServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, status } : service,
      ),
    );
  };

  return {
    screen,
    setScreen,
    isDarkMode,
    setIsDarkMode,
    isProfessionalScreen,
    profileReturnScreen,
    clientWorkReturnScreen,
    clientProfileReturnScreen,
    legalReturnScreen,
    selectedClientService,
    selectedProfessionalId,
    contractedClientServices,
    openAccountProfile,
    openLegal,
    openProfessionalArea,
    openClientTab,
    openClientProfile,
    openClientServiceDetails,
    addContractedService,
    updateContractedServiceStatus,
  };
}

type AppNavigation = ReturnType<typeof useAppNavigation>;

/* ------------------------------------------------------------------------
 * AUTH NAVIGATION
 * Contexto: autenticação — login, signup, legal, escolha de perfil, conta.
 * ---------------------------------------------------------------------- */

function AuthNavigation({ nav }: { nav: AppNavigation }) {
  const {
    screen,
    setScreen,
    isDarkMode,
    legalReturnScreen,
    profileReturnScreen,
    openAccountProfile,
    openProfessionalArea,
    openLegal,
  } = nav;

  switch (screen) {
    case "login":
      return (
        <LoginScreen
          onCreateAccount={() => setScreen("signup")}
          onOpenPrivacy={() => openLegal("privacy", "login")}
          onOpenTerms={() => openLegal("terms", "login")}
          onSuccess={() => setScreen("profileChoice")}
        />
      );

    case "signup":
      return (
        <SignupScreen
          onLogin={() => setScreen("login")}
          onOpenPrivacy={() => openLegal("privacy", "signup")}
          onOpenTerms={() => openLegal("terms", "signup")}
          onSuccess={() => setScreen("profileChoice")}
        />
      );

    case "terms":
      return (
        <LegalDocumentScreen
          type="terms"
          onBack={() => setScreen(legalReturnScreen)}
        />
      );

    case "privacy":
      return (
        <LegalDocumentScreen
          type="privacy"
          onBack={() => setScreen(legalReturnScreen)}
        />
      );

    case "profileChoice":
      return (
        <ProfileChoiceScreen
          onBack={() => setScreen("login")}
          isDarkMode={isDarkMode}
          onContinue={(profile) => {
            if (profile === "profissional") {
              void openProfessionalArea();
            } else {
              setScreen("clientHome");
            }
          }}
          onProfilePress={() => openAccountProfile("profileChoice")}
        />
      );

    case "accountProfile":
      return (
        <AccountProfileScreen
          isDarkMode={isDarkMode}
          onBack={() => setScreen(profileReturnScreen)}
          onSave={() => setScreen(profileReturnScreen)}
          onSignOut={() => setScreen("login")}
          onDeleteAccount={() => setScreen("signup")}
        />
      );

    default:
      return null;
  }
}

/* ------------------------------------------------------------------------
 * CLIENT NAVIGATION
 * Contexto: cliente — home, busca, anúncios, trabalhos, perfil de
 * profissional, mensagens, configurações.
 * ---------------------------------------------------------------------- */

function ClientNavigation({ nav }: { nav: AppNavigation }) {
  const {
    screen,
    setScreen,
    isDarkMode,
    setIsDarkMode,
    clientWorkReturnScreen,
    clientProfileReturnScreen,
    selectedClientService,
    selectedProfessionalId,
    contractedClientServices,
    openAccountProfile,
    openClientTab,
    openClientProfile,
    openClientServiceDetails,
    addContractedService,
    updateContractedServiceStatus,
  } = nav;

  switch (screen) {
    case "clientHome":
      return (
        <ClientHomePage
          onNavigate={(tab) => openClientTab(tab, "clientHome")}
          onOpenProfessional={(professionalId) =>
            openClientProfile(professionalId, "clientHome")
          }
          onProfilePress={() => openAccountProfile("clientHome")}
          onBack={() => setScreen("profileChoice")}
        />
      );

    case "clientSearch":
      return (
        <ClientSearchPage
          onBack={() => setScreen("clientHome")}
          onNavigate={(tab) => openClientTab(tab, "clientSearch")}
          onOpenProfessional={(professionalId) =>
            openClientProfile(professionalId, "clientSearch")
          }
          onProfilePress={() => openAccountProfile("clientSearch")}
        />
      );

    case "clientAds":
      return (
        <ClientAdsPage
          onContractService={addContractedService}
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
          onToggleDarkMode={setIsDarkMode}
        />
      );

    case "clientWork":
      return (
        <ClientMyWorkPage
          extraServices={contractedClientServices}
          onChangeExtraServiceStatus={updateContractedServiceStatus}
          onNavigate={(tab) => openClientTab(tab)}
          onProfilePress={() => openAccountProfile("clientHome")}
          onOpenProfessional={(professionalId) =>
            openClientProfile(professionalId, "clientWork")
          }
          onOpenDetail={openClientServiceDetails}
          onBack={() => setScreen(clientWorkReturnScreen)}
        />
      );

    case "clientServiceDetails":
      if (!selectedClientService) return null;
      return (
        <ServiceDetailsScreen
          service={toServiceDetailsItem(selectedClientService)}
          participantLabel="Profissional contratado"
          onBack={() => setScreen("clientWork")}
          onMessage={() => setScreen("clientServiceMessage")}
          onProfilePress={() => openAccountProfile("clientServiceDetails")}
          onStatusAction={() => setScreen("clientWork")}
        />
      );

    case "clientServiceMessage":
      if (!selectedClientService) return null;
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

/* ------------------------------------------------------------------------
 * PROFESSIONAL NAVIGATION
 * Contexto: profissional — setup e home.
 * ---------------------------------------------------------------------- */

function ProfessionalNavigation({ nav }: { nav: AppNavigation }) {
  const { screen, setScreen, isDarkMode, setIsDarkMode, openAccountProfile } = nav;

  switch (screen) {
    case "professionalSetup":
      return (
        <ProfessionalSetupScreen
          onBack={() => setScreen("profileChoice")}
          onProfilePress={() => openAccountProfile("professionalSetup")}
          onSave={() => setScreen("professionalHome")}
        />
      );

    case "professionalHome":
      return (
        <ProfessionalHomeScreen
          onBack={() => setScreen("profileChoice")}
          onProfilePress={() => openAccountProfile("professionalHome")}
          onSignOut={() => setScreen("login")}
          isDarkMode={isDarkMode}
          onToggleDarkMode={setIsDarkMode}
        />
      );

    default:
      return null;
  }
}

/* ------------------------------------------------------------------------
 * ROOT NAVIGATOR
 * Ponto único de decisão: em qual contexto a tela atual está? Delega para
 * o sub-navegador correspondente.
 * ---------------------------------------------------------------------- */

function RootNavigator({ nav }: { nav: AppNavigation }) {
  const group = screenGroups[nav.screen];

  switch (group) {
    case "auth":
      return <AuthNavigation nav={nav} />;
    case "client":
      return <ClientNavigation nav={nav} />;
    case "professional":
      return <ProfessionalNavigation nav={nav} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------
 * APP
 * Ponto de entrada: apenas tema global e composição do shell visual.
 * ---------------------------------------------------------------------- */

export default function App() {
  const nav = useAppNavigation();

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={nav.isDarkMode ? darkThemeVars : lightThemeVars}
    >
      <StatusBar style={nav.isDarkMode ? "light" : "dark"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          className={`flex-1 w-full bg-background ${
            nav.isProfessionalScreen ? "" : "items-center"
          }`}
        >
          <RootNavigator nav={nav} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
