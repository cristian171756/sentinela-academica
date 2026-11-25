// Testes da camada de dados e migração — node --test tests/dados.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function criarStorage() {
    const mapa = new Map();
    return {
        getItem: chave => (mapa.has(chave) ? mapa.get(chave) : null),
        setItem: (chave, valor) => mapa.set(chave, String(valor)),
        removeItem: chave => mapa.delete(chave),
        clear: () => mapa.clear(),
        _mapa: mapa
    };
}

globalThis.localStorage = criarStorage();
const IPA = require("../ipa.js");

const codigo = fs.readFileSync(require("node:path").join(__dirname, "..", "dados.js"), "utf8") + `
globalThis.__dados = {
    carregarDados, salvarDados, migrarDados, getAlunos, getProfessorPorId,
    registrarNota, registrarFrequencia, cadastrarAtividade, registrarEntrega,
    getAtividades, getEntregasDaAtividade, getRegistrosFrequencia,
    statusIPA, adicionarAluno, notasPadrao, atualizarAluno,
    turmasAutorizadasProfessor, professorAutorizado, avaliarDadosDemonstrativos,
    removerNota, removerRegistroFrequencia, atualizarAtividade, removerAtividade, removerEntrega
};`;
vm.runInThisContext(codigo + `\nglobalThis.__restaurar = restaurarBackupOriginal;`, { filename: "dados.js" });
const D = globalThis.__dados;

