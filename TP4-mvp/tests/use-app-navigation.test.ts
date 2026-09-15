import { act, renderHook } from "@testing-library/react-native";

import { api } from "../front-end/src/services/api";
import { useAppNavigation } from "../front-end/src/navigation/useAppNavigation";

describe("useAppNavigation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("starts at login with safe default return states", () => {
    const { result } = renderHook(() => useAppNavigation());

    expect(result.current.screen).toBe("login");
    expect(result.current.profileReturnScreen).toBe("profileChoice");
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
  ] as const)("opens the %s client tab", (tab, expectedScreen) => {
    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.openClientTab(tab);
    });

    expect(result.current.screen).toBe(expectedScreen);
  });

  it("preserves the origin when opening the client work tab", () => {
    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.openClientTab("work", "clientAds");
    });

    expect(result.current.screen).toBe("clientWork");
    expect(result.current.clientWorkReturnScreen).toBe("clientAds");
  });

  it("stores the origin when opening account profile", () => {
    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      result.current.openAccountProfile("clientServiceMessage");
    });

    expect(result.current.screen).toBe("accountProfile");
    expect(result.current.profileReturnScreen).toBe("clientServiceMessage");
  });

  it("opens the existing professional area when the profile lookup succeeds", async () => {
    const professionalMe = jest
      .spyOn(api, "professionalMe")
      .mockResolvedValue({} as Awaited<ReturnType<typeof api.professionalMe>>);
    const { result } = renderHook(() => useAppNavigation());

    await act(async () => {
      await result.current.openProfessionalArea();
    });

    expect(professionalMe).toHaveBeenCalledTimes(1);
    expect(result.current.screen).toBe("professionalHome");
  });

  it("opens professional setup when the profile lookup fails", async () => {
    const professionalMe = jest
      .spyOn(api, "professionalMe")
      .mockRejectedValue(new Error("profile not found"));
    const { result } = renderHook(() => useAppNavigation());

    await act(async () => {
      await result.current.openProfessionalArea();
    });

    expect(professionalMe).toHaveBeenCalledTimes(1);
    expect(result.current.screen).toBe("professionalSetup");
  });
});
