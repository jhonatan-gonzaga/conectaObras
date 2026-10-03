import { ApiError, api } from "../front-end/src/services/api";
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
describe("store API errors", () => {
  afterEach(() => jest.restoreAllMocks());
  it("preserves server activation pending codes", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 400, text: async () => JSON.stringify({ message: "Cadastro incompleto", pending: ["CNPJ_INVALID"] }) } as Response);
    let caught: unknown;
    try { await api.changeMyStoreStatus("ACTIVE"); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ status: 400, details: { pending: ["CNPJ_INVALID"] } });
  });
});
