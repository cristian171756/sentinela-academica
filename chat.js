// ==========================================
// SENTINELA ACADÊMICA
// Chat das turmas
// ==========================================

const sess = protegerPagina(["coordenacao", "aluno", "professor"]);
if (!sess) throw new Error("sem sessão");
const tipo = sess.tipo;
App.initSidebar("chat");

let turmaAtual = null;
const titulo = document.getElementById("tituloChat");
const subtitulo = document.getElementById("subtituloChat");
const sidebar = document.getElementById("chatSidebar");
const listaTurmas = document.getElementById("listaTurmasChat");
const messagesEl = document.getElementById("chatMessages");
const input = document.getElementById("chatInput");
const btnEnviar = document.getElementById("chatEnviar");

function turmasPermitidas() {
    if (tipo === "aluno") {
        const aluno = getAlunoPorId(sess.referencia);
        return aluno && aluno.turma ? [aluno.turma] : [];
    }
    if (tipo === "professor") {
        const prof = getProfessorPorId(sess.referencia);
        if (prof && Array.isArray(prof.turmas) && prof.turmas.length) return prof.turmas;
    }
    return getTurmas();
}

function renderListaTurmas() {
    const turmas = turmasPermitidas();
    listaTurmas.innerHTML = "";
    if (tipo === "coordenacao" || tipo === "professor") {
        sidebar.style.display = "";
        turmas.forEach(t => {
            const div = document.createElement("div");
            div.className = "chat-room";
            div.dataset.turma = t;
            div.innerHTML = `<i class="fa-solid fa-users"></i><span>${escapeHtml(t)}</span>`;
            div.addEventListener("click", () => selecionarTurma(t, div));
            listaTurmas.appendChild(div);
        });
        if (turmas.length > 0) {
            const first = listaTurmas.querySelector(".chat-room");
            first.classList.add("active");
            selecionarTurma(turmas[0], first);
        } else {
            messagesEl.innerHTML = `<p class="sem-resultado">Nenhuma turma vinculada ao seu perfil.</p>`;
        }
        return;
    }
    turmaAtual = turmas[0] || null;
    titulo.textContent = "Chat — " + (turmaAtual || "Turma");
    subtitulo.textContent = "Converse com sua turma, coordenação e professores.";
    if (!turmaAtual) messagesEl.innerHTML = `<p class="sem-resultado">Turma não encontrada.</p>`;
}

function selecionarTurma(t, el) {
    if (el) {
        listaTurmas.querySelectorAll(".chat-room").forEach(r => r.classList.remove("active"));
        el.classList.add("active");
    }
    turmaAtual = t;
    titulo.textContent = "Chat — " + t;
    if (tipo === "coordenacao") subtitulo.textContent = "Acompanhe e converse com alunos e professores da turma.";
    if (tipo === "professor") subtitulo.textContent = "Converse com sua turma e acompanhe as mensagens dos alunos.";
    renderMessages(true);
}

