import { test, expect } from '@playwright/test';

// Fluxo de "Salvar Baixa" com interceptação da chamada PUT para evitar dependência do backend.
test.describe('Titulos Receber - Fluxo de Baixa', () => {
  test.beforeEach(async ({ page }) => {
    // Injeta token fake no sessionStorage antes de qualquer script da aplicação.
    await page.addInitScript(() => {
      sessionStorage.setItem('TOKEN', JSON.stringify({ access_token: 'test_token', token_type: 'Bearer' }));
      sessionStorage.setItem('ERPTOKEN', JSON.stringify({ access_token: 'test_token', token_type: 'Bearer' }));
    });

    // Intercepta a listagem para garantir que haja itens na tabela.
    await page.route('**/api/v1/titulos-receber**', async (route) => {
      if (route.request().method() === 'GET') {
        const items = [
          {
            nf: '214862',
            parcela: 'A',
            codigoCliente: '414',
            nomeCliente: 'JALL SUPERMERCADOS',
            dataEmissao: '03/07/2024',
            dataVencimento: '02/07/2025',
            valor: '350,00',
            saldo: '350,00',
            formaPagamento: 'BOLETO',
            statusCanhotaRecebido: 'ABERTO',
            statusCanhotaRetorno: 'ABERTO'
          }
        ];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(items) });
        return;
      }
      await route.continue();
    });

    // Intercepta a chamada de confirmar entrega e retorna sucesso.
    await page.route('**/api/v1/titulos-receber/*/*/confirmar-entrega', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Baixa confirmada com sucesso.' })
      });
    });
  });

  test('validação: exige data antes de salvar baixa', async ({ page }) => {
    await page.goto('/titulos');

    // Pesquisar por um NF conhecido (do tmp-api.json), para garantir que exista linha na tabela
    await page.locator('po-input[name="nf"] input').fill('214862');
    await page.getByRole('button', { name: 'Pesquisar' }).last().click();

    // Aguarda a ação "Detalhes" ficar visível
    await expect(page.getByText('Detalhes').first()).toBeVisible();
    // Abre os detalhes do primeiro item via ação "Detalhes"
    await page.getByText('Detalhes').first().click();

    // Abre o fluxo de baixa sem informar data
    await page.getByRole('button', { name: 'Confirmar Recebimento' }).click();
    await page.getByRole('button', { name: 'Salvar Baixa' }).click();

    // Deve exibir aviso de que a data é obrigatória
    await expect(page.getByText('Informe a data de recebimento do cliente.')).toBeVisible();
  });

  test('fluxo completo: preencher data e salvar baixa com sucesso (via mock)', async ({ page }) => {
    await page.goto('/titulos');

    // Pesquisar por NF conhecido
    await page.locator('po-input[name="nf"] input').fill('214862');
    await page.getByRole('button', { name: 'Pesquisar' }).last().click();

    // Aguarda a ação "Detalhes" ficar visível
    await expect(page.getByText('Detalhes').first()).toBeVisible();
    // Abre os detalhes de um registro
    await page.getByText('Detalhes').first().click();

    // Inicia o fluxo de baixa
    await page.getByRole('button', { name: 'Confirmar Recebimento' }).click();

    // Preenche a data no datepicker (DD/MM/YYYY). Usa uma data válida.
    await page.locator('po-datepicker[name="dataRecebimentoCliente"] input').fill('19/10/2025');

    await page.getByRole('button', { name: 'Salvar Baixa' }).click();

    // Deve mostrar mensagem de sucesso
    await expect(page.getByText('Baixa confirmada com sucesso.')).toBeVisible();

    // Opcional: verifica se o status da linha foi atualizado para "Baixado"
    await expect.soft(page.getByText('Baixado').first()).toBeVisible();
  });
});