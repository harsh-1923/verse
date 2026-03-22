import baseConfig from "./base.js";

export default [
  ...baseConfig,
  // Add Node-specific rules here when needed
  {
    rules: {
      "no-console": "off",
    },
  },
];
