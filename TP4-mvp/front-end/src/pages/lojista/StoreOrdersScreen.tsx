import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { StoreOwnerTabBar } from "../../components/lojista/StoreOwnerTabBar";
import { ApiError, api, formatMoney, type DeliveryStatus, type StoreOrder, type StoreOrderStatus } from "../../services/api";

const logo = require("../../../assets/logotipo.png");
const orderLabels: Record<StoreOrderStatus, string> = { PENDING: "Pendente", CONFIRMED: "Confirmado", PREPARING: "Em preparo", READY: "Pronto", COMPLETED: "Concluído", CANCELED: "Cancelado" };
const deliveryLabels: Record<DeliveryStatus, string> = { PENDING: "Pendente", PREPARING: "Em preparo", IN_TRANSIT: "Em trânsito", DELIVERED: "Entregue", FAILED: "Falhou", CANCELED: "Cancelada" };
const nextOrder: Record<StoreOrderStatus, StoreOrderStatus[]> = { PENDING: ["CONFIRMED", "CANCELED"], CONFIRMED: ["PREPARING", "CANCELED"], PREPARING: ["READY", "CANCELED"], READY: [], COMPLETED: [], CANCELED: [] };
const nextDelivery: Record<DeliveryStatus, DeliveryStatus[]> = { PENDING: ["PREPARING", "CANCELED"], PREPARING: ["IN_TRANSIT", "CANCELED"], IN_TRANSIT: ["DELIVERED", "FAILED"], FAILED: ["IN_TRANSIT", "CANCELED"], DELIVERED: [], CANCELED: [] };
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não informada";
const localDay = (value: string) => {
  const parsed = new Date(value);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};
const parseDay = (value: string, end = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a data no formato AAAA-MM-DD.");
  const parsed = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  if (Number.isNaN(parsed.getTime()) || localDay(parsed.toISOString()) !== value) throw new Error("Informe uma data válida.");
  return parsed.toISOString();
};
const message = (cause: unknown) => cause instanceof ApiError ? cause.message : "Não foi possível atualizar o pedido.";
const field = "rounded-xl border border-input-border bg-card px-3 py-3 text-foreground";

