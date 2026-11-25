// Testes do adaptador de persistência — node --test tests/repositorio.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const CAMINHO = require.resolve("../repositorio.js");

function carregarNovo(config) {
    delete require.cache[CAMINHO];
    if (config) globalThis.SUPABASE_CONFIG = config;
    else delete globalThis.SUPABASE_CONFIG;
    return require(CAMINHO);
}

test("sem configuração, modo é local e nada é compartilhado", () => {
    const R = carregarNovo(null);
    assert.equal(R.modoAtivo(), "local");
    assert.equal(R.compartilhamentoAtivo(), false);
    assert.match(R.descricao(), /nada é enviado à rede/);
    assert.deepEqual(R.PENDENTES.length, 4);
});

test("modo local delega leitura e escrita para a camada existente", () => {
    const R = carregarNovo(null);
    const dados = { alunos: [] };
    let recebido = null;
    globalThis.carregarDados = () => dados;
    globalThis.salvarDados = d => { recebido = d; };

    assert.equal(R.carregar(), dados);
    assert.equal(R.salvar(dados), true);
    assert.equal(recebido, dados);

    delete globalThis.carregarDados;
    delete globalThis.salvarDados;
});

test("modo supabase sem adaptador implementado falha de forma explícita", () => {
    const R = carregarNovo({ modo: "supabase", url: "https://exemplo.supabase.co", anonKey: "anon" });
    assert.equal(R.modoAtivo(), "supabase");
    assert.equal(R.credenciaisValidas(), true);
    assert.equal(R.compartilhamentoAtivo(), false);
    assert.throws(() => R.carregar(), /não ativada/);
    assert.throws(() => R.salvar({}), /não ativada/);
});

test("configuração incompleta não é considerada válida", () => {
    const R = carregarNovo({ modo: "supabase", url: "", anonKey: "" });
    assert.equal(R.credenciaisValidas(), false);
});
