import {
  isAuthContextScreen,
  isClientContextScreen,
  isProfessionalContextScreen,
  type Screen,
} from "../front-end/src/navigation/types";

describe("navigation screen guards", () => {
  const screens: Screen[] = [
    "login",
    "signup",
    "terms",
    "privacy",
    "profileChoice",
    "accountProfile",
    "clientHome",
    "clientSearch",
    "clientWork",
    "clientAds",
    "clientServiceDetails",
    "clientServiceMessage",
    "clientSettings",
    "clientProfile",
    "professionalSetup",
    "professionalHome",
  ];

  it.each([
    ["login", "auth"],
    ["signup", "auth"],
    ["terms", "auth"],
    ["privacy", "auth"],
    ["profileChoice", "auth"],
    ["clientHome", "client"],
    ["clientSearch", "client"],
    ["clientWork", "client"],
    ["clientAds", "client"],
    ["clientServiceDetails", "client"],
    ["clientServiceMessage", "client"],
    ["clientSettings", "client"],
    ["clientProfile", "client"],
    ["professionalSetup", "professional"],
    ["professionalHome", "professional"],
  ] as const)("classifies %s as %s", (screen, context) => {
    expect({
      auth: isAuthContextScreen(screen),
      client: isClientContextScreen(screen),
      professional: isProfessionalContextScreen(screen),
    }[context]).toBe(true);
  });

  it("keeps accountProfile outside the contextual navigators", () => {
    expect(isAuthContextScreen("accountProfile")).toBe(false);
    expect(isClientContextScreen("accountProfile")).toBe(false);
    expect(isProfessionalContextScreen("accountProfile")).toBe(false);
  });

  it("assigns every screen to exactly one context or the root profile route", () => {
    for (const screen of screens) {
      const matches = [
        isAuthContextScreen(screen),
        isClientContextScreen(screen),
        isProfessionalContextScreen(screen),
        screen === "accountProfile",
      ].filter(Boolean);

      expect(matches).toHaveLength(1);
    }
  });
});
