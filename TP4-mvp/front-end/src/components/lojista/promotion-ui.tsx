import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

export function PromotionButton({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} className={`min-h-11 items-center justify-center rounded-full px-5 py-3 ${secondary ? "bg-[#f1edee]" : "bg-primary"} ${disabled ? "opacity-40" : ""}`}><Text className={`text-sm font-semibold ${secondary ? "text-foreground" : "text-white"}`}>{label}</Text></Pressable>;
}
export function PromotionHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <View className="flex-row items-center gap-3 bg-card px-5 py-3"><Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} className="h-11 w-11 items-center justify-center rounded-full bg-background"><Ionicons name="arrow-back" size={22} color="#99333a" /></Pressable><Text className="flex-1 text-lg font-semibold text-foreground">{title}</Text><Ionicons name="pricetags-outline" size={24} color="#99333a" /></View>;
}
export function PromotionDialog({ visible, title, children, confirmLabel, onConfirm, onCancel, busy = false }: {
  visible: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}><View className="flex-1 justify-center bg-black/40 px-6"><View className="rounded-[24px] bg-card p-6"><Ionicons name="shield-checkmark-outline" size={30} color="#99333a" /><Text className="mb-3 mt-4 text-xl font-semibold text-foreground">{title}</Text>{children}<View className="mt-5 gap-2"><PromotionButton label={busy ? "Salvando..." : confirmLabel} disabled={busy} onPress={onConfirm} /><PromotionButton label="Cancelar" secondary disabled={busy} onPress={onCancel} /></View></View></View></Modal>;
}