export function StoreOrdersScreen({ status: initialStatus, onBack, onSwitchProfile, onOpenProfile, onProducts, onPromotions, onSettings, avatarUrl }: {
  status?: string; onBack: () => void; onSwitchProfile?: () => void; onOpenProfile?: () => void;
  onProducts?: () => void; onPromotions?: () => void; onSettings?: () => void; avatarUrl?: string | null;
}) {
  const [status, setStatus] = useState<StoreOrderStatus | undefined>(initialStatus as StoreOrderStatus | undefined);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoreOrder | null>(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [carrier, setCarrier] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const filters = {
        status,
        from: from ? parseDay(from) : undefined,
        to: to ? parseDay(to, true) : undefined,
      };
      const [list, detail] = await Promise.all([api.storeOrders(filters), selectedId ? api.storeOrder(selectedId) : Promise.resolve(null)]);
      setOrders(list);
      if (detail) setSelected(detail);
      setError(null);
    } catch (cause) { setError(cause instanceof Error && !(cause instanceof ApiError) ? cause.message : message(cause)); }
    finally { setLoading(false); }
  }, [status, from, to, selectedId]);

  useEffect(() => {
    void refresh(true);
    const timer = setInterval(() => { void refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  const open = async (id: string) => {
    setSelectedId(id);
    setError(null);
    try {
      const order = await api.storeOrder(id);
      setSelected(order);
      setTrackingCode(order.delivery?.trackingCode ?? "");
      setCarrier(order.delivery?.carrier ?? "");
      setEstimatedDate(order.delivery?.estimatedDate ? localDay(order.delivery.estimatedDate) : "");
    } catch (cause) { setError(message(cause)); }
  };

  const mutate = async (action: () => Promise<StoreOrder>) => {
    setSaving(true); setError(null);
    try {
      const updated = await action();
      setSelected(updated);
      setOrders((old) => old.map((order) => order.id === updated.id ? updated : order));
      await refresh();
    } catch (cause) { setError(message(cause)); }
    finally { setSaving(false); }
  };

  const saveDelivery = () => {
    if (!selected) return;
    let parsed: string | undefined;
    try { parsed = estimatedDate ? parseDay(estimatedDate, true) : undefined; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Informe uma data válida."); return; }
    void mutate(() => api.upsertStoreOrderDelivery(selected.id, {
      trackingCode: trackingCode.trim(), carrier: carrier.trim(),
      estimatedDate: parsed,
    }));
  };

  const address = selected?.addressSnapshot;
  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <View className="flex-row items-center justify-between bg-card px-5 py-3">
      <Pressable onPress={onSwitchProfile ?? onBack} accessibilityRole="button" accessibilityLabel="Trocar perfil" className="h-10 w-10 items-center justify-center rounded-full bg-background"><Ionicons name="arrow-back" size={20} color="#141c25" /></Pressable>
      <Image source={logo} className="h-9 w-[145px]" resizeMode="contain" accessibilityLabel="Conecta Obras Itacoatiara" />
      <Pressable onPress={onOpenProfile ?? onBack} accessibilityRole="button" accessibilityLabel="Abrir informações do perfil" className="h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-[#fbe7e8]">{avatarUrl ? <Image source={{ uri: avatarUrl }} className="h-9 w-9 rounded-full" /> : <Ionicons name="person-outline" size={21} color="#99333a" />}</Pressable>
    </View>
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 36 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh(true)} />}>
    <Pressable onPress={selected ? () => { setSelected(null); setSelectedId(null); } : onBack} accessibilityRole="button" className="mb-5 self-start rounded-xl bg-card px-4 py-3"><Text className="font-semibold text-primary">Voltar</Text></Pressable>
    <Text className="mb-2 text-2xl font-bold text-foreground">{selected ? `Pedido ${selected.orderNumber ?? selected.id}` : "Pedidos da loja"}</Text>
    {error ? <Text accessibilityRole="alert" className="mb-4 rounded-xl bg-card p-3 text-primary">{error}</Text> : null}
    {!selected ? <>
      <Text className="mb-4 text-sm text-muted-foreground">Atualiza automaticamente a cada 15 segundos. Puxe para atualizar agora.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {([undefined, "PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELED"] as const).map((value) => <Pressable key={value ?? "ALL"} onPress={() => setStatus(value)} accessibilityRole="button" className={`mr-2 rounded-full px-4 py-3 ${status === value ? "bg-primary" : "bg-card"}`}><Text className={status === value ? "font-semibold text-white" : "text-foreground"}>{value ? orderLabels[value] : "Todos"}</Text></Pressable>)}
      </ScrollView>
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1"><Text className="mb-1 text-xs text-muted-foreground">De (AAAA-MM-DD)</Text><TextInput value={from} onChangeText={setFrom} placeholder="2026-10-01" accessibilityLabel="Data inicial" className={field} /></View>
        <View className="flex-1"><Text className="mb-1 text-xs text-muted-foreground">Até (AAAA-MM-DD)</Text><TextInput value={to} onChangeText={setTo} placeholder="2026-10-31" accessibilityLabel="Data final" className={field} /></View>
      </View>
      <Pressable onPress={() => void refresh(true)} accessibilityRole="button" className="mb-4 self-start rounded-full bg-primary px-5 py-3"><Text className="font-semibold text-white">Atualizar</Text></Pressable>
      {loading && orders.length === 0 ? <Text className="py-8 text-center text-muted-foreground">Carregando pedidos...</Text> : orders.length === 0 ? <Text className="py-8 text-center text-muted-foreground">Nenhum pedido encontrado.</Text> : orders.map((order) => <Pressable key={order.id} onPress={() => void open(order.id)} accessibilityRole="button" accessibilityLabel={`Abrir pedido ${order.orderNumber ?? order.id}`} className="mb-3 rounded-2xl border border-input-border bg-card p-4">
        <View className="flex-row justify-between"><Text className="font-semibold text-foreground">{order.orderNumber ?? order.id}</Text>{order.isDelayed ? <Text className="font-bold text-primary">Atrasado</Text> : null}</View>
        <Text className="mt-1 text-sm text-muted-foreground">{orderLabels[order.status]} · Entrega: {order.delivery ? deliveryLabels[order.delivery.status] : "Não configurada"}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Previsão: {date(order.delivery?.estimatedDate)} · {formatMoney(order.total)}</Text>
      </Pressable>)}
    </> : <>
      <View className="mb-4 rounded-2xl bg-card p-4">
        <Text className="font-semibold text-foreground">Pedido: {orderLabels[selected.status]}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Cliente: {selected.customer?.name ?? "Não informado"}{selected.customer?.phone ? ` · ${selected.customer.phone}` : ""}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Entrega: {selected.delivery ? deliveryLabels[selected.delivery.status] : "Não configurada"}{selected.isDelayed ? " · Atrasada" : ""}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Previsão: {date(selected.delivery?.estimatedDate)}</Text>
        {selected.delivery?.deliveredAt ? <Text className="mt-1 text-sm text-muted-foreground">Entregue em: {date(selected.delivery.deliveredAt)}</Text> : null}
        {address ? <Text className="mt-2 text-sm text-foreground">Endereço: {[address.street, address.number, address.complement, address.neighborhood, address.city, address.state, address.zipCode].filter(Boolean).join(", ")}</Text> : null}
      </View>
      <Text className="mb-2 text-lg font-semibold text-foreground">Itens e valores</Text>
      <View className="mb-4 rounded-2xl bg-card p-4">{selected.items.map((item) => <Text key={item.id} className="mb-2 text-sm text-foreground">{item.quantity} × {item.name} · {formatMoney(item.lineTotal ?? Number(item.unitPrice) * item.quantity)}</Text>)}<Text className="mt-2 font-semibold text-foreground">Subtotal: {formatMoney(selected.subtotal)}</Text><Text className="text-sm text-muted-foreground">Desconto: {formatMoney(selected.discount)}</Text><Text className="font-bold text-foreground">Total: {formatMoney(selected.total)}</Text></View>
      {nextOrder[selected.status].length ? <><Text className="mb-2 text-lg font-semibold text-foreground">Atualizar pedido</Text><View className="mb-4 flex-row flex-wrap gap-2">{nextOrder[selected.status].filter((value) => value !== "CANCELED" || !selected.delivery || ["PENDING", "PREPARING", "FAILED"].includes(selected.delivery.status)).map((value) => <Pressable key={value} disabled={saving} onPress={() => void mutate(() => api.changeStoreOrderStatus(selected.id, value))} accessibilityRole="button" className="rounded-full bg-primary px-4 py-3"><Text className="font-semibold text-white">{orderLabels[value]}</Text></Pressable>)}</View></> : null}
      {["CONFIRMED", "PREPARING", "READY"].includes(selected.status) && !["DELIVERED", "CANCELED"].includes(selected.delivery?.status ?? "") ? <><Text className="mb-2 text-lg font-semibold text-foreground">Dados da entrega</Text><View className="mb-4 gap-2"><TextInput value={trackingCode} onChangeText={setTrackingCode} placeholder="Código de rastreio" accessibilityLabel="Código de rastreio" className={field} /><TextInput value={carrier} onChangeText={setCarrier} placeholder="Transportadora" accessibilityLabel="Transportadora" className={field} /><TextInput value={estimatedDate} onChangeText={setEstimatedDate} placeholder="Previsão (AAAA-MM-DD)" accessibilityLabel="Previsão de entrega" className={field} /><Pressable disabled={saving} onPress={saveDelivery} accessibilityRole="button" className="items-center rounded-full bg-primary px-4 py-3"><Text className="font-semibold text-white">Salvar entrega</Text></Pressable></View></> : null}
      {selected.delivery && nextDelivery[selected.delivery.status].length ? <><Text className="mb-2 text-lg font-semibold text-foreground">Atualizar rastreio</Text><View className="mb-4 flex-row flex-wrap gap-2">{nextDelivery[selected.delivery.status].filter((value) => value === "CANCELED" ? selected.status !== "COMPLETED" : value === "PREPARING" ? ["PREPARING", "READY"].includes(selected.status) : selected.status === "READY").map((value) => <Pressable key={value} disabled={saving} onPress={() => void mutate(() => api.changeStoreOrderDeliveryStatus(selected.id, value))} accessibilityRole="button" className="rounded-full bg-primary px-4 py-3"><Text className="font-semibold text-white">{deliveryLabels[value]}</Text></Pressable>)}</View></> : null}
      <Text className="mb-2 text-lg font-semibold text-foreground">Histórico</Text><View className="rounded-2xl bg-card p-4">{selected.timeline.map((event) => <Text key={`${event.kind}-${event.id}`} className="mb-2 text-sm text-foreground">{date(event.createdAt)} · {event.kind === "ORDER" ? "Pedido" : "Entrega"}: {event.toStatus}{event.note ? ` · ${event.note}` : ""}</Text>)}</View>
    </>}
    </ScrollView>
    <StoreOwnerTabBar selected="Pedidos" onDashboard={onBack} onOrders={() => { setSelected(null); setSelectedId(null); }} onProducts={onProducts ?? onBack} onPromotions={onPromotions ?? onBack} onSettings={onSettings ?? onBack} />
  </View>;
}
