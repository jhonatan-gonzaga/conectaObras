import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { ClientBottomNav, type ClientNavKey } from "./bottom-nav";
import { ProjectHeader } from "../profissional/components";
import { resolveImageUrl } from "../../services/api";
import { formatCatalogPrice, formatPublicAddress, type PublicProduct, type PublicStore } from "../../services/public-catalog";
import type { RecentSearch, useRecentSearches } from "../../services/recent-searches";

export function CatalogFrame({ title, children, onBack, onProfilePress, onNavigate, active = "home" }: {
  title: string; children: ReactNode; onBack: () => void; onProfilePress?: () => void;
  onNavigate?: (tab: ClientNavKey) => void; active?: ClientNavKey;
}) {
  return <View className="flex-1 w-full max-w-[480px] bg-background">
    <ProjectHeader onBack={onBack} onProfilePress={onProfilePress} />
    <ScrollView className="flex-1" contentContainerClassName="gap-5 px-4 pb-8 pt-5" keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" className="font-sans text-[26px] font-bold leading-8 text-foreground">{title}</Text>
      {children}
    </ScrollView>
    <View className="px-5 pb-2"><ClientBottomNav active={active} onSelect={onNavigate} /></View>
  </View>;
}

export function CatalogAction({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    className={`min-h-11 items-center justify-center rounded-full px-4 py-3 ${primary ? "bg-primary" : "bg-card border border-input-border"} ${disabled ? "opacity-50" : ""}`}>
    <Text className={`font-sans text-sm font-semibold ${primary ? "text-white" : "text-primary"}`}>{label}</Text>
  </Pressable>;
}

export function CatalogChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    className={`min-h-11 items-center justify-center rounded-full px-4 py-2 ${selected ? "bg-primary" : "bg-card"}`}>
    <Text className={`font-sans text-sm font-semibold ${selected ? "text-white" : "text-foreground"}`}>{label}</Text>
  </Pressable>;
}

export function CatalogInput({ label, ...props }: TextInputProps & { label: string }) {
  return <View className="flex-1 gap-2">
    <Text className="font-sans text-xs font-semibold text-muted-foreground">{label}</Text>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#8b7b7e" className="min-h-11 rounded-full border border-input-border bg-card px-4 py-3 font-sans text-sm text-foreground" />
  </View>;
}

export function CatalogSearchInput({ query, onChange, placeholder }: { query: string; onChange: (value: string) => void; placeholder: string }) {
  return <View className="min-h-12 flex-row items-center gap-2 rounded-full border border-input-border bg-card pl-4 pr-1">
    <Ionicons name="search-outline" size={20} color="#8b7b7e" />
    <TextInput accessibilityLabel={placeholder} value={query} onChangeText={onChange} maxLength={120} placeholder={placeholder} placeholderTextColor="#8b7b7e"
      returnKeyType="search" className="min-h-12 flex-1 py-3 font-sans text-sm text-foreground" />
    {query ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar texto da busca" onPress={() => onChange("")} className="h-11 w-11 items-center justify-center"><Ionicons name="close" size={18} color="#8b7b7e" /></Pressable> : null}
  </View>;
}

export function CatalogToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View className="min-h-12 flex-row items-center justify-between gap-3 rounded-2xl bg-card px-4 py-2">
    <Text className="flex-1 font-sans text-sm font-semibold text-foreground">{label}</Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: "#8b7b7e", true: "#b94b50" }} thumbColor="#ffffff" />
  </View>;
}

