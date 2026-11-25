// ==========================================
// SENTINELA ACADÊMICA
// Perfil do Aluno — detalhamento do IPA
// ==========================================

const sessao = protegerPagina(["coordenacao", "aluno"]);
if (sessao) {
    App.initSidebar(sessao.tipo === "aluno" ? "perfil" : "alunos",
                    sessao.tipo === "aluno" ? "aluno" : "coordenacao");

    let aluno;

    if (sessao.tipo === "aluno") {
        aluno = getAlunoPorId(sessao.referencia);
        document.getElementById("btnVoltar").style.display = "none";
        document.getElementById("subPerfil").textContent = "Seu desempenho escolar.";
    } else {
        const params = new URLSearchParams(window.location.search);
        aluno = getAlunoPorId(params.get("id")) || getAlunos()[0];
        document.getElementById("subPerfil").textContent = "Detalhes do estudante.";
    }

    if (!aluno) {
        window.location.href = homePorTipo(sessao.tipo);
    } else {
        const calc = IPA.calcularPara(aluno, carregarDados());
        const st = calc.classificacao;

        document.getElementById("perfilCard").innerHTML = `
            <div class="perfil-topo">
                <div class="avatar">${App.iniciais(aluno.nome)}</div>
                <div>
                    <h2>${aluno.nome}</h2>
                    <p>${aluno.turma} &middot; Mat. ${aluno.matricula}</p>
                    <span class="status-pill ${st.classe}">${st.texto}</span>
                    ${aluno.dadosDemonstrativos ? '<span class="ipa-tag-demo">dados demonstrativos</span>' : ""}
                </div>
            </div>
            <div class="perfil-grid">
                <div class="info-box">
                    <h3>Média Geral</h3>
                    <span>${IPA.formatarNumero(calc.mediaGeral, 1)}</span>
                </div>
                <div class="info-box">
                    <h3>Frequência calculada</h3>
                    <span>${IPA.ehNumero(calc.indicadores.F) ? IPA.formatarNumero(calc.indicadores.F, 0) + "%" : "—"}</span>
                </div>
                <div class="info-box">
                    <h3>IPA</h3>
                    <span class="status-text ${st.classe}">${calc.completo ? IPA.formatarIPA(calc.ipa) : "pendente"}</span>
                </div>
            </div>
            <h3 style="margin-top:35px;">Observações</h3>
            <p>${aluno.observacoes || ""}</p>
        `;

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

        const serie = IPA.serieHistorico(aluno);
        const historico = serie.itens.length
            ? serie.itens.slice().reverse().map(h => `
                <tr>
                    <td>${IPA.formatarDataCurta(h.data)}</td>
                    <td>${h.completo ? IPA.formatarIPA(h.ipa) : "incompleto"}</td>
                    <td>${IPA.formatarNumero(h.indicadores.F)} / ${IPA.formatarNumero(h.indicadores.D)} / ${IPA.formatarNumero(h.indicadores.A)} / ${IPA.formatarNumero(h.indicadores.E)}</td>
                    <td>${h.classificacao}</td>
                    <td>${h.motivo}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="5">Nenhum registro calculado ainda. O histórico demonstrativo original foi preservado.</td></tr>`;

        const maiorContribuicao = calc.completo
            ? ["F", "D", "A", "E"].reduce((melhor, chave) =>
                calc.contribuicoes[chave] > calc.contribuicoes[melhor] ? chave : melhor, "F")
            : null;

        document.getElementById("painelIPAPerfil").innerHTML = `
            <h2>Índice Preventivo Acadêmico</h2>
            <p class="ipa-valor-grande">${calc.completo ? "IPA FINAL: " + IPA.formatarIPA(calc.ipa) : "IPA pendente de dados"}</p>
            <div class="ipa-indicadores">${indicadores}</div>
            <p class="ipa-aviso ${st.classe}">
                ${calc.completo
                    ? st.texto + (maiorContribuicao ? ". Maior contribuição para o IPA: " + IPA.ROTULOS[maiorContribuicao] + " (" + IPA.formatarNumero(calc.contribuicoes[maiorContribuicao]) + " pontos)." : "")
                    : "Não há classificação definitiva. Faltam: " + calc.faltantes.map(f => f.rotulo).join("; ") + "."}
            </p>
            <p style="font-size:13px;color:#64748b;">
                Como o resultado é calculado: 100 − (Frequência × 0,35 + Desempenho × 0,30 +
                Entrega de atividades × 0,20 + Evolução × 0,15). Cada indicador vai de 0 a 100;
                quanto maior o IPA, maior a necessidade de acompanhamento.
            </p>
            <h3 style="margin-top:22px;">Histórico do IPA</h3>
            <table>
                <thead><tr><th>Data</th><th>IPA</th><th>F/D/A/E</th><th>Classificação</th><th>Motivo</th></tr></thead>
                <tbody>${historico}</tbody>
            </table>
        `;

        const titulo = document.getElementById("tituloEvolucaoPerfil");
        if (titulo && serie.origem === "demonstracao") titulo.textContent = "Evolução do IPA (dados demonstrativos)";

        new Chart(document.getElementById("graficoPerfil"), {
            type: "line",
            data: {
                labels: serie.labels,
                datasets: [{
                    label: "IPA",
                    data: serie.ipa,
                    borderColor: "#090E3F",
                    backgroundColor: "rgba(9,14,63,.08)",
                    fill: true, tension: .4,
                    pointRadius: 4, pointBackgroundColor: "#F5C400",
                    spanGaps: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 100, grid: { color: "#E2E8F0" } },
                    x: { grid: { display: false } }
                }
            }
        });

        const notas = IPA.notasPorDisciplina(aluno);
        document.getElementById("tabelaPerfil").innerHTML = Object.keys(notas).map(d => {
            const valores = notas[d];
            const n = IPA.media(valores);
            const cls = n === null ? "" : n >= 7 ? "green" : n >= 5 ? "yellow" : "red";
            return `
                <tr>
                    <td>${d}</td>
                    ${valores.map((v, i) => {
                        const origem = IPA.provenienciaNota(aluno, d, i + 1);
                        const titulo = origem === "professor" ? "Lançado pelo professor" : origem === "demonstracao" ? "Dado demonstrativo" : "";
                        return `<td title="${titulo}">${IPA.ehNumero(v) ? v.toFixed(1) : "—"}</td>`;
                    }).join("")}
                    <td><strong>${n === null ? "—" : n.toFixed(1)}</strong></td>
                    <td><div class="barra"><span class="barra-preench ${cls}" style="width:${n === null ? 0 : (n / 10) * 100}%"></span></div></td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="7">Nenhuma nota lançada ainda.</td></tr>`;
    }
}
