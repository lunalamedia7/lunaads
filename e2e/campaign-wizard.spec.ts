import { test, expect } from "@playwright/test";
import { login, clearWizardDraft } from "./helpers";

/**
 * Cobre o mecanismo do wizard (validação, navegação, resumo, custo) até a
 * tela de Revisão — sem clicar em "Publicar". Não há ambiente de staging
 * separado desse Supabase, então parar antes de publicar evita criar
 * campanhas/lotes reais a cada execução da suíte.
 */

test.beforeEach(async () => {
  await clearWizardDraft();
});

test("Estilo Fast: preenche os 5 passos e chega na revisão com o resumo certo", async ({ page }) => {
  await login(page);
  await page.goto("/campanhas/nova");
  await page.click("text=Estilo Fast");

  await page.waitForSelector("[role='checkbox']", { timeout: 10_000 });
  await page.locator("[role='checkbox']").first().click();
  await page.click('button:has-text("Próximo")');

  await page.waitForSelector("text=Configuração da campanha", { timeout: 10_000 });
  await page.locator('button:has-text("Selecione um objetivo")').click();
  await page.waitForSelector('[role="option"]', { timeout: 5_000 });
  await page.locator('[role="option"]', { hasText: "Conversões" }).click();
  await page.fill("#budgetAmount", "50");
  await page.click('button:has-text("Próximo")');

  await page.waitForSelector("text=Conjunto de anúncios", { timeout: 10_000 });
  await page.fill("#optimizationGoal", "CONVERT");
  await page.fill("#countries", "BR");
  await page.fill("#ageMin", "18");
  await page.fill("#ageMax", "45");
  await page.locator('label:has-text("Todos")').first().click();
  await page.fill("#adsetBudget", "50");
  await page.fill("#startDate", "2026-09-01");
  await page.click('button:has-text("Próximo")');

  await page.waitForSelector("text=Anúncio", { timeout: 10_000 });
  await page.fill("#creativeRef", "video_e2e.mp4");
  await page.fill("#adText", "Teste e2e");
  await page.locator('button:has-text("Selecione")').last().click();
  await page.waitForSelector('[role="option"]', { timeout: 5_000 });
  await page.locator('[role="option"]', { hasText: "Saiba mais" }).click();
  await page.fill("#destinationUrl", "https://exemplo.com/pagina");
  await page.click('button:has-text("Próximo")');

  await page.waitForSelector("text=Revisão", { timeout: 10_000 });
  await expect(page.locator("text=Custo diário somado: R$ 50.00")).toBeVisible();
  await expect(page.locator('button:has-text("Publicar em 1 conta")')).toBeEnabled();
});

test("Estilo Builder: adicionar conjunto atualiza a árvore e o custo ao vivo", async ({ page }) => {
  await login(page);
  await page.goto("/campanhas/nova");
  await page.click("text=Estilo Builder");

  await page.waitForSelector("text=Selecione as contas", { timeout: 10_000 });
  await page.locator("[role='checkbox']").first().click();

  await page.click('button:has-text("Campanha")');
  await page.waitForSelector("text=Configuração da campanha", { timeout: 10_000 });
  await page.locator('label:has-text("ABO")').click();
  await page.fill("#budgetAmount", "1");

  await expect(page.locator('[data-testid="adgroup-block"]')).toHaveCount(1);

  // preenche o conjunto 1 (já existe por padrão) e seu anúncio padrão
  await page.locator('[data-testid="select-adgroup"]').nth(0).click();
  await page.waitForSelector("text=Conjunto de anúncios", { timeout: 10_000 });
  await page.fill("#optimizationGoal", "CONVERT");
  await page.fill("#countries", "BR");
  await page.fill("#ageMin", "18");
  await page.fill("#ageMax", "45");
  await page.locator('label:has-text("Todos")').first().click();
  await page.fill("#adsetBudget", "20");
  await page.fill("#startDate", "2026-09-01");

  await page.locator('[data-testid="select-ad"]').nth(0).click();
  await page.waitForSelector("text=Anúncio", { timeout: 10_000 });
  await page.fill("#creativeRef", "video_e2e_1.mp4");
  await page.fill("#adText", "Anúncio 1");
  await page.locator('button:has-text("Selecione")').last().click();
  await page.waitForSelector('[role="option"]', { timeout: 5_000 });
  await page.locator('[role="option"]', { hasText: "Saiba mais" }).click();
  await page.fill("#destinationUrl", "https://exemplo.com/pagina-1");

  // adiciona o conjunto 2 (com seu anúncio padrão) e preenche os dois
  await page.click('[data-testid="add-adgroup-btn"]');
  await expect(page.locator('[data-testid="adgroup-block"]')).toHaveCount(2);
  await page.waitForSelector("text=Conjunto de anúncios", { timeout: 10_000 });
  await page.fill("#optimizationGoal", "CONVERT");
  await page.fill("#countries", "BR");
  await page.fill("#ageMin", "18");
  await page.fill("#ageMax", "45");
  await page.locator('label:has-text("Todos")').first().click();
  await page.fill("#adsetBudget", "30");
  await page.fill("#startDate", "2026-09-01");

  await page.locator('[data-testid="select-ad"]').nth(1).click();
  await page.waitForSelector("text=Anúncio", { timeout: 10_000 });
  await page.fill("#creativeRef", "video_e2e_2.mp4");
  await page.fill("#adText", "Anúncio 2");
  await page.locator('button:has-text("Selecione")').last().click();
  await page.waitForSelector('[role="option"]', { timeout: 5_000 });
  await page.locator('[role="option"]', { hasText: "Saiba mais" }).click();
  await page.fill("#destinationUrl", "https://exemplo.com/pagina-2");

  // custo ao vivo = soma dos conjuntos (ABO) x contas selecionadas: (20+30)*1
  await expect(page.locator('[data-testid="live-daily-cost"]')).toHaveText("R$ 50.00");
});