function dia(deslocamento) {
    const d = new Date();
    d.setDate(d.getDate() + deslocamento);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const diaMes = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${diaMes}`;
}

function joao() {
    return D.carregarDados().alunos.find(a => a.matricula === "2024001");
}

test("migração preserva originais, cria backup e converte notas demonstrativas", () => {
    const dados = D.carregarDados();
    assert.equal(dados.schemaVersao, 7);
    assert.ok(globalThis.localStorage.getItem("sentinela_dados_v4_backup"));

    const j = joao();
    assert.equal(j.dadosDemonstrativos, true);
    assert.equal(j.ipaLegado, 8);
    assert.equal(j.historicoIPA.length, 6);
    assert.equal(j.registrosNotas.length, 84); // 21 disciplinas x 4 bimestres
    assert.equal(j.registrosNotas[0].origem, "demonstracao");
    assert.equal(j.registrosFrequencia.length, 0);

    const backup = JSON.parse(globalThis.localStorage.getItem("sentinela_dados_v4_backup"));
    assert.equal(backup.alunos.find(a => a.matricula === "2024001").ipa, 8);
    assert.equal(backup.schemaVersao, undefined);

    // Idempotente
    D.migrarDados(D.carregarDados());
    assert.equal(joao().registrosNotas.length, 84);
});

test("autorização usa somente turmas explícitas, nunca notas demonstrativas", () => {
    const prof = D.getProfessorPorId(5);
    assert.ok(D.turmasAutorizadasProfessor(prof).includes("Informática II"));
    assert.equal(D.professorAutorizado(prof, "Matemática", "Informática II"), true);
    assert.equal(D.professorAutorizado(prof, "Biologia", "Informática II"), false);

    const semVinculo = { id: 99, nome: "Sem Turma", disciplinas: ["Matemática"], turmas: [] };
    assert.deepEqual(D.turmasAutorizadasProfessor(semVinculo), []);
    assert.equal(D.professorAutorizado(semVinculo, "Matemática", "Informática II"), false);

    const dados = D.carregarDados();
    dados.professores.push(semVinculo);
    D.salvarDados(dados);
    assert.throws(() => D.registrarNota({
        professorId: 99, alunoId: 1, disciplina: "Matemática", bimestre: 2, valor: 8
    }), /não está autorizado/);
});

test("sincronização inicial substitui IPA manual e mantém histórico antigo", () => {
    IPA.recalcularTodos("Sincronização automática ao carregar");
    const j = joao();
    assert.equal(j.ipa, null);
    assert.equal(j.ipaCompleto, false);
    assert.equal(j.ipaClassificacao, "IPA pendente de dados");
    assert.deepEqual(j.dadosFaltantes.slice().sort(), [
        "Entrega de atividades (atividade com prazo vencido)",
        "Frequência escolar (registros de presença/falta)"
    ].sort());
    assert.equal(j.historicoIPA.length, 6);
    assert.equal(j.historicoIPACalculado.length, 1);
    assert.equal(j.historicoIPACalculado[0].origem, "demonstracao");
    assert.equal(D.statusIPA(j.ipa).texto, "IPA pendente de dados");
});

test("alterar nota recalcula desempenho e registra histórico sem apagar o valor demonstrativo", () => {
    const antes = joao();
    const dAntes = antes.indicadoresIPA.D;
    const histAntes = antes.historicoIPACalculado.length;

    D.registrarNota({ professorId: 5, alunoId: 1, disciplina: "Matemática", bimestre: 1, valor: 2 });

    const depois = joao();
    const reg = depois.registrosNotas.find(r => r.disciplina === "Matemática" && r.bimestre === 1);
    assert.equal(reg.valor, 2);
    assert.equal(reg.origem, "professor");
    assert.equal(reg.valorDemonstrativo, 7.9);
    assert.ok(depois.indicadoresIPA.D < dAntes);
    assert.equal(depois.historicoIPACalculado.length, histAntes + 1);
    assert.match(depois.historicoIPACalculado.at(-1).motivo, /Nota de Matemática.*alterada/);
});

test("registrar e corrigir falta atualiza F sem duplicar a aula", () => {
    D.registrarFrequencia({ professorId: 5, alunoId: 1, disciplina: "Matemática", data: dia(-1), presenca: true });
    D.registrarFrequencia({ professorId: 5, alunoId: 1, disciplina: "Matemática", data: dia(-2), presenca: false });
    let j = joao();
    assert.equal(j.indicadoresIPA.F, 50);
    assert.equal(j.registrosFrequencia.length, 2);

    D.registrarFrequencia({ professorId: 5, alunoId: 1, disciplina: "Matemática", data: dia(-2), presenca: true });
    j = joao();
    assert.equal(j.indicadoresIPA.F, 100);
    assert.equal(j.registrosFrequencia.length, 2);
});

test("duas aulas no mesmo dia são registradas separadamente pela identificação da aula", () => {
    const data = dia(-3);
    D.registrarFrequencia({ professorId: 5, alunoId: 1, disciplina: "Matemática", data, aulaId: "1ª aula", presenca: true });
    D.registrarFrequencia({ professorId: 5, alunoId: 1, disciplina: "Matemática", data, aulaId: "2ª aula", presenca: true });
    const doDia = () => joao().registrosFrequencia.filter(r => r.data === data && r.disciplina === "Matemática");
    assert.equal(doDia().length, 2);
    assert.ok(doDia().every(r => r.turma === "Informática II"));
    assert.equal(joao().indicadoresIPA.F, 100);

    D.registrarFrequencia({ professorId: 5, alunoId: 1, disciplina: "Matemática", data, aulaId: "1ª aula", presenca: false });
    assert.equal(doDia().length, 2);
    assert.equal(joao().indicadoresIPA.F, 75);
});

test("corrigir data da aula atualiza o registro em vez de duplicá-lo", () => {
    const registro = joao().registrosFrequencia[0];
    const anterior = joao().registrosFrequencia.length;
    D.registrarFrequencia({
        professorId: 5, alunoId: 1, registroId: registro.id,
        disciplina: "Matemática", data: dia(-7),
        aulaId: registro.aulaId, presenca: false
    });
    const depois = joao().registrosFrequencia;
    assert.equal(depois.length, anterior);
    assert.equal(depois.find(r => String(r.id) === String(registro.id)).data, dia(-7));
    assert.equal(depois.find(r => String(r.id) === String(registro.id)).presenca, false);
});

test("atividade e entrega alteram A; futuras não entram no cálculo", () => {
    const atividade = D.cadastrarAtividade({
        professorId: 5,
        titulo: "Lista de exercícios",
        descricao: "Resolver ao final da aula",
        disciplina: "Matemática",
        turma: "Informática II",
        dataEntrega: dia(-1)
    });
    assert.equal(joao().indicadoresIPA.A, 0);

    D.registrarEntrega({ professorId: 5, atividadeId: atividade.id, alunoId: 1, status: "entregue" });
    assert.equal(joao().indicadoresIPA.A, 100);

    const futura = D.cadastrarAtividade({
        professorId: 5,
        titulo: "Trabalho futuro",
        disciplina: "Matemática",
        turma: "Informática II",
        dataEntrega: dia(10)
    });
    assert.equal(joao().indicadoresIPA.A, 100);
    assert.equal(D.getEntregasDaAtividade(futura.id).length, 0);

    D.registrarEntrega({ professorId: 5, atividadeId: atividade.id, alunoId: 1, status: "atrasada" });
    const entrega = D.getEntregasDaAtividade(atividade.id);
    assert.equal(entrega.length, 1);
    assert.equal(entrega[0].status, "atrasada");
});

test("validações bloqueiam nota fora da escala, período inválido e acesso não autorizado", () => {
    assert.throws(() => D.registrarNota({ professorId: 5, alunoId: 1, disciplina: "Matemática", bimestre: 1, valor: 11 }), /entre 0 e 10/);
    assert.throws(() => D.registrarNota({ professorId: 5, alunoId: 1, disciplina: "Matemática", bimestre: 9, valor: 8 }), /bimestre de 1 a 4/);
    assert.throws(() => D.registrarNota({ professorId: 3, alunoId: 1, disciplina: "Matemática", bimestre: 2, valor: 8 }), /não está autorizado/);
    assert.throws(() => D.registrarFrequencia({ professorId: 5, alunoId: 1, disciplina: "Matemática", data: "31/11/2026", presenca: true }), /data válida/);
    assert.throws(() => D.registrarEntrega({ professorId: 5, atividadeId: 9999, alunoId: 1, status: "entregue" }), /Atividade não encontrada/);
});

test("recalcular sem mudança nos números não cria linha no histórico", () => {
    const antes = joao().historicoIPACalculado.length;
    IPA.recalcular(1, "Carregamento automático sem alteração");
    assert.equal(joao().historicoIPACalculado.length, antes);
});

test("indicadoresDoAluno consulta o banco quando não há cache", () => {
    const dados = D.carregarDados();
    dados.atividades.push({
        id: 777, titulo: "Atividade de verificação", turma: "Informática II",
        disciplina: "Matemática", dataEntrega: dia(-1), professorId: 5
    });
    dados.entregas.push({ id: 778, atividadeId: 777, alunoId: 1, status: "entregue" });
    D.salvarDados(dados);

    const copia = JSON.parse(JSON.stringify(joao()));
    delete copia.indicadoresIPA;
    assert.equal(IPA.indicadoresDoAluno(copia).A, 100);
});

test("sinalização demonstrativa desaparece quando os registros são reais", () => {
    assert.equal(joao().dadosDemonstrativos, true);
    const dados = D.carregarDados();
    const aluno = dados.alunos.find(a => a.matricula === "2024001");
    aluno.registrosNotas.forEach(r => { r.origem = "professor"; });
    assert.equal(D.avaliarDadosDemonstrativos(aluno), false);
    D.salvarDados(dados);

    D.registrarNota({ professorId: 5, alunoId: 1, disciplina: "Matemática", bimestre: 2, valor: 8 });
    assert.equal(joao().dadosDemonstrativos, false);
});

test("novo aluno não ganha notas fictícias e fica com IPA pendente", () => {
    const novo = D.adicionarAluno({ nome: "Aluno Sem Registro", senha: "1234", turma: "Informática II" });
    assert.deepEqual(novo.notas, {});
    assert.equal(novo.ipa, null);
    assert.equal(novo.frequencia, null);
    assert.deepEqual(novo.registrosNotas, []);
    assert.equal(D.notasPadrao("Informática").Matemática, undefined);
});

test("edição manual não sobrescreve os indicadores calculados", () => {
    const aluno = D.atualizarAluno(1, {
        nome: "João Pedro Atualizado",
        ipa: 99,
        media: 10,
        frequencia: 100
    });
    assert.equal(aluno.nome, "João Pedro Atualizado");
    assert.notEqual(aluno.ipa, 99);
    assert.equal(aluno.ipa, IPA.calcularPara(aluno, D.carregarDados()).ipa);
    assert.equal(aluno.media, IPA.mediaGeral(aluno));
});

test("dados permanecem salvos após nova leitura", () => {
    const salvo = JSON.parse(globalThis.localStorage.getItem("sentinela_dados_v4"));
    const j = salvo.alunos.find(a => a.matricula === "2024001");
    assert.equal(j.schemaVersao, undefined);
    assert.ok(j.historicoIPACalculado.length >= 3);
    assert.equal(j.registrosFrequencia.length, 4);
    assert.equal(j.indicadoresIPA.F, 50);
    assert.equal(D.carregarDados().schemaVersao, 7);
});

test("nota e registro de frequência podem ser excluídos com autorização", () => {
    const antes = joao();
    const nota = antes.registrosNotas.find(r => r.disciplina === "Matemática" && r.bimestre === 1);
    const freq = antes.registrosFrequencia[0];
    assert.ok(nota && freq);

    const historico = antes.historicoIPACalculado.length;
    D.removerNota({ professorId: 5, alunoId: 1, registroId: nota.id });
    D.removerRegistroFrequencia({ professorId: 5, registroId: freq.id });

    const depois = joao();
    assert.equal(depois.registrosNotas.some(r => String(r.id) === String(nota.id)), false);
    assert.equal(depois.notas.Matemática[0], null);
    assert.equal(depois.registrosFrequencia.some(r => String(r.id) === String(freq.id)), false);
    assert.ok(depois.historicoIPACalculado.length > historico);

    const outraNota = depois.registrosNotas.find(r => r.disciplina === "Matemática" && r.bimestre === 2);
    assert.throws(() => D.removerNota({ professorId: 3, alunoId: 1, registroId: outraNota.id }), /autorizado/);
});

test("atividade pode ser editada e excluída; entrega pode ser removida", () => {
    const atividade = D.cadastrarAtividade({
        professorId: 5, titulo: "Atividade de exclusão", disciplina: "Matemática",
        turma: "Informática II", dataEntrega: dia(-1)
    });
    const entrega = D.registrarEntrega({ professorId: 5, atividadeId: atividade.id, alunoId: 1, status: "entregue" });
    assert.equal(D.getEntregasDaAtividade(atividade.id).length, 1);

    D.atualizarAtividade(atividade.id, { professorId: 5, dataEntrega: dia(5) });
    assert.equal(D.getAtividades().find(a => String(a.id) === String(atividade.id)).dataEntrega, dia(5));
    assert.throws(() => D.atualizarAtividade(atividade.id, { professorId: 3, dataEntrega: dia(5) }), /responsável/);

    D.removerEntrega({ professorId: 5, entregaId: entrega.id });
    assert.equal(D.getEntregasDaAtividade(atividade.id).length, 0);
    D.removerAtividade({ professorId: 5, atividadeId: atividade.id });
    assert.equal(D.getAtividades().some(a => String(a.id) === String(atividade.id)), false);
    assert.throws(() => D.removerAtividade({ professorId: 3, atividadeId: 1 }), /responsável/);
});

test("recuperação restaura os originais, guarda o estado anterior e recalcula", () => {
    const antes = globalThis.localStorage.getItem("sentinela_dados_v4");
    const dados = globalThis.__restaurar();
    const j = dados.alunos.find(a => a.matricula === "2024001");

    assert.equal(j.ipaLegado, 8);
    assert.equal(j.ipa, null);
    assert.equal(j.registrosFrequencia.length, 0);
    assert.equal(j.historicoIPACalculado.length, 1);
    assert.equal(globalThis.localStorage.getItem("sentinela_dados_v4_antes_restauracao"), antes);
    assert.equal(globalThis.localStorage.getItem("sentinela_dados_v4_backup").includes('"ipa":8'), true);
});

test("fluxo real de notas, aulas e entregas gera e persiste IPA 21,25", () => {
    const aluno = D.adicionarAluno({ nome: "Aluno Fluxo Real", senha: "1234", turma: "Informática II" });
    const id = aluno.id;

    D.registrarNota({ professorId: 5, alunoId: id, disciplina: "Matemática", bimestre: 1, valor: 6.5 });
    D.registrarNota({ professorId: 5, alunoId: id, disciplina: "Matemática", bimestre: 2, valor: 8.5 });

    for (let i = 1; i <= 20; i++) {
        D.registrarFrequencia({
            professorId: 5, alunoId: id, disciplina: "Matemática",
            data: dia(-i), aulaId: `Aula ${i}`, presenca: i <= 17
        });
    }

    const atividades = [];
    for (let i = 1; i <= 5; i++) {
        atividades.push(D.cadastrarAtividade({
            professorId: 5, titulo: `Atividade ${i}`, disciplina: "Matemática",
            turma: "Informática II", dataEntrega: dia(-1)
        }));
    }
    atividades.slice(0, 4).forEach(a =>
        D.registrarEntrega({ professorId: 5, atividadeId: a.id, alunoId: id, status: "entregue" }));

    const salvo = JSON.parse(globalThis.localStorage.getItem("sentinela_dados_v4"));
    const final = salvo.alunos.find(a => String(a.id) === String(id));
    assert.deepEqual(final.indicadoresIPA, { F: 85, D: 75, A: 80, E: 70 });
    assert.equal(final.ipa, 21.25);
    assert.equal(final.ipaClassificacao, "Baixa necessidade de acompanhamento");
    assert.equal(final.ipaCompleto, true);
    // O histórico é deduplicado: 28 lançamentos não geram 28 linhas iguais.
    assert.ok(final.historicoIPACalculado.length >= 8);
    assert.ok(final.historicoIPACalculado.length < 28);
    assert.equal(final.historicoIPACalculado[final.historicoIPACalculado.length - 1].ipa, 21.25);
    assert.equal(IPA.calcularPara(final, D.carregarDados()).ipa, 21.25);
});
