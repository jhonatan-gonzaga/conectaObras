import { AccountProfileScreen } from "../pages";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AuthNavigator } from "./AuthNavigator";
import { ClientNavigator } from "./ClientNavigator";
import { ProfessionalNavigator } from "./ProfessionalNavigator";
import { StoreOwnerNavigator } from "./StoreOwnerNavigator";
import { guardPersonaScreen } from "./persona-routing";
import {
  isAuthContextScreen,
  isClientContextScreen,
  isProfessionalContextScreen,
  isStoreOwnerContextScreen,
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
  const { screen: currentScreen, setScreen, profileReturnScreen } = navigation;
  if (!navigation.isSessionReady) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator accessibilityLabel="Restaurando sessao" /><Text className="mt-3 text-sm text-muted-foreground">Restaurando sessao...</Text></View>;
  }
  if (navigation.sessionError) {
    return <View className="flex-1 items-center justify-center gap-4 px-8"><Text accessibilityRole="alert" className="text-center text-primary">{navigation.sessionError}</Text><Pressable accessibilityRole="button" onPress={navigation.retrySessionRestore} className="rounded-xl bg-primary px-5 py-3"><Text className="font-bold text-white">Tentar novamente</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { void navigation.signOut(); }}><Text className="font-semibold text-muted-foreground">Sair da sessao</Text></Pressable></View>;
  }
  const screen = guardPersonaScreen(currentScreen, navigation.authUser?.role ?? null, navigation.hasStore);

  if (screen === "accountProfile") {
    return (
      <AccountProfileScreen
        isDarkMode={isDarkMode}
        onBack={() => setScreen(profileReturnScreen)}
        onSave={() => setScreen(profileReturnScreen)}
        onSignOut={() => { void navigation.signOut(); }}
        onDeleteAccount={() => setScreen("signup")}
        canSwitchProfile={navigation.authUser?.role === "CLIENTE" || navigation.authUser?.role === "PROFISSIONAL" || navigation.authUser?.role === "LOJISTA"}
        onSwitchProfile={() => setScreen("profileChoice")}
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

  if (isStoreOwnerContextScreen(screen)) {
    return <StoreOwnerNavigator screen={screen} navigation={navigation} />;
  }

  return null;
}
