import { Linking, Text, View } from "react-native";
import type { ClientNavKey } from "../../components/cliente";
import { ProductCatalog, StoreCatalog } from "../../components/cliente/catalog-results";
import { CatalogAction, CatalogError, CatalogFrame, CatalogImage, CatalogSkeleton, ProductPrice, RecentSearches } from "../../components/cliente/catalog-ui";
import { api, ApiError } from "../../services/api";
import { formatCatalogPrice, formatPublicAddress, weekDayLabels, weekDays, type ProductQuery, type StoreQuery } from "../../services/public-catalog";
import { useRecentSearches } from "../../services/recent-searches";
import { useCatalogDetail } from "../../services/use-catalog-detail";
import { useState } from "react";

type FrameProps = { onBack: () => void; onProfilePress?: () => void; onNavigate?: (tab: ClientNavKey) => void; active?: ClientNavKey };
type ListProps = FrameProps & { userId?: string; onStore: (id: string) => void; onProduct: (id: string) => void };

export function ClientStoresPage({ filters, onChange, userId, onStore, onProduct, ...frame }: ListProps & { filters: StoreQuery; onChange: (filters: StoreQuery) => void }) {
  const history = useRecentSearches(userId);
  return <CatalogFrame title="Lojas de materiais" {...frame}>
    <StoreCatalog filters={filters} onChange={onChange} onStore={onStore} history={history} />
    <RecentSearches history={{ ...history, entries: history.entries.filter((entry) => entry.domain === "stores") }} onReuse={(entry) => onChange({ ...filters, q: entry.query })} />
  </CatalogFrame>;
}

export function ClientProductsPage({ filters, onChange, userId, onProduct, onStore, ...frame }: ListProps & { filters: ProductQuery; onChange: (filters: ProductQuery) => void }) {
  const history = useRecentSearches(userId);
  return <CatalogFrame title="Catálogo de produtos" {...frame}>
    <ProductCatalog filters={filters} onChange={onChange} onProduct={onProduct} history={history} />
    <RecentSearches history={{ ...history, entries: history.entries.filter((entry) => entry.domain === "products") }} onReuse={(entry) => onChange({ ...filters, q: entry.query })} />
  </CatalogFrame>;
}

function DetailError({ error, kind, onRetry }: { error: unknown; kind: "Loja" | "Produto"; onRetry: () => void }) {
  const missing = error instanceof ApiError && error.status === 404;
  return <CatalogError message={missing ? `${kind} não ${kind === "Loja" ? "encontrada ou indisponível" : "encontrado ou indisponível"}. Volte para consultar o catálogo.` : error instanceof Error ? error.message : "Não foi possível carregar os detalhes."} onRetry={missing ? undefined : onRetry} />;
}

