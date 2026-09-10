import {
  ProfessionalHomeScreen,
  ProfessionalSetupScreen,
} from "../components/profissional";
import type { ProfessionalScreen } from "./types";
import type { AppNavigation } from "./useAppNavigation";

type ProfessionalNavigatorProps = {
  screen: ProfessionalScreen;
  navigation: AppNavigation;
  isDarkMode: boolean;
  onToggleDarkMode: (value: boolean) => void;
};

export function ProfessionalNavigator({
  screen,
  navigation,
  isDarkMode,
  onToggleDarkMode,
}: ProfessionalNavigatorProps) {
  const { setScreen, openAccountProfile } = navigation;

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
          onToggleDarkMode={onToggleDarkMode}
        />
      );

    default:
      return null;
  }
}
