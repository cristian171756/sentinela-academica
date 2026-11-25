// ==========================================
// SENTINELA ACADÊMICA
// Turmas (agregado dos resultados calculados)
// ==========================================

protegerPagina("coordenacao");
App.initSidebar("turmas");

const alunos = getAlunos();
const dadosTurmas = carregarDados();
const calculos = new Map(alunos.map(a => [String(a.id), IPA.calcularPara(a, dadosTurmas)]));

const mapa = {};

alunos.forEach(a => {
    if (!mapa[a.turma]) {
        mapa[a.turma] = { turma: a.turma, n: 0, somaMedia: 0, nMedia: 0, somaIPA: 0, nIPA: 0, somaFreq: 0, nFreq: 0 };
    }
    const t = mapa[a.turma];
    const calc = calculos.get(String(a.id));
    t.n++;
    if (IPA.ehNumero(calc.mediaGeral)) { t.somaMedia += calc.mediaGeral; t.nMedia++; }
    if (IPA.ehNumero(calc.ipa)) { t.somaIPA += calc.ipa; t.nIPA++; }
    if (IPA.ehNumero(calc.indicadores.F)) { t.somaFreq += calc.indicadores.F; t.nFreq++; }
});

const linhas = Object.values(mapa).map(t => {
    const media = t.nMedia ? (t.somaMedia / t.nMedia).toFixed(1) : "—";
    const ipa = t.nIPA ? Number((t.somaIPA / t.nIPA).toFixed(2)) : null;
    const freq = t.nFreq ? Math.round(t.somaFreq / t.nFreq) + "%" : "—";
    const st = statusIPA(ipa);
    return `<tr>
        <td><strong>${t.turma}</strong></td>
        <td>${t.n}</td>
        <td>${media}</td>
        <td>${freq}</td>
        <td><span class="status ${st.classe}">${ipa === null ? "pendente" : IPA.formatarIPA(ipa)}</span></td>
        <td>${st.texto}</td>
    </tr>`;
}).join("");

document.getElementById("tabelaTurmas").innerHTML = linhas;
