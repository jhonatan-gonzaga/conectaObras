import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CatalogAction, CatalogChip, CatalogError, CatalogFrame, CatalogImage, CatalogSearchInput, CatalogSkeleton, ProductCard, RecentSearches } from "../../components/cliente/catalog-ui";
import { StoreCatalog, ProductCatalog } from "../../components/cliente/catalog-results";
import { useCommerce } from "../../components/cliente/CommerceContext";
import { api } from "../../services/api";
import { cartLineTotal, centsAsDecimal } from "../../services/commerce-cart";
import { formatCatalogPrice, formatPublicAddress, type ProductQuery, type PublicProduct, type PublicStore, type StoreQuery } from "../../services/public-catalog";
import { useCatalogPage } from "../../services/use-catalog-page";
import { useCatalogDetail } from "../../services/use-catalog-detail";
import { useRecentSearches } from "../../services/recent-searches";
import type { ClientSearchState } from "../../navigation/types";

type Frame = { onBack: () => void; onProfilePress: () => void };
type CatalogLinks = { onStores: () => void; onProducts: (filters?: ProductQuery) => void; onStore: (id: string) => void; onProduct: (id: string) => void };

export function CommerceHomePage({ onStores, onProducts, onStore, onProduct, ...frame }: Frame & CatalogLinks) {
  const commerce = useCommerce();
  const [query, setQuery] = useState("");
  const categories = useCatalogDetail(api.productCategories, "categories");
  const stores = useCatalogPage<PublicStore, StoreQuery>(api.publicStores, { limit: 3 });
  const offers = useCatalogPage<PublicProduct, ProductQuery>(api.publicProducts, { onPromotion: true, inStock: true, limit: 4 });
  return <CatalogFrame title="Início — Compras" {...frame}>
    <Text className="self-start rounded-full bg-muted px-4 py-2 font-sans text-xs font-semibold text-primary">Comércio local · Itacoatiara, AM</Text>
    <CatalogSearchInput query={query} onChange={setQuery} placeholder="Buscar materiais, produtos ou marcas" onSubmit={() => onProducts({ q: query })} />
    <CatalogAction label="Buscar no catálogo" onPress={() => onProducts({ q: query })} />
    <View className="flex-row gap-3">
      {[
        { label: "Lista de Lojas", detail: "Ver estabelecimentos", icon: "storefront-outline" as const, press: onStores },
        { label: "Carrinho", detail: `${commerce?.cart.count ?? 0} itens salvos`, icon: "basket-outline" as const, press: () => commerce?.onNavigate("cart") },
        { label: "Meus Pedidos", detail: "Disponibilidade", icon: "receipt-outline" as const, press: () => commerce?.onNavigate("orders") },
      ].map((item) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={item.press} className="min-h-28 flex-1 gap-2 rounded-2xl bg-card p-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-muted"><Ionicons name={item.icon} size={22} color="#b94b50" /></View>
        <Text className="font-sans text-xs font-bold text-foreground">{item.label}</Text><Text className="font-sans text-[10px] leading-4 text-muted-foreground">{item.detail}</Text>
      </Pressable>)}
    </View>
    <View className="gap-3 rounded-3xl bg-primary p-5">
      <Text className="font-sans text-xs font-semibold text-white">Rede Conecta Obras</Text>
      <Text className="font-sans text-xl font-extrabold leading-7 text-white">Materiais para sua obra em Itacoatiara</Text>
      <Text className="font-sans text-sm leading-5 text-white">Explore produtos e conheça as lojas cadastradas na plataforma.</Text>
    </View>
    <View className="gap-3"><Text className="font-sans text-lg font-bold text-foreground">Categorias de produtos</Text>
      {categories.loading ? <CatalogSkeleton /> : categories.error ? <CatalogError message="Não foi possível carregar as categorias." onRetry={categories.retry} /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <CatalogChip label="Ver todos os produtos" selected={false} onPress={() => onProducts()} />
        {categories.data?.map((category) => <CatalogChip key={category.id} label={category.name} selected={false} onPress={() => onProducts({ categoryId: category.id })} />)}
      </ScrollView>}
    </View>
    <Text className="font-sans text-lg font-bold text-foreground">Conheça as lojas</Text>
    {stores.loading ? <CatalogSkeleton /> : stores.error ? <CatalogError message={stores.error} onRetry={stores.retry} /> : stores.items.length ? stores.items.map((store) => <Pressable key={store.id} accessibilityRole="button" accessibilityLabel={`Ver loja ${store.name || "Loja"}`} onPress={() => onStore(store.id)} className="gap-3 rounded-2xl bg-card p-4">
      <View className="flex-row items-center gap-3"><View className="w-16"><CatalogImage uri={store.logoUrl ?? store.backgroundUrl} label={store.name || "Loja"} height={64} /></View><View className="flex-1 gap-1"><Text className="font-sans text-base font-bold text-foreground">{store.name || "Loja"}</Text><Text className="font-sans text-xs text-muted-foreground">{formatPublicAddress(store.address)}</Text></View></View>
      {store.description ? <Text numberOfLines={2} className="font-sans text-sm text-muted-foreground">{store.description}</Text> : null}
      <View className="flex-row justify-between"><Text className="font-sans text-xs font-semibold text-primary">{store.openNow ? "● Aberto agora" : "Fechado"}</Text><Text className="font-sans text-sm font-semibold text-primary">Ver loja →</Text></View>
    </Pressable>) : <Text className="font-sans text-sm text-muted-foreground">Nenhuma loja disponível no momento.</Text>}
    <CatalogAction label="Ver todas as lojas" onPress={onStores} />
    <Text className="font-sans text-lg font-bold text-foreground">Promoções vigentes</Text>
    {offers.loading ? <CatalogSkeleton /> : offers.error ? <CatalogError message={offers.error} onRetry={offers.retry} /> : offers.items.length ? <View className="flex-row flex-wrap justify-between gap-y-4">{offers.items.map((product) => <ProductCard key={product.id} product={product} onPress={() => onProduct(product.id)} />)}</View> : <Text className="font-sans text-sm text-muted-foreground">Nenhuma promoção disponível no momento.</Text>}
    <CatalogAction label="Ver promoções no catálogo" onPress={() => onProducts({ onPromotion: true })} />
  </CatalogFrame>;
}

