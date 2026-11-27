import { Ionicons } from "@expo/vector-icons";
import { RecordingPresets, useAudioRecorder } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AudioRecordingState, startAudioRecording, stopAndUploadAudio } from "../../services/audio-upload";
import { ApiError, api, type SupportQueue, type SupportTicket, type SupportTicketDetail } from "../../services/api";
import { pickAndUploadImage } from "../../services/image-upload";

const statusLabels: Record<SupportTicket["status"], string> = { OPEN: "Aberto", IN_REVIEW: "Em atendimento", RESOLVED: "Resolvido" };
const filters: { label: string; value?: SupportTicket["status"] }[] = [
  { label: "Todos" }, { label: "Abertos", value: "OPEN" }, { label: "Em atendimento", value: "IN_REVIEW" }, { label: "Resolvidos", value: "RESOLVED" },
];

function Action({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} className={`min-h-11 items-center justify-center rounded-xl px-4 ${secondary ? "border border-input-border bg-card" : "bg-primary"} ${disabled ? "opacity-50" : ""}`}>
    <Text className={`text-sm font-semibold ${secondary ? "text-primary" : "text-white"}`}>{label}</Text>
  </Pressable>;
}

function TicketCard({ ticket, onPress }: { ticket: SupportTicket; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir chamado ${ticket.subject}`} onPress={onPress} className="mb-3 gap-2 rounded-2xl border border-input-border bg-card p-4">
    <View className="flex-row items-start justify-between gap-3"><Text className="flex-1 text-base font-semibold text-foreground">{ticket.subject}</Text><Ionicons name="chevron-forward" size={18} color="#b94b50" /></View>
    {ticket.user ? <Text className="text-sm text-muted-foreground">{ticket.user.name} · {ticket.user.role}</Text> : null}
    <Text className="text-xs font-semibold text-primary">{statusLabels[ticket.status]} · {new Date(ticket.updatedAt).toLocaleDateString("pt-BR")}</Text>
  </Pressable>;
}

export function SupportDashboardScreen({ onOpenTicket, onProfile, onSignOut }: { onOpenTicket: (id: string) => void; onProfile: () => void; onSignOut: () => void }) {
  const [status, setStatus] = useState<SupportTicket["status"] | undefined>();
  const [data, setData] = useState<SupportQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (page = 1) => {
    setLoading(true); setError(null);
    try { setData(await api.supportQueue({ status, page, limit: 20 })); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os chamados."); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 22, paddingBottom: 36 }}>
      <View className="mb-6 flex-row items-center justify-between"><View><Text className="text-xs font-semibold uppercase tracking-wider text-primary">Conecta Obras</Text><Text className="text-2xl font-bold text-foreground">Central de suporte</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={onProfile}><Ionicons name="person-circle-outline" size={32} color="#b94b50" /></Pressable></View>
      <Text className="mb-5 text-sm text-muted-foreground">Atenda solicitações e acompanhe o histórico de cada chamado.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5"><View className="flex-row gap-2">{filters.map((item) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: status === item.value }} onPress={() => { setStatus(item.value); setData(null); }} className={`rounded-full px-4 py-2 ${status === item.value ? "bg-primary" : "bg-card"}`}><Text className={status === item.value ? "font-semibold text-white" : "text-foreground"}>{item.label}</Text></Pressable>)}</View></ScrollView>
      {loading && !data ? <Text accessibilityRole="alert" className="py-8 text-center text-muted-foreground">Carregando chamados...</Text> : null}
      {error ? <View className="mb-4 gap-3"><Text accessibilityRole="alert" className="text-primary">{error}</Text><Action label="Tentar novamente" onPress={() => void load(data?.page ?? 1)} /></View> : null}
      {!error && !loading && data?.items.length === 0 ? <Text className="py-8 text-center text-muted-foreground">Nenhum chamado neste filtro.</Text> : null}
      {!error && data?.items.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onPress={() => onOpenTicket(ticket.id)} />)}
      {data && data.total > data.limit ? <View className="mt-4 flex-row items-center justify-between"><Action label="Anterior" secondary disabled={loading || data.page <= 1} onPress={() => void load(data.page - 1)} /><Text className="text-muted-foreground">{data.page} / {Math.ceil(data.total / data.limit)}</Text><Action label="Próxima" secondary disabled={loading || data.page * data.limit >= data.total} onPress={() => void load(data.page + 1)} /></View> : null}
      <View className="mt-8"><Action label="Atualizar chamados" secondary disabled={loading} onPress={() => void load(data?.page ?? 1)} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" onPress={onSignOut} className="mt-5 items-center"><Text className="text-sm text-muted-foreground">Sair da conta</Text></Pressable>
    </ScrollView>
  </View>;
}

export function MySupportTicketsScreen({ onOpenTicket, onBack }: { onOpenTicket: (id: string) => void; onBack: () => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTickets(await api.mySupportTickets()); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar seus chamados."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => {
    if (subject.trim().length < 3 || message.trim().length < 10) { setError("Informe assunto e descrição com pelo menos 3 e 10 caracteres."); return; }
    setBusy(true); setError(null);
    try { const ticket = await api.createSupportTicket({ subject: subject.trim(), message: message.trim() }); setSubject(""); setMessage(""); onOpenTicket(ticket.id); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Não foi possível criar o chamado."); }
    finally { setBusy(false); }
  };
  return <View className="w-full max-w-[560px] flex-1 bg-background"><ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 22, paddingBottom: 36 }}>
    <View className="mb-5 flex-row items-center gap-3"><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao perfil" onPress={onBack}><Ionicons name="arrow-back" size={24} color="#b94b50" /></Pressable><Text className="text-2xl font-bold text-foreground">Meus chamados</Text></View>
    <View className="mb-6 gap-3 rounded-2xl bg-card p-4"><Text className="text-lg font-semibold text-foreground">Pedir ajuda</Text><TextInput accessibilityLabel="Assunto do chamado" value={subject} onChangeText={setSubject} maxLength={120} placeholder="Assunto" className="min-h-11 rounded-xl border border-input-border px-3 text-foreground" /><TextInput accessibilityLabel="Descrição do chamado" value={message} onChangeText={setMessage} maxLength={2000} multiline placeholder="Descreva o problema" className="min-h-24 rounded-xl border border-input-border px-3 py-3 text-foreground" /><Action label={busy ? "Enviando..." : "Criar chamado"} disabled={busy} onPress={() => void create()} /></View>
    {error ? <Text accessibilityRole="alert" className="mb-4 text-primary">{error}</Text> : null}
    <Text className="mb-3 text-lg font-semibold text-foreground">Histórico</Text>
    {loading ? <Text className="text-muted-foreground">Carregando chamados...</Text> : tickets.length === 0 ? <Text className="text-muted-foreground">Você ainda não abriu chamados.</Text> : tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onPress={() => onOpenTicket(ticket.id)} />)}
    <View className="mt-3"><Action label="Atualizar histórico" secondary onPress={() => void load()} /></View>
  </ScrollView></View>;
}

export function SupportTicketScreen({ ticketId, isAgent, onBack }: { ticketId: string; isAgent: boolean; onBack: () => void }) {
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState<AudioRecordingState>({ recording: null, startedAt: null });
  const recordingRef = useRef<AudioRecordingState>({ recording: null, startedAt: null });
  const updateRecording = (state: AudioRecordingState) => { recordingRef.current = state; setRecording(state); };
  useEffect(() => () => { if (recordingRef.current.recording) void recordingRef.current.recording.stop().catch(() => undefined); }, []);
  const load = useCallback(async () => {
    try { setTicket(await api.supportTicket(ticketId)); setError(null); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o chamado."); }
  }, [ticketId]);
  useEffect(() => { void load(); }, [load]);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); await load(); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : "Não foi possível concluir a ação."); }
    finally { setBusy(false); }
  };
  const sendText = () => {
    if (!text.trim()) { setError("Digite uma mensagem."); return; }
    void run(async () => { await api.sendSupportMessage(ticketId, { type: "TEXT", text: text.trim() }); setText(""); });
  };
  const sendImage = () => void run(async () => { const imageUrl = await pickAndUploadImage(); if (imageUrl) await api.sendSupportMessage(ticketId, { type: "IMAGE", imageUrl }); });
  const toggleAudio = () => void run(async () => {
    if (recording.recording) {
      updateRecording({ recording: null, startedAt: null });
      const uploaded = await stopAndUploadAudio(recording);
      if (uploaded) await api.sendSupportMessage(ticketId, { type: "AUDIO", audioUrl: uploaded.url, durationMs: uploaded.durationMs });
    } else updateRecording(await startAudioRecording(recorder));
  });
  const changeStatus = (status: SupportTicket["status"]) => void run(() => api.updateSupportStatus(ticketId, status));
  const transfer = () => void run(async () => { const result = await api.supportWhatsApp(ticketId); await Linking.openURL(result.url); });
  return <View className="w-full max-w-[560px] flex-1 bg-background"><ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 22, paddingBottom: 36 }}>
    <View className="mb-5 flex-row items-center gap-3"><Pressable accessibilityRole="button" accessibilityLabel="Voltar aos chamados" onPress={onBack}><Ionicons name="arrow-back" size={24} color="#b94b50" /></Pressable><Text className="flex-1 text-xl font-bold text-foreground">{ticket?.subject ?? "Chamado"}</Text></View>
    {error ? <View className="mb-4 gap-2"><Text accessibilityRole="alert" className="text-primary">{error}</Text><Action label="Tentar novamente" secondary onPress={() => void load()} /></View> : null}
    {!ticket ? <Text className="text-muted-foreground">Carregando chamado...</Text> : <>
      <View className="mb-5 gap-2 rounded-2xl bg-card p-4"><Text className="font-semibold text-primary">{statusLabels[ticket.status]}</Text><Text className="text-sm text-muted-foreground">{ticket.user.name} · {ticket.user.role}</Text><Text className="text-foreground">{ticket.message}</Text></View>
      {isAgent ? <View className="mb-5 gap-2"><Text className="text-lg font-semibold text-foreground">Atendimento</Text><View className="flex-row flex-wrap gap-2">{ticket.status === "OPEN" ? <Action label="Iniciar atendimento" disabled={busy} onPress={() => changeStatus("IN_REVIEW")} /> : ticket.status === "IN_REVIEW" ? <><Action label="Resolver chamado" disabled={busy} onPress={() => changeStatus("RESOLVED")} /><Action label="Voltar para aberto" secondary disabled={busy} onPress={() => changeStatus("OPEN")} /></> : <Action label="Reabrir chamado" disabled={busy} onPress={() => changeStatus("IN_REVIEW")} />}{ticket.status !== "RESOLVED" ? <Action label="Continuar no WhatsApp" secondary disabled={busy} onPress={transfer} /> : null}</View></View> : null}
      <Text className="mb-3 text-lg font-semibold text-foreground">Conversa</Text>
      {ticket.messages.length === 0 ? <Text className="mb-4 text-sm text-muted-foreground">Nenhuma resposta ainda.</Text> : ticket.messages.map((item) => <View key={item.id} className="mb-3 gap-1 rounded-2xl bg-card p-4"><Text className="text-xs font-semibold text-primary">{item.actor.name} · {new Date(item.createdAt).toLocaleString("pt-BR")}</Text>{item.type === "TEXT" ? <Text className="text-foreground">{item.text}</Text> : item.type === "IMAGE" && item.imageUrl ? <Image source={{ uri: item.imageUrl }} accessibilityLabel={`Imagem de ${item.actor.name}`} style={{ height: 180, borderRadius: 12 }} resizeMode="contain" /> : item.audioUrl ? <Action label={`Ouvir áudio de ${item.actor.name}`} secondary onPress={() => void Linking.openURL(item.audioUrl!)} /> : null}</View>)}
      {ticket.status !== "RESOLVED" ? <View className="mt-3 gap-2"><TextInput accessibilityLabel="Mensagem para suporte" value={text} onChangeText={setText} maxLength={2000} multiline placeholder="Escreva uma mensagem" className="min-h-24 rounded-xl border border-input-border bg-card px-3 py-3 text-foreground" /><Action label="Enviar mensagem" disabled={busy} onPress={sendText} /><View className="flex-row gap-2"><View className="flex-1"><Action label="Enviar imagem" secondary disabled={busy} onPress={sendImage} /></View><View className="flex-1"><Action label={recording.recording ? "Parar e enviar áudio" : "Gravar áudio"} secondary disabled={busy} onPress={toggleAudio} /></View></View></View> : <Text className="mt-3 text-sm text-muted-foreground">Este chamado está resolvido. Um agente pode reabri-lo para continuar.</Text>}
      <Text className="mb-2 mt-7 text-lg font-semibold text-foreground">Histórico de ações</Text>
      {ticket.auditLogs.map((event) => <Text key={event.id} className="mb-2 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("pt-BR")} · {event.actor.name} · {event.action === "CREATED" ? "Chamado criado" : event.action === "MESSAGE_SENT" ? "Mensagem enviada" : event.action === "WHATSAPP_HANDOFF" ? "Transferência para WhatsApp" : `Status: ${event.toStatus ? statusLabels[event.toStatus] : "alterado"}`}</Text>)}
      <View className="mt-5"><Action label="Atualizar conversa" secondary disabled={busy} onPress={() => void load()} /></View>
    </>}
  </ScrollView></View>;
}
