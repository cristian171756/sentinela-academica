// ==========================================
// SENTINELA ACADÊMICA
// Dashboard com indicadores calculados pelo IPA
// ==========================================

protegerPagina("coordenacao");
App.initSidebar("dashboard", "coordenacao");

const alunos = getAlunos();
const dadosDashboard = carregarDados();
const calculos = new Map(alunos.map(a => [String(a.id), IPA.calcularPara(a, dadosDashboard)]));

function calcDe(aluno) {
    return calculos.get(String(aluno.id));
}

// Resumo geral
const total = alunos.length;
const turmasUnicas = new Set(alunos.map(a => a.turma)).size;
const emAtencao = alunos.filter(a => {
    const c = calcDe(a);
    return c.completo && c.classificacao.chave === "alta";
}).length;
const pendentes = alunos.filter(a => !calcDe(a).completo).length;
const frequencias = alunos.map(a => calcDe(a).indicadores.F).filter(IPA.ehNumero);
const freqMedia = frequencias.length ? Math.round(frequencias.reduce((s, v) => s + v, 0) / frequencias.length) : null;

document.getElementById("cardsResumo").innerHTML = `
    <div class="card-info">
        <i class="fa-solid fa-user-graduate"></i>
        <div><h3>${total}</h3><span>Alunos Monitorados</span></div>
    </div>
    <div class="card-info">
        <i class="fa-solid fa-school"></i>
        <div><h3>${turmasUnicas}</h3><span>Turmas</span></div>
    </div>
    <div class="card-info">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div><h3>${emAtencao}</h3><span>Alta Necessidade</span></div>
    </div>
    <div class="card-info">
        <i class="fa-solid fa-chart-line"></i>
        <div><h3>${freqMedia === null ? "—" : freqMedia + "%"}</h3><span>Frequência Média calculada</span></div>
    </div>
`;

// Detalhe por indicador: apenas registros reais disponíveis entram na média.
const painelIndicadores = document.getElementById("conteudoIndicadoresCoordenacao");
if (painelIndicadores) {
    painelIndicadores.innerHTML = `
        <div class="ipa-indicadores">
            ${["F", "D", "A", "E"].map(chave => {
                const valores = alunos.map(a => calcDe(a).indicadores[chave]).filter(IPA.ehNumero);
                const medio = valores.length ? IPA.arredondar2(IPA.media(valores)) : null;
                const semRegistro = alunos.length - valores.length;
                return `
                    <div class="ipa-indicador">
                        <div class="ipa-indicador-topo">
                            <span>${IPA.ROTULOS[chave]}</span>
                            <strong>${IPA.ehNumero(medio) ? IPA.formatarNumero(medio) + "/100" : "sem dados"}</strong>
                        </div>
                        <div class="barra"><span class="barra-preench ${IPA.ehNumero(medio) ? "green" : ""}" style="width:${IPA.ehNumero(medio) ? medio : 0}%"></span></div>
                        <small>Peso ${Math.round(IPA.PESOS[chave] * 100)}% • ${semRegistro} aluno(s) sem registro</small>
                    </div>
                `;
            }).join("")}
        </div>
        <p style="font-size:13px;color:#64748b;margin-top:12px;">
            Os pesos, o cálculo e a classificação são definidos em <code>ipa.js</code>, fonte única de verdade.
        </p>
    `;
}

// Alunos em alta necessidade de acompanhamento (IPA >= 70), ordenados
const atencao = alunos
    .filter(a => {
        const c = calcDe(a);
        return c.completo && c.classificacao.chave === "alta";
    })
    .sort((a, b) => calcDe(b).ipa - calcDe(a).ipa);

document.getElementById("listaAtencao").innerHTML = atencao.map(a => {
    const c = calcDe(a);
    return `
        <li>
            <div>
                <strong>${a.nome}</strong>
                <span class="sub">${a.turma}</span>
            </div>
            <span class="status ${c.classificacao.classe}">${IPA.formatarIPA(c.ipa)}</span>
        </li>
    `;
}).join("") || `<li class="vazio">${pendentes > 0
    ? `${pendentes} aluno(s) aguardam registros para ter o IPA classificado.`
    : "Nenhum aluno em alerta. 🎉"}</li>`;

