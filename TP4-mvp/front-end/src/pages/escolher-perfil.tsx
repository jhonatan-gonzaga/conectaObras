import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { ProfileCard } from "../components/app-components";

const logo = require("../../assets/logotipo.png");

type ProfileType = "cliente" | "profissional";

export function ProfileChoiceScreen({
  onBack,
  onContinue,
  isDarkMode = false,
}: {
  onBack: () => void;
  onContinue: (profile: ProfileType) => void;
  isDarkMode?: boolean;
}) {
  const { height } = useWindowDimensions();
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>("cliente");

  return (
    <ScrollView
      className="w-full max-w-[480px] bg-background"
      contentContainerStyle={{ minHeight: height }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full bg-background" style={{ minHeight: height }}>
      <View className="flex-row items-center justify-between px-5 pb-4 pt-12">
        <Pressable
          onPress={onBack}
          className="h-9 w-9 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Voltar para entrar"
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDarkMode ? "#eb747a" : "#0f1720"}
          />
        </Pressable>

        <Image
          source={logo}
          className="h-10 w-[150px]"
          resizeMode="contain"
          accessibilityLabel="Conecta Obras Itacoatiara"
        />

        <View className="h-10 w-10" />
      </View>

      <View className="h-px bg-muted" />

      <View className="items-center px-5 pb-6 pt-7">
        <View className="mb-5 rounded-full bg-[#f7e8e9] px-5 py-2">
          <Text className="text-sm font-bold uppercase tracking-[1.6px] text-primary">
            Ola, bem-vindo(a)!
          </Text>
        </View>

        <Text className="mb-3 text-center text-3xl font-bold text-foreground">
          Informe o seu perfil
        </Text>
        <Text className="mb-8 text-center text-base leading-7 text-muted-foreground">
          Selecione o tipo de conta que melhor descreve voce para
          personalizarmos sua experiencia.
        </Text>

        <View
          className="w-full gap-4"
          accessibilityRole="radiogroup"
        >
          <ProfileCard
            label="Cliente"
            description="Busque por servicos e produtos locais"
            icon="person-outline"
            selected={selectedProfile === "cliente"}
            onPress={() => setSelectedProfile("cliente")}
          />
          <ProfileCard
            label="Profissional"
            description="Ofereca sua mao de obra e servicos"
            icon="color-palette-outline"
            selected={selectedProfile === "profissional"}
            onPress={() => setSelectedProfile("profissional")}
          />
        </View>
      </View>

      <View className="mt-auto px-5 pb-8 pt-2">
        <Pressable
          onPress={() => onContinue(selectedProfile)}
          className="min-h-[56px] items-center justify-center rounded-[24px] bg-primary px-6"
          accessibilityRole="button"
          accessibilityLabel={`Continuar como ${selectedProfile}`}
        >
          <Text className="text-base font-semibold text-white">Continuar</Text>
        </Pressable>
      </View>
      </View>
    </ScrollView>
  );
}