function nomeAutor(sessao) {
    if (sessao.tipo === "coordenacao") return "Coordenação";
    if (sessao.tipo === "professor") {
        const prof = getProfessorPorId(sessao.referencia);
        return prof ? prof.nome : "Professor";
    }
    const aluno = getAlunoPorId(sessao.referencia);
    return aluno ? aluno.nome : "Aluno";
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function fotoAutor(tipoAutor, ref) {
    if (typeof Pref === "undefined" || !Pref.getFoto) return null;
    if (tipoAutor === "aluno" || tipoAutor === "professor" || tipoAutor === "coordenacao") {
        return Pref.getFoto(tipoAutor, ref);
    }
    return null;
}

function iniciais(nome) {
    const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    return (partes[0][0] + (partes[1] ? partes[1][0] : "")).toUpperCase();
}

function papelAutor(tipoAutor) {
    if (tipoAutor === "coordenacao") return "Coordenação";
    if (tipoAutor === "professor") return "Professor";
    return "Aluno";
}

function formatarDia(iso) {
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);
    const same = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    if (same(d,hoje)) return "Hoje";
    if (same(d,ontem)) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderMessages(forceScroll = false) {
    if (!turmaAtual) {
        messagesEl.innerHTML = `<div class="chat-empty"><i class="fa-solid fa-comments"></i><p>Selecione uma turma para começar.</p></div>`;
        return;
    }
    const msgs = getMensagensChat(turmaAtual);
    const nearBottom = (messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight) < 80;
    if (!msgs.length) {
        messagesEl.innerHTML = `<div class="chat-empty"><i class="fa-regular fa-message"></i><p>Nenhuma mensagem ainda em <strong>${escapeHtml(turmaAtual)}</strong>.</p><span>Envie a primeira mensagem para iniciar a conversa.</span></div>`;
        return;
    }

    let ultimoDia = "";
    messagesEl.innerHTML = msgs.map(m => {
        const meu = (m.autorTipo === tipo) && String(m.autorRef) === String(sess.referencia);
        const data = new Date(m.data);
        const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const dia = formatarDia(m.data);
        const separador = dia !== ultimoDia ? `<div class="chat-day-sep"><span>${dia}</span></div>` : "";
        ultimoDia = dia;
        const foto = fotoAutor(m.autorTipo, m.autorRef);
        const avatar = foto
            ? `<img class="chat-avatar" src="${foto}" alt="Foto de ${escapeHtml(m.autorNome || "")}">`
            : `<div class="chat-avatar chat-avatar-fallback chat-avatar-${escapeHtml(m.autorTipo || 'aluno')}">${escapeHtml(iniciais(m.autorNome))}</div>`;
        const online = m.autorTipo === "aluno" ? (typeof Pref !== "undefined" && Pref.estaOnline({ tipo: "aluno", referencia: m.autorRef })) : true;
        const onlineDot = m.autorTipo === "aluno" ? `<span class="online-dot ${online ? "online" : "offline"}" title="${online ? "Online" : "Offline"}"></span>` : "";
        return `
            ${separador}
            <div class="chat-msg-row ${meu ? "meu" : "outro"}">
                ${!meu ? avatar : ""}
                <div class="chat-msg ${meu ? "meu" : "outro"} ${m.autorTipo === "coordenacao" ? "msg-coord" : m.autorTipo === "professor" ? "msg-prof" : "msg-aluno"}">
                    <div class="chat-msg-meta">
                        <span class="chat-msg-autor">${onlineDot}${escapeHtml(m.autorNome || "Usuário")}</span>
                        <span class="chat-msg-papel papel-${escapeHtml(m.autorTipo || "aluno")}">${papelAutor(m.autorTipo)}</span>
                    </div>
                    <div class="chat-msg-texto">${escapeHtml(m.texto)}</div>
                    <div class="chat-msg-data">${hora}</div>
                </div>
                ${meu ? avatar : ""}
            </div>
        `;
    }).join("");
    if (forceScroll || nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function enviar() {
    const texto = input.value.trim();
    if (!texto || !turmaAtual) return;

    const ofensivas = typeof Pref !== "undefined" ? Pref.verificarPalavrasOfensivas(texto) : [];
    if (ofensivas.length > 0) {
        alert("Sua mensagem contém palavras ofensivas e não pode ser enviada. Por favor, respeite os colegas.");
        if (typeof Pref !== "undefined") Pref.tocarSom("erro");
        return;
    }

    enviarMensagemChat({
        turma: turmaAtual,
        autorTipo: tipo,
        autorNome: nomeAutor(sess),
        autorRef: sess.referencia,
        texto
    });
    input.value = "";
    input.focus();
    renderMessages(true);
    if (typeof Pref !== "undefined") Pref.tocarSom("mensagem");
}

btnEnviar.addEventListener("click", enviar);
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); enviar(); }
});
input.addEventListener("input", () => {
    btnEnviar.disabled = !input.value.trim() || !turmaAtual;
});

renderListaTurmas();
renderMessages(true);
setInterval(() => renderMessages(false), 3000);

if (typeof Pref !== "undefined") {
    Pref.marcarOnline(sess);
    setInterval(() => Pref.marcarOnline(sess), 30000);
}
btnEnviar.disabled = true;
