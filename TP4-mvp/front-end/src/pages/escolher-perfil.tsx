import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { ProfileCard } from "../components/app-components";
import { ApiError, api, type StoreIdentity } from "../services/api";

const logo = require("../../assets/logotipo.png");

type ProfileType = "cliente" | "profissional" | "lojista" | "loja";

export function ProfileChoiceScreen({
  onBack,
  onContinue,
  activeRole = "cliente",
  isAuthenticated = false,
  isDarkMode = false,
}: {
  onBack: () => void;
  onContinue: (profile: ProfileType) => void | Promise<void>;
  activeRole?: ProfileType;
  isAuthenticated?: boolean;
  isDarkMode?: boolean;
}) {
  const { height } = useWindowDimensions();
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>(activeRole);
  const [isContinuing, setIsContinuing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [store, setStore] = useState<StoreIdentity | null>(null);
  const [storeLookupError, setStoreLookupError] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setStore(null); setStoreLookupError(false); return; }
    let active = true;
    setStoreLookupError(false);
    api.storeIdentity()
      .then((identity) => { if (active) setStore(identity); })
      .catch((error) => {
        if (!active) return;
        setStore(null);
        setStoreLookupError(!(error instanceof ApiError && error.status === 404));
      });
    return () => { active = false; };
  }, [isAuthenticated]);

  const handleContinue = async () => {
    if (isContinuing) return;
    setIsContinuing(true);
    setSubmitError(null);
    try {
      await onContinue(selectedProfile);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Nao foi possivel trocar de perfil.");
    } finally {
      setIsContinuing(false);
    }
  };

  return (
    <ScrollView
      className="w-full max-w-[480px] bg-background"
      contentContainerStyle={{ minHeight: height }}
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full bg-background" style={{ minHeight: height }}>
      <View className="flex-row items-center justify-between px-5 py-4">
        <Pressable
          onPress={onBack}
          className="h-11 w-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={isAuthenticated ? "Voltar" : "Voltar para entrar"}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDarkMode ? "#eb747a" : "#0f1720"}
          />
        </Pressable>

        <Text className="text-base font-bold text-foreground">Escolher Perfil</Text>

        <View className="h-10 w-10" />
      </View>

      <View className="h-px bg-muted" />

      <View className="items-center px-5 pb-6 pt-7">
        <Image source={logo} className="mb-6 h-12 w-[200px]" resizeMode="contain" accessibilityLabel="Conecta Obras Itacoatiara" />
        <View className="mb-5 rounded-full bg-[#f7e8e9] px-5 py-2">
          <Text className="text-sm font-bold uppercase tracking-[1.6px] text-primary">
            {isAuthenticated ? "Perfil ativo" : "Ola, bem-vindo(a)!"}
          </Text>
        </View>

        <Text className="mb-3 text-center text-[22px] font-extrabold text-foreground">
          Como você quer usar o aplicativo?
        </Text>
        <Text className="mb-6 text-center text-sm leading-6 text-muted-foreground">
          Escolha seu acesso. Cliente e Loja usam sua conta de cliente. Profissional e Dono de Loja têm cadastros próprios; seus perfis continuam salvos.
        </Text>

        <View
          className="w-full gap-4"
          accessibilityRole="radiogroup"
        >
          <ProfileCard
            label="Cliente"
            description="Busque por servicos e produtos locais"
            icon="bag-outline"
            selected={selectedProfile === "cliente"}
            onPress={() => setSelectedProfile("cliente")}
          />
          <ProfileCard
            label="Profissional"
            description="Ofereca sua mao de obra e servicos"
            icon="construct-outline"
            selected={selectedProfile === "profissional"}
            onPress={() => setSelectedProfile("profissional")}
          />
          <ProfileCard
            label="Dono de Loja"
            description={store ? "Sua loja já está cadastrada. Toque para acessar o painel." : storeLookupError ? "Não foi possível consultar sua loja. Você ainda pode acessar o perfil Lojista." : "Cadastre sua loja e venda produtos locais"}
            icon="storefront-outline"
            selected={selectedProfile === "lojista"}
            onPress={() => setSelectedProfile("lojista")}
          />
          {store?.name?.trim() ? <Text className="px-4 text-sm font-semibold text-primary">{store.name}</Text> : null}
          <ProfileCard
            label="Loja"
            description="Comercial · Veja lojas, produtos e compras"
            icon="bag-outline"
            selected={selectedProfile === "loja"}
            onPress={() => setSelectedProfile("loja")}
          />
        </View>
      </View>

      <View className="mt-auto px-5 pb-8 pt-2">
        <Pressable
          onPress={() => { void handleContinue(); }}
          disabled={isContinuing}
          className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-[24px] bg-primary px-6"
          accessibilityRole="button"
          accessibilityLabel={`Continuar como ${selectedProfile}`}
        >
          {isContinuing ? <ActivityIndicator color="#ffffff" /> : null}
          <Text className="text-base font-semibold text-white">
            {isContinuing ? "Trocando perfil..." : isAuthenticated ? `Continuar como ${selectedProfile}` : "Continuar"}
          </Text>
        </Pressable>
        {submitError ? <Text accessibilityRole="alert" className="mt-3 text-center text-sm font-semibold text-primary">{submitError}</Text> : null}
      </View>
      </View>
    </ScrollView>
  );
}
