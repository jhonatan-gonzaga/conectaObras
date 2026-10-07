import { lookupPostalCode } from "../front-end/src/services/postal-code";

describe("postal code lookup", () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });
  it("queries digits and maps only supported address fields", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP", complemento: "lado par" }) });
    expect(await lookupPostalCode("01001-000")).toEqual({ street: "Praça da Sé", neighborhood: "Sé", city: "São Paulo", state: "SP" });
    expect(global.fetch).toHaveBeenCalledWith("https://viacep.com.br/ws/01001000/json/", expect.any(Object));
  });
  it("rejects incomplete CEP before making a request", async () => {
    global.fetch = jest.fn();
    await expect(lookupPostalCode("01001")).rejects.toThrow("8 dígitos");
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("handles missing CEP and unavailable service without fake address data", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ erro: true }) }).mockResolvedValueOnce({ ok: false });
    await expect(lookupPostalCode("99999999")).rejects.toThrow("CEP não encontrado");
    await expect(lookupPostalCode("01001000")).rejects.toThrow("manualmente");
  });
});
