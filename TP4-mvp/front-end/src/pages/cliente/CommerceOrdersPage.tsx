import { Ionicons } from "@expo/vector-icons";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { CatalogChip, CatalogFrame } from "../../components/cliente/catalog-ui";
import { CommerceOrdersFeedback } from "../../components/cliente/CommerceOrdersFeedback";

const filters = ["Em aberto", "Concluídos", "Todos"] as const;
const ordersTheme = vars({
  "--color-background": "251 246 247",
  "--color-primary": "185 75 80",
  "--color-foreground": "15 23 32",
  "--color-card": "255 255 255",
  "--color-muted": "247 242 243",
  "--color-muted-foreground": "122 101 104",
  "--color-input-border": "185 75 80",
  "--color-input-border-alpha": "0.1",
});

export function CommerceOrdersPage({ onStores, ...frame }: {
  onBack: () => void;
  onProfilePress: () => void;
  onStores: () => void;
}) {
  const [filter, setFilter] = useState<typeof filters[number]>("Em aberto");

  // POST /orders only creates orders. All existing order reads require LOJISTA.
  // Keep the consumer view empty until a customer-scoped read API is available.
  return <View style={ordersTheme} className="flex-1 w-full max-w-[480px]">
    <CatalogFrame title="Meus Pedidos" {...frame}>
      <View className="-mt-3 flex-row items-center gap-4">
        <Text className="flex-1 font-sans text-xs leading-5 text-muted-foreground">Acompanhe seus pedidos e consulte suas compras anteriores.</Text>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Ionicons name="cube-outline" size={21} color="#b94b50" />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {filters.map((label) => <CatalogChip key={label} label={label} selected={filter === label} onPress={() => setFilter(label)} />)}
      </ScrollView>
      <CommerceOrdersFeedback state={{ status: "empty" }} onStores={onStores} />
    </CatalogFrame>
  </View>;
}
