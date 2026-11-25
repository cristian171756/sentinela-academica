// ==========================================
// SENTINELA ACADÊMICA
// Área do Professor: notas, frequência e atividades
// ==========================================

const sessao = protegerPagina("professor");
if (sessao) {
    const prof = getProfessorPorId(sessao.referencia);
    if (!prof) { encerrarSessao(); }
    else {
        App.initSidebar("notas", "professor");
        const sub = document.getElementById("subProfessor");
        if (sub) sub.textContent = `${prof.nome} • ${prof.disciplinas.join(", ") || "Sem disciplinas"}`;

        const disciplinas = Array.isArray(prof.disciplinas) ? prof.disciplinas : [];
        const turmas = turmasAutorizadasProfessor(prof);
        let atividadeSelecionada = null;
        let atividadeEmEdicao = null;
        let freqEmEdicao = null;

        function mensagem(id, texto, ok) {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = texto;
            el.style.color = ok === false ? "#EF4444" : "#14B8A6";
        }

        function preencherTurmas() {
            ["selectTurmaFreq", "selectTurmaAtv"].forEach(id => {
                const sel = document.getElementById(id);
                if (!sel) return;
                sel.innerHTML = "";
                turmas.forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t;
                    opt.textContent = t;
                    sel.appendChild(opt);
                });
                if (turmas.length === 0) {
                    const opt = document.createElement("option");
                    opt.textContent = "Nenhuma turma autorizada";
                    sel.appendChild(opt);
                }
            });
        }

        function preencherAlunos(sel, turma) {
            if (!sel) return;
            sel.innerHTML = "";
            getAlunos()
                .filter(a => !turma || a.turma === turma)
                .forEach(a => {
                    const opt = document.createElement("option");
                    opt.value = a.id;
                    opt.textContent = `${a.nome} (${a.turma})`;
                    sel.appendChild(opt);
                });
            if (!sel.options.length) {
                const opt = document.createElement("option");
                opt.textContent = "Nenhum aluno nesta turma";
                sel.appendChild(opt);
            }
        }

        function preencherDisciplinas(sel) {
            if (!sel) return;
            sel.innerHTML = "";
            disciplinas.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = d;
                sel.appendChild(opt);
            });
            if (!disciplinas.length) {
                const opt = document.createElement("option");
                opt.textContent = "Sem disciplinas atribuídas";
                sel.appendChild(opt);
            }
        }

        function atualizarDisciplinasDoAluno() {
            preencherDisciplinas(document.getElementById("selectDisciplina"));
        }

        function carregarNotaNoFormulario() {
            const aluno = getAlunoPorId(document.getElementById("selectAluno").value);
            const input = document.getElementById("inputNota");
            if (!aluno || !input) return;
            const disciplina = document.getElementById("selectDisciplina").value;
            const bimestre = Number(document.getElementById("selectBimestre").value);
            const registro = (aluno.registrosNotas || []).find(r =>
                r.disciplina === disciplina && Number(r.bimestre) === bimestre);
            const bruto = (aluno.notas || {})[disciplina];
            const legado = Array.isArray(bruto) ? bruto[bimestre - 1] : bruto;
            const valor = registro ? registro.valor : legado;
            input.value = IPA.ehNumero(valor) ? valor : "";
        }

        function carregarAlunos() {
            preencherAlunos(document.getElementById("selectAluno"), turmas.length === 1 ? turmas[0] : null);
            atualizarDisciplinasDoAluno();
            renderResumoIPA();
        }

        function renderResumoIPA() {
            const el = document.getElementById("conteudoResumoIPA");
            if (!el) return;
            const aluno = getAlunoPorId(document.getElementById("selectAluno").value);
            if (!aluno) {
                el.innerHTML = `<p class="ipa-aviso">Selecione um aluno para consultar o IPA.</p>`;
                return;
            }
            const r = IPA.calcularPara(aluno, carregarDados());
            const itens = ["F", "D", "A", "E"].map(chave => `
                <div class="ipa-indicador">
                    <div class="ipa-indicador-topo">
                        <span>${IPA.ROTULOS[chave]}</span>
                        <strong>${IPA.ehNumero(r.indicadores[chave]) ? IPA.formatarNumero(r.indicadores[chave]) + "/100" : "sem dados"}</strong>
                    </div>
                    <div class="barra"><span class="barra-preench ${IPA.ehNumero(r.indicadores[chave]) ? "green" : ""}" style="width:${IPA.ehNumero(r.indicadores[chave]) ? r.indicadores[chave] : 0}%"></span></div>
                    <small>Peso ${Math.round(IPA.PESOS[chave] * 100)}%</small>
                </div>
            `).join("");

            el.innerHTML = `
                <p><strong>${aluno.nome}</strong> • ${aluno.turma}${aluno.dadosDemonstrativos ? ' <span class="ipa-tag-demo">dados demonstrativos</span>' : ""}</p>
                <p class="ipa-valor-grande">${r.completo ? "IPA FINAL: " + IPA.formatarIPA(r.ipa) : "IPA pendente de dados"}</p>
                <div class="ipa-indicadores">${itens}</div>
                <p class="ipa-aviso ${r.classificacao.classe}">
                    ${r.completo
                        ? r.classificacao.texto
                        : "Faltam registros para: " + r.faltantes.map(f => f.rotulo).join("; ") + "."}
                </p>
            `;
        }

        // ===== Notas =====
        function renderTabela() {
            const tbody = document.getElementById("tabelaProfessor");
            if (!tbody) return;
            const rows = [];
            getAlunos().filter(a => turmas.includes(a.turma)).forEach(a => {
                const notas = IPA.notasPorDisciplina(a);
                disciplinas.forEach(d => {
                    const valores = notas[d];
                    if (!valores || !valores.some(IPA.ehNumero)) return;
                    const m = IPA.media(valores);
                    const origens = Array.from(new Set(valores
                        .map((_, indice) => IPA.provenienciaNota(a, d, indice))
                        .filter(Boolean)));
                    const origem = origens.length === 0 ? "—"
                        : origens.length === 1
                            ? (origens[0] === "professor" ? "Professor" : "Demonstração")
                            : "Misto";
                    const celulas = valores.map((v, indice) => {
                        const registro = (a.registrosNotas || []).find(r =>
                            r.disciplina === d && Number(r.bimestre) === indice + 1);
                        return `<td>
                            <button type="button" class="btn-nota-cell" data-aluno="${a.id}" data-disc="${d}" data-bim="${indice + 1}"
                                title="Carregar esta nota no formulário">${IPA.ehNumero(v) ? v.toFixed(1) : "—"}</button>
                            ${registro ? `<button type="button" class="btn-excluir-nota" data-aluno="${a.id}" data-id="${registro.id}" title="Excluir nota"><i class="fa-solid fa-trash"></i></button>` : ""}
                        </td>`;
                    }).join("");
                    rows.push(`
                        <tr>
                            <td>${a.nome}</td>
                            <td>${a.turma}</td>
                            <td>${d}</td>
                            ${celulas}
                            <td><strong>${m === null ? "—" : m.toFixed(1)}</strong></td>
                            <td>${origem}</td>
                            <td>—</td>
                        </tr>
                    `);
                });
            });
            tbody.innerHTML = rows.join("") || `<tr><td colspan="10">Nenhuma nota lançada.</td></tr>`;

            tbody.querySelectorAll(".btn-nota-cell").forEach(btn => {
                btn.addEventListener("click", () => {
                    document.getElementById("selectAluno").value = btn.dataset.aluno;
                    preencherDisciplinas(document.getElementById("selectDisciplina"));
                    document.getElementById("selectDisciplina").value = btn.dataset.disc;
                    document.getElementById("selectBimestre").value = btn.dataset.bim;
                    carregarNotaNoFormulario();
                    renderResumoIPA();
                    mensagem("msgNota", "Nota carregada no formulário. Altere o valor e salve para editar.", true);
                });
            });

            tbody.querySelectorAll(".btn-excluir-nota").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (!confirm("Excluir esta nota? O IPA será recalculado.")) return;
                    try {
                        removerNota({
                            professorId: prof.id,
                            alunoId: btn.dataset.aluno,
                            registroId: btn.dataset.id
                        });
                        mensagem("msgNota", "Nota excluída e IPA recalculado.", true);
                        renderTabela();
                        renderResumoIPA();
                        atualizarGraficos();
                    } catch (erro) {
                        mensagem("msgNota", erro.message, false);
                    }
                });
            });
        }

        // ===== Frequência =====
        function renderFrequencia() {
            const tbody = document.getElementById("tabelaFrequencia");
            const aluno = getAlunoPorId(document.getElementById("selectAlunoFreq").value);
            if (!tbody) return;
            if (!aluno) {
                tbody.innerHTML = `<tr><td colspan="6">Selecione um aluno.</td></tr>`;
                return;
            }
            const registros = getRegistrosFrequencia(aluno.id);
            tbody.innerHTML = registros.map(r => `
                <tr>
                    <td>${IPA.formatarDataCurta(r.data)}</td>
                    <td>${r.disciplina}</td>
                    <td>${r.aulaId || `${r.disciplina}|${r.data}`}</td>
                    <td>${r.presenca ? "Presença" : "Falta"}</td>
                    <td>${r.origem === "professor" ? "Professor" : "Demonstração"}</td>
                    <td>
                        <button type="button" class="btn-editar-freq" data-id="${r.id}" title="Corrigir registro"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="btn-excluir-freq" data-id="${r.id}" title="Excluir registro"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `).join("") || `<tr><td colspan="6">Nenhum registro de frequência para este aluno.</td></tr>`;

            tbody.querySelectorAll(".btn-editar-freq").forEach(btn => {
                btn.addEventListener("click", () => {
                    const registro = registros.find(r => String(r.id) === btn.dataset.id);
                    if (!registro) return;
                    document.getElementById("selectDiscFreq").value = registro.disciplina;
                    document.getElementById("inputDataFreq").value = registro.data;
                    document.getElementById("inputAulaFreq").value = registro.aulaId || `${registro.disciplina}|${registro.data}`;
                    document.getElementById("selectPresenca").value = registro.presenca ? "presente" : "falta";
                    freqEmEdicao = registro.id;
                    document.getElementById("btnSalvarFreq").textContent = "Salvar Correção";
                    mensagem("msgFrequencia", "Registro carregado para correção. Salve para atualizar.", true);
                });
            });

            tbody.querySelectorAll(".btn-excluir-freq").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (!confirm("Excluir este registro de frequência? O IPA será recalculado.")) return;
                    try {
                        removerRegistroFrequencia({ professorId: prof.id, registroId: btn.dataset.id });
                        mensagem("msgFrequencia", "Registro excluído e IPA recalculado.", true);
                        if (String(freqEmEdicao) === String(btn.dataset.id)) freqEmEdicao = null;
                        document.getElementById("btnSalvarFreq").textContent = "Salvar Frequência";
                        renderFrequencia();
                        renderResumoIPA();
                        atualizarGraficos();
                    } catch (erro) {
                        mensagem("msgFrequencia", erro.message, false);
                    }
                });
            });
        }

        // ===== Atividades e entregas =====
        function renderAtividades() {
            const container = document.getElementById("listaAtividadesProfessor");
            if (!container) return;
            const minhas = getAtividades().filter(a =>
                String(a.professorId) === String(prof.id) || turmas.includes(a.turma)
            );
            container.innerHTML = minhas.map(a => {
                const vencida = a.dataEntrega <= IPA.hojeISO();
                const responsavel = String(a.professorId) === String(prof.id);
                return `
                    <div class="ipa-atividade">
                        <div>
                            <strong>${a.titulo}${atividadeEmEdicao === Number(a.id) ? " (em edição)" : ""}</strong>
                            <p>${a.descricao || "Sem descrição"}</p>
                            <small>${a.disciplina} • ${a.turma} • Entrega: ${IPA.formatarDataCurta(a.dataEntrega)} ${vencida ? "" : "(ainda não vencida)"}</small>
                        </div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            <button type="button" class="btn btn-ver-entregas" data-id="${a.id}" style="width:auto;margin:0;">Ver entregas</button>
                            ${responsavel ? `<button type="button" class="btn btn-editar-atv" data-id="${a.id}" style="width:auto;margin:0;background:#2563EB;">Editar</button>
                            <button type="button" class="btn btn-excluir-atv" data-id="${a.id}" style="width:auto;margin:0;background:#EF4444;">Excluir</button>` : ""}
                        </div>
                    </div>
                `;
            }).join("") || `<p class="ipa-aviso">Nenhuma atividade cadastrada.</p>`;

            container.querySelectorAll(".btn-ver-entregas").forEach(btn => {
                btn.addEventListener("click", () => abrirEntregas(Number(btn.dataset.id)));
            });

            container.querySelectorAll(".btn-editar-atv").forEach(btn => {
                btn.addEventListener("click", () => {
                    const atividade = getAtividades().find(a => String(a.id) === btn.dataset.id);
                    if (!atividade) return;
                    atividadeEmEdicao = Number(atividade.id);
                    document.getElementById("inputTituloAtv").value = atividade.titulo;
                    document.getElementById("inputDescricaoAtv").value = atividade.descricao || "";
                    document.getElementById("selectDiscAtv").value = atividade.disciplina;
                    document.getElementById("selectTurmaAtv").value = atividade.turma;
                    document.getElementById("inputDataAtv").value = atividade.dataEntrega;
                    document.getElementById("btnSalvarAtividade").textContent = "Salvar Alterações";
                    document.getElementById("btnCancelarEdicaoAtv").style.display = "";
                    mensagem("msgAtividade", "Atividade carregada para edição. Altere os campos e salve.", true);
                    renderAtividades();
                });
            });

            container.querySelectorAll(".btn-excluir-atv").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (!confirm("Excluir esta atividade e todas as entregas associadas? O IPA será recalculado.")) return;
                    try {
                        removerAtividade({ professorId: prof.id, atividadeId: btn.dataset.id });
                        if (atividadeSelecionada && String(atividadeSelecionada.id) === btn.dataset.id) {
                            atividadeSelecionada = null;
                            document.getElementById("painelEntregas").style.display = "none";
                        }
                        mensagem("msgAtividade", "Atividade excluída e IPA recalculado.", true);
                        renderAtividades();
                        renderResumoIPA();
                    } catch (erro) {
                        mensagem("msgAtividade", erro.message, false);
                    }
                });
            });
        }

        function abrirEntregas(id) {
            const atividade = getAtividades().find(a => String(a.id) === String(id));
            if (!atividade) return;
            atividadeSelecionada = atividade;
            document.getElementById("painelEntregas").style.display = "";
            document.getElementById("tituloEntregas").textContent = `Entregas: ${atividade.titulo}`;
            preencherAlunos(document.getElementById("selectAlunoEntrega"), atividade.turma);
            renderEntregas();
        }

        function renderEntregas() {
            const tbody = document.getElementById("tabelaEntregas");
            if (!tbody || !atividadeSelecionada) return;
            const entregas = getEntregasDaAtividade(atividadeSelecionada.id);
            const alunos = getAlunos().filter(a => a.turma === atividadeSelecionada.turma);
            tbody.innerHTML = alunos.map(a => {
                const entrega = entregas.find(e => String(e.alunoId) === String(a.id));
                const status = entrega ? entrega.status : "pendente";
                const rotulo = status === "entregue" ? "Entregue" : status === "atrasada" ? "Atrasada" : "Pendente";
                return `
                    <tr data-aluno-id="${a.id}">
                        <td>${a.nome}</td>
                        <td><span class="status ${status === "entregue" ? "green" : status === "atrasada" ? "yellow" : ""}">${rotulo}</span></td>
                        <td>${entrega && entrega.atualizadoEm ? IPA.formatarDataCurta(entrega.atualizadoEm) : "—"}</td>
                        <td>${entrega ? `<button type="button" class="btn-excluir-entrega" data-id="${entrega.id}" title="Voltar para pendente"><i class="fa-solid fa-trash"></i></button>` : "—"}</td>
                    </tr>
                `;
            }).join("") || `<tr><td colspan="4">Nenhum aluno nesta turma.</td></tr>`;

            tbody.querySelectorAll(".btn-excluir-entrega").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (!confirm("Remover esta entrega? O aluno voltará para 'pendente' e o IPA será recalculado.")) return;
                    try {
                        removerEntrega({ professorId: prof.id, entregaId: btn.dataset.id });
                        mensagem("msgEntrega", "Entrega removida e IPA recalculado.", true);
                        renderEntregas();
                        document.getElementById("selectAluno").value = btn.closest("tr").dataset.alunoId || document.getElementById("selectAluno").value;
                        renderResumoIPA();
                    } catch (erro) {
                        mensagem("msgEntrega", erro.message, false);
                    }
                });
            });
        }

        // ===== Inicialização =====
        preencherTurmas();
        if (turmas.length === 0) {
            ["msgNota", "msgFrequencia", "msgAtividade", "msgEntrega"].forEach(id =>
                mensagem(id, "Nenhuma turma autorizada. Procure a coordenação para vincular suas turmas.", false));
        }
        carregarAlunos();
        carregarNotaNoFormulario();
        renderTabela();

        preencherAlunos(document.getElementById("selectAlunoFreq"), turmas[0]);
        preencherDisciplinas(document.getElementById("selectDiscFreq"));
        document.getElementById("inputDataFreq").value = IPA.hojeISO();
        renderFrequencia();

        preencherDisciplinas(document.getElementById("selectDiscAtv"));
        document.getElementById("inputDataAtv").value = IPA.hojeISO();
        renderAtividades();

        document.getElementById("selectAluno").addEventListener("change", () => {
            atualizarDisciplinasDoAluno();
            carregarNotaNoFormulario();
            renderResumoIPA();
        });
        document.getElementById("selectDisciplina").addEventListener("change", carregarNotaNoFormulario);
        document.getElementById("selectBimestre").addEventListener("change", carregarNotaNoFormulario);
        document.getElementById("selectTurmaFreq").addEventListener("change", e => {
            freqEmEdicao = null;
            document.getElementById("btnSalvarFreq").textContent = "Salvar Frequência";
            preencherAlunos(document.getElementById("selectAlunoFreq"), e.target.value);
            renderFrequencia();
        });
        document.getElementById("selectAlunoFreq").addEventListener("change", () => {
            freqEmEdicao = null;
            document.getElementById("btnSalvarFreq").textContent = "Salvar Frequência";
            renderFrequencia();
        });
        document.getElementById("selectTurmaAtv").addEventListener("change", e => {
            const disc = document.getElementById("selectDiscAtv");
            preencherDisciplinas(disc);
        });

        document.getElementById("formNota").addEventListener("submit", e => {
            e.preventDefault();
            try {
                registrarNota({
                    professorId: prof.id,
                    alunoId: document.getElementById("selectAluno").value,
                    disciplina: document.getElementById("selectDisciplina").value,
                    bimestre: Number(document.getElementById("selectBimestre").value),
                    valor: document.getElementById("inputNota").value
                });
                mensagem("msgNota", "Nota salva! O IPA foi recalculado automaticamente.", true);
                document.getElementById("inputNota").value = "";
                renderTabela();
                renderResumoIPA();
                atualizarGraficos();
            } catch (erro) {
                mensagem("msgNota", erro.message, false);
            }
        });

        document.getElementById("formFrequencia").addEventListener("submit", e => {
            e.preventDefault();
            try {
                registrarFrequencia({
                    professorId: prof.id,
                    alunoId: document.getElementById("selectAlunoFreq").value,
                    disciplina: document.getElementById("selectDiscFreq").value,
                    data: document.getElementById("inputDataFreq").value,
                    aulaId: document.getElementById("inputAulaFreq").value,
                    presenca: document.getElementById("selectPresenca").value,
                    registroId: freqEmEdicao
                });
                mensagem("msgFrequencia", "Frequência salva! O IPA foi recalculado automaticamente.", true);
                document.getElementById("inputAulaFreq").value = "";
                freqEmEdicao = null;
                document.getElementById("btnSalvarFreq").textContent = "Salvar Frequência";
                renderFrequencia();
                renderResumoIPA();
                atualizarGraficos();
            } catch (erro) {
                mensagem("msgFrequencia", erro.message, false);
            }
        });

        document.getElementById("formAtividade").addEventListener("submit", e => {
            e.preventDefault();
            try {
                const campos = {
                    professorId: prof.id,
                    titulo: document.getElementById("inputTituloAtv").value,
                    descricao: document.getElementById("inputDescricaoAtv").value,
                    disciplina: document.getElementById("selectDiscAtv").value,
                    turma: document.getElementById("selectTurmaAtv").value,
                    dataEntrega: document.getElementById("inputDataAtv").value
                };
                if (atividadeEmEdicao !== null) {
                    atualizarAtividade(atividadeEmEdicao, campos);
                    mensagem("msgAtividade", "Atividade atualizada! O IPA foi recalculado.", true);
                } else {
                    cadastrarAtividade(campos);
                    mensagem("msgAtividade", "Atividade cadastrada! O indicador de entregas foi atualizado.", true);
                }
                document.getElementById("formAtividade").reset();
                document.getElementById("inputDataAtv").value = IPA.hojeISO();
                atividadeEmEdicao = null;
                document.getElementById("btnSalvarAtividade").textContent = "Cadastrar Atividade";
                document.getElementById("btnCancelarEdicaoAtv").style.display = "none";
                renderAtividades();
                renderResumoIPA();
            } catch (erro) {
                mensagem("msgAtividade", erro.message, false);
            }
        });

        document.getElementById("btnCancelarEdicaoAtv").addEventListener("click", () => {
            document.getElementById("formAtividade").reset();
            document.getElementById("inputDataAtv").value = IPA.hojeISO();
            atividadeEmEdicao = null;
            document.getElementById("btnSalvarAtividade").textContent = "Cadastrar Atividade";
            document.getElementById("btnCancelarEdicaoAtv").style.display = "none";
            renderAtividades();
            mensagem("msgAtividade", "Edição cancelada.", true);
        });

        document.getElementById("formEntrega").addEventListener("submit", e => {
            e.preventDefault();
            try {
                const alunoId = document.getElementById("selectAlunoEntrega").value;
                registrarEntrega({
                    professorId: prof.id,
                    atividadeId: atividadeSelecionada.id,
                    alunoId,
                    status: document.getElementById("selectStatusEntrega").value
                });
                mensagem("msgEntrega", "Entrega salva! O IPA do aluno foi recalculado.", true);
                renderEntregas();
                document.getElementById("selectAluno").value = alunoId;
                renderResumoIPA();
            } catch (erro) {
                mensagem("msgEntrega", erro.message, false);
            }
        });

        // ==========================================
        // SISTEMA DE GRÁFICOS DO PROFESSOR
        // ==========================================

        const TIPOS_GRAFICO = {
            notasDisciplina: { titulo: "Minhas Disciplinas", tipo: "bar" },
            desempenhoAlunos: { titulo: "Desempenho dos Alunos", tipo: "bar" },
            distribuicaoNotas: { titulo: "Distribuição de Notas", tipo: "doughnut" },
            frequenciaAlunos: { titulo: "Frequência dos Alunos", tipo: "bar" }
        };

        let chartPrincipal = null;
        let chartComparacao = null;

        function getAlunosDoProfessor() {
            return getAlunos().filter(a => turmas.includes(a.turma));
        }

        function getDadosGrafico(tipo) {
            const alunosProf = getAlunosDoProfessor();

            switch (tipo) {
                case "notasDisciplina": {
                    const medias = disciplinas.map(d => {
                        const valores = [];
                        alunosProf.forEach(a => {
                            const notas = IPA.notasPorDisciplina(a)[d];
                            if (notas) {
                                const m = IPA.media(notas);
                                if (m !== null) valores.push(m);
                            }
                        });
                        return valores.length ? IPA.media(valores) : null;
                    });
                    return { labels: disciplinas, data: medias, cor: "#2563EB" };
                }

                case "desempenhoAlunos": {
                    const medias = [];
                    const nomes = [];
                    alunosProf.forEach(a => {
                        const m = IPA.mediaGeral(a);
                        if (m !== null) {
                            medias.push(m);
                            nomes.push(a.nome.split(" ")[0]);
                        }
                    });
                    return { labels: nomes, data: medias, cor: "#14B8A6" };
                }

                case "distribuicaoNotas": {
                    let baixas = 0, medias = 0, boas = 0;
                    alunosProf.forEach(a => {
                        const m = IPA.mediaGeral(a);
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

                case "frequenciaAlunos": {
                    const faixas = ["< 60%", "60-70%", "70-80%", "80-90%", "90-100%", "sem dados"];
                    const contagem = [0, 0, 0, 0, 0, 0];
                    alunosProf.forEach(a => {
                        const f = IPA.calcularF(a);
                        if (f === null) contagem[5]++;
                        else if (f < 60) contagem[0]++;
                        else if (f < 70) contagem[1]++;
                        else if (f < 80) contagem[2]++;
                        else if (f < 90) contagem[3]++;
                        else contagem[4]++;
                    });
                    return { labels: faixas, data: contagem, cor: "#7C3AED" };
                }

                default:
                    return { labels: [], data: [], cor: "#2563EB" };
            }
        }

        function criarGrafico(canvasId, tipo) {
            const dados = getDadosGrafico(tipo);
            const info = TIPOS_GRAFICO[tipo];
            const ctx = document.getElementById(canvasId);
            const isDoughnut = info.tipo === "doughnut";

            return new Chart(ctx, {
                type: info.tipo,
                data: {
                    labels: dados.labels,
                    datasets: [{
                        label: info.titulo,
                        data: dados.data,
                        backgroundColor: isDoughnut ? dados.cores : dados.cor + "CC",
                        borderColor: isDoughnut ? "#fff" : dados.cor,
                        borderWidth: isDoughnut ? 2 : 1,
                        borderRadius: isDoughnut ? 0 : 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom", display: isDoughnut } },
                    scales: isDoughnut ? {} : {
                        y: { beginAtZero: true, grid: { color: "#E2E8F0" } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        function atualizarGraficos() {
            const tipoPrincipal = document.getElementById("graficoPrincipal").value;
            const tipoComparacao = document.getElementById("graficoComparacao").value;

            document.getElementById("tituloPrincipal").textContent = TIPOS_GRAFICO[tipoPrincipal].titulo;

            if (chartPrincipal) chartPrincipal.destroy();
            chartPrincipal = criarGrafico("canvasPrincipal", tipoPrincipal);

            const boxComparacao = document.getElementById("boxComparacao");
            if (tipoComparacao && tipoComparacao !== tipoPrincipal) {
                boxComparacao.style.display = "";
                document.getElementById("tituloComparacao").textContent = TIPOS_GRAFICO[tipoComparacao].titulo;
                if (chartComparacao) chartComparacao.destroy();
                chartComparacao = criarGrafico("canvasComparacao", tipoComparacao);
            } else {
                boxComparacao.style.display = "none";
                if (chartComparacao) { chartComparacao.destroy(); chartComparacao = null; }
            }
        }

        document.getElementById("graficoPrincipal").addEventListener("change", atualizarGraficos);
        document.getElementById("graficoComparacao").addEventListener("change", atualizarGraficos);

        atualizarGraficos();
    }
}
