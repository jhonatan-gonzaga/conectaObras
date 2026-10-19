import { api, ApiError } from "../front-end/src/services/api";
import type { PromotionPayload } from "../front-end/src/services/store-promotions";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const payload: PromotionPayload = { name: "Oferta", productId: "p1", discountType: "FIXED", discountValue: 10, startsAt: "2030-10-15T11:00:00.000Z", endsAt: "2030-10-23T02:59:00.000Z", status: "ACTIVE" };
describe("promotion API contract", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses owner routes for list, details, creation, editing and activation", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "{}" } as Response);
    await api.storePromotions(); await api.storePromotion("a/b"); await api.createStorePromotion(payload);
    await api.updateStorePromotion("a/b", { ...payload, status: "DRAFT" }); await api.setStorePromotionStatus("a/b", "CANCELED");
    expect(fetchMock.mock.calls.map(([url]) => String(url).split("/stores")[1])).toEqual(["/me/promotions", "/me/promotions/a%2Fb", "/me/promotions", "/me/promotions/a%2Fb", "/me/promotions/a%2Fb/status"]);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "POST", body: JSON.stringify(payload) });
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ ...payload, status: "DRAFT" }) });
    expect(fetchMock.mock.calls[4][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ status: "CANCELED" }) });
  });
  it("exposes conflict messages from the API", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 409, text: async () => JSON.stringify({ message: "Já existe uma promoção nesse período." }) } as Response);
    await expect(api.createStorePromotion(payload)).rejects.toEqual(new ApiError("Já existe uma promoção nesse período.", 409, { message: "Já existe uma promoção nesse período." }));
  });
});
