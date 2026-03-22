export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["web", "types", "eslint-config", "tsconfig", "repo"],
    ],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
  },
};
