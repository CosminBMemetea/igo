import nextVitals from "eslint-config-next/core-web-vitals";
// React Compiler is not enabled. Keep its new migration diagnostics visible as
// warnings while preserving the established Rules of Hooks as errors.
export default [...nextVitals, { rules: {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/immutability": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/preserve-manual-memoization": "warn",
} }, { ignores: [".next/**", "node_modules/**", "apps/**"] }];