// Gráfico de evolução (IPA e média calculados)
const serieGeral = IPA.serieHistoricoAgregada(alunos);
new Chart(document.getElementById("grafico"), {
    type: "line",
    data: {
        labels: serieGeral.labels,
        datasets: [
            {
                label: "IPA Médio",
                data: serieGeral.ipa,
                borderColor: "#090E3F",
                backgroundColor: "rgba(37,99,235,.10)",
                fill: true,
                tension: .35,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: "#090E3F",
                spanGaps: false
            },
            {
                label: "Média Geral",
                data: serieGeral.media,
                borderColor: "#F5C400",
                backgroundColor: "rgba(245,196,0,.14)",
                fill: true,
                tension: .35,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: "#D4A900",
                spanGaps: false
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: {
                position: "bottom",
                labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 14, color: "#475569", font: { size: 12, weight: "600" } }
            },
            tooltip: { backgroundColor: "#0F172A", padding: 10, cornerRadius: 10 }
        },
        scales: {
            y: { beginAtZero: true, min: 0, max: 100, grid: { color: "rgba(148,163,184,.18)", drawBorder: false }, ticks: { color: "#475569", font: { size: 11 }, maxTicksLimit: 6 }, border: { display: false } },
            x: { grid: { display: false, drawBorder: false }, ticks: { color: "#475569", font: { size: 11 } }, border: { display: false } }
        }
    }
});

// ==========================================
// SISTEMA DE GRÁFICOS DETALHADOS
// ==========================================

const TIPOS_GRAFICO = {
    alunosTurma: { titulo: "Alunos por Turma", tipo: "bar" },
    frequencia: { titulo: "Distribuição de Frequência", tipo: "bar" },
    notasBaixas: { titulo: "Notas Baixas vs Boas Notas", tipo: "doughnut" },
    matriculados: { titulo: "Alunos Matriculados", tipo: "line" },
    pendencias: { titulo: "Pendências por Turma", tipo: "bar" },
    desempenhoDisciplina: { titulo: "Desempenho por Disciplina", tipo: "bar" },
    evolucaoIPA: { titulo: "Evolução IPA vs Média", tipo: "line" }
};

let chartPrincipal = null;
let chartComparacao = null;

function getDadosGrafico(tipo) {
    const turmas = {};
    alunos.forEach(a => {
        const c = calcDe(a);
        const media = c.mediaGeral;
        const ipa = c.ipa;
        const freq = c.indicadores.F;
        if (!turmas[a.turma]) turmas[a.turma] = { n: 0, somaMedia: 0, somaIPA: 0, somaFreq: 0, notasBaixas: 0, boasNotas: 0, pendencias: 0 };
        const t = turmas[a.turma];
        t.n++;
        t.somaMedia += media === null ? 0 : media;
        t.somaIPA += ipa === null ? 0 : ipa;
        t.somaFreq += freq === null ? 0 : freq;
        if (media !== null && media < 5) t.notasBaixas++;
        if (media !== null && media >= 7) t.boasNotas++;
        if (c.classificacao.chave === "moderada" || c.classificacao.chave === "alta") t.pendencias++;
    });

    const nomesTurmas = Object.keys(turmas);

    switch (tipo) {
        case "alunosTurma":
            return {
                labels: nomesTurmas,
                data: nomesTurmas.map(t => turmas[t].n),
                cor: "#090E3F"
            };

        case "frequencia": {
            const faixas = ["< 60%", "60-70%", "70-80%", "80-90%", "90-100%", "sem dados"];
            const contagem = [0, 0, 0, 0, 0, 0];
            alunos.forEach(a => {
                const f = calcDe(a).indicadores.F;
                if (f === null) contagem[5]++;
                else if (f < 60) contagem[0]++;
                else if (f < 70) contagem[1]++;
                else if (f < 80) contagem[2]++;
                else if (f < 90) contagem[3]++;
                else contagem[4]++;
            });
            return { labels: faixas, data: contagem, cor: "#0F766E" };
        }

        case "notasBaixas": {
            let baixas = 0, medias = 0, boas = 0;
            alunos.forEach(a => {
                const m = calcDe(a).mediaGeral;
                if (m === null) return;
                if (m < 5) baixas++;
                else if (m < 7) medias++;
                else boas++;
            });
            return {
                labels: ["Notas Baixas (< 5)", "Notas Médias (5-7)", "Boas Notas (≥ 7)"],
                data: [baixas, medias, boas],
                cores: ["#EF4444", "#F59E0B", "#14B8A6"]
            };
        }

        case "matriculados": {
            const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
            const acumulado = meses.map((_, i) => alunos.slice(0, Math.max(1, Math.round(alunos.length * (i + 1) / 6))).length);
            return { labels: meses, data: acumulado, cor: "#F5C400" };
        }

        case "pendencias":
            return {
                labels: nomesTurmas,
                data: nomesTurmas.map(t => turmas[t].pendencias),
                cor: "#EF4444"
            };

        case "desempenhoDisciplina": {
            const disciplinas = {};
            alunos.forEach(a => {
                const notas = IPA.notasPorDisciplina(a);
                Object.keys(notas).forEach(d => {
                    const m = IPA.media(notas[d]);
                    if (m === null) return;
                    if (!disciplinas[d]) disciplinas[d] = { s: 0, n: 0 };
                    disciplinas[d].s += m;
                    disciplinas[d].n++;
                });
            });
            const nomes = Object.keys(disciplinas);
            return {
                labels: nomes,
                data: nomes.map(d => (disciplinas[d].s / disciplinas[d].n).toFixed(1)),
                cor: "#090E3F"
            };
        }

        case "evolucaoIPA":
            return {
                labels: serieGeral.labels,
                data: serieGeral.ipa,
                data2: serieGeral.media,
                cor: "#090E3F",
                cor2: "#14B8A6"
            };

        default:
            return { labels: [], data: [], cor: "#090E3F" };
    }
}

