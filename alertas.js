// ==========================================
// SENTINELA ACADÊMICA
// Alertas (IPA calculado, ordenado por risco)
// =========================================

protegerPagina("coordenacao");
App.initSidebar("alertas");

const alunos = getAlunos();
const dadosAlertas = carregarDados();
const calculos = new Map(alunos.map(a => [String(a.id), IPA.calcularPara(a, dadosAlertas)]));

const alertas = alunos
    .filter(a => {
        const c = calculos.get(String(a.id));
        return c.completo && c.classificacao.chave === "alta";
    })
    .sort((a, b) => calculos.get(String(b.id)).ipa - calculos.get(String(a.id)).ipa);

const tabela = document.getElementById("tabelaAlertas");
const vazio = document.getElementById("semAlertas");

if (alertas.length === 0) {
    tabela.innerHTML = "";
    vazio.style.display = "block";
} else {
    vazio.style.display = "none";
    tabela.innerHTML = alertas.map(a => {
        const c = calculos.get(String(a.id));
        const st = c.classificacao;
        const icone = st.classe === "red" ? "fa-skull-crossbones" : "fa-triangle-exclamation";
        const indicadores = ["F", "D", "A", "E"].map(chave =>
            `${chave}: ${IPA.formatarNumero(c.indicadores[chave])}`
        ).join(" · ");
        return `
            <tr>
                <td>
                    <div class="aluno-cell">
                        <span class="avatar-pequeno ${st.classe}">${App.iniciais(a.nome)}</span>
                        <strong>${a.nome}</strong>
                    </div>
                </td>
                <td>${a.turma}</td>
                <td><span class="status ${st.classe}">${IPA.formatarIPA(c.ipa)}</span></td>
                <td>
                    <span class="status-pill ${st.classe}">
                        <i class="fa-solid ${icone}"></i> ${st.texto}
                    </span>
                    <br><small style="color:#64748b;">${indicadores}</small>
                </td>
                <td><a href="perfil.html?id=${a.id}" title="Ver perfil"><i class="fa-solid fa-eye"></i></a></td>
            </tr>
        `;
    }).join("");
}
