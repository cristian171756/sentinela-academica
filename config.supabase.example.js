// ============================================================
// SENTINELA ACADÊMICA — exemplo de configuração do Supabase
// ============================================================
// 1) Copie este arquivo para `config.supabase.js` (ignorado pelo Git).
// 2) Preencha url e anonKey do SEU projeto.
// 3) Mude `modo` para "supabase" somente após aplicar `supabase/schema.sql`
//    e implementar/validar o adaptador em `repositorio.js`.
//
// NUNCA coloque aqui a chave service_role: ela dá acesso administrativo
// e não pode existir em código executado no navegador.
//
// Sem este arquivo, o sistema permanece em MODO LOCAL (localStorage) e
// nenhum dado é enviado para a rede.
// ============================================================

window.SUPABASE_CONFIG = Object.freeze({
    modo: "local",          // "local" | "supabase"
    url: "",                // Ex.: https://SEU-PROJETO.supabase.co
    anonKey: "",            // chave pública anon/public (não é segredo, mas exige RLS)
    observacao: "Configuração de exemplo. Nenhum compartilhamento real está ativo."
});
