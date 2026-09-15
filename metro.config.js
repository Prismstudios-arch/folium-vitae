const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build loads a WebAssembly file, which Metro won't bundle
// unless told it's an asset. This only matters for the web build used to
// preview screens; the native app never imports it.
config.resolver.assetExts.push("wasm");

module.exports = config;
