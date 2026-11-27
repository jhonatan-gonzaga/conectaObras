import { emptyStoreForm, maskCep, maskCnpj, maskPhone, resumeStore, storePayload, validateStore } from "../front-end/src/services/store-form";

describe("store form", () => {
  it("allows incomplete drafts but validates provided CNPJ, phone, CEP and times", () => {
    const form = emptyStoreForm();
    expect(validateStore(form)).toEqual({});
    expect(validateStore(form, true)).toHaveProperty("cnpj");
    form.cnpj = "11.111.111/1111-11";
    form.phone = "123";
    form.address.zipCode = "123";
    form.openingHours[0] = { dayOfWeek: "MONDAY", closed: false, openingTime: "18:00", closingTime: "08:00" };
    expect(validateStore(form)).toMatchObject({ cnpj: expect.any(String), phone: expect.any(String), "address.zipCode": expect.any(String), "MONDAY.closingTime": expect.any(String) });
  });
  it("normalizes masks and excludes identities from the payload", () => {
    const form = emptyStoreForm();
    form.cnpj = maskCnpj("11222333000181");
    form.phone = maskPhone("5592999999999");
    form.address.zipCode = maskCep("69000000");
    form.openingHours[0].openingTime = "08:00";
    const payload = storePayload(form);
    expect(payload).toMatchObject({ cnpj: "11222333000181", phone: "+5592999999999", address: { zipCode: "69000000" } });
    expect(payload.openingHours).toHaveLength(7);
    expect(payload.openingHours[0]).toMatchObject({ closed: true, openingTime: null, closingTime: null });
    expect(payload).not.toHaveProperty("ownerId");
    expect(payload).not.toHaveProperty("storeId");
  });
  it("restores saved data and fills missing weekdays as closed", () => {
    const form = resumeStore({ id: "store-a", name: "Minha loja", status: "DRAFT", cnpj: "11222333000181", phone: "+5592999999999", address: { city: "Manaus", zipCode: "69000000" }, openingHours: [{ dayOfWeek: "MONDAY", closed: false, openingTime: "08:00", closingTime: "18:00" }] });
    expect(form.cnpj).toBe("11.222.333/0001-81");
    expect(form.phone).toBe("(92) 99999-9999");
    expect(form.address.city).toBe("Manaus");
    expect(form.openingHours).toHaveLength(7);
    expect(form.openingHours[0].openingTime).toBe("08:00");
    expect(form.openingHours[1].closed).toBe(true);
    expect(validateStore(form).cnpj).toBeUndefined();
  });
});
