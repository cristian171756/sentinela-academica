// ==========================================
// SENTINELA ACADÊMICA
// Relatórios com resultados calculados pelo IPA
// ==========================================

protegerPagina("coordenacao");
App.initSidebar("relatorios");

const alunos = getAlunos();
const dadosRelatorios = carregarDados();
const calculos = new Map(alunos.map(a => [String(a.id), IPA.calcularPara(a, dadosRelatorios)]));
const total = alunos.length;

function calcDe(aluno) {
    return calculos.get(String(aluno.id));
}

const verde = alunos.filter(a => calcDe(a).classificacao.chave === "baixa").length;
const amarelo = alunos.filter(a => calcDe(a).classificacao.chave === "moderada").length;
const vermelho = alunos.filter(a => calcDe(a).classificacao.chave === "alta").length;
const pendentes = alunos.filter(a => !calcDe(a).completo).length;

const medias = alunos.map(a => calcDe(a).mediaGeral).filter(IPA.ehNumero);
const mediaGeral = medias.length ? (medias.reduce((s, v) => s + v, 0) / medias.length).toFixed(1) : "—";
const frequencias = alunos.map(a => calcDe(a).indicadores.F).filter(IPA.ehNumero);
const freqMedia = frequencias.length ? Math.round(frequencias.reduce((s, v) => s + v, 0) / frequencias.length) : null;

document.getElementById("cardsRelatorio").innerHTML = `
    <div class="card-info">
        <i class="fa-solid fa-user-graduate"></i>
        <div><h3>${total}</h3><span>Alunos</span></div>
    </div>
    <div class="card-info">
        <i class="fa-solid fa-star"></i>
        <div><h3>${mediaGeral}</h3><span>Média Geral calculada</span></div>
    </div>
    <div class="card-info">
        <i class="fa-solid fa-calendar-check"></i>
        <div><h3>${freqMedia === null ? "—" : freqMedia + "%"}</h3><span>Frequência Média calculada</span></div>
    </div>
    <div class="card-info">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div><h3>${vermelho}</h3><span>Alta Necessidade</span></div>
    </div>
`;

// Distribuição
new Chart(document.getElementById("graficoDistribuicao"), {
    type: "doughnut",
    data: {
        labels: ["Baixa Necessidade", "Necessidade Moderada", "Alta Necessidade", "Pendente de dados"],
        datasets: [{
            data: [verde, amarelo, vermelho, pendentes],
            backgroundColor: ["#14B8A6", "#F59E0B", "#EF4444", "#94A3B8"],
            borderWidth: 0
        }]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
    }
});

// IPA por turma (somente resultados completos)
const turmas = {};
alunos.forEach(a => {
    if (!turmas[a.turma]) turmas[a.turma] = { n: 0, s: 0 };
    const ipa = calcDe(a).ipa;
    if (IPA.ehNumero(ipa)) {
        turmas[a.turma].n++;
        turmas[a.turma].s += ipa;
    }
});
const nomesTurmas = Object.keys(turmas);
const ipaTurmas = nomesTurmas.map(t => turmas[t].n ? Number((turmas[t].s / turmas[t].n).toFixed(2)) : null);

new Chart(document.getElementById("graficoTurmas"), {
    type: "bar",
    data: {
        labels: nomesTurmas,
        datasets: [{
            label: "IPA Médio",
            data: ipaTurmas,
            backgroundColor: "#2563EB",
            borderRadius: 8
        }]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 100, grid: { color: "#E2E8F0" } },
                  x: { grid: { display: false } } }
    }
});

// Desempenho por disciplina (média calculada sobre notas válidas)
const disciplinas = {};
alunos.forEach(a => {
    const notas = IPA.notasPorDisciplina(a);
    Object.keys(notas).forEach(d => {
        const media = IPA.media(notas[d]);
        if (media === null) return;
        if (!disciplinas[d]) disciplinas[d] = { s: 0, n: 0 };
        disciplinas[d].s += media;
        disciplinas[d].n++;
    });
});
const nomesDisc = Object.keys(disciplinas);
const mediasDisc = nomesDisc.map(d => (disciplinas[d].s / disciplinas[d].n).toFixed(1));

new Chart(document.getElementById("graficoDisciplinas"), {
    type: "bar",
    data: {
        labels: nomesDisc,
        datasets: [{
            label: "Média",
            data: mediasDisc,
            backgroundColor: mediasDisc.map(v => v >= 7 ? "#14B8A6" : v >= 5 ? "#F59E0B" : "#EF4444"),
            borderRadius: 8
        }]
    },
    options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { min: 0, max: 10, grid: { color: "#E2E8F0" } },
                  y: { grid: { display: false } } }
    }
});
