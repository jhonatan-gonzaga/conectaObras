import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ApiError, api } from "../../services/api";

export function StoreOwnerSetupScreen({ onComplete, onSignOut }: { onComplete: () => void; onSignOut: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError("Informe o nome da loja."); return; }
    if (loading) return;
    setLoading(true); setError(null);
    try { await api.saveMyStore({ name: name.trim(), phone: phone.trim() || undefined, description: description.trim() || undefined }); onComplete(); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Nao foi possivel salvar a loja."); }
    finally { setLoading(false); }
  };

  return <ScrollView className="w-full max-w-[480px] flex-1 bg-background px-5" contentContainerStyle={{ justifyContent: "center", flexGrow: 1, paddingVertical: 32 }}>
    <View className="mb-2 flex-row items-center justify-between"><Text className="text-2xl font-bold text-foreground">Cadastre sua loja</Text><Pressable onPress={onSignOut} accessibilityRole="button" accessibilityLabel="Sair da conta" className="rounded-xl bg-card px-3 py-2"><Text className="font-semibold text-primary">Sair</Text></Pressable></View>
    <Text className="mb-6 text-sm leading-6 text-muted-foreground">Preencha os dados iniciais para acessar o painel. Voce podera completar o cadastro depois.</Text>
    {[{ label: "Nome da loja", value: name, change: setName, placeholder: "Ex.: Materiais do Centro" }, { label: "Telefone", value: phone, change: setPhone, placeholder: "(92) 99999-9999" }, { label: "Descricao", value: description, change: setDescription, placeholder: "O que sua loja oferece?" }].map((field) => <View key={field.label} className="mb-4"><Text className="mb-2 text-sm font-semibold text-foreground">{field.label}</Text><TextInput value={field.value} onChangeText={field.change} placeholder={field.placeholder} multiline={field.label === "Descricao"} className="min-h-12 rounded-xl border border-input-border bg-card px-4 py-3 text-foreground" placeholderTextColor="#7a6568" /></View>)}
    {error ? <Text accessibilityRole="alert" className="mb-4 text-sm text-primary">{error}</Text> : null}
    <Pressable onPress={() => void save()} disabled={loading} accessibilityRole="button" className="mt-2 min-h-14 items-center justify-center rounded-2xl bg-primary"><Text className="font-bold text-white">{loading ? "Salvando..." : "Criar loja"}</Text></Pressable>
  </ScrollView>;
}
