import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { StoreHelpModal } from "../../components/lojista/StoreHelpModal";
import { StoreAddressFields, StoreButton, StoreCard, StoreCommercialFields, StoreContactFields, StoreFeedback, StoreHours, StoreLoadState, StoreReview, StoreImagePreview, colors, ui } from "../../components/lojista/store-form-ui";
import { ProfessionalHeader } from "../../components/profissional/components/navigation";
import { useStoreForm } from "./useStoreForm";

type Props = { onBack: () => void; onPreview: () => void; onAccount: () => void; onSwitchProfile: () => void; onSignOut: () => void };

export function StoreOwnerEditScreen({ onBack, onPreview, onAccount, onSwitchProfile, onSignOut }: Props) {
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
    <ProfessionalHeader onBack={() => editor.leave(onBack)} onProfilePress={() => editor.leave(onAccount)} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      <View><Text style={ui.sectionTitle}>Ajustes da loja</Text><Text style={ui.caption}>{editor.dirty ? "Alterações não salvas" : "Informações da sua loja"}</Text></View>
      <View style={{ borderRadius: 28, overflow: "hidden", backgroundColor: colors.card }}>
        <LinearGradient colors={["#99333a", "#b94b50", "#ddc0bf"]} style={{ height: 160 }}>
          {editor.backgroundUri ? <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}><StoreImagePreview uri={editor.backgroundUri} label="Fundo da loja" /></View> : null}
          <View style={{ padding: 16, alignItems: "flex-end", gap: 10 }}><View style={{ backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={ui.link}>{editor.status === "ACTIVE" ? "Loja ativa" : editor.status === "INACTIVE" ? "Loja inativa" : "Em cadastro"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Editar fundo da loja" disabled={editor.busy} onPress={() => void editor.selectImage("background")} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 10 }}><Ionicons name="camera-outline" size={20} color={colors.primary} /></Pressable></View>
        </LinearGradient>
        <View style={{ padding: 20, paddingTop: 0, gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel="Editar capa da loja" disabled={editor.busy} onPress={() => void editor.selectImage("cover")} style={[ui.logo, { marginTop: -30, borderWidth: 4, borderColor: "white" }]}><StoreImagePreview uri={editor.coverUri} label="Capa da loja" /></Pressable><Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>{editor.form.name || "Sua loja"}</Text><Text style={ui.caption}>ID da loja: {editor.profile?.id}</Text><Text style={ui.caption}>Gerencie os dados apresentados aos seus clientes</Text></View>
      </View>
      <StoreCard title="Informações Básicas" subtitle="Identidade visual e dados comerciais" icon="information-circle-outline"><StoreCommercialFields editor={editor} /></StoreCard>
      <StoreCard title="Localização e Endereço" icon="location-outline" action={<Pressable accessibilityRole="button" onPress={() => void openMap()} style={{ padding: 8 }}><Text style={ui.link}>Mapa</Text></Pressable>}><StoreAddressFields editor={editor} />{mapError ? <Text accessibilityRole="alert" style={ui.error}>{mapError}</Text> : null}</StoreCard>
      <StoreCard title="Atendimento & Contato" subtitle="Canais diretos com seus compradores" icon="headset-outline"><StoreContactFields editor={editor} /><View style={ui.labelRow}><Text style={ui.label}>Horário de Funcionamento</Text><Pressable accessibilityRole="button" accessibilityState={{ expanded: hours }} onPress={() => setHours(!hours)}><Text style={ui.link}>{hours ? "Ocultar dias" : "Ver dias"}</Text></Pressable></View>{hours || Object.keys(editor.errors).some((key) => key.includes("Time") || key === "openingHours") ? <StoreHours editor={editor} /> : <Text style={ui.caption}>{editor.form.openingHours.filter((day) => !day.closed).length} dia(s) com atendimento. Toque em Ver dias para editar.</Text>}</StoreCard>
      {editor.status !== "ACTIVE" ? <StoreReview editor={editor} /> : null}
      <StoreFeedback editor={editor} />
      <StoreButton label={editor.busy ? "Salvando..." : "Salvar Alterações"} icon="checkmark" disabled={editor.busy} onPress={() => void editor.save()} />
      <StoreButton label="Visualizar Loja como Cliente" icon="eye-outline" secondary disabled={editor.busy || !editor.exists} onPress={() => editor.leave(onPreview)} />
      <View style={ui.labelRow}><Pressable accessibilityRole="button" onPress={() => editor.leave(onSwitchProfile)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Trocar perfil</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setHelp(true)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Precisa de ajuda?</Text></Pressable><Pressable accessibilityRole="button" onPress={() => editor.leave(onSignOut)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Sair</Text></Pressable></View>
    </ScrollView>
    <StoreHelpModal visible={help} onClose={() => setHelp(false)} />
  </KeyboardAvoidingView>;
}
