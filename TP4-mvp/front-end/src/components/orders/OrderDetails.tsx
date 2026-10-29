import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import { api, formatMoney, type StoreOrder } from "../../services/api";
import { deliveryLabels, localDay, orderDate, orderLabels, orderTimezone, parseOrderDay } from "../../services/store-orders";
import { NativeDateTimeField } from "../native-date-time-field";
import { OrderBadge, OrderButton } from "./order-ui";
import type { OrdersAudience } from "./use-orders";

export type OrderIntent = { label: string; description: string; execute: () => Promise<StoreOrder>; onSuccess?: () => void };
const field = "min-h-12 rounded-xl border border-input-border bg-card px-3 py-3 text-foreground";

function DeliveryForm({ order, disabled, onRequest }: { order: StoreOrder; disabled: boolean; onRequest: (intent: OrderIntent) => void }) {
  const [trackingCode, setTrackingCode] = useState("");
  const [carrier, setCarrier] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (dirty) return;
    setTrackingCode(order.delivery?.trackingCode ?? "");
    setCarrier(order.delivery?.carrier ?? "");
    setEstimatedDate(order.delivery?.estimatedDate ? localDay(order.delivery.estimatedDate) : "");
  }, [order.delivery?.trackingCode, order.delivery?.carrier, order.delivery?.estimatedDate, dirty]);

  const save = () => {
    try {
      const input = {
        trackingCode: trackingCode.trim(), carrier: carrier.trim(),
        estimatedDate: estimatedDate ? parseOrderDay(estimatedDate, true) : undefined,
      };
      if (!input.trackingCode && !input.carrier && !input.estimatedDate && !order.delivery) throw new Error("Informe ao menos um dado da entrega.");
      setError(null);
      onRequest({
        label: "Salvar entrega", description: `Salvar os dados de rastreio e previsão do pedido ${order.orderNumber ?? order.id}?`,
        execute: () => api.upsertStoreOrderDelivery(order.id, input), onSuccess: () => setDirty(false),
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Confira a previsão de entrega."); }
  };
  return <View className="gap-3 rounded-[18px] bg-card p-4">
    <Text className="text-lg font-semibold text-foreground">Dados da entrega</Text>
    <Text className="text-xs text-muted-foreground">A previsão considera o fim do dia no fuso do aparelho. {orderTimezone()}</Text>
    <Text className="text-sm text-foreground">Código de rastreio</Text>
    <TextInput value={trackingCode} onChangeText={(value) => { setDirty(true); setTrackingCode(value); }} editable={!disabled} maxLength={191} accessibilityLabel="Código de rastreio" placeholder="Código de rastreio" className={field} />
    <Text className="text-sm text-foreground">Transportadora</Text>
    <TextInput value={carrier} onChangeText={(value) => { setDirty(true); setCarrier(value); }} editable={!disabled} maxLength={191} accessibilityLabel="Transportadora" placeholder="Transportadora ou entrega local" className={field} />
    <NativeDateTimeField label="Previsão de entrega" mode="date" value={estimatedDate} onChange={(value) => { setDirty(true); setEstimatedDate(value); }} disabled={disabled} placeholder="AAAA-MM-DD" />
    {error ? <Text accessibilityRole="alert" className="text-sm text-primary">{error}</Text> : null}
    <OrderButton label="Salvar entrega" disabled={disabled} onPress={save} />
  </View>;
}

export function OrderDetails({ order, audience, disabled, onRequest }: {
  order: StoreOrder; audience: OrdersAudience; disabled: boolean; onRequest: (intent: OrderIntent) => void;
}) {
  const [contactError, setContactError] = useState<string | null>(null);
  const address = order.addressSnapshot;
  const actions = order.allowedActions;
  const contact = async () => {
    const phone = order.store?.whatsapp?.replace(/\D/g, "");
    if (!phone) return;
    try {
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá, gostaria de saber sobre meu pedido ${order.orderNumber ?? order.id} no Conecta Obras.`)}`);
      setContactError(null);
    } catch { setContactError("Não foi possível abrir o WhatsApp."); }
  };
  return <View className="gap-4">
    <View className="gap-3 rounded-[18px] bg-card p-4 shadow-sm shadow-black/5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="min-w-0 flex-1 text-lg font-semibold text-foreground">Pedido {order.orderNumber ?? order.id}</Text>
        <OrderBadge order={order} />
      </View>
      <Text className="text-xs text-muted-foreground">Realizado em {orderDate(order.createdAt)}</Text>
      {order.store?.name ? <View className="flex-row items-center gap-3 rounded-xl bg-background p-3"><Ionicons name="storefront-outline" size={24} color="#b94b50" /><Text className="flex-1 font-semibold text-foreground">{order.store.name}</Text></View> : null}
      {audience === "owner" ? <Text className="text-sm text-foreground">Cliente: {order.customer?.name ?? "Não informado"}{order.customer?.phone ? ` · ${order.customer.phone}` : ""}</Text> : null}
      <View className="flex-row items-start gap-2 rounded-xl bg-background p-3">
        <Ionicons name="location-outline" size={20} color="#b94b50" />
        <Text className="min-w-0 flex-1 text-sm leading-5 text-foreground">{address && Object.values(address).some(Boolean)
          ? `Entrega em: ${[address.street, address.number, address.complement, address.neighborhood, address.city, address.state, address.zipCode].filter(Boolean).join(", ")}`
          : "Endereço de entrega não informado."}</Text>
      </View>
      <Text className="text-sm text-muted-foreground">Entrega: {order.delivery ? deliveryLabels[order.delivery.status] : "Aguardando configuração"}{order.isDelayed ? " · Atrasada" : ""}</Text>
      <Text className="text-sm text-muted-foreground">Previsão: {orderDate(order.delivery?.estimatedDate)}</Text>
      {order.isDelayed ? <View className="rounded-xl bg-[#ffdad6] p-3"><Text accessibilityRole="alert" className="font-semibold text-[#93000a]">Entrega atrasada</Text><Text className="text-sm text-[#93000a]">A previsão passou e a entrega ainda não foi concluída.</Text></View> : null}
      {order.delivery?.trackingCode ? <Text className="text-sm text-foreground">Rastreio: {order.delivery.trackingCode}</Text> : null}
      {order.delivery?.carrier ? <Text className="text-sm text-foreground">Transportadora: {order.delivery.carrier}</Text> : null}
      {order.delivery?.deliveredAt ? <Text className="text-sm text-foreground">Entregue em: {orderDate(order.delivery.deliveredAt)}</Text> : null}
    </View>

    <View className="gap-3 rounded-[18px] bg-card p-4">
      <Text className="text-lg font-semibold text-foreground">Produtos inclusos ({order.items.length} itens)</Text>
      {order.items.map((item) => <View key={item.id} className="flex-row items-center gap-3 rounded-xl bg-background p-3">
        <Ionicons name="cube-outline" size={24} color="#b94b50" />
        <View className="min-w-0 flex-1"><Text className="font-medium text-foreground">{item.quantity}× {item.name}</Text><Text className="text-xs text-muted-foreground">{formatMoney(item.unitPrice)} un. · {formatMoney(item.lineTotal ?? Number(item.unitPrice) * item.quantity)}</Text></View>
      </View>)}
      <Text className="text-sm text-muted-foreground">Subtotal: {formatMoney(order.subtotal)}</Text>
      <Text className="text-sm text-muted-foreground">Desconto: {formatMoney(order.discount)}</Text>
      <View className="flex-row items-center justify-between border-t border-input-border pt-3"><Text className="text-sm text-muted-foreground">Valor total</Text><Text className="text-xl font-bold text-primary">{formatMoney(order.total)}</Text></View>
    </View>

    <View className="gap-3 rounded-[18px] bg-card p-4">
      <Text className="text-lg font-semibold text-foreground">Etapas do pedido</Text>
      {order.timeline.length ? order.timeline.map((event) => <View key={`${event.kind}-${event.id}`} className="flex-row gap-3 border-l-2 border-input-border pb-3 pl-3">
        <Ionicons name="checkmark-circle" size={22} color="#b94b50" />
        <View className="flex-1"><Text className="font-medium text-foreground">{event.kind === "ORDER" ? "Pedido" : "Entrega"}: {event.kind === "ORDER" ? orderLabels[event.toStatus as keyof typeof orderLabels] ?? event.toStatus : deliveryLabels[event.toStatus as keyof typeof deliveryLabels] ?? event.toStatus}</Text><Text className="text-xs text-muted-foreground">{orderDate(event.createdAt)}</Text>{event.note ? <Text className="text-sm text-muted-foreground">{event.note}</Text> : null}</View>
      </View>) : <Text className="text-sm text-muted-foreground">Nenhuma atualização registrada.</Text>}
    </View>

    {audience === "owner" ? <>
      {actions.orderStatuses.length ? <View className="gap-3 rounded-[18px] bg-card p-4"><Text className="text-lg font-semibold text-foreground">Atualizar pedido</Text>{actions.orderStatuses.map((status) => <OrderButton key={status} label={`Pedido: ${orderLabels[status]}`} disabled={disabled} onPress={() => onRequest({ label: orderLabels[status], description: `Alterar o pedido ${order.orderNumber ?? order.id} para ${orderLabels[status]}?`, execute: () => api.changeStoreOrderStatus(order.id, status) })} />)}</View> : null}
      {actions.canEditDelivery ? <DeliveryForm key={order.id} order={order} disabled={disabled} onRequest={onRequest} /> : null}
      {actions.deliveryStatuses.length ? <View className="gap-3 rounded-[18px] bg-card p-4"><Text className="text-lg font-semibold text-foreground">Atualizar entrega</Text>{actions.deliveryStatuses.map((status) => <OrderButton key={status} label={`Entrega: ${deliveryLabels[status]}`} disabled={disabled} onPress={() => onRequest({ label: deliveryLabels[status], description: `Alterar a entrega do pedido ${order.orderNumber ?? order.id} para ${deliveryLabels[status]}?`, execute: () => api.changeStoreOrderDeliveryStatus(order.id, status) })} />)}</View> : null}
      {!actions.orderStatuses.length && !actions.deliveryStatuses.length && !actions.canEditDelivery ? <Text className="text-center text-sm text-muted-foreground">Nenhuma ação disponível para este estado.</Text> : null}
    </> : order.store?.whatsapp ? <OrderButton label="Conversar com a loja no WhatsApp" onPress={() => void contact()} secondary /> : null}
    {contactError ? <Text accessibilityRole="alert" className="text-sm text-primary">{contactError}</Text> : null}
  </View>;
}
