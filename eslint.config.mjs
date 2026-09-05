import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Flat Config. `eslint-config-next` liefert ab Version 16 fertige
 * Flat-Config-Arrays – FlatCompat wird nicht mehr gebraucht.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".storage/**",
      "next-env.d.ts",
      "prisma/migrations/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
