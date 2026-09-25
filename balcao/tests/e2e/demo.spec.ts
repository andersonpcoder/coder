import { expect, test, type Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /demonstração/ }).click();
  await expect(page).toHaveURL(/painel/);
  await expect(page.getByText("Olá, Ana")).toBeVisible();
}

const toast = (page: Page) => page.locator("[aria-live=polite] > div").last();

test("página inicial apresenta planos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /O balcão do seu negócio/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planos" })).toBeVisible();
});

test("agenda: cria agendamento e recusa conflito", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/agenda");
  const dialog = page.getByRole("dialog");
  // Uma quarta-feira depois do período coberto pelos dados de exemplo (28 dias),
  // em que a Marina trabalha e a agenda está livre.
  const next = new Date(Date.now() + 40 * 86400000);
  while (next.getDay() !== 3) next.setDate(next.getDate() + 1);
  const date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;

  const fill = async (customerIndex: number) => {
    await page.getByRole("button", { name: "Novo agendamento" }).click();
    await dialog.getByLabel("Cliente", { exact: true }).selectOption({ index: customerIndex });
    await dialog.getByLabel("Serviço").selectOption("s-corte-f");
    await dialog.getByLabel("Profissional").selectOption("p-marina");
    await dialog.getByLabel("Data").fill(date);
  };

  // Primeiro horário livre sugerido pelo próprio formulário.
  await fill(1);
  const slot = dialog.locator("button[aria-pressed]").first();
  const time = (await slot.innerText()).trim();
  await slot.click();
  await dialog.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(toast(page)).toContainText("Agendamento criado");
  await expect(dialog).toBeHidden();

  // O mesmo horário para a mesma profissional é recusado.
  await fill(2);
  await dialog.getByLabel("Início").fill(time);
  await dialog.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(toast(page)).toContainText("Conflito de horário");
  await expect(dialog).toBeVisible();
});

test("fila: encaixe, chamada e painel de TV", async ({ page, context }) => {
  await enterDemo(page);
  await page.goto("/fila");
  await page.getByRole("button", { name: "Encaixe" }).click();
  await page.getByRole("dialog").getByLabel("Nome do cliente").fill("Teste Encaixe");
  await page.getByRole("button", { name: "Colocar na fila" }).click();
  await expect(toast(page)).toContainText(/Encaixe de Teste Encaixe na fila\. Senha E\d{3}/);

  const tv = await context.newPage();
  await tv.goto("/tv");
  await page.getByRole("button", { name: /Chamar próximo/ }).click();
  await expect(tv.getByText("Senha", { exact: true })).toBeVisible();
});

test("atendimentos: resposta rápida e envio", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/atendimentos");
  await page.getByRole("button", { name: /Fernanda Oliveira/ }).click();
  await page.getByRole("group", { name: "Respostas rápidas" }).getByRole("button", { name: "Endereço" }).click();
  await expect(page.getByLabel("Mensagem")).toHaveValue(/Rua das Palmeiras/);
  await page.getByLabel("Mensagem").press("Enter");
  await expect(page.getByRole("log", { name: "Mensagens" })).toContainText("Rua das Palmeiras");
});

test("página pública: cliente agenda sozinho", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/estudio-aurora");
  await page.getByRole("button", { name: /Manicure/ }).click();
  await page.getByRole("button", { name: /Juliana Alves/ }).click();
  const days = page.getByRole("radiogroup", { name: "Dia" }).getByRole("radio");
  for (let i = 1; i < 10; i++) {
    await days.nth(i).click();
    if (await page.getByRole("radiogroup", { name: "Horário" }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(200);
  }
  await page.getByRole("radiogroup", { name: "Horário" }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome completo").fill("Cliente E2E");
  await page.getByLabel("WhatsApp").fill("11933332222");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page.getByRole("heading", { name: "Agendamento feito!" })).toBeVisible();

  await page.getByRole("link", { name: "Remarcar ou cancelar" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Sim, cancelar" }).click();
  await expect(page.getByText("Agendamento cancelado.")).toBeVisible();
});

test("clientes: cadastro e exportação CSV", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/clientes");
  await page.getByRole("button", { name: "Novo cliente" }).click();
  await page.getByRole("dialog").getByLabel("Nome", { exact: true }).fill("Cliente Novo E2E");
  await page.getByRole("dialog").getByLabel("WhatsApp").fill("11944443333");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("link", { name: /Cliente Novo E2E/ })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar CSV" }).click()]);
  expect(download.suggestedFilename()).toBe("clientes-balcao.csv");
});

test("permissões: profissional vê só a própria agenda", async ({ page }) => {
  await enterDemo(page);
  await page.locator("aside").getByRole("button", { name: /Ana Paula Mendes/ }).click();
  await page.getByRole("menuitem", { name: /Marina Costa/ }).click();
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await expect(nav).not.toContainText("Financeiro");
  await expect(nav).not.toContainText("Configurações");
  await page.goto("/agenda");
  await expect(page.getByText("Sua agenda de atendimentos.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo agendamento" })).toHaveCount(0);
});

test("celular: menu e painel @celular", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Fila" }).click();
  await expect(page.getByRole("heading", { name: "Fila de atendimento" })).toBeVisible();
});
