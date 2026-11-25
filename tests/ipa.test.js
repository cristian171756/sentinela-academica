// Testes do módulo central IPA — executar com: node --test tests/ipa.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const IPA = require("../ipa.js");

function dia(deslocamento) {
    const d = new Date();
    d.setDate(d.getDate() + deslocamento);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const diaMes = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${diaMes}`;
}

test("exemplo oficial: F85 D75 A80 E70 => IPA 21,25 e baixa necessidade", () => {
    const r = IPA.calcularIPA({ F: 85, D: 75, A: 80, E: 70 });
    assert.equal(r.ipa, 21.25);
    assert.equal(IPA.formatarIPA(r.ipa), "21,25");
    assert.equal(r.classificacao.chave, "baixa");
    assert.equal(r.classificacao.texto, "Baixa necessidade de acompanhamento");
    assert.deepEqual(r.contribuicoes, { F: 29.75, D: 22.5, A: 16, E: 10.5 });
});

test("fórmula é arredondada apenas no resultado final", () => {
    const r = IPA.calcularIPA({ F: 33.33, D: 33.33, A: 33.33, E: 33.33 });
    assert.equal(r.ipa, 66.67);
    assert.deepEqual(r.contribuicoes, { F: 11.67, D: 10, A: 6.67, E: 5 });
});

test("limites de classificação", () => {
    assert.equal(IPA.classificar(0).chave, "baixa");
    assert.equal(IPA.classificar(39.99).chave, "baixa");
    assert.equal(IPA.classificar(40).chave, "moderada");
    assert.equal(IPA.classificar(69.99).chave, "moderada");
    assert.equal(IPA.classificar(70).chave, "alta");
    assert.equal(IPA.classificar(100).chave, "alta");
});

test("indicador ausente não vira zero: IPA fica incompleto e sem classificação", () => {
    const r = IPA.calcularIPA({ F: 85, D: 75, A: null, E: 70 });
    assert.equal(r.ipa, null);
    assert.equal(r.completo, false);
    assert.equal(r.classificacao.chave, "incompleto");
    assert.equal(r.classificacao.texto, "IPA pendente de dados");
    assert.deepEqual(r.faltantes.map(f => f.chave), ["A"]);
});

test("desempenho usa todas as disciplinas e ignora períodos não lançados", () => {
    const aluno = {
        notas: { "Matemática": [7, 8, null, null], "Português": [9, null, null, null] }
    };
    assert.equal(IPA.mediaGeral(aluno), 8.25);
    assert.equal(IPA.calcularD(aluno), 82.5);
    assert.deepEqual(IPA.mediasPorBimestre(aluno), [8, 8, null, null]);

    const semNotas = { notas: {}, registrosNotas: [] };
    assert.equal(IPA.calcularD(semNotas), null);

    const soBim1 = { notas: {}, registrosNotas: [{ disciplina: "Arte", bimestre: 1, valor: 7 }] };
    assert.equal(IPA.mediaGeral(soBim1), 7);
    assert.equal(IPA.notasPorDisciplina(soBim1).Arte[1], null);
});

test("evolução: 50 estável, +2 => 70, -2 => 30, limites 0 e 100", () => {
    const comNotas = (b1, b2) => ({
        notas: {},
        registrosNotas: [
            { disciplina: "Matemática", bimestre: 1, valor: b1 },
            { disciplina: "Matemática", bimestre: 2, valor: b2 }
        ]
    });
    assert.equal(IPA.calcularE(comNotas(7, 7)), 50);
    assert.equal(IPA.calcularE(comNotas(7, 9)), 70);
    assert.equal(IPA.calcularE(comNotas(9, 7)), 30);
    assert.equal(IPA.calcularE(comNotas(4, 9)), 100);
    assert.equal(IPA.calcularE(comNotas(9, 4)), 0);
    assert.equal(IPA.calcularE(comNotas(7, 12)), null); // nota fora da escala é inválida
    assert.equal(IPA.calcularE({ notas: {}, registrosNotas: [{ disciplina: "Arte", bimestre: 1, valor: 8 }] }), null);
});

test("frequência: presenças sobre aulas registradas, sem aulas sem registro", () => {
    const registros = [];
    for (let i = 1; i <= 20; i++) {
        registros.push({ disciplina: "Matemática", data: dia(-i), presenca: i <= 17 });
    }
    const aluno = { registrosFrequencia: registros };
    assert.equal(IPA.calcularF(aluno), 85);

    aluno.registrosFrequencia = registros.concat([{ disciplina: "Arte", data: "data-invalida", presenca: false }]);
    assert.equal(IPA.calcularF(aluno), 85);
    assert.equal(IPA.calcularF({ registrosFrequencia: [] }), null);
});

test("atividades: vencidas no denominador, futuras fora, atrasada entregue conta", () => {
    const aluno = { id: 1, turma: "3º Ano A", notas: { "Matemática": [7, 7, 7, 7] } };
    const dados = {
        atividades: [
            { id: 1, turma: "3º Ano A", disciplina: "Matemática", dataEntrega: dia(-3) },
            { id: 2, turma: "3º Ano A", disciplina: "Matemática", dataEntrega: dia(5) }
        ],
        entregas: [{ atividadeId: 1, alunoId: 1, status: "atrasada" }]
    };
    assert.equal(IPA.calcularA(aluno, dados), 100);
    assert.equal(IPA.calcularA(aluno, { atividades: dados.atividades, entregas: [] }), 0);
    assert.equal(IPA.calcularA(aluno, { atividades: [], entregas: [] }), null);
    assert.equal(IPA.calcularA({ id: 2, turma: "Outra", notas: { "Matemática": [7] } }, dados), null);
});

test("atividade conta para o aluno da turma mesmo sem notas na disciplina", () => {
    const aluno = { id: 3, turma: "3º Ano A", notas: { "Matemática": [7, 7, 7, 7] } };
    const dados = {
        atividades: [{ id: 1, turma: "3º Ano A", disciplina: "Arte", dataEntrega: dia(-1) }],
        entregas: [{ atividadeId: 1, alunoId: 3, status: "entregue" }]
    };
    assert.equal(IPA.calcularA(aluno, dados), 100);
    assert.equal(IPA.calcularA({ id: 4, turma: "Outra Turma", notas: {} }, dados), null);
});

test("cálculo completo combina registros de diferentes disciplinas", () => {
    const aluno = {
        id: 1,
        turma: "3º Ano A",
        notas: { "Matemática": [7, 9, null, null], "Português": [8, 8, null, null] },
        registrosFrequencia: [
            { disciplina: "Matemática", data: dia(-2), presenca: true },
            { disciplina: "Português", data: dia(-1), presenca: false }
        ]
    };
    const dados = {
        atividades: [{ id: 1, turma: "3º Ano A", disciplina: "Matemática", dataEntrega: dia(-1) }],
        entregas: [{ atividadeId: 1, alunoId: 1, status: "entregue" }]
    };
    const r = IPA.calcularPara(aluno, dados);
    assert.equal(r.indicadores.F, 50);
    assert.equal(r.indicadores.D, 80);
    assert.equal(r.indicadores.A, 100);
    assert.equal(r.indicadores.E, 60);
    assert.equal(r.ipa, 29.5);
});
