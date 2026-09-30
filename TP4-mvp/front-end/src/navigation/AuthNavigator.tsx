import {
  LegalDocumentScreen,
  LoginScreen,
  ProfileChoiceScreen,
  SignupScreen,
} from "../pages";
import type { AppNavigation } from "./useAppNavigation";
import type { AuthScreen } from "./types";

type AuthNavigatorProps = {
  screen: AuthScreen | "profileChoice";
  navigation: AppNavigation;
  isDarkMode: boolean;
};

export function AuthNavigator({
  screen,
  navigation,
  isDarkMode,
}: AuthNavigatorProps) {
  const {
    setScreen,
    legalReturnScreen,
    setLegalReturnScreen,
    openAccountProfile,
    openProfessionalArea,
    authenticate,
  } = navigation;

  switch (screen) {
    case "login":
      return (
        <LoginScreen
          onCreateAccount={() => setScreen("signup")}
          onOpenPrivacy={() => {
            setLegalReturnScreen("login");
            setScreen("privacy");
          }}
          onOpenTerms={() => {
            setLegalReturnScreen("login");
            setScreen("terms");
          }}
          onSuccess={() => { void authenticate(); }}
        />
      );

    case "signup":
      return (
        <SignupScreen
          onLogin={() => setScreen("login")}
          onOpenPrivacy={() => {
            setLegalReturnScreen("signup");
            setScreen("privacy");
          }}
          onOpenTerms={() => {
            setLegalReturnScreen("signup");
            setScreen("terms");
          }}
          onSuccess={() => { void authenticate(); }}
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

    default:
      return null;
  }
}
