import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useCommerce } from "./CommerceContext";
import type { CommerceTab } from "../../navigation/types";

export { ProjectHeader as CommerceHeader } from "../profissional/components";

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
