import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { BackHandler, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { StoreHelpModal } from "../../components/lojista/StoreHelpModal";
import { StoreAddressFields, StoreButton, StoreCard, StoreCommercialFields, StoreContactFields, StoreFeedback, StoreHours, StoreLoadState, StoreReview, colors, ui } from "../../components/lojista/store-form-ui";
import { useStoreForm } from "./useStoreForm";

export type StoreSettingsDestination = "dashboard" | "orders" | "catalog" | "sales" | "messages";
type Props = { onBack: () => void; onPreview: () => void; onAccount: () => void; onNavigate: (destination: StoreSettingsDestination) => void; onSwitchProfile: () => void; onSignOut: () => void };
const tabs = [{ key: "dashboard", label: "Visão", icon: "grid-outline" }, { key: "orders", label: "Pedidos", icon: "receipt-outline" }, { key: "catalog", label: "Catálogo", icon: "cube-outline" }, { key: "sales", label: "Vendas", icon: "wallet-outline" }] as const;

export function StoreOwnerEditScreen({ onBack, onPreview, onAccount, onNavigate, onSwitchProfile, onSignOut }: Props) {
  const editor = useStoreForm();
  const [hours, setHours] = useState(false);
  const [help, setHelp] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => { editor.leave(onBack); return true; });
    return () => handler.remove();
  });
  async function openMap() {
    const { street, number, city, state } = editor.form.address;
    if (!street.trim() || !city.trim()) { setMapError("Preencha rua e cidade para abrir o mapa."); return; }
    try { await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${street}, ${number}, ${city}, ${state}`)}`); setMapError(null); }
    catch { setMapError("Não foi possível abrir o mapa neste dispositivo."); }
  }
  if (editor.loading || editor.loadError) return <StoreLoadState editor={editor} onBack={onBack} />;
  return <KeyboardAvoidingView style={ui.page} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={[ui.sectionHeader, { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.card }]}><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao painel" onPress={() => editor.leave(onBack)} style={{ padding: 8 }}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable><View style={{ flex: 1 }}><Text style={ui.sectionTitle}>Ajustes da loja</Text><Text style={ui.caption}>{editor.dirty ? "Alterações não salvas" : "Informações da sua loja"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Mensagens da loja" onPress={() => editor.leave(() => onNavigate("messages"))} style={{ padding: 8 }}><Ionicons name="chatbubble-outline" size={21} color={colors.muted} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Minha conta" onPress={() => editor.leave(onAccount)} style={{ padding: 8 }}><Ionicons name="person-circle-outline" size={26} color={colors.muted} /></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      <View style={{ borderRadius: 28, overflow: "hidden", backgroundColor: colors.card }}><LinearGradient colors={["#99333a", "#b94b50", "#ddc0bf"]} style={{ height: 126, padding: 20, alignItems: "flex-end" }}><View style={{ backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={ui.link}>{editor.status === "ACTIVE" ? "Loja ativa" : editor.status === "INACTIVE" ? "Loja inativa" : "Em cadastro"}</Text></View></LinearGradient><View style={{ padding: 20, paddingTop: 0, gap: 8 }}><View style={[ui.logo, { marginTop: -30, borderWidth: 4, borderColor: "white" }]}>{editor.profile?.logoUrl ? <Image source={{ uri: editor.profile.logoUrl }} style={{ width: "100%", height: "100%" }} /> : <Ionicons name="storefront-outline" size={32} color={colors.primary} />}</View><Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>{editor.form.name || "Sua loja"}</Text><Text style={ui.caption}>ID da loja: {editor.profile?.id}</Text><Text style={ui.caption}>Gerencie os dados apresentados aos seus clientes</Text></View></View>
      <StoreCard title="Informações Básicas" subtitle="Identidade visual e dados comerciais" icon="information-circle-outline"><StoreCommercialFields editor={editor} /></StoreCard>
      <StoreCard title="Localização e Endereço" icon="location-outline" action={<Pressable accessibilityRole="button" onPress={() => void openMap()} style={{ padding: 8 }}><Text style={ui.link}>Mapa</Text></Pressable>}><StoreAddressFields editor={editor} />{mapError ? <Text accessibilityRole="alert" style={ui.error}>{mapError}</Text> : null}</StoreCard>
      <StoreCard title="Atendimento & Contato" subtitle="Canais diretos com seus compradores" icon="headset-outline"><StoreContactFields editor={editor} /><View style={ui.labelRow}><Text style={ui.label}>Horário de Funcionamento</Text><Pressable accessibilityRole="button" accessibilityState={{ expanded: hours }} onPress={() => setHours(!hours)}><Text style={ui.link}>{hours ? "Ocultar dias" : "Ver dias"}</Text></Pressable></View>{hours || Object.keys(editor.errors).some((key) => key.includes("Time") || key === "openingHours") ? <StoreHours editor={editor} /> : <Text style={ui.caption}>{editor.form.openingHours.filter((day) => !day.closed).length} dia(s) com atendimento. Toque em Ver dias para editar.</Text>}</StoreCard>
      {editor.status !== "ACTIVE" ? <StoreReview editor={editor} /> : null}
      <StoreFeedback editor={editor} />
      <StoreButton label={editor.busy ? "Salvando..." : "Salvar Alterações"} icon="checkmark" disabled={editor.busy} onPress={() => void editor.save()} />
      <StoreButton label="Visualizar Loja como Cliente" icon="eye-outline" secondary disabled={editor.busy || !editor.exists} onPress={() => editor.leave(onPreview)} />
      <View style={ui.labelRow}><Pressable accessibilityRole="button" onPress={() => editor.leave(onSwitchProfile)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Trocar perfil</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setHelp(true)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Precisa de ajuda?</Text></Pressable><Pressable accessibilityRole="button" onPress={() => editor.leave(onSignOut)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Sair</Text></Pressable></View>
    </ScrollView>
    <View style={{ flexDirection: "row", backgroundColor: colors.card, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>{tabs.map((tab) => <Pressable key={tab.key} accessibilityRole="button" onPress={() => editor.leave(() => onNavigate(tab.key))} style={{ flex: 1, alignItems: "center", paddingVertical: 4, gap: 4 }}><Ionicons name={tab.icon} size={21} color={colors.muted} /><Text style={ui.caption}>{tab.label}</Text></Pressable>)}<View accessibilityRole="text" style={{ flex: 1, alignItems: "center", paddingVertical: 4, gap: 4 }}><Ionicons name="options-outline" size={21} color={colors.primary} /><Text style={ui.link}>Ajustes</Text></View></View>
    <StoreHelpModal visible={help} onClose={() => setHelp(false)} />
  </KeyboardAvoidingView>;
}
