import { api } from "../front-end/src/services/api";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

describe("product API contract", () => {
  afterEach(() => jest.restoreAllMocks());

  it("sends list filters and inventory updates to owner routes", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ items: [], total: 0, page: 2, limit: 10 }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "p", price: "30.00", stock: 0 }) } as Response);
    await api.storeProducts({ q: "cimento", categoryId: "tools", status: "ACTIVE", stock: "IN_STOCK", page: 2, limit: 10 });
    await api.updateStoreProductInventory("p", { price: "30.00", stock: 0 });
    expect(fetchMock.mock.calls[0][0]).toContain("/store-products?q=cimento&categoryId=tools&status=ACTIVE&stock=IN_STOCK&page=2&limit=10");
    expect(fetchMock.mock.calls[1][0]).toContain("/store-products/p/inventory");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ price: "30.00", stock: 0 }) });
  });

  it("reports upload progress and resolves the persisted image", async () => {
    const original = global.XMLHttpRequest;
    const progress: number[] = [];
    let requestedUrl = "";
    class FakeXHR {
      upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
      onerror?: () => void;
      onabort?: () => void;
      onload?: () => void;
      responseText = JSON.stringify({ id: "image-1", url: "/img.jpg", position: 0, isCover: true });
      status = 201;
      open(_method: string, url: string) { requestedUrl = url; }
      setRequestHeader() {}
      send() { this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 }); this.onload?.(); }
    }
    global.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    try {
      const image = await api.uploadStoreProductImage("p", { uri: "file:///photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg" } as never, (value) => progress.push(value));
      expect(requestedUrl).toContain("/store-products/p/images");
      expect(progress).toEqual([0, 50, 100]);
      expect(image.id).toBe("image-1");
    } finally { global.XMLHttpRequest = original; }
  });
});
