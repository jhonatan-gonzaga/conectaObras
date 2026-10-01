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
    authenticate,
    signupRole,
    setSignupRole,
    authUser,
    profileReturnScreen,
    selectPersona,
  } = navigation;

  switch (screen) {
    case "login":
      return (
        <LoginScreen
          onCreateAccount={() => setScreen("profileChoice")}
          onOpenPrivacy={() => {
            setLegalReturnScreen("login");
            setScreen("privacy");
          }}
          onOpenTerms={() => {
            setLegalReturnScreen("login");
            setScreen("terms");
          }}
          onSuccess={() => { void authenticate(true); }}
        />
      );

    case "signup":
      return (
        <SignupScreen
          role={signupRole}
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
          activeRole={authUser?.role === "PROFISSIONAL" ? "profissional" : "cliente"}
          isAuthenticated={Boolean(authUser)}
          onBack={() => setScreen(authUser ? profileReturnScreen : "login")}
          isDarkMode={isDarkMode}
          onContinue={(profile) => selectPersona(profile === "profissional" ? "PROFISSIONAL" : "CLIENTE")}
        />
      );

    default:
      return null;
  }
}
