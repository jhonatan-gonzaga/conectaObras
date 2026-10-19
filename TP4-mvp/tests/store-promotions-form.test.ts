import { fromBrasiliaInput, promotionPayload, promotionPreview, promotionState, toBrasiliaInput, validatePromotionForm, type PromotionForm, type PromotionProduct, type StorePromotion } from "../front-end/src/services/store-promotions";

const product: PromotionProduct = { id: "p1", name: "Porcelanato", price: "89.90", sku: "POR-60", stock: 12, status: "ACTIVE", images: [] };
const form: PromotionForm = { name: " Oferta ", productId: "p1", discountType: "PERCENTAGE", discountValue: "20", startsAt: "2030-10-15T08:00", endsAt: "2030-10-22T23:59" };
const promotion = { id: "promo1", ...form, product, discountValue: "20.00", discountPct: "20.00", startsAt: "2030-10-15T11:00:00.000Z", endsAt: "2030-10-23T02:59:00.000Z", status: "ACTIVE" } as StorePromotion;

describe("promotion validation and preview", () => {
  it.each([
    ["PERCENTAGE", "20", "71.92"], ["FIXED", "17,98", "71.92"], ["DIRECT", "71,92", "71.92"],
  ] as const)("previews %s with currency rounding", (type, input, result) => {
    expect(promotionPreview(product.price, type, input)).toEqual({ finalPrice: result, savings: "17.98", percent: 20 });
  });
  it.each([
    ["PERCENTAGE", "0"], ["PERCENTAGE", "100"], ["PERCENTAGE", "abc"], ["PERCENTAGE", "20.123"],
    ["FIXED", "89.90"], ["FIXED", "90"], ["DIRECT", "0"], ["DIRECT", "89.90"], ["DIRECT", "-1"],
  ] as const)("rejects invalid %s value %s", (type, input) => expect(promotionPreview(product.price, type, input)).toBeNull());
  it("rejects discounts that round to zero or do not change the price", () => {
    expect(promotionPreview("0.01", "PERCENTAGE", "90")).toBeNull();
    expect(promotionPreview("0.01", "PERCENTAGE", "1")).toBeNull();
  });
  it("rounds half cents like the API without floating point subtraction errors", () => {
    expect(promotionPreview("5.00", "PERCENTAGE", "89.90")?.finalPrice).toBe("0.51");
  });
  it("validates the whole form without allowing dates to override invalid discounts", () => {
    expect(validatePromotionForm(form, product, [], "ACTIVE")).toEqual([]);
    const invalid = { ...form, discountValue: "100", endsAt: "2030-10-14T08:00" };
    expect(validatePromotionForm(invalid, product, [], "ACTIVE")).toHaveLength(2);
    expect(validatePromotionForm({ ...invalid, endsAt: form.endsAt }, product, [], "ACTIVE")).toHaveLength(1);
    expect(validatePromotionForm(form, { ...product, status: "ARCHIVED" }, [], "ACTIVE")).toHaveLength(1);
  });
  it("blocks overlap for publication, permits drafts and excludes the edited promotion", () => {
    expect(validatePromotionForm(form, product, [promotion], "ACTIVE")).toEqual([expect.stringContaining("Já existe")]);
    expect(validatePromotionForm(form, product, [promotion], "DRAFT")).toEqual([]);
    expect(validatePromotionForm(form, product, [promotion], "ACTIVE", promotion.id)).toEqual([]);
    expect(validatePromotionForm({ ...form, startsAt: "2030-10-22T23:59", endsAt: "2030-10-25T23:59" }, product, [promotion], "ACTIVE")).toEqual([]);
  });
  it("encodes Brasília wall time with a fixed offset even on a device in another zone", () => {
    expect(fromBrasiliaInput("2030-10-15T08:00")).toBe("2030-10-15T11:00:00.000Z");
    expect(toBrasiliaInput("2030-10-15T11:00:00.000Z")).toBe("2030-10-15T08:00");
    expect(fromBrasiliaInput("2030-02-30T12:00")).toBeNull();
    expect(fromBrasiliaInput("2030-10-15T25:00")).toBeNull();
    expect(fromBrasiliaInput("")).toBeNull();
  });
  it("sends exactly one rule with numeric value and UTC dates", () => {
    expect(promotionPayload({ ...form, discountType: "FIXED", discountValue: "17,98" }, "ACTIVE")).toEqual({ name: "Oferta", productId: "p1", discountType: "FIXED", discountValue: 17.98, startsAt: promotion.startsAt, endsAt: promotion.endsAt, status: "ACTIVE" });
  });
  it("derives scheduled, current and expired states using exclusive end time", () => {
    expect(promotionState(promotion, Date.parse(promotion.startsAt!) - 1)).toBe("SCHEDULED");
    expect(promotionState(promotion, Date.parse(promotion.startsAt!))).toBe("ACTIVE");
    expect(promotionState(promotion, Date.parse(promotion.endsAt!))).toBe("ENDED");
    expect(promotionState({ ...promotion, status: "CANCELED" }, Date.parse(promotion.startsAt!))).toBe("CANCELED");
    expect(validatePromotionForm(form, product, [], "ACTIVE", undefined, Date.parse(promotion.endsAt!))).toEqual([expect.stringContaining("expirada")]);
  });
});
