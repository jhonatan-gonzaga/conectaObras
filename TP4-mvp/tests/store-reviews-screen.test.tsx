import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { StoreReviewsScreen } from "../front-end/src/pages/lojista/StoreReviewsScreen";
import { ApiError, api, type StoreReviewsResponse } from "../front-end/src/services/api";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const reputation = {
  averageRating: 4,
  reviewCount: 3,
  distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
};

function makeResponse(
  overrides: Partial<StoreReviewsResponse> = {}
): StoreReviewsResponse {
  return {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    reputation: {
      averageRating: null,
      reviewCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    ...overrides,
  };
}

describe("StoreReviewsScreen", () => {
  afterEach(() => jest.restoreAllMocks());

  it("exibe média, quantidade e distribuição das avaliações", async () => {
    jest.spyOn(api, "storeReviews").mockResolvedValue(
      makeResponse({
        total: 3,
        reputation,
        items: [
          {
            id: "review-1",
            storeId: "store-1",
            rating: 5,
            comment: "Excelente atendimento",
            createdAt: "2026-10-20T12:00:00.000Z",
            updatedAt: "2026-10-20T12:00:00.000Z",
            customer: { name: "Mariana" },
          },
        ],
      })
    );

    const screen = render(<StoreReviewsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("4,0")).toBeTruthy();
    expect(screen.getByText("3 avaliações no total")).toBeTruthy();
    expect(screen.getByLabelText("5 estrelas: 1 avaliações")).toBeTruthy();
    expect(screen.getByLabelText("4 estrelas: 1 avaliações")).toBeTruthy();
    expect(screen.getByLabelText("3 estrelas: 1 avaliações")).toBeTruthy();
    expect(screen.getByLabelText("2 estrelas: 0 avaliações")).toBeTruthy();
    expect(screen.getByLabelText("1 estrelas: 0 avaliações")).toBeTruthy();
    expect(screen.getByText("Excelente atendimento")).toBeTruthy();
  });

  it("exibe estado vazio quando não existem avaliações", async () => {
    jest.spyOn(api, "storeReviews").mockResolvedValue(makeResponse());

    const screen = render(<StoreReviewsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("Nenhuma avaliação encontrada.")).toBeTruthy();
    expect(screen.getByText("0 avaliações no total")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("exibe erro e permite tentar novamente", async () => {
    const storeReviews = jest
      .spyOn(api, "storeReviews")
      .mockRejectedValueOnce(new ApiError("Erro ao carregar avaliações", 500))
      .mockResolvedValueOnce(makeResponse());

    const screen = render(<StoreReviewsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("Erro ao carregar avaliações")).toBeTruthy();

    fireEvent.press(screen.getByText("Tentar novamente"));

    expect(await screen.findByText("Nenhuma avaliação encontrada.")).toBeTruthy();
    expect(storeReviews).toHaveBeenCalledTimes(2);
  });

  it("navega entre páginas sem acumular avaliações anteriores", async () => {
    const firstPage = makeResponse({
      total: 11,
      page: 1,
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `review-${index + 1}`,
        storeId: "store-1",
        rating: 5,
        comment: `Comentário ${index + 1}`,
        createdAt: "2026-10-20T12:00:00.000Z",
        updatedAt: "2026-10-20T12:00:00.000Z",
        customer: { name: `Cliente ${index + 1}` },
      })),
    });

    const secondPage = makeResponse({
      total: 11,
      page: 2,
      items: [
        {
          id: "review-11",
          storeId: "store-1",
          rating: 4,
          comment: "Comentário 11",
          createdAt: "2026-10-21T12:00:00.000Z",
          updatedAt: "2026-10-21T12:00:00.000Z",
          customer: { name: "Cliente 11" },
        },
      ],
    });

    const storeReviews = jest
      .spyOn(api, "storeReviews")
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    const screen = render(<StoreReviewsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("Comentário 1")).toBeTruthy();
    expect(screen.getByText("Página 1 de 2")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Próxima página"));

    expect(await screen.findByText("Comentário 11")).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText("Comentário 1")).toBeNull();
      expect(screen.getByText("Página 2 de 2")).toBeTruthy();
    });

    expect(storeReviews).toHaveBeenNthCalledWith(1, 1, 10);
    expect(storeReviews).toHaveBeenNthCalledWith(2, 2, 10);
  });

  it("atualiza as avaliações ao pressionar o botão de refresh", async () => {
    const initial = makeResponse({
      total: 1,
      reputation: {
        averageRating: 3,
        reviewCount: 1,
        distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
      },
    });

    const updated = makeResponse({
      total: 2,
      reputation: {
        averageRating: 4,
        reviewCount: 2,
        distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
      },
    });

    const storeReviews = jest
      .spyOn(api, "storeReviews")
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(updated);

    const screen = render(<StoreReviewsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("1 avaliações no total")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Atualizar avaliações"));

    expect(await screen.findByText("2 avaliações no total")).toBeTruthy();
    expect(screen.getByText("4,0")).toBeTruthy();

    expect(storeReviews).toHaveBeenCalledTimes(2);
    expect(storeReviews).toHaveBeenNthCalledWith(2, 1, 10);
  });
});