import { useEffect, useState } from "react";

import type { ClientNavKey } from "../components/cliente";
import { ApiError, api, restoreAccessToken, type AuthUser, type SelectableUserRole, type StoreDashboardList } from "../services/api";
import type {
  ClientProfileReturnScreen,
  ClientWorkReturnScreen,
  ClientWorkService,
  ProfileReturnScreen,
  ReturnScreen,
  Screen,
} from "./types";

export function useAppNavigation() {
  const [screen, setScreen] = useState<Screen>("login");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [hasStore, setHasStore] = useState(false);
  const [signupRole, setSignupRole] = useState<SelectableUserRole>("CLIENTE");
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [storeListReturnScreen, setStoreListReturnScreen] = useState<"storeOwnerEdit" | "storeOwnerDashboard">("storeOwnerDashboard");
  const [storeListKind, setStoreListKind] = useState<StoreDashboardList>("active-products");
  const [storeListStatus, setStoreListStatus] = useState<string | undefined>();
  const [profileReturnScreen, setProfileReturnScreen] =
    useState<ProfileReturnScreen>("clientHome");
  const [clientWorkReturnScreen, setClientWorkReturnScreen] =
    useState<ClientWorkReturnScreen>("clientHome");
  const [clientProfileReturnScreen, setClientProfileReturnScreen] =
    useState<ClientProfileReturnScreen>("clientHome");
  const [legalReturnScreen, setLegalReturnScreen] =
    useState<ReturnScreen>("login");
  const [selectedClientService, setSelectedClientService] =
    useState<ClientWorkService | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<
    string | null
  >(null);
  const [contractedClientServices, setContractedClientServices] = useState<
    ClientWorkService[]
  >([]);

  const openAccountProfile = (from: ProfileReturnScreen) => {
    setProfileReturnScreen(from);
    setScreen("accountProfile");
  };

  const routeForAuthenticatedUser = async (user: AuthUser) => {
    setAuthUser(user);
    if (user.role === "CLIENTE") { setHasStore(false); setScreen("clientHome"); return; }
    if (user.role === "PROFISSIONAL") {
      setHasStore(false);
      try { await api.professionalMe(); setScreen("professionalHome"); }
      catch { setScreen("professionalSetup"); }
      return;
    }
    if (user.role === "LOJISTA") {
      try { await api.myStore(); setHasStore(true); setScreen("storeOwnerDashboard"); }
      catch (error) {
        if (error instanceof Error && "status" in error && (error as { status?: number }).status === 404) { setHasStore(false); setScreen("storeOwnerSetup"); }
        else { setHasStore(true); setScreen("storeOwnerDashboard"); }
      }
      return;
    }
    await api.logout(); setAuthUser(null); setScreen("login");
  };

  const authenticate = async (showProfileChoice = false) => {
    try {
      const user = await api.me();
      if (showProfileChoice && (user.role === "CLIENTE" || user.role === "PROFISSIONAL" || user.role === "LOJISTA")) {
        setAuthUser(user);
        setHasStore(false);
        setScreen("profileChoice");
        return;
      }
      await routeForAuthenticatedUser(user);
    }
    catch { await signOut(); }
  };

  const selectPersona = async (role: SelectableUserRole) => {
    if (!authUser) {
      setSignupRole(role);
      setScreen("signup");
      return;
    }

    const response = await api.switchRole(role);
    setAuthUser(response.user);
    await routeForAuthenticatedUser(response.user);
  };

  const signOut = async () => {
    await api.logout();
    setAuthUser(null); setHasStore(false); setSelectedClientService(null); setSelectedProfessionalId(null);
    setContractedClientServices([]); setStoreListKind("active-products"); setStoreListStatus(undefined); setStoreListReturnScreen("storeOwnerDashboard");
    setProfileReturnScreen("clientHome"); setClientWorkReturnScreen("clientHome");
    setClientProfileReturnScreen("clientHome"); setLegalReturnScreen("login"); setScreen("login");
  };

  const restoreSession = async () => {
    setSessionError(null);
    try {
      const token = await restoreAccessToken();
      if (token) {
        try { await routeForAuthenticatedUser(await api.me()); }
        catch (error) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) await api.logout();
          else setSessionError(error instanceof Error ? error.message : "Nao foi possivel restaurar a sessao.");
        }
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Nao foi possivel restaurar a sessao.");
    } finally { setIsSessionReady(true); }
  };

  useEffect(() => {
    void restoreSession();
  }, []);

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

  return {
    screen,
    setScreen,
    authUser,
    hasStore,
    signupRole,
    setSignupRole,
    selectPersona,
    markStoreRegistered: () => setHasStore(true),
    markStoreMissing: () => setHasStore(false),
    isSessionReady,
    sessionError,
    retrySessionRestore: () => { setIsSessionReady(false); void restoreSession(); },
    authenticate,
    signOut,
    storeListReturnScreen,
    setStoreListReturnScreen,
    storeListKind,
    setStoreListKind,
    storeListStatus,
    setStoreListStatus,
    profileReturnScreen,
    clientWorkReturnScreen,
    clientProfileReturnScreen,
    setClientProfileReturnScreen,
    legalReturnScreen,
    setLegalReturnScreen,
    selectedClientService,
    setSelectedClientService,
    selectedProfessionalId,
    setSelectedProfessionalId,
    contractedClientServices,
    setContractedClientServices,
    openAccountProfile,
    openClientTab,
  };
}

export type AppNavigation = ReturnType<typeof useAppNavigation>;
