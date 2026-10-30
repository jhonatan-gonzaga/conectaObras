import "./global.css";

import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { RootNavigator } from "./navigation/RootNavigator";
import { isProfessionalContextScreen } from "./navigation/types";
import { useAppNavigation } from "./navigation/useAppNavigation";
import { AppThemeContext, appThemeStyles } from "./components/app-theme";

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigation = useAppNavigation();
  const isProfessionalScreen = isProfessionalContextScreen(navigation.screen);
  const theme = isDarkMode ? appThemeStyles.dark : appThemeStyles.light;

  return (
    <AppThemeContext.Provider value={theme}>
      <SafeAreaProvider>
        <SafeAreaView
          className="flex-1 bg-background"
          style={theme}
        >
          <StatusBar style={isDarkMode ? "light" : "dark"} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            <View
              className={`flex-1 w-full bg-background ${
                isProfessionalScreen ? "" : "items-center"
              }`}
            >
              <RootNavigator
                navigation={navigation}
                isDarkMode={isDarkMode}
                onToggleDarkMode={setIsDarkMode}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </AppThemeContext.Provider>
  );
}
