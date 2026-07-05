"use client";

import { useEffect } from "react";
import { trackClient } from "@/lib/track-client";

/**
 * Dispara SESSAO_INICIADA uma vez por sessão de aba (guard em sessionStorage —
 * garante o cookie mi_sid no 1º acesso). Montado no layout do site público.
 */
export default function Tracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("mi_sess_tracked")) return;
      sessionStorage.setItem("mi_sess_tracked", "1");
    } catch {
      // modo privado / storage bloqueado: segue e registra mesmo assim
    }
    trackClient("SESSAO_INICIADA", { path: window.location.pathname });
  }, []);

  return null;
}
