// Testes de integração estática das páginas — node --test tests/integracao.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const htmls = fs.readdirSync(RAIZ).filter(n => n.endsWith(".html"));

test("todas as páginas carregam ipa.js depois de dados.js", () => {
    for (const arquivo of htmls) {
        const html = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
        const posDados = html.indexOf('src="dados.js"');
        const posIpa = html.indexOf('src="ipa.js"');
        assert.ok(posDados >= 0, `${arquivo} não carrega dados.js`);
        assert.ok(posIpa > posDados, `${arquivo} não carrega ipa.js depois de dados.js`);
    }
});

test("fórmula e pesos existem apenas no módulo central", () => {
    const arquivos = fs.readdirSync(RAIZ).filter(n => n.endsWith(".js") && !n.startsWith("config."));
    for (const arquivo of arquivos) {
        if (arquivo === "ipa.js") continue;
        const codigo = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
        assert.ok(!/0\.35\s*\*|0\.30\s*\*|0\.20\s*\*|0\.15\s*\*/.test(codigo),
            `${arquivo} parece duplicar os pesos do IPA`);
    }
});

test("scripts de página não referenciam IDs inexistentes no HTML", () => {
    const pares = {
        "index.html": "script.js",
        "dashboard.html": "dashboard.js",
        "alunos.html": "alunos.js",
        "turmas.html": "turmas.js",
        "alertas.html": "alertas.js",
        "relatorios.html": "relatorios.js",
        "professor.html": "professor.js",
        "professores.html": "professores.js",
        "portal-aluno.html": "portal-aluno.js",
        "perfil.html": "perfil.js",
        "configuracoes.html": "configuracoes.js",
        "contas.html": "contas.js"
    };

    for (const [html, js] of Object.entries(pares)) {
        const conteudoHtml = fs.readFileSync(path.join(RAIZ, html), "utf8");
        const codigo = fs.readFileSync(path.join(RAIZ, js), "utf8");
        const ids = Array.from(codigo.matchAll(/getElementById\(["']([^"']+)["']\)/g), m => m[1]);
        const ausentes = ids.filter(id => !conteudoHtml.includes(`id="${id}"`));
        assert.deepEqual(ausentes, [], `${js} referencia IDs inexistentes em ${html}`);
    }
});