function criarGrafico(canvasId, tipo) {
    const dados = getDadosGrafico(tipo);
    const info = TIPOS_GRAFICO[tipo];
    const ctx = document.getElementById(canvasId);
    const corTexto = "#475569";
    const corGrade = "rgba(148,163,184,.18)";

    const isLine = info.tipo === "line";
    const isDoughnut = info.tipo === "doughnut";
    const datasets = [];

    if (tipo === "evolucaoIPA") {
        datasets.push({
            label: "IPA Médio",
            data: dados.data,
            borderColor: dados.cor,
            backgroundColor: "rgba(9,14,63,.08)",
            fill: true,
            tension: .35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: dados.cor,
            spanGaps: false
        });
        datasets.push({
            label: "Média Geral",
            data: dados.data2,
            borderColor: "#F5C400",
            backgroundColor: "rgba(245,196,0,.14)",
            fill: true,
            tension: .35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#D4A900",
            spanGaps: false
        });
    } else {
        datasets.push({
            label: info.titulo,
            data: dados.data,
            backgroundColor: isDoughnut ? dados.cores : dados.cor + "D9",
            borderColor: isDoughnut ? "#fff" : dados.cor,
            borderWidth: isDoughnut ? 3 : 0,
            borderRadius: isDoughnut ? 0 : 10,
            borderSkipped: false,
            hoverBackgroundColor: isDoughnut ? dados.cores : dados.cor,
            maxBarThickness: 42
        });
    }

    return new Chart(ctx, {
        type: info.tipo,
        data: { labels: dados.labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450 },
            layout: { padding: { top: 4, right: 8, bottom: 0, left: 0 } },
            plugins: {
                legend: {
                    display: isDoughnut || tipo === "evolucaoIPA",
                    position: "bottom",
                    labels: {
                        usePointStyle: true,
                        pointStyle: "circle",
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: 14,
                        color: corTexto,
                        font: { size: 12, weight: "600" }
                    }
                },
                tooltip: {
                    backgroundColor: "#0F172A",
                    padding: 10,
                    cornerRadius: 10,
                    titleFont: { size: 12, weight: "700" },
                    bodyFont: { size: 12 }
                }
            },
            scales: isDoughnut ? {} : {
                y: {
                    beginAtZero: true,
                    grid: { color: corGrade, drawBorder: false },
                    ticks: { color: corTexto, font: { size: 11 }, maxTicksLimit: 5 },
                    border: { display: false }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        color: corTexto,
                        font: { size: 11 },
                        maxRotation: 0,
                        autoSkip: true,
                        callback(value) {
                            const label = this.getLabelForValue(value);
                            return label && label.length > 12 ? label.slice(0, 12) + "…" : label;
                        }
                    },
                    border: { display: false }
                }
            }
        }
    });
}

function atualizarGraficos() {
    const tipoPrincipal = document.getElementById("graficoPrincipal").value;
    const tipoComparacao = document.getElementById("graficoComparacao").value;
    const grid = document.getElementById("chartCompareGrid");

    document.getElementById("tituloPrincipal").textContent = TIPOS_GRAFICO[tipoPrincipal].titulo;

    if (chartPrincipal) chartPrincipal.destroy();
    chartPrincipal = criarGrafico("canvasPrincipal", tipoPrincipal);

    const boxComparacao = document.getElementById("boxComparacao");
    const comparando = tipoComparacao && tipoComparacao !== tipoPrincipal;
    if (comparando) {
        grid.classList.remove("single");
        boxComparacao.style.display = "";
        document.getElementById("tituloComparacao").textContent = TIPOS_GRAFICO[tipoComparacao].titulo;
        if (chartComparacao) chartComparacao.destroy();
        chartComparacao = criarGrafico("canvasComparacao", tipoComparacao);
    } else {
        grid.classList.add("single");
        boxComparacao.style.display = "none";
        if (chartComparacao) { chartComparacao.destroy(); chartComparacao = null; }
    }
}

document.getElementById("graficoPrincipal").addEventListener("change", atualizarGraficos);
document.getElementById("graficoComparacao").addEventListener("change", atualizarGraficos);

atualizarGraficos();