export function ClientStoreDetailPage({ id, onProduct, filters: savedFilters, onFiltersChange, ...frame }: FrameProps & { id: string; filters?: ProductQuery; onFiltersChange?: (filters: ProductQuery) => void; onProduct: (id: string) => void }) {
  const detail = useCatalogDetail(api.publicStore, id);
  const [filters, setFilters] = useState<ProductQuery>({ storeId: id });
  const [contactError, setContactError] = useState<string | null>(null);
  const store = detail.data;
  const contact = async (value: string, kind: "tel" | "whatsapp") => {
    const digits = value.replace(/\D/g, "");
    const phone = digits.length <= 11 ? `55${digits}` : digits;
    try { await Linking.openURL(kind === "tel" ? `tel:+${phone}` : `https://wa.me/${phone}`); }
    catch { setContactError("Não foi possível abrir o contato da loja neste dispositivo."); }
  };
  return <CatalogFrame title="Detalhes da loja" {...frame}>
    {detail.loading ? <CatalogSkeleton /> : detail.error ? <DetailError error={detail.error} kind="Loja" onRetry={detail.retry} /> : store ? <>
      <CatalogImage uri={store.backgroundUrl ?? store.coverUrl} label={store.name || "Loja"} height={200} />
      <View className="gap-3 rounded-2xl bg-card p-4">
        <Text className="font-sans text-2xl font-bold text-foreground">{store.name || "Loja"}</Text>
        <Text className="font-sans text-sm font-semibold text-primary">{store.openNow ? "Aberto agora" : "Fechado"}</Text>
        {store.description ? <Text className="font-sans text-sm leading-6 text-foreground">{store.description}</Text> : null}
        <Text className="font-sans text-sm leading-5 text-muted-foreground">{formatPublicAddress(store.address)}</Text>
        <Text className="font-sans text-base font-semibold text-foreground">Horários de funcionamento</Text>
        {[...store.openingHours].sort((a, b) => weekDays.indexOf(a.dayOfWeek) - weekDays.indexOf(b.dayOfWeek)).map((hour) => <Text key={hour.dayOfWeek} className="font-sans text-sm text-muted-foreground">{weekDayLabels[weekDays.indexOf(hour.dayOfWeek)]}: {hour.closed ? "Fechado" : hour.openingTime && hour.closingTime ? `${hour.openingTime} – ${hour.closingTime}` : "Não informado"}</Text>)}
        {!store.openingHours.length ? <Text className="font-sans text-sm text-muted-foreground">Horários não informados.</Text> : null}
        <Text className="font-sans text-xs text-muted-foreground">Fuso horário: {store.timeZone}</Text>
        {store.whatsapp?.replace(/\D/g, "") ? <CatalogAction label="Falar com a loja no WhatsApp" onPress={() => { void contact(store.whatsapp!, "whatsapp"); }} /> : null}
        {store.phone?.replace(/\D/g, "") ? <CatalogAction label={`Ligar para ${store.phone}`} onPress={() => { void contact(store.phone!, "tel"); }} /> : null}
        {contactError ? <Text accessibilityRole="alert" className="font-sans text-sm text-primary">{contactError}</Text> : null}
      </View>
      {store.promotions.length ? <View className="gap-3">
        <Text className="font-sans text-lg font-bold text-foreground">Promoções da loja</Text>
        {store.promotions.map((promotion) => <View key={promotion.id} className="gap-2 rounded-2xl bg-card p-4">
          <Text className="font-sans text-base font-semibold text-foreground">{promotion.productName}</Text>
          <Text className="font-sans text-lg font-bold text-primary">{formatCatalogPrice(promotion.effectivePrice)}</Text>
          <CatalogAction label={`Ver oferta ${promotion.productName}`} onPress={() => onProduct(promotion.productId)} />
        </View>)}
      </View> : null}
      <Text className="font-sans text-xl font-bold text-foreground">Produtos da loja</Text>
      <ProductCatalog filters={{ ...(savedFilters ?? filters), storeId: id }} onChange={onFiltersChange ?? setFilters} onProduct={onProduct} />
    </> : null}
  </CatalogFrame>;
}

export function ClientProductDetailPage({ id, onStore, ...frame }: FrameProps & { id: string; onStore: (id: string) => void }) {
  const detail = useCatalogDetail(api.publicProduct, id);
  const product = detail.data;
  return <CatalogFrame title="Detalhes do produto" {...frame}>
    {detail.loading ? <CatalogSkeleton /> : detail.error ? <DetailError error={detail.error} kind="Produto" onRetry={detail.retry} /> : product ? <>
      <CatalogImage uri={product.coverUrl} label={product.name} height={270} />
      <Text className="self-start rounded-full bg-muted px-4 py-2 font-sans text-xs text-muted-foreground">{product.category.name}</Text>
      <Text className="font-sans text-2xl font-bold leading-8 text-foreground">{product.name}</Text>
      <View className="gap-3 rounded-2xl bg-card p-4"><ProductPrice product={product} large />
        {product.onPromotion ? <Text className="font-sans text-sm font-semibold text-primary">Promoção vigente</Text> : null}
        <Text className="font-sans text-sm text-foreground">{product.inStock ? `Disponível em estoque (${product.stock} unidades)` : "Produto sem estoque"}</Text>
      </View>
      <View className="gap-3 rounded-2xl bg-card p-4"><Text className="font-sans text-lg font-semibold text-foreground">Descrição do produto</Text><Text className="font-sans text-sm leading-6 text-muted-foreground">{product.description || "Descrição não informada."}</Text></View>
      <View className="gap-3 rounded-2xl bg-card p-4">
        <Text className="font-sans text-lg font-bold text-foreground">{product.store.name || "Loja"}</Text>
        <Text className="font-sans text-sm leading-5 text-muted-foreground">{formatPublicAddress(product.store.address)}</Text>
        <CatalogAction label="Ver loja e outros produtos" onPress={() => onStore(product.store.id)} primary />
      </View>
    </> : null}
  </CatalogFrame>;
}