export function CommerceSearchPage({ state, onChange, userId, onStore, onProduct, ...frame }: Frame & { state: ClientSearchState; onChange: (state: ClientSearchState) => void; userId?: string; onStore: (id: string) => void; onProduct: (id: string) => void }) {
  const history = useRecentSearches(userId);
  const domain = state.domain === "stores" ? "stores" : "products";
  return <CatalogFrame title="Buscar materiais e lojas" {...frame}>
    <View className="flex-row gap-3"><CatalogChip label="Lojas" selected={domain === "stores"} onPress={() => onChange({ ...state, domain: "stores" })} /><CatalogChip label="Produtos" selected={domain === "products"} onPress={() => onChange({ ...state, domain: "products" })} /></View>
    {domain === "stores" ? <StoreCatalog filters={state.stores} onChange={(stores) => onChange({ ...state, stores })} onStore={onStore} history={history} /> : <ProductCatalog filters={state.products} onChange={(products) => onChange({ ...state, products })} onProduct={onProduct} history={history} />}
    <RecentSearches history={{ ...history, entries: history.entries.filter((entry) => entry.domain !== "professionals") }} onReuse={(entry) => onChange(entry.domain === "stores" ? { ...state, domain: "stores", stores: { ...state.stores, q: entry.query, page: undefined } } : { ...state, domain: "products", products: { ...state.products, q: entry.query, page: undefined } })} />
  </CatalogFrame>;
}

