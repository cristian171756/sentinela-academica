// ==========================================
// SENTINELA ACADÊMICA
// Alunos (render + filtros) com IPA calculado
// =========================================

protegerPagina("coordenacao");
App.initSidebar("alunos");

const tabela = document.getElementById("tabelaAlunos");
const pesquisa = document.getElementById("pesquisa");
const semResultado = document.getElementById("semResultado");
const filtros = document.querySelectorAll("#filtros .filter");

let filtroAtivo = "todos";

function render() {
    const texto = pesquisa.value.toLowerCase().trim();
    const alunos = getAlunos();
    const dados = carregarDados();
    const calculos = new Map(alunos.map(a => [String(a.id), IPA.calcularPara(a, dados)]));

    const filtrados = alunos.filter(a => {
        const nome = a.nome.toLowerCase();
        const turma = a.turma.toLowerCase();
        const casa = nome.includes(texto) || turma.includes(texto);
        const calc = calculos.get(String(a.id));

        let passaFiltro = true;
        if (filtroAtivo === "verde") passaFiltro = calc.classificacao.chave === "baixa";
        else if (filtroAtivo === "amarelo") passaFiltro = calc.classificacao.chave === "moderada";
        else if (filtroAtivo === "vermelho") passaFiltro = calc.classificacao.chave === "alta";
        else if (filtroAtivo === "informatica") passaFiltro = a.curso === "Informática";

        return casa && passaFiltro;
    });

    if (filtrados.length === 0) {
        tabela.innerHTML = "";
        semResultado.style.display = "block";
        return;
    }

    semResultado.style.display = "none";

    tabela.innerHTML = filtrados.map(a => {
        const calc = calculos.get(String(a.id));
        const st = calc.classificacao;
        const ipaTexto = calc.completo ? IPA.formatarIPA(calc.ipa) : "pendente";
        const frequencia = calc.indicadores.F;
        return `
            <tr>
                <td>
                    <div class="aluno-cell">
                        <span class="avatar-pequeno">${App.iniciais(a.nome)}</span>
                        <div>
                            <strong>${a.nome}</strong>
                            <span class="mat">Mat. ${a.matricula}</span>
                            ${a.dadosDemonstrativos ? '<span class="ipa-tag-demo">demonstrativo</span>' : ""}
                        </div>
                    </div>
                </td>
                <td>${a.turma}</td>
                <td><strong>${IPA.formatarNumero(calc.mediaGeral, 1)}</strong></td>
                <td>
                    <div class="freq-mini">
                        <span>${IPA.ehNumero(frequencia) ? IPA.formatarNumero(frequencia, 0) + "%" : "—"}</span>
                        <div class="barra"><span class="barra-preench ${st.classe}" style="width:${IPA.ehNumero(frequencia) ? frequencia : 0}%"></span></div>
                    </div>
                </td>
                <td><span class="status ${st.classe}" title="${st.texto}">${ipaTexto}</span></td>
                <td>
                    <a href="perfil.html?id=${a.id}" title="Ver perfil">
                        <i class="fa-solid fa-eye"></i>
                    </a>
                </td>
            </tr>
        `;
    }).join("");
}

pesquisa.addEventListener("keyup", render);

filtros.forEach(botao => {
    botao.addEventListener("click", () => {
        filtros.forEach(f => f.classList.remove("active"));
        botao.classList.add("active");
        filtroAtivo = botao.dataset.filtro;
        render();
    });
});

render();
