// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Inline JSX handlers are allowed: no component is memoized, so stable
    // handler identity buys nothing. See README "Code style".
    rules: {
      "react/jsx-no-bind": "off",
    },
  },
  {
    ignores: ["dist/*"],
  }
]);
