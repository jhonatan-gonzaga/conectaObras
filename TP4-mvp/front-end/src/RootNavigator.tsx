import { AccountProfileScreen } from "../pages";
import { AuthNavigator } from "./AuthNavigator";
import { ClientNavigator } from "./ClientNavigator";
import { ProfessionalNavigator } from "./ProfessionalNavigator";
import {
  isAuthContextScreen,
  isClientContextScreen,
  isProfessionalContextScreen,
} from "./types";
import type { AppNavigation } from "./useAppNavigation";

type RootNavigatorProps = {
  navigation: AppNavigation;
  isDarkMode: boolean;
  onToggleDarkMode: (value: boolean) => void;
};

/**
 * Unico ponto de decisao de "qual tela mostrar", delegando cada
 * contexto (autenticacao, cliente, profissional) ao seu proprio navigator.
 */
export function RootNavigator({
  navigation,
  isDarkMode,
  onToggleDarkMode,
}: RootNavigatorProps) {
  const { screen, setScreen, profileReturnScreen } = navigation;

  if (screen === "accountProfile") {
    return (
      <AccountProfileScreen
        isDarkMode={isDarkMode}
        onBack={() => setScreen(profileReturnScreen)}
        onSave={() => setScreen(profileReturnScreen)}
        onSignOut={() => setScreen("login")}
        onDeleteAccount={() => setScreen("signup")}
      />
    );
  }

  if (isAuthContextScreen(screen)) {
    return (
      <AuthNavigator
        screen={screen}
        navigation={navigation}
        isDarkMode={isDarkMode}
      />
    );
  }

  if (isClientContextScreen(screen)) {
    return (
      <ClientNavigator
        screen={screen}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    );
  }

  if (isProfessionalContextScreen(screen)) {
    return (
      <ProfessionalNavigator
        screen={screen}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    );
  }

  return null;
}
