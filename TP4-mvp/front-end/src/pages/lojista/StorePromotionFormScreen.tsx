import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { NativeDateTimeField } from "../../components/native-date-time-field";
import { PromotionButton, PromotionDialog, PromotionHeader } from "../../components/lojista/promotion-ui";
import { ApiError, api, formatMoney } from "../../services/api";
import { emptyPromotionForm, PROMOTION_TIMEZONE, promotionPayload, promotionPreview, promotionToForm, validatePromotionForm, type DiscountType, type PromotionForm, type PromotionProduct, type StorePromotion } from "../../services/store-promotions";

const rules: { type: DiscountType; label: string; input: string }[] = [
  { type: "PERCENTAGE", label: "Porcentagem (%)", input: "Percentual a deduzir" },
  { type: "FIXED", label: "Fixo (R$)", input: "Valor em reais a subtrair" },
  { type: "DIRECT", label: "Preço direto", input: "Novo preço promocional" },
];

export function StorePromotionFormScreen({ id, onBack, onSaved }: { id: string | null; onBack: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PromotionForm>(emptyPromotionForm);
  const [initial, setInitial] = useState("");
  const [product, setProduct] = useState<PromotionProduct>();
  const [promotions, setPromotions] = useState<StorePromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(true);
  const [initialPublishing, setInitialPublishing] = useState(true);
  const [confirm, setConfirm] = useState<"DRAFT" | "ACTIVE" | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [discard, setDiscard] = useState(false);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const productRequest = useRef(0);
  const loadRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true); setLoadError(null);
    try {
      const [all, saved] = await Promise.all([api.storePromotions(), id ? api.storePromotion(id) : Promise.resolve(null)]);
      if (request !== loadRequest.current) return;
      const next = saved ? promotionToForm(saved) : emptyPromotionForm();
      setPromotions(all); setForm(next); setInitial(JSON.stringify(next)); setProduct(saved?.product ?? undefined);
      setPublishing(!saved || saved.status === "ACTIVE");
      setInitialPublishing(!saved || saved.status === "ACTIVE");
    } catch (cause) { if (request === loadRequest.current) setLoadError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o formulário."); }
    finally { if (request === loadRequest.current) setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); return () => { loadRequest.current++; }; }, [load]);
  const loadProducts = useCallback(async (nextPage = 1) => {
    const request = ++productRequest.current;
    setProductLoading(true); setProductError(null);
    try {
      const result = await api.storeProducts({ q: query, status: "ACTIVE", page: nextPage, limit: 20 });
      if (request !== productRequest.current) return;
      setProducts((old) => nextPage === 1 ? result.items : [...old, ...result.items]); setTotal(result.total); setPage(nextPage);
    } catch (cause) { if (request === productRequest.current) setProductError(cause instanceof ApiError ? cause.message : "Não foi possível buscar os produtos."); }
    finally { if (request === productRequest.current) setProductLoading(false); }
  }, [query]);
  useEffect(() => {
    if (!picker) return;
    setProducts([]);
    const timer = setTimeout(() => { void loadProducts(); }, 250);
    return () => { clearTimeout(timer); productRequest.current++; };
  }, [picker, loadProducts]);
  const leave = useCallback(() => { if (saving.current) return; if (initial && (JSON.stringify(form) !== initial || publishing !== initialPublishing)) setDiscard(true); else onBack(); }, [form, initial, publishing, initialPublishing, onBack]);
  useEffect(() => { const back = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; }); return () => back.remove(); }, [leave]);
  const update = (change: Partial<PromotionForm>) => { setForm((old) => ({ ...old, ...change })); setError(null); };
  const preview = product ? promotionPreview(product.price, form.discountType, form.discountValue) : null;
  const errors = validatePromotionForm(form, product, promotions, publishing ? "ACTIVE" : "DRAFT", id ?? undefined);
  const draftErrors = validatePromotionForm(form, product, promotions, "DRAFT", id ?? undefined);
  const save = async () => {
    if (!confirm || saving.current) return;
    const validation = validatePromotionForm(form, product, promotions, confirm, id ?? undefined);
    if (validation.length) { setError(validation.join("\n")); setConfirm(null); return; }
    saving.current = true; setBusy(true); setError(null);
    try {
      const payload = promotionPayload(form, confirm);
      if (id) await api.updateStorePromotion(id, payload); else await api.createStorePromotion(payload);
      onSaved();
    } catch (cause) { setConfirm(null); setError(cause instanceof ApiError ? cause.message : "Não foi possível salvar a promoção. Tente novamente."); }
    finally { saving.current = false; setBusy(false); }
  };
  const setDatePart = (field: "startsAt" | "endsAt", value: string, time = false) => {
    const [date = "", hours = ""] = form[field].split("T");
    update({ [field]: time ? `${date}T${value}` : `${value}T${hours}` });
  };

  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <PromotionHeader title={id ? "Editar promoção" : "Criar promoção"} onBack={leave} />
    {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#99333a" /></View> : loadError ? <View className="gap-4 p-5"><Text accessibilityRole="alert" className="text-primary">{loadError}</Text><PromotionButton label="Tentar novamente" onPress={() => void load()} /></View> : <>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text className="mb-5 text-sm text-muted-foreground">Uma regra por produto durante cada período de oferta.</Text>
        <Text className="mb-2 font-semibold text-foreground">Nome da promoção</Text>
        <TextInput accessibilityLabel="Nome da promoção" value={form.name} onChangeText={(name) => update({ name })} editable={!busy} maxLength={120} placeholder="Ex.: Semana dos revestimentos" className="mb-6 min-h-12 rounded-full bg-card px-4 text-foreground" />
        <Text className="mb-3 text-base font-semibold text-foreground">1. Seleção do produto</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Selecionar produto" disabled={busy} onPress={() => setPicker(true)} className="mb-5 flex-row items-center gap-3 rounded-[24px] bg-card p-5"><Ionicons name="cube-outline" size={28} color="#99333a" /><View className="flex-1"><Text className="font-semibold text-foreground">{product?.name ?? "Escolha um produto do catálogo"}</Text>{product ? <><Text className="mt-1 text-xs text-muted-foreground">SKU: {product.sku ?? "Não informado"} · {product.stock} em estoque</Text><Text className="mt-2 font-semibold text-primary">Preço atual: {formatMoney(product.price)}</Text></> : null}</View><Ionicons name="chevron-down" size={20} color="#897171" /></Pressable>
        <Text className="mb-3 text-base font-semibold text-foreground">2. Tipo e intensidade da oferta</Text>
        <View className="mb-5 gap-4 rounded-[24px] bg-card p-5">
          <View accessibilityRole="radiogroup" className="flex-row gap-1 rounded-full bg-background p-1">{rules.map((rule) => <Pressable key={rule.type} accessibilityRole="radio" accessibilityState={{ checked: form.discountType === rule.type }} disabled={busy} onPress={() => update({ discountType: rule.type, discountValue: "" })} className={`min-h-11 flex-1 items-center justify-center rounded-full px-1 ${form.discountType === rule.type ? "bg-primary" : ""}`}><Text className={`text-center text-xs font-semibold ${form.discountType === rule.type ? "text-white" : "text-muted-foreground"}`}>{rule.label}</Text></Pressable>)}</View>
          <Text className="text-xs text-muted-foreground">{rules.find((rule) => rule.type === form.discountType)?.input}</Text>
          <TextInput accessibilityLabel="Valor do desconto" value={form.discountValue} onChangeText={(discountValue) => update({ discountValue })} editable={!busy} keyboardType="decimal-pad" placeholder={form.discountType === "PERCENTAGE" ? "Ex.: 20" : "Ex.: 17,98"} className="min-h-12 rounded-full bg-background px-4 text-xl font-semibold text-foreground" />
          <Text className="text-xs leading-5 text-muted-foreground">{form.discountType === "PERCENTAGE" ? "Maior que 0% e menor que 100%." : "Use valores positivos com até duas casas decimais."} O preço final deve ser menor que o preço de tabela.</Text>
        </View>
        <Text className="mb-3 text-base font-semibold text-foreground">3. Prévia do preço ao consumidor</Text>
        <View className="mb-5 gap-2 rounded-[24px] bg-[#ffdad9] p-6"><Text className="text-xs text-[#83232b]">Vitrine digital do cliente · Prévia</Text>{preview ? <><Text className="text-sm text-[#83232b] line-through">{formatMoney(product!.price)}</Text><Text testID="promotion-final-price" className="text-4xl font-bold text-primary">{formatMoney(preview.finalPrice)}</Text><Text className="text-sm font-semibold text-primary">Economia de {formatMoney(preview.savings)} (−{preview.percent}%)</Text></> : <Text className="text-sm text-[#83232b]">Selecione um produto e informe um desconto válido.</Text>}</View>
        <Text className="mb-3 text-base font-semibold text-foreground">4. Vigência e agendamento</Text>
        <View className="mb-5 gap-4 rounded-[24px] bg-card p-5"><Text className="rounded-2xl bg-[#eae1da] p-3 text-xs font-semibold text-[#645d58]">{PROMOTION_TIMEZONE}</Text>
          {(["startsAt", "endsAt"] as const).map((field) => <View key={field} className="gap-2"><NativeDateTimeField label={field === "startsAt" ? "Data de início" : "Data de término"} mode="date" placeholder="AAAA-MM-DD" value={form[field].split("T")[0]} onChange={(value) => setDatePart(field, value)} disabled={busy} /><NativeDateTimeField label={field === "startsAt" ? "Hora de início (BRT)" : "Hora de término (BRT)"} mode="time" placeholder="HH:MM" value={form[field].split("T")[1] ?? ""} onChange={(value) => setDatePart(field, value, true)} disabled={busy} /></View>)}
        </View>
        <Text className="mb-3 text-base font-semibold text-foreground">5. Ativação no catálogo</Text>
        <View className="mb-5 flex-row items-center gap-3 rounded-[24px] bg-card p-5"><View className="flex-1"><Text className="font-semibold text-foreground">Publicar no período definido</Text><Text className="mt-1 text-xs leading-5 text-muted-foreground">Se o início for futuro, a promoção ficará agendada. Desligado, salva como rascunho.</Text></View><Switch accessibilityLabel="Publicar no período definido" value={publishing} disabled={busy} onValueChange={setPublishing} trackColor={{ false: "#ddd9da", true: "#99333a" }} thumbColor="#ffffff" /></View>
        {errors.length ? <View className="gap-2 rounded-2xl bg-[#ffdad6] p-4">{errors.map((message) => <Text key={message} accessibilityRole="alert" className="text-xs leading-5 text-[#93000a]">{message}</Text>)}</View> : <Text className="rounded-2xl bg-card p-4 text-sm text-primary">Desconto e vigência válidos. Nenhuma sobreposição detectada.</Text>}
        {error ? <Text accessibilityRole="alert" className="mt-4 text-sm leading-5 text-[#93000a]">{error}</Text> : null}
      </ScrollView>
      <View className="flex-row justify-between gap-2 border-t border-input-border bg-card p-4"><View className="flex-1"><PromotionButton label="Salvar rascunho" secondary disabled={busy || draftErrors.length > 0} onPress={() => setConfirm("DRAFT")} /></View><View className="flex-1"><PromotionButton label={publishing ? "Publicar" : "Salvar"} disabled={busy || errors.length > 0} onPress={() => setConfirm(publishing ? "ACTIVE" : "DRAFT")} /></View></View>
    </>}
    <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[85%] rounded-t-[24px] bg-card p-5"><View className="mb-4 flex-row items-center justify-between"><Text className="text-lg font-semibold text-foreground">Escolher produto ativo</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar seleção de produto" onPress={() => setPicker(false)} className="p-3"><Ionicons name="close" size={24} color="#99333a" /></Pressable></View><TextInput accessibilityLabel="Buscar produto da promoção" value={query} onChangeText={setQuery} placeholder="Buscar nome ou SKU" className="mb-4 min-h-12 rounded-full bg-background px-4 text-foreground" />
      <ScrollView keyboardShouldPersistTaps="handled">{products.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Selecionar ${item.name}`} onPress={() => { setProduct(item); update({ productId: item.id }); setPicker(false); }} className="mb-2 rounded-2xl bg-background p-4"><Text className="font-semibold text-foreground">{item.name}</Text><Text className="mt-1 text-sm text-muted-foreground">{formatMoney(item.price)} · SKU: {item.sku ?? "Não informado"}</Text></Pressable>)}{productLoading ? <ActivityIndicator color="#99333a" /> : null}{productError ? <View className="gap-3"><Text accessibilityRole="alert" className="text-primary">{productError}</Text><PromotionButton label="Tentar buscar novamente" onPress={() => void loadProducts()} /></View> : null}{!productLoading && !productError && !products.length ? <Text className="p-5 text-center text-muted-foreground">Nenhum produto ativo encontrado.</Text> : null}{products.length < total && !productLoading ? <PromotionButton label="Carregar mais produtos" secondary onPress={() => void loadProducts(page + 1)} /> : null}</ScrollView>
    </View></View></Modal>
    <PromotionDialog visible={Boolean(confirm)} title={confirm === "ACTIVE" ? "Confirmar oferta" : "Salvar como rascunho?"} confirmLabel={confirm === "ACTIVE" ? "Confirmar publicação" : "Confirmar rascunho"} busy={busy} onConfirm={() => void save()} onCancel={() => setConfirm(null)}><Text className="text-sm leading-6 text-muted-foreground">{product?.name}{"\n"}{preview ? `Preço da oferta: ${formatMoney(preview.finalPrice)}\n` : ""}{confirm === "ACTIVE" ? "A publicação seguirá a vigência no horário de Brasília (UTC−3)." : "O desconto ficará salvo sem destaque no catálogo. Se a oferta estiver ativa, será desativada."}</Text></PromotionDialog>
    <PromotionDialog visible={discard} title="Descartar alterações?" confirmLabel="Descartar e voltar" onConfirm={onBack} onCancel={() => setDiscard(false)}><Text className="text-sm text-muted-foreground">As alterações desta promoção ainda não foram salvas.</Text></PromotionDialog>
  </View>;
}