export function CommerceCartPage({ onProduct, onStore, ...frame }: Frame & { onProduct: (id: string) => void; onStore: (id: string) => void }) {
  const commerce = useCommerce();
  const cart = commerce?.cart;
  if (!cart) return null;
  const groups = [...new Set(cart.lines.filter((line) => line.product).map((line) => line.product!.store.id))];
  return <CatalogFrame title="Carrinho de Compras" {...frame}>
    {cart.error ? <View className="gap-3"><CatalogError message={cart.error} onRetry={cart.retry} />{cart.ready ? <CatalogAction label="Salvar carrinho novamente" onPress={cart.saveAgain} /> : null}</View> : null}
    {!cart.ready && !cart.error ? <CatalogSkeleton /> : null}
    {cart.ready && !cart.lines.length ? <View className="items-center gap-4 rounded-3xl bg-card p-8"><Ionicons name="basket-outline" size={40} color="#b94b50" /><Text className="text-center font-sans text-lg font-bold text-foreground">Seu carrinho está vazio</Text><Text className="text-center font-sans text-sm leading-5 text-muted-foreground">Explore as lojas e adicione produtos disponíveis.</Text><CatalogAction label="Buscar produtos" onPress={() => commerce.onNavigate("search")} primary /></View> : null}
    {groups.map((storeId) => {
      const product = cart.lines.find((line) => line.product?.store.id === storeId)!.product!;
      return <View key={storeId} className="gap-2 rounded-2xl bg-card p-4"><Text className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origem dos itens</Text><Text className="font-sans text-lg font-bold text-foreground">{product.store.name || "Loja"}</Text><Text className="font-sans text-xs text-muted-foreground">{formatPublicAddress(product.store.address)}</Text><CatalogAction label={`Ver loja: ${product.store.name || "Loja"}`} onPress={() => onStore(storeId)} /></View>;
    })}
    {cart.lines.length ? <Text className="font-sans text-base font-bold text-foreground">Itens selecionados ({cart.lines.length} produtos)</Text> : null}
    {cart.lines.map((line) => {
      const product = line.product;
      const busy = cart.busy.includes(line.id);
      return <View key={line.id} className="gap-3 rounded-2xl bg-card p-4">
        <View className="flex-row gap-3"><View className="w-20"><CatalogImage uri={product?.coverUrl} label={product?.name || "Produto indisponível"} height={80} /></View><View className="flex-1 gap-2"><Text className="font-sans text-xs text-muted-foreground">{product?.store.name || "Origem não confirmada"}</Text><Text className="font-sans text-sm font-bold text-foreground">{product?.name || "Produto indisponível"}</Text>{product ? <><Text className="font-sans text-xs text-muted-foreground">{formatCatalogPrice(product.effectivePrice)} / un</Text><Text className="font-sans text-base font-bold text-primary">{formatCatalogPrice(centsAsDecimal(cartLineTotal(line)))}</Text></> : <Text className="font-sans text-xs text-primary">Preço e estoque não confirmados. Item fora do total.</Text>}</View></View>
        {product ? <><CatalogAction label={`Ver produto: ${product.name}`} onPress={() => onProduct(line.id)} /><View className="flex-row items-center justify-between gap-2 rounded-2xl bg-muted px-3 py-2"><Text className="font-sans text-xs text-muted-foreground">Quantidade</Text><View className="flex-row items-center gap-3"><CatalogAction label={`Diminuir quantidade: ${product.name}`} text="?" disabled={busy || line.quantity <= 1} onPress={() => { void cart.setQuantity(line.id, line.quantity - 1); }} /><Text accessibilityLabel={`Quantidade: ${product.name}`} className="font-sans text-sm font-bold text-foreground">{line.quantity}</Text><CatalogAction label={`Aumentar quantidade: ${product.name}`} text="+" primary disabled={busy || line.quantity >= product.stock} onPress={() => { void cart.setQuantity(line.id, line.quantity + 1); }} /></View></View></> : null}
        <CatalogAction label={`Remover ${product?.name || "produto indisponível"}`} disabled={busy} onPress={() => cart.remove(line.id)} />
      </View>;
    })}
    {cart.lines.length ? <View className="gap-4 rounded-2xl bg-card p-5"><Text className="font-sans text-sm font-bold uppercase tracking-wide text-muted-foreground">Resumo do carrinho</Text><View className="flex-row justify-between"><Text className="font-sans text-sm text-muted-foreground">Subtotal dos produtos</Text><Text testID="cart-subtotal" className="font-sans text-sm font-bold text-foreground">{formatCatalogPrice(centsAsDecimal(cart.total))}</Text></View><View className="h-px bg-muted" /><View className="flex-row items-center justify-between"><Text className="font-sans text-base font-bold text-foreground">Total dos produtos</Text><Text testID="cart-total" className="font-sans text-2xl font-extrabold text-primary">{formatCatalogPrice(centsAsDecimal(cart.total))}</Text></View><Text className="font-sans text-xs leading-5 text-muted-foreground">Carrinho salvo neste dispositivo. Não há reserva de estoque nem finalização de compra disponível. Valores e disponibilidade podem mudar.</Text><CatalogAction label="Atualizar preços e estoque" disabled={cart.busy.length > 0} onPress={cart.retry} /><CatalogAction label="Adicionar mais produtos" onPress={() => commerce.onNavigate("search")} /></View> : null}
  </CatalogFrame>;
}

export function CommerceOrdersPage(frame: Frame) {
  return <CatalogFrame title="Pedidos" {...frame}><View className="items-center gap-4 rounded-3xl bg-card p-8"><Ionicons name="receipt-outline" size={40} color="#b94b50" /><Text className="text-center font-sans text-lg font-bold text-foreground">Consulta de pedidos indisponível</Text><Text className="text-center font-sans text-sm leading-6 text-muted-foreground">O acompanhamento de pedidos para clientes ainda não está disponível. Você pode consultar lojas e organizar os produtos no carrinho local.</Text></View></CatalogFrame>;
}
