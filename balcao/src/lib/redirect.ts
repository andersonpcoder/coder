/**
 * Aceita só caminhos internos do próprio site para o parâmetro "proximo",
 * para que o link de login não leve a outro site nem rode `javascript:`.
 */
export function safeNext(value: string | null | undefined, fallback = "/painel"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // Caracteres de controle fazem o navegador ignorar partes do endereço.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
