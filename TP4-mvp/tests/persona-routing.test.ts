import { guardPersonaScreen, initialScreenForRole, personaForRole } from "../front-end/src/navigation/persona-routing";

describe("authenticated persona routing", () => {
  it.each([
    ["CLIENTE", "client", "clientHome"],
    ["PROFISSIONAL", "professional", "professionalHome"],
    ["LOJISTA", "storeOwner", "storeOwnerSetup"],
    ["SUPORTE", "unsupported", "login"],
  ] as const)("routes %s by role", (role, persona, route) => {
    expect(personaForRole(role)).toBe(persona);
    expect(initialScreenForRole(role, false)).toBe(route);
  });

  it("restores a store owner directly to dashboard when the store exists", () => {
    expect(initialScreenForRole("LOJISTA", true)).toBe("storeOwnerDashboard");
  });

  it("allows editing only for a store owner with a registered store", () => {
    expect(guardPersonaScreen("storeOwnerEdit", "LOJISTA", true)).toBe("storeOwnerEdit");
    expect(guardPersonaScreen("storeOwnerEdit", "LOJISTA", false)).toBe("storeOwnerSetup");
    expect(guardPersonaScreen("storeOwnerEdit", "CLIENTE", true)).toBe("clientHome");
    expect(guardPersonaScreen("storeOwnerEdit", null)).toBe("login");
  });

  it.each(["CLIENTE", "PROFISSIONAL", "SUPORTE"] as const)("prevents %s from entering store routes", (role) => {
    expect(guardPersonaScreen("storeOwnerDashboard", role)).toBe(initialScreenForRole(role, false));
  });

  it("repairs a deep link to a screen outside the signed-in role", () => {
    expect(guardPersonaScreen("storeOwnerList", "CLIENTE")).toBe("clientHome");
    expect(guardPersonaScreen("professionalHome", "LOJISTA", true)).toBe("storeOwnerDashboard");
    expect(guardPersonaScreen("storeOwnerDashboard", "LOJISTA", false)).toBe("storeOwnerSetup");
    expect(guardPersonaScreen("storeOwnerSetup", "LOJISTA", true)).toBe("storeOwnerDashboard");
  });

  it("sends an invalid anonymous deep link to login", () => {
    expect(guardPersonaScreen("storeOwnerList", null)).toBe("login");
  });
});
