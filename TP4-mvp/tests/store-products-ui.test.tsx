import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ApiError, api } from "../front-end/src/services/api";
import { pickProductImage } from "../front-end/src/services/image-upload";
import { StoreProductFormScreen } from "../front-end/src/pages/lojista/StoreProductFormScreen";
import { StoreProductsScreen } from "../front-end/src/pages/lojista/StoreProductsScreen";
import type { ProductFilters, StoreProduct } from "../front-end/src/services/store-products";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../front-end/src/services/image-upload", () => ({ pickProductImage: jest.fn() }));

const product: StoreProduct = {
  id: "product-1", storeId: "store-1", categoryId: "tools", sku: "FUR-01", name: "Furadeira",
  description: "710W", price: "29.90", stock: 3, status: "ACTIVE",
  lastPriceUpdateAt: "2026-10-07T12:00:00.000Z", createdAt: "2026-10-07T12:00:00.000Z",
  updatedAt: "2026-10-07T12:00:00.000Z", images: [],
};
const category = { id: "tools", name: "Ferramentas", slug: "ferramentas" };
const filters: ProductFilters = { q: "", categoryId: "", status: "", stock: "" };

describe("Store products screens", () => {
  beforeEach(() => {
    jest.spyOn(api, "productCategories").mockResolvedValue([category]);
  });
  afterEach(() => jest.restoreAllMocks());

  it("loads real pages, applies filters and preserves parent navigation state", async () => {
    const list = jest.spyOn(api, "storeProducts").mockResolvedValueOnce({ items: [product], total: 2, page: 1, limit: 10 })
      .mockResolvedValue({ items: [{ ...product, id: "product-2", name: "Trena" }], total: 2, page: 2, limit: 10 });
    const onChangeFilters = jest.fn();
    const onEdit = jest.fn();
    const screen = render(<StoreProductsScreen filters={filters} onChangeFilters={onChangeFilters} onBack={jest.fn()} onCreate={jest.fn()} onEdit={onEdit} />);
    await waitFor(() => expect(screen.getByText("Furadeira")).toBeTruthy());
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10, status: "" }));
    fireEvent.press(screen.getByText("Carregar mais"));
    await waitFor(() => expect(screen.getByText("Trena")).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText("Buscar produtos"), "cimento");
    expect(onChangeFilters).toHaveBeenCalledWith({ ...filters, q: "cimento" });
    fireEvent.press(screen.getByText("Ferramentas"));
    expect(onChangeFilters).toHaveBeenCalledWith({ ...filters, categoryId: "tools" });
    fireEvent.press(screen.getByLabelText("Editar Furadeira"));
    expect(onEdit).toHaveBeenCalledWith("product-1");
  }, 10000);

  it("restores server values after a failed quick update", async () => {
    jest.spyOn(api, "storeProducts").mockResolvedValue({ items: [product], total: 1, page: 1, limit: 10 });
    jest.spyOn(api, "updateStoreProductInventory").mockRejectedValue(new ApiError("Produto alterado em outra sessão.", 409));
    jest.spyOn(api, "storeProduct").mockResolvedValue({ ...product, price: "32.00", stock: 2 });
    const screen = render(<StoreProductsScreen filters={filters} onChangeFilters={jest.fn()} onBack={jest.fn()} onCreate={jest.fn()} onEdit={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("Furadeira")).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText("Preço de Furadeira"), "40,00");
    fireEvent.press(screen.getByLabelText("Salvar preço e estoque de Furadeira"));
    await waitFor(() => expect(screen.getByLabelText("Preço de Furadeira").props.value).toBe("32,00"));
    expect(screen.getByLabelText("Estoque de Furadeira").props.value).toBe("2");
    expect(screen.getByText("Produto alterado em outra sessão.")).toBeTruthy();
  });

  it("opens product details and its photo in full screen from the catalog", async () => {
    const photo = { id: "photo-1", url: "https://example.test/photo.jpg", altText: null, position: 0, isCover: true };
    jest.spyOn(api, "storeProducts").mockResolvedValue({ items: [{ ...product, images: [photo] }], total: 1, page: 1, limit: 10 });
    const onOrders = jest.fn();
    const screen = render(<StoreProductsScreen filters={filters} onChangeFilters={jest.fn()} onBack={jest.fn()} onCreate={jest.fn()} onEdit={jest.fn()} onOpenOrders={onOrders} />);
    await waitFor(() => expect(screen.getByLabelText("Ver detalhes de Furadeira")).toBeTruthy());
    expect(screen.getByText("● Disponível para venda")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Ampliar foto de Furadeira"));
    expect(screen.getByLabelText("Foto do produto em tela cheia")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Fechar imagem"));
    fireEvent.press(screen.getByLabelText("Pedidos"));
    expect(onOrders).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText("Ver informações de Furadeira"));
    expect(screen.getByText("Detalhes do produto")).toBeTruthy();
    expect(screen.getByText("Categoria: Ferramentas")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Ampliar foto 1 de Furadeira"));
    expect(screen.getByLabelText("Foto do produto em tela cheia")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Fechar imagem"));
  });

  it("requires confirmation and blocks duplicate archive requests", async () => {
    const list = jest.spyOn(api, "storeProducts").mockResolvedValueOnce({ items: [product], total: 1, page: 1, limit: 10 })
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    let finish!: (value: StoreProduct) => void;
    const archive = jest.spyOn(api, "archiveStoreProduct").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const screen = render(<StoreProductsScreen filters={filters} onChangeFilters={jest.fn()} onBack={jest.fn()} onCreate={jest.fn()} onEdit={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("Furadeira")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Arquivar Furadeira"));
    expect(archive).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Confirmar arquivamento"));
    fireEvent.press(screen.getByLabelText("Confirmar arquivamento"));
    expect(archive).toHaveBeenCalledTimes(1);
    finish({ ...product, status: "ARCHIVED" });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Furadeira")).toBeNull());
  });

  it("validates and creates a product without a mock payload", async () => {
    const create = jest.spyOn(api, "createStoreProduct").mockResolvedValue({ ...product, status: "DRAFT" });
    const onSaved = jest.fn();
    const screen = render(<StoreProductFormScreen productId={null} onBack={jest.fn()} onSaved={onSaved} />);
    expect(screen.queryByLabelText("Excluir produto")).toBeNull();
    fireEvent.press(screen.getByLabelText("Salvar produto"));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText("Informe um preço positivo com até duas casas decimais.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Nome do Produto"), "Furadeira");
    fireEvent.changeText(screen.getByLabelText("Preço (R$)"), "29,90");
    fireEvent.changeText(screen.getByLabelText("Estoque (unid.)"), "3");
    await waitFor(() => expect(screen.getByText("Ferramentas")).toBeTruthy());
    fireEvent.press(screen.getByText("Ferramentas"));
    fireEvent.press(screen.getByLabelText("Salvar produto"));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Furadeira", price: "29.90", stock: 3, categoryId: "tools" })));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Produto cadastrado com sucesso."));
  });

  it("loads and edits a saved product", async () => {
    jest.spyOn(api, "storeProduct").mockResolvedValue({ ...product, status: "DRAFT" });
    const update = jest.spyOn(api, "updateStoreProduct").mockResolvedValue({ ...product, status: "DRAFT", name: "Furadeira 710W" });
    const onSaved = jest.fn();
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={jest.fn()} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText("Nome do Produto").props.value).toBe("Furadeira"));
    fireEvent.changeText(screen.getByLabelText("Nome do Produto"), "Furadeira 710W");
    fireEvent.press(screen.getByLabelText("Salvar produto"));
    await waitFor(() => expect(update).toHaveBeenCalledWith(product.id, expect.objectContaining({ name: "Furadeira 710W" })));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Produto atualizado com sucesso."));
  });

  it("confirms exclusion from the edit screen and blocks duplicate requests", async () => {
    jest.spyOn(api, "storeProduct").mockResolvedValue(product);
    let finish!: (value: StoreProduct) => void;
    const archive = jest.spyOn(api, "archiveStoreProduct").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const onSaved = jest.fn();
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={jest.fn()} onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByLabelText("Excluir produto")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Excluir produto"));
    expect(screen.getByText("Excluir produto?")).toBeTruthy();
    expect(archive).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Cancelar exclusão"));
    expect(archive).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Excluir produto"));
    fireEvent.press(screen.getByLabelText("Confirmar exclusão do produto"));
    fireEvent.press(screen.getByLabelText("Confirmar exclusão do produto"));
    expect(archive).toHaveBeenCalledTimes(1);
    finish({ ...product, status: "ARCHIVED" });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Produto retirado do catálogo. Você pode restaurá-lo em Arquivados."));
  });

  it("confirms leaving an edited product with unsaved changes", async () => {
    jest.spyOn(api, "storeProduct").mockResolvedValue(product);
    const onBack = jest.fn();
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={onBack} onSaved={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Nome do Produto")).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText("Nome do Produto"), "Furadeira nova");
    fireEvent.press(screen.getByLabelText("Voltar aos produtos"));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText("Sair da edição?")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Continuar editando"));
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Voltar aos produtos"));
    fireEvent.press(screen.getByLabelText("Confirmar saída da edição"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("leaves an unchanged product directly", async () => {
    jest.spyOn(api, "storeProduct").mockResolvedValue(product);
    const onBack = jest.fn();
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={onBack} onSaved={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Disponível para venda")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Voltar aos produtos"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("restores an archived product before editing and can reactivate it", async () => {
    const archived = { ...product, status: "ARCHIVED" as const };
    jest.spyOn(api, "storeProduct").mockResolvedValue(archived);
    const status = jest.spyOn(api, "setStoreProductStatus").mockResolvedValue({ ...product, status: "INACTIVE" });
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={jest.fn()} onSaved={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Restaurar para editar")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Restaurar para editar"));
    await waitFor(() => expect(status).toHaveBeenCalledWith(product.id, "INACTIVE"));
    await waitFor(() => expect(screen.getByLabelText("Nome do Produto")).toBeTruthy());
    expect(screen.getByText("Produto restaurado. Agora você pode editá-lo.")).toBeTruthy();
  });

  it("explains what an archived product needs before reactivation", async () => {
    jest.spyOn(api, "storeProduct").mockResolvedValue({ ...product, status: "ARCHIVED" });
    jest.spyOn(api, "setStoreProductStatus").mockRejectedValue(new ApiError("O produto nao pode ser ativado.", 400, { pending: ["COVER_IMAGE_REQUIRED"] }));
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={jest.fn()} onSaved={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Reativar para venda")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Reativar para venda"));
    await waitFor(() => expect(screen.getByText("Para reativar, revise: foto de capa. Você pode restaurar para editar.")).toBeTruthy());
  });

  it("shows upload progress, retry and cover controls", async () => {
    jest.spyOn(api, "storeProduct").mockResolvedValue({ ...product, status: "DRAFT" });
    const asset = { uri: "file:///photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg", fileSize: 100 };
    (pickProductImage as jest.Mock).mockResolvedValue(asset);
    const upload = jest.spyOn(api, "uploadStoreProductImage").mockRejectedValueOnce(new ApiError("Falha de envio", 0))
      .mockImplementationOnce(async (_id, _asset, onProgress) => { onProgress(65); return { id: "image-1", url: "https://example.test/photo.jpg", altText: null, position: 0, isCover: true }; });
    jest.spyOn(api, "setStoreProductCover").mockResolvedValue([{ id: "image-1", url: "https://example.test/photo.jpg", altText: null, position: 0, isCover: true }]);
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={jest.fn()} onSaved={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Adicionar foto")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Adicionar foto"));
    await waitFor(() => expect(screen.getByText("Falha de envio")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Tentar novamente foto 1"));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("CAPA")).toBeTruthy());
  });

  it("creates an active product only after uploading its cover", async () => {
    const draft = { ...product, status: "DRAFT" as const, images: [] };
    const create = jest.spyOn(api, "createStoreProduct").mockResolvedValue(draft);
    const image = { id: "image-1", url: "https://example.test/photo.jpg", altText: null, position: 0, isCover: true };
    const upload = jest.spyOn(api, "uploadStoreProductImage").mockResolvedValue(image);
    const cover = jest.spyOn(api, "setStoreProductCover").mockResolvedValue([image]);
    const activate = jest.spyOn(api, "setStoreProductStatus").mockResolvedValue({ ...draft, status: "ACTIVE", images: [image] });
    (pickProductImage as jest.Mock).mockResolvedValue({ uri: "file:///photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg", fileSize: 100 });
    const onSaved = jest.fn();
    const screen = render(<StoreProductFormScreen productId={null} onBack={jest.fn()} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByLabelText("Nome do Produto"), "Furadeira");
    fireEvent.changeText(screen.getByLabelText("Preço (R$)"), "29,90");
    fireEvent.changeText(screen.getByLabelText("Estoque (unid.)"), "3");
    await waitFor(() => expect(screen.getByText("Ferramentas")).toBeTruthy());
    fireEvent.press(screen.getByText("Ferramentas"));
    fireEvent.press(screen.getByLabelText("Adicionar foto"));
    await waitFor(() => expect(screen.getByText("1 de 8")).toBeTruthy());
    fireEvent(screen.getByLabelText("Disponível para venda"), "valueChange", true);
    fireEvent.press(screen.getByLabelText("Salvar produto"));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(upload).toHaveBeenCalledWith(product.id, expect.any(Object), expect.any(Function)));
    await waitFor(() => expect(cover).toHaveBeenCalledWith(product.id, image.id));
    await waitFor(() => expect(activate).toHaveBeenCalledWith(product.id, "ACTIVE"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("reorders and removes persisted images through the gallery API", async () => {
    const first = { id: "image-1", url: "https://example.test/1.jpg", altText: null, position: 0, isCover: true };
    const second = { id: "image-2", url: "https://example.test/2.jpg", altText: null, position: 1, isCover: false };
    jest.spyOn(api, "storeProduct").mockResolvedValueOnce({ ...product, status: "DRAFT", images: [first, second] })
      .mockResolvedValue({ ...product, status: "DRAFT", images: [second] });
    const reorder = jest.spyOn(api, "reorderStoreProductImages").mockResolvedValue([{ ...second, position: 0 }, { ...first, position: 1 }]);
    const remove = jest.spyOn(api, "removeStoreProductImage").mockResolvedValue(undefined);
    const screen = render(<StoreProductFormScreen productId={product.id} onBack={jest.fn()} onSaved={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Mover foto 1 para direita")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Mover foto 1 para direita"));
    await waitFor(() => expect(reorder).toHaveBeenCalledWith(product.id, ["image-2", "image-1"]));
    await waitFor(() => expect(screen.getByLabelText("Remover foto 1")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Remover foto 1"));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Cancelar remoção"));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Remover foto 1"));
    fireEvent.press(screen.getByLabelText("Confirmar remoção da foto"));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(product.id, "image-2"));
  });
});