export function RecentSearches({ history, onReuse }: { history: ReturnType<typeof useRecentSearches>; onReuse: (entry: RecentSearch) => void }) {
  return <View className="gap-3">
    <View className="flex-row items-center justify-between gap-2">
      <Text className="font-sans text-sm font-semibold text-foreground">Buscas recentes</Text>
      {history.entries.length ? <CatalogAction label="Limpar histórico" onPress={history.clear} /> : null}
    </View>
    {history.error ? <Text accessibilityRole="alert" className="font-sans text-sm text-primary">{history.error}</Text> : null}
    {history.entries.length === 0 ? <Text className="font-sans text-xs text-muted-foreground">Suas pesquisas aparecerão aqui.</Text> : <View className="flex-row flex-wrap gap-2">
      {history.entries.map((entry) => <View key={`${entry.domain}:${entry.query}`} className="max-w-full flex-row items-center rounded-full bg-card pl-4">
        <Pressable accessibilityRole="button" accessibilityLabel={`Repetir busca ${entry.query}`} onPress={() => onReuse(entry)} className="min-h-11 min-w-0 shrink justify-center py-2">
          <Text numberOfLines={1} className="font-sans text-xs font-semibold text-foreground">{entry.query}</Text>
          <Text className="font-sans text-[10px] text-muted-foreground">{({ professionals: "Profissionais", stores: "Lojas", products: "Produtos" })[entry.domain]}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Excluir busca ${entry.query}`} onPress={() => history.remove(entry)} className="h-11 w-11 items-center justify-center"><Ionicons name="close" size={16} color="#8b7b7e" /></Pressable>
      </View>)}
    </View>}
  </View>;
}

export function CatalogImage({ uri, label, height = 160 }: { uri?: string | null; label: string; height?: number }) {
  const resolved = resolveImageUrl(uri);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [resolved]);
  return <View style={{ height }} className="w-full items-center justify-center overflow-hidden rounded-2xl bg-muted">
    {resolved && !failed ? <Image accessibilityLabel={label} source={{ uri: resolved }} resizeMode="cover" className="h-full w-full" onError={() => setFailed(true)} /> : <View className="items-center gap-2 px-3"><Ionicons name="image-outline" size={28} color="#8b7b7e" /><Text className="font-sans text-xs text-muted-foreground">Imagem indisponível</Text></View>}
  </View>;
}

export function StoreCard({ store, onPress }: { store: PublicStore; onPress: () => void }) {
  const name = store.name || "Loja";
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver loja ${name}`} onPress={onPress} className="gap-3 rounded-2xl border border-black/5 bg-card p-3 shadow-sm shadow-black/5">
    <View className="relative"><CatalogImage uri={store.backgroundUrl ?? store.coverUrl} label={name} />
      <View className="absolute left-3 top-3 rounded-full bg-card px-3 py-2"><Text className="font-sans text-xs font-semibold text-foreground">{store.openNow ? "● Aberto agora" : "Fechado"}</Text></View>
    </View>
    <Text className="font-sans text-lg font-bold text-foreground">{name}</Text>
    <Text className="font-sans text-sm leading-5 text-muted-foreground">{formatPublicAddress(store.address)}</Text>
    {store.description ? <Text numberOfLines={2} className="font-sans text-sm text-muted-foreground">{store.description}</Text> : null}
    <Text className="self-end py-2 font-sans text-sm font-semibold text-primary">Ver catálogo →</Text>
  </Pressable>;
}

export function ProductPrice({ product, large = false }: { product: PublicProduct; large?: boolean }) {
  return <View className="gap-1">
    {product.onPromotion && product.basePrice !== product.effectivePrice ? <Text className="font-sans text-xs text-muted-foreground line-through">{formatCatalogPrice(product.basePrice)}</Text> : null}
    <Text className={`font-sans font-bold text-primary ${large ? "text-3xl" : "text-lg"}`}>{formatCatalogPrice(product.effectivePrice)}</Text>
  </View>;
}

export function ProductCard({ product, onPress }: { product: PublicProduct; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver produto ${product.name}`} onPress={onPress} className="w-[48%] overflow-hidden rounded-2xl border border-black/5 bg-card shadow-sm shadow-black/5">
    <View className="relative"><CatalogImage uri={product.coverUrl} label={product.name} height={150} />
      {product.onPromotion ? <View className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1"><Text className="font-sans text-[10px] font-semibold text-white">Promoção</Text></View> : null}
    </View>
    <View className="flex-1 gap-2 p-3">
      <Text numberOfLines={1} className="font-sans text-xs text-muted-foreground">{product.store.name || "Loja"}</Text>
      <Text numberOfLines={3} className="font-sans text-sm font-semibold leading-5 text-foreground">{product.name}</Text>
      <View className="mt-auto pt-2"><ProductPrice product={product} /></View>
      <Text className="font-sans text-xs text-muted-foreground">{product.inStock ? `Em estoque: ${product.stock}` : "Sem estoque"}</Text>
    </View>
  </Pressable>;
}

export function CatalogSkeleton() {
  return <View accessibilityLabel="Carregando catálogo" accessibilityRole="progressbar" className="gap-3 rounded-2xl bg-card p-4">
    <ActivityIndicator color="#b94b50" /><View className="h-32 rounded-2xl bg-muted" /><View className="h-4 w-3/4 rounded-full bg-muted" /><View className="h-4 w-1/2 rounded-full bg-muted" />
  </View>;
}

export function CatalogError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View accessibilityRole="alert" className="gap-3 rounded-2xl border border-input-border bg-card p-5">
    <Text className="font-sans text-sm text-primary">{message}</Text>
    {onRetry ? <CatalogAction label="Tentar novamente" onPress={onRetry} primary /> : null}
  </View>;
}

export function CatalogPagination({ count, total, loading, hasMore, onMore }: { count: number; total: number; loading: boolean; hasMore: boolean; onMore: () => void }) {
  return <View className="gap-3 py-2">
    {loading ? <ActivityIndicator accessibilityLabel="Carregando mais resultados" color="#b94b50" /> : hasMore ? <CatalogAction label="Carregar mais resultados" onPress={onMore} /> : null}
    <Text className="text-center font-sans text-xs text-muted-foreground">Mostrando {count} de {total} resultados</Text>
  </View>;
}
