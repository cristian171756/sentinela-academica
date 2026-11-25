// ============================================================
// SENTINELA ACADÊMICA — adaptador de persistência
// ============================================================
// Estado atual: MODO LOCAL. Nenhuma requisição é feita e nenhum dado
// é compartilhado. Este arquivo apenas prepara a fronteira entre a
// aplicação e um futuro backend Supabase/PostgreSQL.
//
// Para ativar de verdade (após credenciais e validação):
//   1. aplicar `supabase/schema.sql`;
//   2. criar `config.supabase.js` a partir do exemplo (não versionado);
//   3. implementar os métodos marcados como pendentes usando o cliente
//      Supabase autenticado (anonKey + sessão do usuário, nunca service_role);
//   4. incluir `config.supabase.js` e `repositorio.js` antes de `dados.js`
//      nas páginas e substituir as chamadas de carregarDados/salvarDados.
//
// Não há "simulação" de nuvem: se modo=supabase sem implementação,
// as operações remotas lançam erro explícito em vez de fingir sucesso.
// ============================================================

(function (global) {
    "use strict";

    const configuracao = global.SUPABASE_CONFIG || { modo: "local" };
    const modo = configuracao.modo === "supabase" ? "supabase" : "local";

    function credenciaisValidas() {
        return typeof configuracao.url === "string" && configuracao.url.length > 0 &&
            typeof configuracao.anonKey === "string" && configuracao.anonKey.length > 0;
    }

    function modoAtivo() {
        return modo;
    }

    function compartilhamentoAtivo() {
        return false; // Nenhuma integração remota foi ativada nesta versão.
    }

    function descricao() {
        return modo === "local"
            ? "Modo local: dados no localStorage deste navegador; nada é enviado à rede."
            : "Modo Supabase selecionado, mas o adaptador remoto ainda não foi ativado.";
    }

    function naoImplementado(operacao) {
        throw new Error(
            `Repositorio.${operacao}: integração Supabase não ativada. ` +
            "Aplique supabase/schema.sql, configure credenciais e implemente o adaptador " +
            "com autenticação do usuário. O modo local continua em uso."
        );
    }

    // ----- Operações locais (comportamento atual da aplicação) -----

    function carregarLocal() {
        if (typeof global.carregarDados !== "function") return null;
        return global.carregarDados();
    }

    function salvarLocal(dados) {
        if (typeof global.salvarDados !== "function") return false;
        global.salvarDados(dados);
        return true;
    }

    // ----- Operações remotas (preparação; sem simulação) -----

    function carregar() {
        if (modo === "local") return carregarLocal();
        naoImplementado("carregar");
    }

    function salvar() {
        if (modo === "local") return salvarLocal(arguments[0]);
        naoImplementado("salvar");
    }

    // Pontos de extensão documentados para a futura implementação:
    //   autenticar()                 -> sessão Supabase Auth do usuário
    //   listar("registros_notas")    -> GET /rest/v1/... com RLS
    //   upsert(tabela, registros)    -> POST /rest/v1/... com Prefer: resolution=merge-duplicates
    //   registrarHistorico(...)      -> RPC public.registrar_historico_ipa
    // Nenhum destes métodos existe hoje para não fingir compartilhamento.
    const PENDENTES = Object.freeze([
        "autenticar",
        "listar",
        "upsert",
        "registrarHistorico"
    ]);

    const Repositorio = Object.freeze({
        modoAtivo,
        credenciaisValidas,
        compartilhamentoAtivo,
        descricao,
        carregarLocal,
        salvarLocal,
        carregar,
        salvar,
        PENDENTES
    });

    global.Repositorio = Repositorio;
    if (typeof module !== "undefined" && module.exports) module.exports = Repositorio;

})(typeof window !== "undefined" ? window : globalThis);
