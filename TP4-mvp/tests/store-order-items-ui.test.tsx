import { act, fireEvent, render } from "@testing-library/react-native";
import { Modal } from "react-native";
import { OrderDetails } from "../front-end/src/components/orders/OrderDetails";
import { ApiError, api, type StoreOrderItemDetails } from "../front-end/src/services/api";
import { order } from "./fixtures/store-order";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/components/native-date-time-field", () => ({ NativeDateTimeField: () => null }));

const details: StoreOrderItemDetails = {
  item: order.items[0],
  product: {
    name: "Tijolo atualizado", description: "Tijolo cerâmico de oito furos", sku: "TIJ-8", categoryName: "Alvenaria", price: "15.00",
    images: [{ id: "image-a", url: "/uploads/products/tijolo.jpg", altText: "Tijolo", position: 0, isCover: true }],
  },
};
beforeEach(() => {
  jest.spyOn(api, "storeOrderItem").mockResolvedValue({ ...details, product: { ...details.product!, stock: 12, status: "ACTIVE" } });
  jest.spyOn(api, "clientStoreOrderItem").mockResolvedValue(details);
});
afterEach(() => jest.restoreAllMocks());

it.each(["owner", "client"] as const)("abre detalhes do produto incluso e retorna ao pedido para %s", async (audience) => {
  const screen = render(<OrderDetails order={order} audience={audience} disabled={false} onRequest={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Ver detalhes de Tijolo"));
  expect(screen.getByText("Detalhes do produto")).toBeTruthy();
  expect(await screen.findByText("Tijolo cerâmico de oito furos")).toBeTruthy();
  expect(screen.getByText("Categoria: Alvenaria")).toBeTruthy();
  expect(screen.getByText("Produto comprado: Tijolo")).toBeTruthy();
  expect(screen.getByText("Quantidade: 2")).toBeTruthy();
  expect(screen.getByText(/Preço unitário no pedido: R\$\s*10,00/)).toBeTruthy();
  expect(screen.getByText(/Total do item: R\$\s*20,00/)).toBeTruthy();
  expect(screen.getByText(/Preço atual no catálogo: R\$\s*15,00/)).toBeTruthy();
  expect(audience === "owner" ? api.storeOrderItem : api.clientStoreOrderItem).toHaveBeenCalledWith("order-a", "item-a");
  expect(audience === "owner" ? api.clientStoreOrderItem : api.storeOrderItem).not.toHaveBeenCalled();
  expect(screen.queryByText("Editar produto")).toBeNull();
  if (audience === "client") expect(screen.queryByText(/Estoque:/)).toBeNull();
  fireEvent.press(screen.getByLabelText("Ampliar foto 1 de Tijolo atualizado"));
  expect(screen.getByLabelText("Foto do produto em tela cheia").props.source.uri).toMatch(/^http.*\/uploads\/products\/tijolo.jpg$/);
  fireEvent.press(screen.getByLabelText("Fechar imagem"));
  fireEvent.press(screen.getByLabelText("Fechar detalhes"));
  expect(screen.queryByText("Detalhes do produto")).toBeNull();
  expect(screen.getByText("Pedido PED-A")).toBeTruthy();
});

it("preserva o snapshot de um produto removido do catálogo", async () => {
  jest.mocked(api.storeOrderItem).mockResolvedValue({ item: order.items[0], product: null });
  const screen = render(<OrderDetails order={order} audience="owner" disabled={false} onRequest={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Ver detalhes de Tijolo"));
  expect(await screen.findByText(/Este produto não está mais disponível no catálogo/)).toBeTruthy();
  expect(screen.getByText("Tijolo")).toBeTruthy();
  expect(screen.getByText(/Preço unitário no pedido: R\$\s*10,00/)).toBeTruthy();
  expect(screen.queryByText(/Preço atual no catálogo/)).toBeNull();
});

it("mostra erro da API, mantém os dados comprados e permite tentar novamente", async () => {
  jest.mocked(api.clientStoreOrderItem).mockRejectedValueOnce(new ApiError("Catálogo indisponível", 503));
  const screen = render(<OrderDetails order={order} audience="client" disabled={false} onRequest={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Ver detalhes de Tijolo"));
  await screen.findByText("Catálogo indisponível");
  expect(screen.getByText("Quantidade: 2")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Tentar carregar produto novamente"));
  expect(await screen.findByText("Tijolo cerâmico de oito furos")).toBeTruthy();
  expect(api.clientStoreOrderItem).toHaveBeenCalledTimes(2);
});

it("fecha pelo botão voltar nativo e ignora uma resposta que chega depois do fechamento", async () => {
  let finish!: (value: StoreOrderItemDetails) => void;
  jest.mocked(api.storeOrderItem).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const screen = render(<OrderDetails order={order} audience="owner" disabled={false} onRequest={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Ver detalhes de Tijolo"));
  expect(screen.getByText("Carregando informações do produto...")).toBeTruthy();
  const modal = screen.UNSAFE_getAllByType(Modal).find((entry) => entry.props.visible);
  act(() => modal!.props.onRequestClose());
  await act(async () => { finish(details); });
  expect(screen.queryByText("Detalhes do produto")).toBeNull();
  fireEvent.press(screen.getByLabelText("Ver detalhes de Tijolo"));
  await screen.findByText("Tijolo cerâmico de oito furos");
});

it("não abre detalhes durante gravação ou confirmação de uma ação do pedido", () => {
  const screen = render(<OrderDetails order={order} audience="owner" disabled onRequest={jest.fn()} />);
  fireEvent.press(screen.getByLabelText("Ver detalhes de Tijolo"));
  expect(screen.queryByText("Detalhes do produto")).toBeNull();
  expect(api.storeOrderItem).not.toHaveBeenCalled();
});
