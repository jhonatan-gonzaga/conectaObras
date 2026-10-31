import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ApiError, api, type StoreReviewsResponse } from "../../services/api";

const PAGE_SIZE = 10;
const STARS = [5, 4, 3, 2, 1] as const;

export function StoreReviewsScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<StoreReviewsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async (targetPage: number) => {
    const current = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.storeReviews(targetPage, PAGE_SIZE);
      if (current !== sequence.current) return;
      setData(result);
      setPage(result.page);
    } catch (cause) {
      if (current !== sequence.current) return;
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as avaliações.");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(1);
    return () => { sequence.current += 1; };
  }, [load]);

  const reputation = data?.reputation;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 40 }}>
      <View className="mb-5 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao painel" onPress={onBack} className="flex-row items-center gap-2 rounded-xl bg-card px-4 py-3">
          <Ionicons name="arrow-back" size={18} color="#99333a" /><Text className="font-semibold text-primary">Voltar</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Atualizar avaliações" disabled={loading} onPress={() => void load(1)} className="flex-row items-center gap-2 rounded-xl bg-card px-4 py-3">
          <Ionicons name="refresh" size={18} color="#99333a" /><Text className="font-semibold text-primary">Atualizar</Text>
        </Pressable>
      </View>
      <Text className="mb-5 text-2xl font-bold text-foreground">Avaliações da loja</Text>
      {loading && !data ? <Text accessibilityRole="alert" className="py-10 text-center text-muted-foreground">Carregando avaliações...</Text> : null}
      {error ? <View className="mb-5 gap-3 rounded-2xl bg-card p-5"><Text accessibilityRole="alert" className="text-primary">{error}</Text><Pressable accessibilityRole="button" onPress={() => void load(page)}><Text className="font-semibold text-primary">Tentar novamente</Text></Pressable></View> : null}
      {data ? <>
        <View className="mb-5 rounded-[18px] bg-card p-5">
          <View className="flex-row items-center gap-2"><Ionicons name="star" size={26} color="#b98542" /><Text className="text-3xl font-bold text-foreground">{reputation?.averageRating == null ? "—" : reputation.averageRating.toFixed(1).replace(".", ",")}</Text></View>
          <Text className="mt-1 text-sm text-muted-foreground">{reputation?.reviewCount ?? 0} avaliações no total</Text>
          <Text className="mb-3 mt-5 font-semibold text-foreground">Distribuição das notas</Text>
          {STARS.map((star) => {
            const count = reputation?.distribution[star] ?? 0;
            const percent = reputation?.reviewCount ? Math.min(100, (count / reputation.reviewCount) * 100) : 0;
            return <View key={star} className="mb-2 flex-row items-center gap-3" accessibilityLabel={`${star} estrelas: ${count} avaliações`}>
              <Text className="w-7 text-sm text-foreground">{star} ★</Text>
              <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#fbe7e8]"><View className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} /></View>
              <Text className="w-8 text-right text-xs text-muted-foreground">{count}</Text>
            </View>;
          })}
        </View>
        <Text className="mb-3 text-lg font-semibold text-foreground">Comentários dos clientes</Text>
        {data.items.length === 0 ? <Text className="rounded-2xl bg-card p-5 text-muted-foreground">Nenhuma avaliação encontrada.</Text> : data.items.map((review) => <View key={review.id} className="mb-3 rounded-2xl bg-card p-4">
          <View className="flex-row items-center justify-between"><Text className="flex-1 font-semibold text-foreground">{review.customer?.name || "Cliente"}</Text><Text className="text-[#b98542]">{"★".repeat(Math.max(0, Math.min(5, review.rating)))}{"☆".repeat(5 - Math.max(0, Math.min(5, review.rating)))}</Text></View>
          <Text className="mt-2 text-sm text-foreground">{review.comment?.trim() || "Cliente não deixou comentário."}</Text>
          <Text className="mt-2 text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString("pt-BR")}</Text>
        </View>)}
        {data.total > PAGE_SIZE ? <View className="mt-4 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Página anterior" disabled={loading || page <= 1} onPress={() => void load(page - 1)} className="rounded-xl bg-card px-4 py-3"><Text className={page <= 1 ? "text-muted-foreground" : "font-semibold text-primary"}>Anterior</Text></Pressable>
          <Text className="text-sm text-muted-foreground">Página {page} de {totalPages}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Próxima página" disabled={loading || page >= totalPages} onPress={() => void load(page + 1)} className="rounded-xl bg-card px-4 py-3"><Text className={page >= totalPages ? "text-muted-foreground" : "font-semibold text-primary"}>Próxima</Text></Pressable>
        </View> : null}
      </> : null}
    </ScrollView>
  </View>;
}
