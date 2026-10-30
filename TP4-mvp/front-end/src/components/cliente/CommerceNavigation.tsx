import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import { useCommerce } from "./CommerceContext";
import type { CommerceTab } from "../../navigation/types";

export function CommerceHeader({ title, onBack, onProfilePress }: { title: string; onBack: () => void; onProfilePress?: () => void }) {
  const commerce = useCommerce();
  return <View className="flex-row items-center gap-2 border-b border-black/5 bg-background px-3 py-3">
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} className="h-11 w-8 items-center justify-center"><Ionicons name="arrow-back" size={21} color="#b94b50" /></Pressable>
    <Image source={require("../../../assets/logotipo.png")} accessibilityLabel="Conecta Obras Itacoatiara" resizeMode="contain" style={{ width: 90, height: 38 }} />
    <View className="flex-1"><Text className="font-sans text-[10px] font-semibold uppercase tracking-wide text-primary">Itacoatiara, AM</Text><Text numberOfLines={2} className="font-sans text-sm font-bold text-foreground">{title}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir carrinho, ${commerce?.cart.count ?? 0} itens`} onPress={() => commerce?.onNavigate("cart")} className="h-11 w-11 items-center justify-center">
      <Ionicons name="bag-outline" size={23} color="#b94b50" />
      {commerce?.cart.count ? <View className="absolute right-0 top-0 rounded-full bg-primary px-1.5"><Text className="text-[10px] font-bold text-white">{commerce.cart.count}</Text></View> : null}
    </Pressable>
    {onProfilePress ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={onProfilePress} className="h-11 w-11 items-center justify-center rounded-full bg-primary"><Ionicons name="person-outline" size={21} color="#ffffff" /></Pressable> : null}
  </View>;
}

const tabs: { key: CommerceTab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "home", label: "Início", icon: "home-outline" }, { key: "search", label: "Buscar", icon: "search-outline" },
  { key: "cart", label: "Carrinho", icon: "bag-outline" }, { key: "orders", label: "Pedidos", icon: "receipt-outline" },
];
export function CommerceBottomNav() {
  const commerce = useCommerce();
  return <View accessibilityRole="tablist" className="flex-row rounded-t-3xl border-t border-black/5 bg-card px-3 py-2">
    {tabs.map((tab) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: commerce?.tab === tab.key }} onPress={() => commerce?.onNavigate(tab.key)} className="min-h-14 flex-1 items-center justify-center gap-1">
      <View><Ionicons name={tab.icon} size={23} color={commerce?.tab === tab.key ? "#b94b50" : "#7a6568"} />
        {tab.key === "cart" && commerce?.cart.count ? <View className="absolute -right-3 -top-1 rounded-full bg-primary px-1"><Text className="text-[10px] font-bold text-white">{commerce.cart.count}</Text></View> : null}
      </View>
      <Text className={`font-sans text-xs font-semibold ${commerce?.tab === tab.key ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</Text>
    </Pressable>)}
  </View>;
}
