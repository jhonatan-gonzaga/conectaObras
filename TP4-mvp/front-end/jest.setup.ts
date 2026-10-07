import "@testing-library/jest-native/extend-expect";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "localhost:8081" } },
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");

  return {
    LinearGradient: View,
  };
});

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});
