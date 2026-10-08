import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { StoreHelpModal } from "../../components/lojista/StoreHelpModal";
import { StoreAddressFields, StoreButton, StoreCard, StoreCommercialFields, StoreContactFields, StoreFeedback, StoreHours, StoreLoadState, StoreReview, colors, ui } from "../../components/lojista/store-form-ui";
import { useStoreForm } from "./useStoreForm";

type Props = { onComplete: () => void; onSwitchProfile: () => void; onSignOut: () => void; onBack?: () => void };
const steps = ["Dados da loja", "Localização", "Contato e horários"];

export function StoreOwnerSetupScreen({ onComplete, onSwitchProfile, onSignOut, onBack = onSwitchProfile }: Props) {
  const editor = useStoreForm();
  const [help, setHelp] = useState(false);
  function back() {
    Keyboard.dismiss();
    if (editor.step > 0) editor.setStep(editor.step - 1);
    else editor.leave(onBack);
  }
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => handler.remove();
  });
  function next() { Keyboard.dismiss(); editor.setStep(editor.step + 1); }
  if (editor.loading || editor.loadError) return <StoreLoadState editor={editor} onBack={onBack} />;
  return <KeyboardAvoidingView style={ui.page} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      <View style={ui.sectionHeader}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" disabled={editor.busy} onPress={back} style={{ padding: 10 }}><Ionicons name="arrow-back" size={23} color={colors.text} /></Pressable><Text style={[ui.caption, { flex: 1 }]}>CADASTRO DA LOJA</Text><Pressable accessibilityRole="button" onPress={() => editor.leave(onSignOut)}><Text style={ui.link}>Sair da conta</Text></Pressable></View>
      <View style={{ gap: 12 }}><View style={ui.sectionHeader}><Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} /><Text style={ui.link}>Prepare sua loja para começar</Text></View><Text style={{ fontSize: 30, lineHeight: 38, fontWeight: "700", color: colors.text }}>Bem-vindo ao seu painel</Text><Text style={{ fontSize: 14, lineHeight: 22, color: colors.muted }}>Cadastre sua loja para gerenciar produtos, pedidos e vendas com facilidade.</Text></View>
      <View style={{ gap: 10 }}><View style={ui.labelRow}><Text style={ui.label}>Passo {editor.step + 1} de 3</Text><Text style={ui.caption}>{steps[editor.step]}</Text></View><View style={ui.row}>{steps.map((title, index) => <View key={title} style={{ height: 5, flex: 1, borderRadius: 4, backgroundColor: index <= editor.step ? colors.primary : colors.border }} />)}</View><Text style={ui.caption}>{editor.dirty ? "Alterações não salvas" : editor.exists ? "Rascunho salvo na sua conta" : "Cadastre sua loja"}</Text></View>
      {editor.step === 0 ? <StoreCard title="Dados da Loja" subtitle="Identidade visual e dados comerciais principais" icon="storefront-outline"><StoreCommercialFields editor={editor} /></StoreCard> : editor.step === 1 ? <StoreCard title="Localização & Endereço" subtitle="Para entregas e retirada presencial" icon="location-outline"><StoreAddressFields editor={editor} /></StoreCard> : <>
        <StoreCard title="Contato & Atendimento" subtitle="Canais de contato com seus compradores" icon="headset-outline"><StoreContactFields editor={editor} /></StoreCard>
        <StoreCard title="Horário de Funcionamento" subtitle="Configure abertura e fechamento para cada dia" icon="time-outline"><StoreHours editor={editor} /></StoreCard>
        <StoreReview editor={editor} onActivated={onComplete} />
      </>}
      <StoreFeedback editor={editor} />
      {editor.step < 2 ? <StoreButton label="Próxima etapa" icon="arrow-forward" disabled={editor.busy} onPress={next} /> : <StoreButton label={editor.busy ? "Salvando..." : "Concluir Cadastro da Loja"} icon="checkmark" disabled={editor.busy} onPress={() => { void editor.save(true).then((ok) => { if (ok) onComplete(); }); }} />}
      <StoreButton label="Salvar rascunho" icon="bookmark-outline" secondary disabled={editor.busy} onPress={() => void editor.save()} />
      {editor.step > 0 ? <StoreButton label="Etapa anterior" secondary disabled={editor.busy} onPress={back} /> : null}
      {editor.exists ? <StoreButton label="Ir para o painel" secondary icon="grid-outline" disabled={editor.busy} onPress={() => editor.leave(onComplete)} /> : null}
      <View style={ui.labelRow}><Pressable accessibilityRole="button" onPress={() => editor.leave(onSwitchProfile)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Trocar perfil</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setHelp(true)} style={{ paddingVertical: 12 }}><Text style={ui.link}>Precisa de ajuda?</Text></Pressable></View>
    </ScrollView><StoreHelpModal visible={help} onClose={() => setHelp(false)} />
  </KeyboardAvoidingView>;
}
