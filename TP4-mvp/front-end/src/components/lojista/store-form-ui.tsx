import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { NativeDateTimeField } from "../native-date-time-field";
import { maskCep, maskCnpj, maskPhone, pendingLabels, storeDays, storeFieldLabel, validateStore } from "../../services/store-form";
import type { useStoreForm } from "../../pages/lojista/useStoreForm";

export type StoreEditor = ReturnType<typeof useStoreForm>;
type Icon = ComponentProps<typeof Ionicons>["name"];
export const colors = { background: "#fdf8f9", card: "#ffffff", input: "#f7f2f3", primary: "#99333a", accent: "#b94b50", text: "#1c1b1c", muted: "#645d58", border: "#e6e1e2" };

export function StoreButton({ label, onPress, disabled = false, secondary = false, icon }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; icon?: Icon }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[ui.button, secondary && ui.secondaryButton, disabled && { opacity: 0.5 }]}>
    {icon ? <Ionicons name={icon} size={19} color={secondary ? colors.primary : "white"} /> : null}
    <Text style={[ui.buttonText, secondary && { color: colors.primary }]}>{label}</Text>
  </Pressable>;
}
export function StoreCard({ title, subtitle, icon, children, action }: { title: string; subtitle?: string; icon: Icon; children: ReactNode; action?: ReactNode }) {
  return <View style={ui.card}>
    <View style={ui.sectionHeader}><View style={ui.iconBox}><Ionicons name={icon} size={22} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={ui.sectionTitle}>{title}</Text>{subtitle ? <Text style={ui.caption}>{subtitle}</Text> : null}</View>{action}</View>
    {children}
  </View>;
}
export function StoreField({ editor, field, label, placeholder, numeric = false, limit, required = false }: { editor: StoreEditor; field: string; label: string; placeholder?: string; numeric?: boolean; limit?: number; required?: boolean }) {
  const addressKey = field.startsWith("address.") ? field.slice(8) as keyof typeof editor.form.address : null;
  const key = field as "name" | "cnpj" | "phone" | "whatsapp" | "description";
  const value = addressKey ? editor.form.address[addressKey] : editor.form[key];
  const valid = editor.registration && !!value.trim() && !editor.validationErrors[field] && !editor.errors[field];
  return <View style={ui.field}>
    <View style={ui.labelRow}><Text style={ui.label}>{label}{required ? " *" : ""}</Text>{field === "description" ? <Text style={ui.caption}>{value.length} / 1000</Text> : null}{valid ? <Text accessibilityLabel={`${label} válido`}><Ionicons name="checkmark-circle" size={18} color="#15803d" /></Text> : null}</View>
    <TextInput accessibilityLabel={label} value={value} editable={!editor.busy} keyboardType={numeric ? "phone-pad" : "default"} maxLength={limit} multiline={field === "description"} autoCapitalize={field === "address.state" ? "characters" : "sentences"} placeholder={placeholder ?? label} placeholderTextColor="#897171" style={[ui.input, valid && ui.validInput, field === "description" && { minHeight: 100, textAlignVertical: "top" }, editor.errors[field] && { borderColor: colors.accent }]}
      onChangeText={(text) => editor.change((old) => addressKey ? { ...old, address: { ...old.address, [addressKey]: addressKey === "zipCode" ? maskCep(text) : text } } : { ...old, [key]: key === "cnpj" ? maskCnpj(text) : key === "phone" || key === "whatsapp" ? maskPhone(text) : text })} />
    {editor.errors[field] ? <Text accessibilityRole="alert" style={ui.error}>{editor.errors[field]}</Text> : null}
  </View>;
}
export function StoreLogo({ editor }: { editor: StoreEditor }) {
  return <View style={ui.logoRow}>
    <View style={ui.logo}>{editor.profile?.logoUrl ? <Image accessibilityLabel="Logo da loja" source={{ uri: editor.profile.logoUrl }} style={{ width: "100%", height: "100%" }} /> : <Ionicons name="storefront-outline" size={36} color={colors.primary} />}</View>
    <View style={{ flex: 1 }}><Text style={ui.label}>Identidade visual</Text><Text style={ui.caption}>JPG ou PNG · até 5 MB</Text><Pressable accessibilityRole="button" disabled={editor.busy || !editor.exists} accessibilityState={{ disabled: editor.busy || !editor.exists }} onPress={() => void editor.uploadLogo()} style={{ paddingVertical: 10 }}><Text style={ui.link}>{editor.profile?.logoUrl ? "Alterar logo" : "Adicionar logo"}</Text></Pressable>{!editor.exists ? <Text style={ui.caption}>Conclua o cadastro para adicionar o logo nos ajustes da loja.</Text> : null}</View>
  </View>;
}
export function StoreCommercialFields({ editor }: { editor: StoreEditor }) {
  return <><StoreLogo editor={editor} /><StoreField editor={editor} field="name" label="Nome da loja" placeholder="Ex.: Armazém Central & Co." limit={120} required /><StoreField editor={editor} field="cnpj" label="CNPJ" placeholder="00.000.000/0001-00" numeric limit={18} /><StoreField editor={editor} field="description" label="Descrição" placeholder="Apresente sua loja, especialidades e diferenciais..." limit={1000} /></>;
}
export function StoreAddressFields({ editor }: { editor: StoreEditor }) {
  return <><View style={ui.row}><View style={{ flex: 1 }}><StoreField editor={editor} field="address.zipCode" label="CEP" placeholder="00000-000" numeric limit={9} /></View><Pressable accessibilityRole="button" accessibilityLabel="Buscar CEP" disabled={editor.busy} onPress={() => void editor.searchCep()} style={ui.cepButton}><Ionicons name="search-outline" size={19} color={colors.primary} /><Text style={ui.link}>Buscar</Text></Pressable></View>
    <StoreField editor={editor} field="address.street" label="Rua" placeholder="Rua / Avenida" limit={120} />
    <View style={ui.row}><View style={{ flex: 1 }}><StoreField editor={editor} field="address.number" label="Número" limit={20} /></View><View style={{ flex: 2 }}><StoreField editor={editor} field="address.complement" label="Complemento" placeholder="Galpão, sala, referência..." limit={160} /></View></View>
    <StoreField editor={editor} field="address.neighborhood" label="Bairro" limit={120} />
    <View style={ui.row}><View style={{ flex: 3 }}><StoreField editor={editor} field="address.city" label="Cidade" limit={120} /></View><View style={{ flex: 1 }}><StoreField editor={editor} field="address.state" label="UF" limit={2} /></View></View></>;
}
export function StoreContactFields({ editor }: { editor: StoreEditor }) {
  return <><StoreField editor={editor} field="phone" label="Telefone" placeholder="(92) 3200-0000" numeric limit={15} /><StoreField editor={editor} field="whatsapp" label="WhatsApp" placeholder="(92) 99999-9999" numeric limit={15} /></>;
}
export function StoreHours({ editor }: { editor: StoreEditor }) {
  return <View style={{ gap: 12 }}>{storeDays.map(([day, label]) => {
    const hour = editor.form.openingHours.find((entry) => entry.dayOfWeek === day)!;
    const update = (values: Partial<typeof hour>) => editor.change((old) => ({ ...old, openingHours: old.openingHours.map((entry) => entry.dayOfWeek === day ? { ...entry, ...values } : entry) }));
    return <View key={day} style={ui.day}><View style={ui.sectionHeader}><Text style={[ui.label, { flex: 1 }]}>{label}</Text><Text style={ui.caption}>{hour.closed ? "Fechado" : "Aberto"}</Text><Switch accessibilityLabel={`${label} fechado`} value={hour.closed} disabled={editor.busy} trackColor={{ true: "#ddc0bf", false: "#e6e1e2" }} thumbColor={hour.closed ? colors.primary : "#fff"} onValueChange={(closed) => update({ closed, openingTime: null, closingTime: null })} /></View>
      <View style={[ui.row, hour.closed && { opacity: 0.4 }]} accessibilityElementsHidden={hour.closed} importantForAccessibility={hour.closed ? "no-hide-descendants" : "auto"}>
        <View style={{ flex: 1 }}><NativeDateTimeField disabled={hour.closed || editor.busy} mode="time" label={`Abertura ${label}`} placeholder="HH:mm" value={hour.openingTime ?? ""} onChange={(openingTime) => update({ openingTime })} status={editor.errors[`${day}.openingTime`] ? "error" : editor.registration && !hour.closed && !editor.validationErrors[`${day}.openingTime`] ? "valid" : "default"} helperText={editor.errors[`${day}.openingTime`]} /></View>
        <View style={{ flex: 1 }}><NativeDateTimeField disabled={hour.closed || editor.busy} mode="time" label={`Fechamento ${label}`} placeholder="HH:mm" value={hour.closingTime ?? ""} onChange={(closingTime) => update({ closingTime })} status={editor.errors[`${day}.closingTime`] ? "error" : editor.registration && !hour.closed && !editor.validationErrors[`${day}.closingTime`] ? "valid" : "default"} helperText={editor.errors[`${day}.closingTime`]} /></View>
      </View></View>;
  })}{editor.errors.openingHours ? <Text accessibilityRole="alert" style={ui.error}>{editor.errors.openingHours}</Text> : null}</View>;
}
export function StoreReview({ editor, onActivated }: { editor: StoreEditor; onActivated?: () => void }) {
  const invalid = validateStore(editor.form, true);
  return <StoreCard title="Resumo antes de ativar" subtitle="Confira os dados e as pendências do cadastro" icon="shield-checkmark-outline">
    {editor.status === "ACTIVE" ? <Text style={ui.caption}>Sua loja está ativa.</Text> : <>
      {Object.entries(invalid).map(([key, message]) => <Text key={key} style={ui.error}>{storeFieldLabel(key)}: {message}</Text>)}
      {editor.pending.map((code) => <Text key={code} style={ui.error}>{pendingLabels[code] ?? `Pendência: ${code}`}</Text>)}
      <Text style={ui.caption}>{editor.ready && !editor.dirty ? "Cadastro salvo e verificado. Você pode ativar sua loja." : "Salve e verifique as pendências antes de ativar."}</Text>
      {editor.ready && !editor.dirty && !editor.pending.length && !Object.keys(invalid).length ? <StoreButton label="Ativar loja" disabled={editor.busy} icon="checkmark-circle-outline" onPress={() => { void editor.activate().then((ok) => { if (ok) onActivated?.(); }); }} /> : null}
    </>}
  </StoreCard>;
}
export function StoreFeedback({ editor, onSaved }: { editor: StoreEditor; onSaved?: () => void }) {
  return <>{editor.busy ? <ActivityIndicator accessibilityLabel="Processando alterações da loja" color={colors.primary} /> : null}{editor.error ? <Text accessibilityRole="alert" style={ui.error}>{editor.error}</Text> : null}{editor.success ? <View style={ui.notice}><Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} /><Text accessibilityRole="alert" style={{ flex: 1, color: colors.primary }}>{editor.success}</Text></View> : null}{editor.error ? <StoreButton label={editor.retryErrorLabel} secondary onPress={() => { void editor.retryError().then((ok) => { if (ok) onSaved?.(); }); }} disabled={editor.busy} /> : null}</>;
}
export function StoreLoadState({ editor, onBack }: { editor: StoreEditor; onBack: () => void }) {
  return <View style={[ui.page, { alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }]}>{editor.loading ? <><ActivityIndicator color={colors.primary} /><Text style={ui.caption}>Carregando loja...</Text></> : <><Text accessibilityRole="alert" style={ui.error}>{editor.loadError}</Text><StoreButton label="Tentar novamente" onPress={editor.retryLoad} /><StoreButton label="Voltar" secondary onPress={onBack} /></>}</View>;
}
export const ui = StyleSheet.create({
  page: { flex: 1, width: "100%", backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 32, gap: 20, width: "100%", maxWidth: 720, alignSelf: "center" },
  card: { backgroundColor: colors.card, borderRadius: 28, padding: 20, gap: 16, borderWidth: 1, borderColor: "#f1edee" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff0f0", alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  labelRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  field: { gap: 8 },
  input: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.input, color: colors.text, borderRadius: 16, fontSize: 14, borderWidth: 1, borderColor: "transparent" },
  validInput: { borderColor: "#15803d", backgroundColor: "#f0fdf4" },
  error: { color: colors.primary, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  link: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  button: { minHeight: 50, borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent },
  secondaryButton: { backgroundColor: "#ece7e8" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  logoRow: { flexDirection: "row", gap: 16, alignItems: "center", paddingVertical: 8 },
  logo: { width: 82, height: 82, borderRadius: 22, backgroundColor: "#fff0f0", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  cepButton: { marginTop: 26, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eae1da", paddingHorizontal: 14, borderRadius: 16 },
  day: { paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  notice: { backgroundColor: "#fff0f0", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
});
