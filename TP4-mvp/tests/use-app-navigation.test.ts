import { act, renderHook, waitFor } from "@testing-library/react-native";

import { ApiError, api } from "../front-end/src/services/api";
import { useAppNavigation } from "../front-end/src/navigation/useAppNavigation";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue(null), setItemAsync: jest.fn().mockResolvedValue(undefined), deleteItemAsync: jest.fn().mockResolvedValue(undefined) }));

describe("useAppNavigation", () => {
  async function renderNavigation() {
    const hook = renderHook(() => useAppNavigation());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    return hook;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("starts at login with safe default return states", async () => {
    const { result } = await renderNavigation();

    expect(result.current.screen).toBe("login");
    expect(result.current.profileReturnScreen).toBe("clientHome");
    expect(result.current.clientWorkReturnScreen).toBe("clientHome");
    expect(result.current.clientProfileReturnScreen).toBe("clientHome");
    expect(result.current.legalReturnScreen).toBe("login");
    expect(result.current.selectedClientService).toBeNull();
    expect(result.current.selectedProfessionalId).toBeNull();
    expect(result.current.contractedClientServices).toEqual([]);
  });

  it.each([
    ["home", "clientHome"],
    ["search", "clientSearch"],
    ["ads", "clientAds"],
    ["settings", "clientSettings"],
    ["work", "clientWork"],
  ] as const)("opens the %s client tab", async (tab, expectedScreen) => {
    const { result } = await renderNavigation();

    act(() => {
      result.current.openClientTab(tab);
    });

    expect(result.current.screen).toBe(expectedScreen);
  });

  it("preserves the origin when opening the client work tab", async () => {
    const { result } = await renderNavigation();

    act(() => {
      result.current.openClientTab("work", "clientAds");
    });

    expect(result.current.screen).toBe("clientWork");
    expect(result.current.clientWorkReturnScreen).toBe("clientAds");
  });

  it("stores the origin when opening account profile", async () => {
    const { result } = await renderNavigation();

    act(() => {
      result.current.openAccountProfile("clientServiceMessage");
    });

    expect(result.current.screen).toBe("accountProfile");
    expect(result.current.profileReturnScreen).toBe("clientServiceMessage");
  });

  it("returns to the store dashboard after opening the account profile", async () => {
    const { result } = await renderNavigation();

    act(() => result.current.openAccountProfile("storeOwnerDashboard"));
    expect(result.current.screen).toBe("accountProfile");
    expect(result.current.profileReturnScreen).toBe("storeOwnerDashboard");

    act(() => result.current.setScreen(result.current.profileReturnScreen));
    expect(result.current.screen).toBe("storeOwnerDashboard");
  });

  it("opens the existing professional area when the profile lookup succeeds", async () => {
    jest.spyOn(api, "me").mockResolvedValue({ id: "p1", role: "PROFISSIONAL" } as never);
    const professionalMe = jest
      .spyOn(api, "professionalMe")
      .mockResolvedValue({} as Awaited<ReturnType<typeof api.professionalMe>>);
    const { result } = await renderNavigation();

    await act(async () => {
      await result.current.authenticate();
    });

    expect(professionalMe).toHaveBeenCalledTimes(1);
    expect(result.current.screen).toBe("professionalHome");
  });

  it("opens professional setup when the profile lookup fails", async () => {
    jest.spyOn(api, "me").mockResolvedValue({ id: "p1", role: "PROFISSIONAL" } as never);
    const professionalMe = jest
      .spyOn(api, "professionalMe")
      .mockRejectedValue(new Error("profile not found"));
    const { result } = await renderNavigation();

    await act(async () => {
      await result.current.authenticate();
    });

    expect(professionalMe).toHaveBeenCalledTimes(1);
    expect(result.current.screen).toBe("professionalSetup");
  });

  it("clears auth and selected IDs on logout", async () => {
    const logout = jest.spyOn(api, "logout");
    jest.spyOn(api, "me").mockResolvedValue({ id: "u1", role: "LOJISTA" } as never);
    jest.spyOn(api, "myStore").mockResolvedValue({ id: "s1", name: "Loja", status: "DRAFT" });
    const { result } = await renderNavigation();
    await act(async () => { await result.current.authenticate(); });
    act(() => {
      result.current.setSelectedProfessionalId("professional-1");
      result.current.setSelectedClientService({ id: "service-1" } as never);
      result.current.setContractedClientServices([{ id: "service-2" } as never]);
      result.current.setScreen("storeOwnerDashboard");
    });
    await act(async () => { await result.current.signOut(); });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(result.current.selectedProfessionalId).toBeNull();
    expect(result.current.selectedClientService).toBeNull();
    expect(result.current.contractedClientServices).toEqual([]);
    expect(result.current.screen).toBe("login");
    expect(result.current.authUser).toBeNull();
    expect(result.current.hasStore).toBe(false);
  });

  it("routes lojistas to setup without a store and to dashboard with a store", async () => {
    jest.spyOn(api, "me").mockResolvedValue({ id: "u1", role: "LOJISTA" } as never);
    const myStore = jest.spyOn(api, "myStore").mockRejectedValueOnce(new ApiError("not found", 404)).mockResolvedValueOnce({ id: "s1", name: "Loja", status: "DRAFT" });
    const { result } = await renderNavigation();
    await act(async () => { await result.current.authenticate(); });
    expect(result.current.screen).toBe("storeOwnerSetup");
    await act(async () => { await result.current.authenticate(); });
    expect(result.current.screen).toBe("storeOwnerDashboard");
    expect(myStore).toHaveBeenCalledTimes(2);
  });

  it("restores a persisted lojista session to the dashboard after refresh", async () => {
    (jest.requireMock("expo-secure-store").getItemAsync as jest.Mock).mockResolvedValueOnce("persisted-token");
    jest.spyOn(api, "me").mockResolvedValue({ id: "u1", role: "LOJISTA" } as never);
    jest.spyOn(api, "myStore").mockResolvedValue({ id: "s1", name: "Loja", status: "DRAFT" });
    const { result } = renderHook(() => useAppNavigation());
    await waitFor(() => expect(result.current.isSessionReady).toBe(true));
    expect(result.current.screen).toBe("storeOwnerDashboard");
  });

  it("restores a persisted lojista session to onboarding after refresh without a store", async () => {
    (jest.requireMock("expo-secure-store").getItemAsync as jest.Mock).mockResolvedValueOnce("persisted-token");
    jest.spyOn(api, "me").mockResolvedValue({ id: "u1", role: "LOJISTA" } as never);
    jest.spyOn(api, "myStore").mockRejectedValue(new ApiError("not found", 404));
    const { result } = renderHook(() => useAppNavigation());
    await waitFor(() => expect(result.current.isSessionReady).toBe(true));
    expect(result.current.screen).toBe("storeOwnerSetup");
  });

  it.each([
    ["CLIENTE", "clientHome"],
    ["PROFISSIONAL", "professionalHome"],
    ["SUPORTE", "login"],
  ] as const)("routes role %s without entering store flow", async (role, expectedScreen) => {
    jest.spyOn(api, "me").mockResolvedValue({ id: "u1", role } as never);
    jest.spyOn(api, "professionalMe").mockResolvedValue({} as never);
    const myStore = jest.spyOn(api, "myStore");
    const { result } = await renderNavigation();
    await act(async () => { await result.current.authenticate(); });
    expect(result.current.screen).toBe(expectedScreen);
    if (role !== "LOJISTA") expect(myStore).not.toHaveBeenCalled();
  });
});
