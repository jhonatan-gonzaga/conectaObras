import { useState } from "react";

import type { ClientNavKey } from "../components/cliente";
import { api } from "../services/api";
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

  return {
    screen,
    setScreen,
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
    openProfessionalArea,
    openClientTab,
  };
}

export type AppNavigation = ReturnType<typeof useAppNavigation>;
