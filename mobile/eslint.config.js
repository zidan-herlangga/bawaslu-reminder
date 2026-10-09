// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  // Kode yang dihasilkan CLI gluestack: toleransi impor rangkap yang tidak
  // memengaruhi perilaku, supaya lint tidak menjerit tiap kali menambah
  // komponen dari pustaka.
  {
    files: ["src/components/ui/**"],
    rules: {
      "import/no-duplicates": "off",
    },
  },
]);
