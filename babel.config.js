module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
          alias: {
            "@": "./src",
            "@components": "./src/components",
            "@hooks": "./src/hooks",
            "@domain": "./src/domain",
            "@utils": "./src/utils",
            "@services": "./src/services",
            "@constants": "./src/constants",
          },
        },
      ],
      // react-native-reanimated/plugin must be listed last.
      "react-native-reanimated/plugin",
    ],
  };
};
