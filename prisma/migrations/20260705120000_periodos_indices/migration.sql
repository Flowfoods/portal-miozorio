-- Índices por data para os filtros de PERÍODO (F4). Aditiva (R11): só índices.
-- club_transactions(created_at): extrato/totais de pontos por intervalo.
-- customers(created_at): "novas clientes no período" (CRM).
CREATE INDEX "club_transactions_created_at_idx" ON "club_transactions"("created_at");
CREATE INDEX "customers_created_at_idx" ON "customers"("created_at");
