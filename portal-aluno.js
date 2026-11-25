// ==========================================
// SENTINELA ACADÊMICA
// Portal do Aluno — IPA dinâmico
// =========================================

const sessao = protegerPagina("aluno");

if (sessao) {
    const aluno = getAlunoPorId(sessao.referencia);

    if (!aluno) {
        encerrarSessao();
    } else {
        App.initSidebar("portal", "aluno");

        const dados = carregarDados();
        const calc = IPA.calcularPara(aluno, dados);
        const status = calc.classificacao;

        // Saudação
        document.getElementById("saudacao").textContent = `Olá, ${aluno.nome.split(" ")[0]}!`;
        document.getElementById("avatarAluno").textContent = App.iniciais(aluno.nome);

        const ipaTexto = calc.completo ? IPA.formatarIPA(calc.ipa) : "pendente";

        // Cards
        document.getElementById("cardsAluno").innerHTML = `
            <div class="card-info">
                <i class="fa-solid fa-star"></i>
                <div><h3>${IPA.formatarNumero(calc.mediaGeral, 1)}</h3><span>Média Geral</span></div>
            </div>
            <div class="card-info">
                <i class="fa-solid fa-calendar-check"></i>
                <div><h3>${IPA.ehNumero(calc.indicadores.F) ? IPA.formatarNumero(calc.indicadores.F, 0) + "%" : "—"}</h3><span>Frequência calculada</span></div>
            </div>
            <div class="card-info">
                <i class="fa-solid fa-shield-heart"></i>
                <div><h3>${ipaTexto}</h3><span>IPA</span></div>
            </div>
            <div class="card-info">
                <i class="fa-solid fa-circle-info"></i>
                <div><h3 class="status-text ${status.classe}">${status.texto}</h3><span>Situação</span></div>
            </div>
        `;

        // Painel detalhado do IPA
        const indicadores = ["F", "D", "A", "E"].map(chave => {
            const valor = calc.indicadores[chave];
            return `
                <div class="ipa-indicador">
                    <div class="ipa-indicador-topo">
                        <span>${IPA.ROTULOS[chave]}</span>
                        <strong>${IPA.ehNumero(valor) ? IPA.formatarNumero(valor) + "/100" : "sem dados"}</strong>
                    </div>
                    <div class="barra"><span class="barra-preench ${IPA.ehNumero(valor) ? "green" : ""}" style="width:${IPA.ehNumero(valor) ? valor : 0}%"></span></div>
                    <small>Peso ${Math.round(IPA.PESOS[chave] * 100)}%${calc.completo ? " • contribui " + IPA.formatarNumero(calc.contribuicoes[chave]) + " pontos" : ""}</small>
                </div>
            `;
        }).join("");

        const historico = IPA.serieHistorico(aluno);
        const linhasHistorico = historico.itens.length
            ? historico.itens.slice().reverse().map(h => `
                <tr>
                    <td>${IPA.formatarDataCurta(h.data)}</td>
                    <td>${h.completo ? IPA.formatarIPA(h.ipa) : "incompleto"}</td>
                    <td>${h.classificacao}</td>
                    <td>${h.motivo}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="4">O histórico antigo (demonstrativo) foi preservado. Ainda não há registros calculados.</td></tr>`;

        document.getElementById("painelIPA").innerHTML = `
            <h2>Detalhamento do IPA${aluno.dadosDemonstrativos ? ' <span class="ipa-tag-demo">dados demonstrativos</span>' : ""}</h2>
            <p class="ipa-valor-grande">${calc.completo ? "IPA FINAL: " + IPA.formatarIPA(calc.ipa) : "IPA pendente de dados"}</p>
            <div class="ipa-indicadores">${indicadores}</div>
            <p class="ipa-aviso ${status.classe}">
                ${calc.completo
                    ? status.texto + ". Cálculo: 100 − (Frequência×0,35 + Desempenho×0,30 + Atividades×0,20 + Evolução×0,15)."
                    : "Não há classificação definitiva enquanto faltam dados: " + calc.faltantes.map(f => f.rotulo).join("; ") + "."}
            </p>
            <h3 style="margin-top:22px;">Histórico do IPA</h3>
            <table>
                <thead><tr><th>Data</th><th>IPA</th><th>Classificação</th><th>Motivo</th></tr></thead>
                <tbody>${linhasHistorico}</tbody>
            </table>
        `;

        // Status visual
        const corStatus = status.classe === "green" ? "#14B8A6" : status.classe === "yellow" ? "#F59E0B" : status.classe === "red" ? "#EF4444" : "#94A3B8";
        document.getElementById("statusVisual").innerHTML = `
            <div class="anel" style="--cor:${corStatus}; --valor:${calc.ipa === null ? 0 : calc.ipa}">
                <span class="anel-valor">${calc.ipa === null ? "—" : IPA.formatarIPA(calc.ipa)}</span>
                <span class="anel-label">IPA</span>
            </div>
            <p class="status-msg ${status.classe}">
                ${calc.completo
                    ? (status.classe === "green"
                        ? "Você está indo muito bem! Continue assim."
                        : status.classe === "yellow"
                            ? "Atenção: vale revisar sua rotina de estudos."
                            : "Alerta: procure a coordenação para apoio.")
                    : "Seu IPA ainda está pendente de registros acadêmicos."}
            </p>
            <p class="status-turma"><i class="fa-solid fa-school"></i> ${aluno.turma}</p>
        `;

        // Gráfico de evolução (IPA + Média)
        const serie = IPA.serieHistorico(aluno);
        const tituloEvo = document.getElementById("tituloEvolucao");
        if (tituloEvo && serie.origem === "demonstracao") tituloEvo.textContent = "Sua Evolução (dados demonstrativos)";
        new Chart(document.getElementById("graficoEvolucao"), {
            type: "line",
            data: {
                labels: serie.labels,
                datasets: [
                    {
                        label: "IPA",
                        data: serie.ipa,
                        borderColor: "#2563EB",
                        backgroundColor: "rgba(37,99,235,.12)",
                        fill: true, tension: .4,
                        pointRadius: 4, pointBackgroundColor: "#2563EB",
                        spanGaps: false
                    },
                    {
                        label: "Média",
                        data: serie.media,
                        borderColor: "#14B8A6",
                        backgroundColor: "rgba(20,184,166,.10)",
                        fill: true, tension: .4,
                        pointRadius: 4, pointBackgroundColor: "#14B8A6",
                        spanGaps: false
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
                scales: {
                    y: { min: 0, max: 100, grid: { color: "#E2E8F0" } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Gráfico de notas por disciplina
        const notas = IPA.notasPorDisciplina(aluno);
        const disciplinas = Object.keys(notas);
        const medias = disciplinas.map(d => IPA.media(notas[d]));
        new Chart(document.getElementById("graficoNotas"), {
            type: "bar",
            data: {
                labels: disciplinas,
                datasets: [{
                    label: "Média",
                    data: medias,
                    backgroundColor: medias.map(n => n === null ? "#CBD5E1" : n >= 7 ? "#14B8A6" : n >= 5 ? "#F59E0B" : "#EF4444"),
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 10, grid: { color: "#E2E8F0" } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Registros reais de frequência (presenças e faltas)
        const registrosFrequencia = getRegistrosFrequencia(aluno.id);
        document.getElementById("tabelaFrequenciaAluno").innerHTML = registrosFrequencia.length
            ? registrosFrequencia.map(r => `
                <tr>
                    <td>${IPA.formatarDataCurta(r.data)}</td>
                    <td>${r.disciplina}</td>
                    <td>${r.aulaId || `${r.disciplina}|${r.data}`}</td>
                    <td><span class="status ${r.presenca ? "green" : "red"}">${r.presenca ? "Presença" : "Falta"}</span></td>
                    <td>${r.origem === "professor" ? "Professor" : "Demonstração"}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5">Nenhum registro de presença ou falta lançado.</td></tr>`;

        // Tabela de notas
        document.getElementById("tabelaNotas").innerHTML = disciplinas.map(d => {
            const valores = notas[d];
            const media = IPA.media(valores);
            const cls = media === null ? "" : media >= 7 ? "green" : media >= 5 ? "yellow" : "red";
            const largura = media === null ? 0 : (media / 10) * 100;
            const celulas = valores.map((v, i) => {
                const origem = IPA.provenienciaNota(aluno, d, i + 1);
                const titulo = origem === "professor" ? "Lançado pelo professor" : origem === "demonstracao" ? "Dado demonstrativo" : "";
                return `<td title="${titulo}">${IPA.ehNumero(v) ? v.toFixed(1) : "—"}</td>`;
            }).join("");
            return `
                <tr>
                    <td>${d}</td>
                    ${celulas}
                    <td><strong>${media === null ? "—" : media.toFixed(1)}</strong></td>
                    <td>
                        <div class="barra"><span class="barra-preench ${cls}" style="width:${largura}%"></span></div>
                    </td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="7">Nenhuma nota lançada ainda.</td></tr>`;

        document.getElementById("observacoesAluno").textContent = aluno.observacoes || "";
    }
}
