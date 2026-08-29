try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local pode não existir (ex.: ambiente de CI com secrets injetados de outra forma)
}
