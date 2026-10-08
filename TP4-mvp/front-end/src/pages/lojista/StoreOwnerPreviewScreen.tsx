import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, Image, ScrollView, Text, View } from "react-native";
import { api } from "../../services/api";
import { maskCnpj, maskPhone, storeDays, type StoreProfile } from "../../services/store-form";
import { StoreButton, StoreCard, colors, ui } from "../../components/lojista/store-form-ui";

export function StoreOwnerPreviewScreen({ onBack }: { onBack: () => void }) {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setStore(null); setError(null);
    void api.myStore().then((data) => { if (current) setStore(data); }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a loja."); });
    return () => { current = false; };
  }, [attempt]);
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => handler.remove();
  }, [onBack]);
  return <ScrollView style={ui.page} contentContainerStyle={ui.content}>
    <StoreButton label="Voltar aos ajustes" secondary icon="arrow-back" onPress={onBack} />
    <Text style={ui.caption}>Prévia dos dados salvos · esta visualização não publica a loja</Text>
    {error ? <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><StoreButton label="Tentar novamente" onPress={() => setAttempt((value) => value + 1)} /></> : !store ? <ActivityIndicator color={colors.primary} /> : <>
      <View style={[ui.card, { alignItems: "center" }]}><View style={ui.logo}>{store.logoUrl ? <Image accessibilityLabel="Logo da loja" source={{ uri: store.logoUrl }} style={{ width: "100%", height: "100%" }} /> : <Ionicons name="storefront-outline" size={34} color={colors.primary} />}</View><Text style={{ color: colors.text, fontSize: 28, fontWeight: "700" }}>{store.name || "Sua loja"}</Text><Text style={ui.caption}>{store.status === "ACTIVE" ? "Loja ativa" : "Loja ainda não está ativa"}</Text><Text style={ui.caption}>{store.description || "Descrição não informada"}</Text>{store.cnpj ? <Text style={ui.caption}>CNPJ: {maskCnpj(store.cnpj)}</Text> : null}</View>
      <StoreCard title="Localização" icon="location-outline"><Text style={ui.label}>{[store.address?.street, store.address?.number].filter(Boolean).join(", ") || "Endereço não informado"}</Text><Text style={ui.caption}>{[store.address?.neighborhood, store.address?.city, store.address?.state].filter(Boolean).join(" · ")}</Text>{store.address?.complement ? <Text style={ui.caption}>{store.address.complement}</Text> : null}</StoreCard>
      <StoreCard title="Contato e atendimento" icon="headset-outline"><Text style={ui.label}>Telefone: {store.phone ? maskPhone(store.phone) : "Não informado"}</Text><Text style={ui.label}>WhatsApp: {store.whatsapp ? maskPhone(store.whatsapp) : "Não informado"}</Text>{storeDays.map(([day, label]) => { const hours = store.openingHours?.find((entry) => entry.dayOfWeek === day); return <View key={day} style={ui.labelRow}><Text style={ui.caption}>{label}</Text><Text style={ui.caption}>{!hours || hours.closed ? "Fechado" : `${hours.openingTime} às ${hours.closingTime}`}</Text></View>; })}</StoreCard>
    </>}
  </ScrollView>;
}
