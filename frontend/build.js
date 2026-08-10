const { spawnSync } = require("child_process");

const apiUrl =
  process.env.NG_APP_API_URL ||
  process.env.API_URL ||
  "http://localhost:3000/api";

const args = [
  "build",
  ...process.argv.slice(2),
  "--define",
  `import.meta.env.NG_APP_API_URL=${JSON.stringify(apiUrl)}`,
  "--define",
  `import.meta.env.API_URL=${JSON.stringify(apiUrl)}`,
];

const result = spawnSync("npx", ["ng", ...args], {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 0);
