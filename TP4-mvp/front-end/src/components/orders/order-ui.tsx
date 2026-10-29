import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { formatMoney, type StoreOrder } from "../../services/api";
import { deliveryLabels, orderDate, orderLabels } from "../../services/store-orders";

export function OrderButton({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} className={`min-h-11 items-center justify-center rounded-full px-4 py-3 ${disabled ? "opacity-40" : ""} ${secondary ? "bg-muted" : "bg-primary"}`}>
    <Text className={`text-sm font-semibold ${secondary ? "text-primary" : "text-white"}`}>{label}</Text>
  </Pressable>;
}

export function OrderBadge({ order }: { order: StoreOrder }) {
  const terminal = order.status === "COMPLETED" || order.status === "CANCELED";
  return <View className={`rounded-full px-3 py-1 ${order.status === "COMPLETED" ? "bg-[#ecfdf5]" : order.status === "CANCELED" ? "bg-[#ffdad6]" : "bg-[#fffbeb]"}`}>
    <Text className={`text-xs font-semibold ${terminal ? "text-foreground" : "text-[#92400e]"}`}>
      {order.delivery?.status === "DELIVERED" ? "Entregue" : orderLabels[order.status]}
    </Text>
  </View>;
}

export function OrderCard({ order, onPress, disabled }: { order: StoreOrder; onPress: () => void; disabled: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir pedido ${order.orderNumber ?? order.id}`} disabled={disabled}
    onPress={onPress} className="mb-3 gap-3 rounded-[18px] bg-card p-4 shadow-sm shadow-black/5">
    <View className="flex-row items-center justify-between gap-2">
      <Text className="min-w-0 flex-1 text-base font-semibold text-foreground">{order.orderNumber ?? order.id}</Text>
      <OrderBadge order={order} />
    </View>
    <Text className="text-xs text-muted-foreground">Realizado em {orderDate(order.createdAt)}</Text>
    <View className="flex-row items-center gap-3 rounded-xl bg-background p-3">
      <Ionicons name="storefront-outline" size={24} color="#b94b50" />
      <View className="min-w-0 flex-1">
        <Text className="font-semibold text-foreground">{order.store?.name || order.customer?.name || "Pedido da loja"}</Text>
        <Text numberOfLines={2} className="text-xs text-muted-foreground">{order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}</Text>
      </View>
    </View>
    <Text className="text-sm text-muted-foreground">Entrega: {order.delivery ? deliveryLabels[order.delivery.status] : "Aguardando configuração"}</Text>
    <Text className="text-xs text-muted-foreground">Previsão: {orderDate(order.delivery?.estimatedDate)}</Text>
    {order.isDelayed ? <Text accessibilityRole="alert" className="font-semibold text-primary">Entrega atrasada</Text> : null}
    <View className="flex-row items-center justify-between border-t border-input-border pt-3">
      <Text className="text-lg font-bold text-primary">{formatMoney(order.total)}</Text>
      <Text className="text-sm font-semibold text-primary">Ver detalhes ›</Text>
    </View>
  </Pressable>;
}
