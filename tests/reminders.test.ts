import { describe, it, expect, vi } from "vitest";
import {
  buildReminderText,
  processReminders,
  type DueReminder,
} from "@/lib/reminders";

const content: Record<string, string> = {
  "msg.lembrete_24h": "Oi, {nome}! Seu {servico} é amanhã ({data}).",
  "msg.aniversario": "Feliz aniversário, {nome}!",
  "msg.pos_atendimento": "Oi, {nome}! Como foi o {servico}?",
};

const row = (over: Partial<DueReminder>): DueReminder => ({
  telefone: "+5521970225231",
  nome: "Ana",
  kind: "aniversario",
  dedup_key: "aniversario:1:2026",
  servico: null,
  inicio: null,
  ...over,
});

describe("buildReminderText", () => {
  it("interpola nome/servico/data no lembrete da véspera", () => {
    const txt = buildReminderText(
      content,
      row({
        kind: "lembrete_24h",
        nome: "Bia",
        servico: "Maquiagem social",
        inicio: new Date("2026-06-20T13:30:00.000Z"),
      }),
    );
    expect(txt).toContain("Oi, Bia!");
    expect(txt).toContain("Maquiagem social");
    // 13:30 UTC = 10:30 em America/Sao_Paulo
    expect(txt).toContain("10:30");
  });

  it("interpola só {nome} quando não há serviço/data", () => {
    expect(buildReminderText(content, row({ kind: "aniversario", nome: "Ana" }))).toBe(
      "Feliz aniversário, Ana!",
    );
  });

  it("retorna null quando não há template para o kind", () => {
    expect(buildReminderText(content, row({ kind: "reconexao" }))).toBeNull();
  });
});

describe("processReminders", () => {
  it("envia, registra e conta por tipo", async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const logger = vi.fn().mockResolvedValue(undefined);
    const rows = [
      row({ kind: "aniversario", dedup_key: "a:1" }),
      row({
        kind: "lembrete_24h",
        dedup_key: "l:2",
        servico: "Escova",
        inicio: new Date("2026-06-20T13:30:00.000Z"),
      }),
    ];
    const s = await processReminders(rows, content, sender, logger);
    expect(s.enviados).toBe(2);
    expect(s.falhas).toBe(0);
    expect(s.porTipo).toEqual({ aniversario: 1, lembrete_24h: 1 });
    expect(sender).toHaveBeenCalledTimes(2);
    // telefone vai só com dígitos
    expect(sender).toHaveBeenCalledWith("5521970225231", expect.any(String));
    expect(logger).toHaveBeenCalledWith("aniversario", "a:1");
  });

  it("pula linha sem telefone e sem template (conta como falha, não envia)", async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const logger = vi.fn().mockResolvedValue(undefined);
    const rows = [
      row({ telefone: "", dedup_key: "semfone" }),
      row({ kind: "reconexao", dedup_key: "semtpl" }), // sem template no content
    ];
    const s = await processReminders(rows, content, sender, logger);
    expect(s.enviados).toBe(0);
    expect(s.falhas).toBe(2);
    expect(sender).not.toHaveBeenCalled();
    expect(logger).not.toHaveBeenCalled();
  });

  it("falha de envio não derruba o lote e não registra o que falhou", async () => {
    const sender = vi
      .fn()
      .mockRejectedValueOnce(new Error("Evolution 500"))
      .mockResolvedValue(undefined);
    const logger = vi.fn().mockResolvedValue(undefined);
    const rows = [
      row({ kind: "aniversario", dedup_key: "falha" }),
      row({ kind: "aniversario", dedup_key: "ok" }),
    ];
    const s = await processReminders(rows, content, sender, logger);
    expect(s.enviados).toBe(1);
    expect(s.falhas).toBe(1);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith("aniversario", "ok");
  });
});
