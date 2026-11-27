
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ApiError, api, type StoreReviewsResponse } from "../../services/api";

const PAGE_SIZE = 10;
const STARS = [5, 4, 3, 2, 1] as const;
const BRAND = "#b94b50";
const GOLD = "#f59e0b";

type ReviewFilter = "all" | "5" | "recent";

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CL";
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <Text className="text-sm tracking-wider" style={{ color: GOLD }}>
      {"★".repeat(filled)}
      <Text className="text-[#d1d5db]">{"★".repeat(5 - filled)}</Text>
    </Text>
  );
}

export function StoreReviewsScreen({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<StoreReviewsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
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

      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar as avaliações."
      );
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);

    return () => {
      sequence.current += 1;
    };
  }, [load]);

  const reputation = data?.reputation;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / PAGE_SIZE))
    : 1;

  const average = reputation?.averageRating;
  const reviewCount = reputation?.reviewCount ?? 0;

  const visibleReviews = data
    ? filter === "5"
      ? data.items.filter((review) => review.rating === 5)
      : filter === "recent"
        ? [...data.items].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          )
        : data.items
    : [];

  const ratingLabel =
    average == null
      ? null
      : average >= 4.5
        ? "Excelente"
        : average >= 3.5
          ? "Muito bom"
          : average >= 2.5
            ? "Bom"
            : "A melhorar";

  return (
    <View className="w-full max-w-[560px] flex-1 bg-[#faf7f7]">
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      >
        {/* Cabeçalho */}
        <View className="mb-7 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar ao painel"
            onPress={onBack}
            className="flex-row items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-4 py-2"
          >
            <Ionicons name="chevron-back" size={16} color={BRAND} />
            <Text className="text-sm font-medium" style={{ color: BRAND }}>
              Voltar
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atualizar avaliações"
            disabled={loading}
            onPress={() => void load(1)}
            className="flex-row items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-4 py-2"
          >
            <Ionicons name="refresh-outline" size={16} color={BRAND} />
            <Text className="text-sm font-medium" style={{ color: BRAND }}>
              Atualizar
            </Text>
          </Pressable>
        </View>

        {/* Título */}
        <View className="mb-5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-2xl font-extrabold text-[#111827]">
              Avaliações da loja
            </Text>

            <View className="rounded-md border border-[#a7e4cf] bg-[#ecfdf5] px-2 py-1">
              <Text className="text-[10px] font-semibold text-[#047857]">
                Loja Oficial
              </Text>
            </View>
          </View>

          <Text className="mt-1 text-xs text-[#64748b]">
            Feedback de clientes de materiais de construção.
          </Text>
        </View>

        {/* Carregamento */}
        {loading && !data ? (
          <Text
            accessibilityRole="alert"
            className="py-10 text-center text-[#64748b]"
          >
            Carregando avaliações...
          </Text>
        ) : null}

        {/* Erro */}
        {error ? (
          <View className="mb-5 gap-3 rounded-2xl bg-white p-5">
            <Text accessibilityRole="alert" style={{ color: BRAND }}>
              {error}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => void load(page)}
            >
              <Text className="font-semibold" style={{ color: BRAND }}>
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            {/* Resumo das avaliações */}
            <View className="mb-5 rounded-2xl border border-[#f1eeee] bg-white p-5">
              <View className="flex-row flex-wrap items-center gap-4 border-b border-[#f1eeee] pb-4">
                <View>
                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-3xl font-extrabold text-[#111827]">
                      {average == null
                        ? "—"
                        : average.toFixed(1).replace(".", ",")}
                    </Text>
                    <Text className="text-xs text-[#94a3b8]">/ 5.0</Text>
                  </View>

                  {average == null ? (
                    <Text className="mt-1 text-sm text-[#94a3b8]">
                      Sem avaliações
                    </Text>
                  ) : (
                    <RatingStars rating={average} />
                  )}
                </View>

                <View className="gap-1">
                  {ratingLabel ? (
                    <View className="self-start rounded-full border border-[#a7e4cf] bg-[#ecfdf5] px-2 py-1">
                      <Text className="text-[10px] font-bold uppercase text-[#047857]">
                        {ratingLabel}
                      </Text>
                    </View>
                  ) : null}

                  <Text className="text-xs text-[#64748b]">
                    {formatCount(
                      reviewCount,
                      "avaliação no total",
                      "avaliações no total"
                    )}
                  </Text>
                </View>
              </View>

              {/* Distribuição das notas */}
              <View className="mt-4">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase text-[#334155]">
                    Distribuição das notas
                  </Text>

                  <Text className="text-[11px] text-[#94a3b8]">
                    {formatCount(
                      reviewCount,
                      "voto computado",
                      "votos computados"
                    )}
                  </Text>
                </View>

                {STARS.map((star) => {
                  const count = reputation?.distribution[star] ?? 0;
                  const percent = reviewCount
                    ? Math.min(100, (count / reviewCount) * 100)
                    : 0;

                  return (
                    <View
                      key={star}
                      className="mb-3 flex-row items-center gap-3"
                      accessibilityLabel={`${star} estrelas: ${count} avaliações`}
                    >
                      <Text className="w-6 text-xs font-semibold text-[#475569]">
                        {star} ★
                      </Text>

                      <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                        <View
                          className="h-2 rounded-full"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: BRAND
                          }}
                        />
                      </View>

                      <Text className="w-11 text-right text-xs text-[#64748b]">
                        {Math.round(percent)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Filtros da página atual */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-6"
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilter("all")}
                className="rounded-full border px-4 py-2"
                style={{
                  backgroundColor: filter === "all" ? BRAND : "#ffffff",
                  borderColor: filter === "all" ? BRAND : "#e5e7eb"
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: filter === "all" ? "#ffffff" : "#475569"
                  }}
                >
                  Todas ({reviewCount})
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setFilter("5")}
                className="rounded-full border px-4 py-2"
                style={{
                  backgroundColor: filter === "5" ? BRAND : "#ffffff",
                  borderColor: filter === "5" ? BRAND : "#e5e7eb"
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: filter === "5" ? "#ffffff" : "#475569" }}
                >
                  5 estrelas ({reputation?.distribution[5] ?? 0})
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setFilter("recent")}
                className="rounded-full border px-4 py-2"
                style={{
                  backgroundColor: filter === "recent" ? BRAND : "#ffffff",
                  borderColor: filter === "recent" ? BRAND : "#e5e7eb"
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: filter === "recent" ? "#ffffff" : "#475569"
                  }}
                >
                  Mais recentes
                </Text>
              </Pressable>
            </ScrollView>

            {/* Comentários */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-base font-bold text-[#111827]">
                Comentários dos clientes
              </Text>

              <Text className="text-xs text-[#94a3b8]">
                {formatCount(
                  visibleReviews.length,
                  "avaliação nesta página",
                  "avaliações nesta página"
                )}
              </Text>
            </View>

            {visibleReviews.length === 0 ? (
              <Text className="rounded-2xl bg-white p-5 text-[#64748b]">
                {filter === "5"
                  ? "Nenhuma avaliação de 5 estrelas nesta página."
                  : "Nenhuma avaliação encontrada."}
              </Text>
            ) : (
              visibleReviews.map((review) => {
                const customerName = review.customer?.name || "Cliente";

                return (
                  <View
                    key={review.id}
                    className="mb-3 rounded-2xl border border-[#f1eeee] bg-white p-4"
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 flex-row items-center gap-3">
                        <View className="h-9 w-9 items-center justify-center rounded-full border border-[#f8d5d7] bg-[#fbe8e9]">
                          <Text className="text-xs font-bold text-[#9d3a3f]">
                            {getInitials(customerName)}
                          </Text>
                        </View>

                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-[#111827]">
                            {customerName}
                          </Text>

                          <Text className="mt-1 text-[11px] text-[#94a3b8]">
                            {new Date(review.createdAt).toLocaleDateString(
                              "pt-BR"
                            )}
                          </Text>
                        </View>
                      </View>

                      <RatingStars rating={review.rating} />
                    </View>

                    <View className="mt-4 rounded-xl border border-[#fbe8e9] bg-[#fdf4f4] p-3">
                      <Text className="text-xs leading-5 text-[#475569]">
                        {review.comment?.trim() ||
                          "Cliente não deixou comentário."}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {/* Paginação */}
            {data.total > PAGE_SIZE ? (
              <View className="mt-4 flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Página anterior"
                  disabled={loading || page <= 1}
                  onPress={() => void load(page - 1)}
                  className="rounded-xl bg-white px-4 py-3"
                >
                  <Text
                    style={{
                      color: page <= 1 ? "#94a3b8" : BRAND
                    }}
                  >
                    Anterior
                  </Text>
                </Pressable>

                <Text className="text-xs text-[#64748b]">
                  Página {page} de {totalPages}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Próxima página"
                  disabled={loading || page >= totalPages}
                  onPress={() => void load(page + 1)}
                  className="rounded-xl bg-white px-4 py-3"
                >
                  <Text
                    style={{
                      color: page >= totalPages ? "#94a3b8" : BRAND
                    }}
                  >
                    Próxima
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Informativo */}
            <View className="mt-7 flex-row items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-[#fdf4f4]">
                <Ionicons
                  name="shield-checkmark-outline"
                  size={19}
                  color={BRAND}
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-[#334155]">
                  Avaliações dos clientes
                </Text>
                <Text className="mt-1 text-[11px] leading-4 text-[#64748b]">
                  Consulte as notas e os comentários recebidos pela sua loja
                  através do Conecta Obras.
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
