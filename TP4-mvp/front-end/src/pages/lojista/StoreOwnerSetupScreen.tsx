import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { NativeDateTimeField } from "../../components/native-date-time-field";
import { ApiError, api } from "../../services/api";
import { emptyStoreForm, maskCep, maskCnpj, maskPhone, pendingLabels, resumeStore, storeDays, storeFieldLabel, storePayload, validateStore, type StoreErrors, type StoreForm } from "../../services/store-form";

type Props = { onComplete: () => void; onSwitchProfile: () => void; onSignOut: () => void };
const steps = ["Dados comerciais", "Endereço", "Horários", "Revisão"];

export function StoreOwnerSetupScreen({ onComplete, onSwitchProfile, onSignOut }: Props) {
  const [form, setForm] = useState<StoreForm>(emptyStoreForm);
  const [saved, setSaved] = useState(JSON.stringify(emptyStoreForm()));
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<StoreErrors>({});
  const [pending, setPending] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const dirty = JSON.stringify(form) !== saved;

  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError(null);
    async function load() {
      let foundStore = false;
      try {
        const store = await api.myStore();
        foundStore = true;
        if (!current) return;
        const restored = resumeStore(store);
        setForm(restored); setSaved(JSON.stringify(restored)); setExists(true); setStatus(store.status);
        if (store.status !== "ACTIVE") {
          const decision = await api.storeActivationReadiness();
          if (current) { setPending(decision.pending); setReady(decision.allowed && !decision.pending.length); }
        }
      } catch (cause) {
        if (!current) return;
        if (!foundStore && cause instanceof ApiError && cause.status === 404) {
          const empty = emptyStoreForm();
          setForm(empty); setSaved(JSON.stringify(empty)); setExists(false); setReady(false);
        } else setLoadError(cause instanceof ApiError ? cause.message : "Não foi possível carregar a loja.");
      } finally { if (current) setLoading(false); }
    }
    void load();
    return () => { current = false; };
  }, [loadAttempt]);

  function leave(action: () => void) {
    if (busy) return;
    if (!dirty) { action(); return; }
    Alert.alert("Alterações não salvas", "Salve o rascunho antes de sair para retomar estas alterações depois.", [
      { text: "Continuar editando", style: "cancel" },
      { text: "Descartar alterações", style: "destructive", onPress: action },
    ]);
  }
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      leave(onSwitchProfile); return true;
    });
    return () => handler.remove();
  });

  function change(update: (value: StoreForm) => StoreForm) {
    setForm(update); setErrors({}); setError(null); setSuccess(null); setReady(false);
  }
  function showApiError(cause: unknown) {
    setError(cause instanceof ApiError ? cause.message : "Não foi possível salvar a loja.");
    if (cause instanceof ApiError && cause.details?.pending?.length) {
      setPending(cause.details.pending); setReady(false); setStep(3);
      const fields: StoreErrors = {};
      for (const code of cause.details.pending) {
        const key = code.startsWith("CNPJ") ? "cnpj" : code.startsWith("PHONE") ? "phone" : code === "STORE_NAME_REQUIRED" ? "name" : code === "ADDRESS_REQUIRED" ? "address.street" : "openingHours";
        fields[key] = pendingLabels[code] ?? code;
      }
      setErrors(fields);
    }
  }
  async function save() {
    if (busy) return;
    const invalid = validateStore(form, status !== "DRAFT");
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      const first = Object.keys(invalid)[0];
      setStep(first.startsWith("address.") ? 1 : first === "openingHours" || first.includes("Time") ? 2 : 0);
      setError("Revise os campos indicados antes de salvar."); return;
    }
    setBusy(true); setError(null); setSuccess(null); setReady(false);
    try {
      const store = await api.saveMyStore(storePayload(form));
      const restored = resumeStore(store);
      setForm(restored); setSaved(JSON.stringify(restored)); setExists(true); setStatus(store.status);
      setSuccess(store.status === "DRAFT" ? "Rascunho salvo. Você pode retomar o cadastro depois." : "Dados da loja salvos com sucesso.");
      if (store.status !== "ACTIVE") {
        const decision = await api.storeActivationReadiness();
        setPending(decision.pending); setReady(decision.allowed && !decision.pending.length);
      }
    } catch (cause) { showApiError(cause); }
    finally { setBusy(false); }
  }
  async function activate() {
    if (busy || dirty || !ready || pending.length || status === "ACTIVE") return;
    setBusy(true); setError(null);
    try {
      const store = await api.changeMyStoreStatus("ACTIVE");
      setStatus(store.status); setReady(false); setSuccess("Loja ativada com sucesso.");
    } catch (cause) { setReady(false); showApiError(cause); }
    finally { setBusy(false); }
  }
  function field(key: string, label: string, value: string, onChange: (text: string) => void, numeric = false, maxLength?: number) {
    return <View key={key} className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-foreground">{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!busy}
        keyboardType={numeric ? "phone-pad" : "default"} maxLength={maxLength}
        autoCapitalize={key === "address.state" ? "characters" : "sentences"}
        multiline={key === "description"} placeholder={key === "name" ? "Ex.: Materiais do Centro" : label}
        className="min-h-12 rounded-xl border border-input-border bg-card px-4 py-3 text-foreground" />
      {errors[key] ? <Text accessibilityRole="alert" className="mt-1 text-sm text-primary">{errors[key]}</Text> : null}
    </View>;
  }
  function button(label: string, action: () => void, disabled = false) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action}
      className="my-2 min-h-12 items-center justify-center rounded-xl bg-primary px-4" style={{ opacity: disabled ? 0.5 : 1 }}>
      <Text className="font-bold text-white">{label}</Text>
    </Pressable>;
  }

  if (loading) return <View className="flex-1 items-center justify-center"><ActivityIndicator /><Text>Carregando loja...</Text></View>;
  if (loadError) return <View className="flex-1 justify-center gap-3 px-5"><Text accessibilityRole="alert">{loadError}</Text>
    {button("Tentar novamente", () => setLoadAttempt((value) => value + 1))}{button("Trocar perfil", onSwitchProfile)}</View>;

  const activationErrors = validateStore(form, true);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView keyboardShouldPersistTaps="handled" className="w-full max-w-[560px] flex-1 bg-background px-5"
    contentContainerStyle={{ paddingVertical: 24, paddingBottom: 48 }}>
    <Text className="text-2xl font-bold text-foreground">{exists ? "Editar loja" : "Cadastre sua loja"}</Text>
    <Text className="my-2 text-muted-foreground">{dirty ? "Alterações não salvas" : exists ? "Dados salvos na sua conta" : "Novo rascunho"} · {status}</Text>
    <View className="mb-4 flex-row justify-between">
      <Pressable accessibilityRole="button" onPress={() => leave(onSwitchProfile)}><Text className="text-primary">Trocar perfil</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => leave(onSignOut)}><Text className="text-primary">Sair da conta</Text></Pressable>
    </View>
    <Text className="mb-4 text-lg font-semibold text-foreground">Etapa {step + 1} de 4: {steps[step]}</Text>
    {step === 0 ? <>
      {field("name", "Nome da loja", form.name, (value) => change((old) => ({ ...old, name: value })), false, 120)}
      {field("cnpj", "CNPJ", form.cnpj, (value) => change((old) => ({ ...old, cnpj: maskCnpj(value) })), true, 18)}
      {field("phone", "Telefone", form.phone, (value) => change((old) => ({ ...old, phone: maskPhone(value) })), true, 15)}
      {field("whatsapp", "WhatsApp", form.whatsapp, (value) => change((old) => ({ ...old, whatsapp: maskPhone(value) })), true, 15)}
      {field("description", "Descrição", form.description, (value) => change((old) => ({ ...old, description: value })), false, 1000)}
    </> : step === 1 ? <>
      {([ ["street", "Rua"], ["number", "Número"], ["neighborhood", "Bairro"], ["city", "Cidade"], ["state", "UF"], ["zipCode", "CEP"], ["complement", "Complemento"] ] as const).map(([key, label]) =>
        field(`address.${key}`, label, form.address[key], (value) => change((old) => ({ ...old, address: { ...old.address, [key]: key === "zipCode" ? maskCep(value) : value } })), key === "zipCode", key === "state" ? 2 : key === "zipCode" ? 9 : key === "number" ? 20 : key === "complement" ? 160 : 120))}
    </> : step === 2 ? <>
      {storeDays.map(([day, label]) => {
        const hour = form.openingHours.find((value) => value.dayOfWeek === day)!;
        const updateHour = (values: Partial<typeof hour>) => change((old) => ({ ...old, openingHours: old.openingHours.map((value) => value.dayOfWeek === day ? { ...value, ...values } : value) }));
        return <View key={day} className="mb-4 rounded-xl bg-card p-4">
          <Text className="font-bold text-foreground">{label}</Text>
          <View className="my-2 flex-row items-center justify-between"><Text className="text-foreground">Fechado</Text>
            <Switch accessibilityLabel={`${label} fechado`} value={hour.closed} disabled={busy} onValueChange={(closed) => updateHour({ closed, openingTime: null, closingTime: null })} /></View>
          <View pointerEvents={hour.closed || busy ? "none" : "auto"} accessibilityElementsHidden={hour.closed} importantForAccessibility={hour.closed ? "no-hide-descendants" : "auto"} style={{ opacity: hour.closed ? 0.4 : 1 }}>
            <NativeDateTimeField disabled={hour.closed || busy} mode="time" label={`Abertura ${label}`} placeholder="HH:mm" value={hour.openingTime ?? ""} onChange={(openingTime) => updateHour({ openingTime })} status={errors[`${day}.openingTime`] ? "error" : "default"} helperText={errors[`${day}.openingTime`]} />
            <NativeDateTimeField disabled={hour.closed || busy} mode="time" label={`Fechamento ${label}`} placeholder="HH:mm" value={hour.closingTime ?? ""} onChange={(closingTime) => updateHour({ closingTime })} status={errors[`${day}.closingTime`] ? "error" : "default"} helperText={errors[`${day}.closingTime`]} />
          </View>
        </View>;
      })}
      {errors.openingHours ? <Text accessibilityRole="alert">{errors.openingHours}</Text> : null}
    </> : <View className="gap-3 rounded-xl bg-card p-4">
      <Text className="font-bold text-foreground">Resumo antes de ativar</Text>
      <Text className="text-foreground">{form.name || "Nome não informado"} · {form.cnpj || "CNPJ não informado"}</Text>
      <Text className="text-foreground">{form.address.street} {form.address.number} · {form.address.city}</Text>
      {status === "ACTIVE" ? <Text className="text-foreground">Sua loja está ativa.</Text> : <>
        {Object.entries(activationErrors).map(([key, message]) => <Text key={key} className="text-primary">{storeFieldLabel(key)}: {message}</Text>)}
        {pending.map((code) => <Text key={code} className="text-primary">{pendingLabels[code] ?? `Pendência: ${code}`}</Text>)}
        <Text className="text-muted-foreground">Salve e verifique as pendências na API antes de ativar.</Text>
        {ready && !dirty && !pending.length && !Object.keys(activationErrors).length ? button("Ativar loja", () => void activate(), busy) : null}
      </>}
    </View>}
    {error ? <Text accessibilityRole="alert" className="my-3 text-primary">{error}</Text> : null}
    {success ? <Text accessibilityRole="alert" className="my-3 text-foreground">{success}</Text> : null}
    {step > 0 ? button("Etapa anterior", () => { Keyboard.dismiss(); setStep(step - 1); }, busy) : null}
    {step < 3 ? button("Próxima etapa", () => { Keyboard.dismiss(); setStep(step + 1); }, busy) : null}
    {button(busy ? "Salvando..." : "Salvar rascunho", () => void save(), busy)}
    {error ? button("Tentar salvar novamente", () => void save(), busy) : null}
    {exists ? button("Ir para o painel", () => leave(onComplete), busy) : null}
  </ScrollView></KeyboardAvoidingView>;
}
