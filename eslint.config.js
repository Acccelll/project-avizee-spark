import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Bloqueia novos `as any`. Mantido como `warn` para não quebrar build com
      // 100+ casts existentes — novos aparecem visíveis no editor/CI.
      "@typescript-eslint/no-explicit-any": "warn",
      // catches sem corpo escondem falhas silenciosas.
      "no-empty": ["error", { allowEmptyCatch: false }],
      // Frontend deve usar `logger` (src/lib/logger.ts). Sem opções vazias:
      // ESLint 9 exige ao menos um item em `allow` quando a opção é informada.
      "no-console": "error",
      // "Hoje" via new Date().toISOString().slice(0, 10) é a data em UTC: no
      // Brasil, a partir das 21h vira o dia seguinte. Use todayISO() /
      // toLocalISODate() de @/lib/dateUtils.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(slice|split|substring)$/][callee.object.type='CallExpression'][callee.object.callee.property.name='toISOString'][callee.object.callee.object.type='NewExpression'][callee.object.callee.object.callee.name='Date'][callee.object.callee.object.arguments.length=0]",
          message:
            "Cortar new Date().toISOString() dá a data em UTC (dia seguinte após 21h no Brasil). Use todayISO() de @/lib/dateUtils. (Timestamp completo com new Date().toISOString() continua liberado.)",
        },
      ],
    },
  },
  {
    files: ["src/lib/logger.ts", "supabase/functions/**", "scripts/**"],
    rules: { "no-console": "off" },
  },
  {
    // Edge functions e scripts rodam no servidor (UTC) e não são "o dia" do usuário.
    files: ["supabase/functions/**", "scripts/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // A API de fixtures do Playwright exige destructuring no primeiro argumento
    // e chama o segundo callback de `use`; ambos colidem com regras React/JS que
    // não se aplicam semanticamente a este contexto.
    files: ["e2e/fixtures/**/*.ts"],
    rules: {
      "no-empty-pattern": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    // Dívida de higiene pré-existente: mantém visível sem bloquear entregas
    // enquanto os parsers legados são saneados de forma dedicada.
    files: [
      "src/components/help/CoachTour.tsx",
      "src/lib/nfeXmlParser.ts",
      "src/lib/ofx/memoExtractors.ts",
      "src/services/financeiro/importacao/adapters/csv.ts",
      "supabase/functions/sefaz-distdfe/index.ts",
    ],
    rules: { "no-useless-escape": "warn" },
  },
  {
    files: ["src/lib/parseOFX.ts", "src/pages/fiscal/PortalFiscal.tsx"],
    rules: { "no-control-regex": "warn" },
  },
  {
    // Edge Functions fiscais antigas ainda usam @ts-ignore em integrações
    // Deno/Supabase; não permitir que isso esconda o resultado do roadmap.
    files: ["supabase/functions/sefaz-distdfe/index.ts", "supabase/functions/sefaz-proxy/index.ts"],
    rules: { "@typescript-eslint/ban-ts-comment": "warn" },
  },
);
