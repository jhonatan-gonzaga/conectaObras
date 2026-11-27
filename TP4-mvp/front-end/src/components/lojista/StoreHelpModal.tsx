import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from "react-native";
import { api } from "../../services/api";
import { StoreButton, ui } from "./store-form-ui";

export function StoreHelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  async function send() {
    if (busy) return;
    if (message.trim().length < 10) { setError("Descreva sua dúvida com pelo menos 10 caracteres."); return; }
    setBusy(true); setError(null);
    try { await api.createSupportTicket({ subject: "Ajuda com cadastro da loja", message: message.trim(), context: "LOJA-006" }); setSent(true); setMessage(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(28,27,28,0.4)" }}>
      <View style={ui.card}><Text style={ui.sectionTitle}>Precisa de ajuda?</Text>{sent ? <Text accessibilityRole="alert" style={ui.caption}>Sua solicitação foi enviada ao suporte.</Text> : <><Text style={ui.caption}>Conte o que está impedindo você de cadastrar ou editar a loja.</Text><TextInput accessibilityLabel="Mensagem para o suporte" placeholder="Descreva sua dúvida..." value={message} onChangeText={setMessage} editable={!busy} multiline maxLength={2000} style={[ui.input, { minHeight: 120, textAlignVertical: "top" }]} />{error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}<StoreButton label={busy ? "Enviando..." : "Enviar ao suporte"} disabled={busy} onPress={() => void send()} /></>}<StoreButton label="Fechar ajuda" secondary disabled={busy} onPress={() => { onClose(); setSent(false); setError(null); }} /></View>
    </KeyboardAvoidingView>
  </Modal>;
}
