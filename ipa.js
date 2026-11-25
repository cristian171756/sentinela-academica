// ==========================================
// SENTINELA ACADÊMICA
// IPA dinâmico — módulo central de cálculo
// Fonte única de verdade para todas as telas
// ==========================================

(function (global) {
    "use strict";

    // Pesos oficiais. Nenhuma outra tela deve declarar estes valores.
    const PESOS = Object.freeze({ F: 0.35, D: 0.30, A: 0.20, E: 0.15 });

    const ROTULOS = Object.freeze({
        F: "Frequência escolar",
        D: "Desempenho acadêmico",
        A: "Entrega de atividades",
        E: "Evolução do rendimento"
    });

    const FALTANTES = Object.freeze({
        F: "Frequência escolar (registros de presença/falta)",
        D: "Desempenho acadêmico (notas lançadas)",
        A: "Entrega de atividades (atividade com prazo vencido)",
        E: "Evolução do rendimento (notas em pelo menos dois bimestres)"
    });

    const CLASSIFICACOES = Object.freeze({
        baixa: { chave: "baixa", classe: "green", texto: "Baixa necessidade de acompanhamento" },
        moderada: { chave: "moderada", classe: "yellow", texto: "Necessidade moderada de acompanhamento" },
        alta: { chave: "alta", classe: "red", texto: "Alta necessidade de acompanhamento" },
        incompleto: { chave: "incompleto", classe: "gray", texto: "IPA pendente de dados" }
    });

    function ehNumero(v) {
        return typeof v === "number" && Number.isFinite(v);
    }

    function limitar(v, min, max) {
        return Math.min(max, Math.max(min, v));
    }

    function arredondar2(v) {
        return Math.round((v + Number.EPSILON) * 100) / 100;
    }

    function media(valores) {
        const nums = valores.filter(ehNumero);
        if (nums.length === 0) return null;
        return nums.reduce((soma, v) => soma + v, 0) / nums.length;
    }

    function dataISOValida(valor) {
        if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
        const data = new Date(valor + "T00:00:00");
        return !isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
    }

    function hojeISO() {
        const d = new Date();
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const dia = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${mes}-${dia}`;
    }

    function notaValida(registro) {
        return !!registro &&
            typeof registro.disciplina === "string" &&
            registro.disciplina.trim().length > 0 &&
            Number.isInteger(registro.bimestre) &&
            registro.bimestre >= 1 && registro.bimestre <= 4 &&
            ehNumero(registro.valor) && registro.valor >= 0 && registro.valor <= 10;
    }

    // Projeção das notas: snapshot demonstrativo + lançamentos do professor.
    // O array original de cada disciplina nunca é alterado aqui.
    function notasPorDisciplina(aluno) {
        const mapa = {};
        const legado = (aluno && aluno.notas) || {};

        Object.keys(legado).forEach(disciplina => {
            const bruto = legado[disciplina];
            const valores = Array.isArray(bruto) ? bruto : [bruto];
            const quatro = [null, null, null, null];
            valores.forEach((v, i) => { if (i < 4 && ehNumero(v)) quatro[i] = v; });
            mapa[disciplina] = quatro;
        });

        const registros = (aluno && aluno.registrosNotas) || [];
        registros.filter(notaValida).forEach(r => {
            if (!mapa[r.disciplina]) mapa[r.disciplina] = [null, null, null, null];
            mapa[r.disciplina][r.bimestre - 1] = r.valor;
        });

        Object.keys(mapa).forEach(d => {
            if (!mapa[d].some(ehNumero)) delete mapa[d];
        });

        return mapa;
    }

    function provenienciaNota(aluno, disciplina, bimestre) {
        const registro = ((aluno && aluno.registrosNotas) || []).find(r =>
            notaValida(r) && r.disciplina === disciplina && r.bimestre === bimestre
        );
        if (registro) return registro.origem === "professor" ? "professor" : "demonstracao";
        const bruto = ((aluno && aluno.notas) || {})[disciplina];
        const valores = Array.isArray(bruto) ? bruto : [bruto];
        return ehNumero(valores[bimestre - 1]) ? "demonstracao" : null;
    }

    // Média geral (0 a 10): média das médias das disciplinas com registros válidos.
    function mediaGeral(aluno) {
        const porDisciplina = notasPorDisciplina(aluno);
        const medias = Object.keys(porDisciplina)
            .map(d => media(porDisciplina[d]))
            .filter(ehNumero);
        return medias.length ? arredondar2(media(medias)) : null;
    }

    function mediasPorBimestre(aluno) {
        const porDisciplina = notasPorDisciplina(aluno);
        return [1, 2, 3, 4].map(b => {
            const valores = Object.keys(porDisciplina)
                .map(d => porDisciplina[d][b - 1])
                .filter(ehNumero);
            return valores.length ? arredondar2(media(valores)) : null;
        });
    }

    // Indicadores (0 a 100) -------------------------------------------------

    function calcularF(aluno) {
        const registros = ((aluno && aluno.registrosFrequencia) || []).filter(r =>
            r && dataISOValida(r.data) && typeof r.presenca === "boolean"
        );
        if (registros.length === 0) return null;
        const presencas = registros.filter(r => r.presenca).length;
        return arredondar2((presencas / registros.length) * 100);
    }

    function calcularD(aluno) {
        const m = mediaGeral(aluno);
        return m === null ? null : arredondar2(m * 10);
    }

    // A atribuição é pela turma (e pela autorização da disciplina no cadastro
    // da atividade). A ausência de notas na disciplina não pode descartar uma
    // entrega real: isso transformaria um indicador ausente em zero encoberto.
    function alunoAtribuidoAAtividade(aluno, atividade) {
        if (!aluno || !atividade) return false;
        if (atividade.turma && aluno.turma !== atividade.turma) return false;
        return true;
    }

    // Regra documentada: apenas atividades com prazo vencido entram no cálculo.
    // "entregue" = no prazo; "atrasada" = entregue fora do prazo (sinalizada,
    // mas conta como entrega); "pendente" = sem entrega (0 pontos).
    function calcularA(aluno, dados) {
        const hoje = hojeISO();
        const atividades = (((dados && dados.atividades) || []).filter(a =>
            a && dataISOValida(a.dataEntrega) && a.dataEntrega <= hoje && alunoAtribuidoAAtividade(aluno, a)
        ));
        if (atividades.length === 0) return null;

        const entregas = (dados && dados.entregas) || [];
        let entregues = 0;
        atividades.forEach(a => {
            const entrega = entregas.find(e =>
                e && String(e.atividadeId) === String(a.id) && String(e.alunoId) === String(aluno.id) &&
                (e.status === "entregue" || e.status === "atrasada")
            );
            if (entrega) entregues++;
        });

        return arredondar2((entregues / atividades.length) * 100);
    }

    // E = limitar(50 + (média atual - média anterior) * 10, 0, 100)
    // Período atual = maior bimestre com notas válidas; anterior = maior
    // bimestre válido anterior a ele. Sem dois períodos, indicador fica nulo.
    function calcularE(aluno) {
        const medias = mediasPorBimestre(aluno);
        let atual = -1;
        for (let i = 3; i >= 0; i--) { if (ehNumero(medias[i])) { atual = i; break; } }
        if (atual < 1) return null;

        let anterior = -1;
        for (let i = atual - 1; i >= 0; i--) { if (ehNumero(medias[i])) { anterior = i; break; } }
        if (anterior < 0) return null;

        return limitar(arredondar2(50 + (medias[atual] - medias[anterior]) * 10), 0, 100);
    }

    // Composição final ------------------------------------------------------

    function dadosFaltantes(indicadores) {
        return ["F", "D", "A", "E"]
            .filter(chave => !ehNumero(indicadores[chave]))
            .map(chave => ({ chave, rotulo: FALTANTES[chave] }));
    }

    function classificar(ipa) {
        if (!ehNumero(ipa)) return Object.assign({}, CLASSIFICACOES.incompleto);
        if (ipa >= 70) return Object.assign({}, CLASSIFICACOES.alta);
        if (ipa >= 40) return Object.assign({}, CLASSIFICACOES.moderada);
        return Object.assign({}, CLASSIFICACOES.baixa);
    }

    // IPA = 100 - (F*0,35 + D*0,30 + A*0,20 + E*0,15)
    function calcularIPA(indicadores) {
        const faltantes = dadosFaltantes(indicadores);
        if (faltantes.length > 0) {
            return {
                ipa: null,
                completo: false,
                classificacao: classificar(null),
                faltantes,
                contribuicoes: { F: null, D: null, A: null, E: null }
            };
        }

        // A fórmula é aplicada em precisão total; o arredondamento é apenas
        // da exibição das contribuições e do resultado final (duas casas).
        const brutos = {
            F: indicadores.F * PESOS.F,
            D: indicadores.D * PESOS.D,
            A: indicadores.A * PESOS.A,
            E: indicadores.E * PESOS.E
        };
        const contribuicoes = {
            F: arredondar2(brutos.F),
            D: arredondar2(brutos.D),
            A: arredondar2(brutos.A),
            E: arredondar2(brutos.E)
        };
        const soma = brutos.F + brutos.D + brutos.A + brutos.E;
        const ipa = arredondar2(limitar(100 - soma, 0, 100));

        return {
            ipa,
            completo: true,
            classificacao: classificar(ipa),
            faltantes: [],
            contribuicoes
        };
    }

    function calcularPara(aluno, dados) {
        const indicadores = {
            F: calcularF(aluno),
            D: calcularD(aluno),
            A: calcularA(aluno, dados),
            E: calcularE(aluno)
        };
        const resultado = calcularIPA(indicadores);
        resultado.indicadores = indicadores;
        resultado.mediaGeral = mediaGeral(aluno);
        resultado.mediasPorBimestre = mediasPorBimestre(aluno);
        return resultado;
    }

    // Formatação ------------------------------------------------------------

    function formatarNumero(v, casas) {
        if (!ehNumero(v)) return "—";
        const n = casas === undefined ? 2 : casas;
        return v.toFixed(n).replace(".", ",");
    }

    function formatarIPA(v) {
        return formatarNumero(v, 2);
    }

    function formatarDataCurta(iso) {
        if (typeof iso !== "string") return "—";
        const parte = iso.slice(0, 10);
        if (!dataISOValida(parte)) return parte;
        const partes = parte.split("-");
        return `${partes[2]}/${partes[1]}/${partes[0].slice(2)}`;
    }

    // Histórico -------------------------------------------------------------

    function serieHistorico(aluno) {
        const calculado = (aluno && aluno.historicoIPACalculado) || [];
        if (calculado.length > 0) {
            return {
                origem: "calculado",
                labels: calculado.map(h => formatarDataCurta(h.data)),
                ipa: calculado.map(h => (h.completo && ehNumero(h.ipa)) ? h.ipa : null),
                media: calculado.map(h => ehNumero(h.mediaGeral) ? h.mediaGeral : null),
                itens: calculado
            };
        }

        const legado = (aluno && aluno.historicoIPA) || [];
        return {
            origem: "demonstracao",
            labels: legado.map((_, i) => `Demo ${i + 1}`),
            ipa: legado.map(v => ehNumero(v) ? v : null),
            media: ((aluno && aluno.historicoMedia) || []).map(v => ehNumero(v) ? v : null),
            itens: []
        };
    }

    function serieHistoricoAgregada(alunos) {
        const series = (alunos || []).map(a => serieHistorico(a));
        if (series.length === 0) {
            return { origem: "calculado", labels: [], ipa: [], media: [] };
        }
        const tamanho = Math.max.apply(null, series.map(s => s.ipa.length));
        const labels = [];
        for (let i = 0; i < tamanho; i++) {
            const comLabel = series.find(s => !!s.labels[i]);
            labels.push(comLabel ? comLabel.labels[i] : `Ponto ${i + 1}`);
        }
        const ipa = [];
        const medias = [];
        for (let i = 0; i < tamanho; i++) {
            ipa.push(arredondar2(media(series.map(s => s.ipa[i]).filter(ehNumero))));
            medias.push(arredondar2(media(series.map(s => s.media[i]).filter(ehNumero))));
        }
        return {
            origem: series.some(s => s.origem === "calculado") ? "calculado" : "demonstracao",
            labels,
            ipa,
            media: medias
        };
    }

    // Integração com a camada de dados (browser) ----------------------------

    function proximoId(lista) {
        return lista.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    }

    function registrarHistorico(aluno, resultado, motivo, data) {
        const historico = aluno.historicoIPACalculado || (aluno.historicoIPACalculado = []);
        // O motivo é metadado: um recálculo sem mudança de números não gera
        // nova linha no histórico (evita entradas espúrias no carregamento).
        const assinatura = JSON.stringify({
            i: resultado.indicadores,
            ipa: resultado.ipa,
            c: resultado.classificacao.chave,
            completo: resultado.completo
        });
        const ultimo = historico[historico.length - 1];
        if (ultimo && ultimo._assinatura === assinatura) return false;

        historico.push({
            id: proximoId(historico),
            data,
            indicadores: Object.assign({}, resultado.indicadores),
            ipa: resultado.ipa,
            classificacao: resultado.classificacao.texto,
            classificacaoChave: resultado.classificacao.chave,
            completo: resultado.completo,
            mediaGeral: resultado.mediaGeral,
            motivo: motivo || "Atualização automática",
            origem: aluno.dadosDemonstrativos ? "demonstracao" : "registro",
            _assinatura: assinatura
        });
        return true;
    }

    function obterBanco(dados) {
        if (dados) return dados;
        if (typeof global.carregarDados === "function") return global.carregarDados();
        return null;
    }

    function recalcular(alunoId, motivo, dados) {
        const banco = obterBanco(dados);
        if (!banco || !Array.isArray(banco.alunos)) return null;
        const aluno = banco.alunos.find(a => String(a.id) === String(alunoId));
        if (!aluno) return null;

        const resultado = calcularPara(aluno, banco);
        const agora = new Date().toISOString();

        aluno.ipa = resultado.ipa;
        aluno.media = resultado.mediaGeral;
        aluno.frequencia = resultado.indicadores.F;
        aluno.ipaCompleto = resultado.completo;
        aluno.indicadoresIPA = Object.assign({}, resultado.indicadores);
        aluno.dadosFaltantes = resultado.faltantes.map(f => f.rotulo);
        aluno.ipaClassificacao = resultado.classificacao.texto;
        aluno.ipaAtualizadoEm = agora;

        registrarHistorico(aluno, resultado, motivo, agora);
        if (!dados && typeof global.salvarDados === "function") global.salvarDados(banco);
        return resultado;
    }

    function recalcularTodos(motivo) {
        const banco = obterBanco(null);
        if (!banco || !Array.isArray(banco.alunos)) return 0;
        banco.alunos.forEach(a => recalcular(a.id, motivo || "Recálculo automático", banco));
        if (typeof global.salvarDados === "function") global.salvarDados(banco);
        return banco.alunos.length;
    }

    function recalcularPorTurma(turma, motivo) {
        const banco = obterBanco(null);
        if (!banco || !Array.isArray(banco.alunos)) return 0;
        const alvos = banco.alunos.filter(a => a.turma === turma);
        alvos.forEach(a => recalcular(a.id, motivo || `Atualização na turma ${turma}`, banco));
        if (alvos.length && typeof global.salvarDados === "function") global.salvarDados(banco);
        return alvos.length;
    }

    function indicadoresDoAluno(aluno) {
        if (aluno && aluno.indicadoresIPA) return aluno.indicadoresIPA;
        const banco = obterBanco(null);
        return calcularPara(aluno, banco).indicadores;
    }

    const IPA = {
        PESOS,
        ROTULOS,
        FALTANTES,
        CLASSIFICACOES,
        ehNumero,
        limitar,
        arredondar2,
        media,
        dataISOValida,
        hojeISO,
        notaValida,
        notasPorDisciplina,
        provenienciaNota,
        mediaGeral,
        mediasPorBimestre,
        calcularF,
        calcularD,
        calcularA,
        calcularE,
        calcularIPA,
        calcularPara,
        classificar,
        dadosFaltantes,
        formatarNumero,
        formatarIPA,
        formatarDataCurta,
        serieHistorico,
        serieHistoricoAgregada,
        recalcular,
        recalcularTodos,
        recalcularPorTurma,
        indicadoresDoAluno
    };

    global.IPA = IPA;
    if (typeof module !== "undefined" && module.exports) module.exports = IPA;

    // Sincronização única ao carregar qualquer página: garante que médias,
    // indicadores e IPA estejam atualizados antes de qualquer tela renderizar.
    if (typeof document !== "undefined" && typeof global.carregarDados === "function" && !global.__IPA_SINCRONIZADO__) {
        global.__IPA_SINCRONIZADO__ = true;
        IPA.recalcularTodos("Sincronização automática ao carregar");
    }

})(typeof window !== "undefined" ? window : globalThis);
