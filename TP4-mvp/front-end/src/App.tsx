import "./global.css";

import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { vars } from "nativewind";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { RootNavigator } from "./navigation/RootNavigator";
import { isProfessionalContextScreen } from "./navigation/types";
import { useAppNavigation } from "./navigation/useAppNavigation";

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

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Inter: Inter_400Regular, InterMedium: Inter_500Medium, InterSemiBold: Inter_600SemiBold, InterBold: Inter_700Bold, InterExtraBold: Inter_800ExtraBold });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigation = useAppNavigation();
  const isProfessionalScreen = isProfessionalContextScreen(navigation.screen);

  if (!fontsLoaded && !fontError) return <View className="flex-1 items-center justify-center bg-[#fbf6f7]"><ActivityIndicator accessibilityLabel="Carregando fontes" color="#b94b50" /></View>;

  return (
    <SafeAreaProvider>
      <SafeAreaView
        className="flex-1 bg-background"
        style={isDarkMode ? darkThemeVars : lightThemeVars}
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
  );
}
