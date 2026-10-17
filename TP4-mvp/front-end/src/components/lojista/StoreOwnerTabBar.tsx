import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type Tab = "Painel" | "Pedidos" | "Produtos" | "Promoções" | "Configurações";
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const tabs: { id: Tab; label: string; icon: IconName }[] = [
  { id: "Painel", label: "Painel", icon: "storefront-outline" },
  { id: "Pedidos", label: "Pedidos", icon: "receipt-outline" },
  { id: "Produtos", label: "Produtos", icon: "cube-outline" },
  { id: "Promoções", label: "Promoções", icon: "pricetag-outline" },
  { id: "Configurações", label: "Configurações", icon: "settings-outline" },
];

export function StoreOwnerTabBar({ selected, onDashboard, onOrders, onProducts, onPromotions, onSettings }: {
  selected: Tab;
  onDashboard: () => void; onOrders: () => void; onProducts: () => void;
  onPromotions: () => void; onSettings: () => void;
}) {
  const actions: Record<Tab, () => void> = {
    Painel: onDashboard, Pedidos: onOrders, Produtos: onProducts,
    Promoções: onPromotions, Configurações: onSettings,
  };
  return <View className="flex-row border-t border-input-border bg-card px-1 shadow-sm shadow-primary/10">
    {tabs.map(({ id, label, icon }) => <Pressable key={id} onPress={actions[id]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: selected === id }} className="min-h-[58px] flex-1 items-center justify-center px-0.5">
      <Ionicons name={icon} size={22} color={selected === id ? "#99333a" : "#766a70"} />
      <Text numberOfLines={1} className={`mt-0.5 text-[10px] ${selected === id ? "font-semibold text-primary" : "text-muted-foreground"}`}>{label}</Text>
    </Pressable>)}
  </View>;
}
