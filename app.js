// ==========================================
// SENTINELA ACADÊMICA
// Layout compartilhado (sidebar, logout, menu mobile)
// ==========================================

const App = {
    _navCoordenacao: [
        { key: "dashboard", href: "dashboard.html", icon: "fa-house", label: "Visão Geral" },
        { key: "alunos", href: "alunos.html", icon: "fa-user-graduate", label: "Alunos" },
        { key: "turmas", href: "turmas.html", icon: "fa-school", label: "Turmas" },
        { key: "alertas", href: "alertas.html", icon: "fa-triangle-exclamation", label: "Alertas" },
        { key: "avisos", href: "avisos.html", icon: "fa-bullhorn", label: "Avisos" },
        { key: "chat", href: "chat.html", icon: "fa-comments", label: "Chat das Turmas" },
        { key: "relatorios", href: "relatorios.html", icon: "fa-chart-column", label: "Relatórios" },
        { key: "contas", href: "contas.html", icon: "fa-users-gear", label: "Contas e Acessos" },
        { key: "professores", href: "professores.html", icon: "fa-chalkboard-user", label: "Professores" },
        { key: "configuracoes", href: "configuracoes.html", icon: "fa-gear", label: "Configurações" }
    ],

    _navProfessor: [
        { key: "notas", href: "professor.html", icon: "fa-pen-to-square", label: "Lançar Notas" },
        { key: "frequencia", href: "professor.html#frequencia", icon: "fa-calendar-check", label: "Frequência" },
        { key: "atividades", href: "professor.html#atividades", icon: "fa-list-check", label: "Atividades" },
        { key: "avisos", href: "avisos.html", icon: "fa-bullhorn", label: "Avisos" },
        { key: "configuracoes", href: "configuracoes.html", icon: "fa-gear", label: "Configurações" }
    ],

    _navAluno: [
        { key: "portal", href: "portal-aluno.html", icon: "fa-gauge-high", label: "Meu Desempenho" },
        { key: "avisos", href: "avisos.html", icon: "fa-bell", label: "Avisos" },
        { key: "chat", href: "chat.html", icon: "fa-comments", label: "Chat da Turma" },
        { key: "perfil", href: "perfil.html", icon: "fa-id-card", label: "Meu Perfil" },
        { key: "configuracoes", href: "configuracoes.html", icon: "fa-gear", label: "Configurações" },
        { key: "boletim", href: "portal-aluno.html#boletim", icon: "fa-file-lines", label: "Boletim" },
        { key: "frequencia", href: "portal-aluno.html#frequencia", icon: "fa-calendar-check", label: "Frequência" }
    ],

    tipoSessaoValido(tipo) {
        return ["coordenacao", "professor", "aluno"].includes(tipo);
    },

    montarSidebar(active, tipo) {
        const sessao = (typeof getSessao === "function") ? getSessao() : null;
        const tipoSeguro = this.tipoSessaoValido(tipo) ? tipo : (sessao && this.tipoSessaoValido(sessao.tipo) ? sessao.tipo : "coordenacao");
        const nav = tipoSeguro === "aluno" ? this._navAluno : tipoSeguro === "professor" ? this._navProfessor : this._navCoordenacao;
        const itens = nav.map(item => `
            <a href="${item.href}" class="${item.key === active ? "active" : ""}">
                <i class="fa-solid ${item.icon}"></i>
                <span>${item.label}</span>
            </a>
        `).join("");

        const rodape = tipoSeguro === "aluno"
            ? `<div class="user-mini"><i class="fa-solid fa-user-graduate"></i><span>Área do Aluno</span></div>`
            : tipoSeguro === "professor"
                ? `<div class="user-mini"><i class="fa-solid fa-chalkboard-user"></i><span>Área do Professor</span></div>`
                : `<div class="user-mini"><i class="fa-solid fa-user-shield"></i><span>Coordenação Pedagógica</span></div>`;

        // Foto de perfil do usuário logado
        let fotoPerfil = "";
        let nomeUsuario = "";
        if (sessao) {
            const foto = (typeof Pref !== "undefined" && Pref.getFoto) ? Pref.getFoto(sessao.tipo, sessao.referencia) : null;
            if (foto) {
                fotoPerfil = `<img src="${foto}" alt="Foto de perfil" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.3);">`;
            }
            if (sessao.tipo === "aluno" && typeof getAlunoPorId === "function") {
                const aluno = getAlunoPorId(sessao.referencia);
                nomeUsuario = aluno ? aluno.nome.split(" ")[0] : "Aluno";
            } else if (sessao.tipo === "professor" && typeof getProfessorPorId === "function") {
                const prof = getProfessorPorId(sessao.referencia);
                nomeUsuario = prof ? prof.nome : "Professor";
            } else {
                nomeUsuario = "Coordenação";
            }
        }

        return `
            <div class="logo-area">
                <img src="logo.svg" alt="Logo">
                <h2>Sentinela Acadêmica</h2>
            </div>
            <nav>${itens}</nav>
            <div class="sidebar-footer">
                ${fotoPerfil ? `<div class="user-foto">${fotoPerfil}<span>${nomeUsuario}</span></div>` : rodape}
                <button class="btn-sair" id="btnSair"><i class="fa-solid fa-right-from-bracket"></i> Sair</button>
            </div>
        `;
    },

    initSidebar(active, tipo) {
        const el = document.getElementById("sidebar");
        if (!el) return;
        const sessao = (typeof getSessao === "function") ? getSessao() : null;
        const tipoSeguro = this.tipoSessaoValido(tipo) ? tipo : (sessao && this.tipoSessaoValido(sessao.tipo) ? sessao.tipo : "coordenacao");
        el.innerHTML = this.montarSidebar(active, tipoSeguro);
        const btn = document.getElementById("btnSair");
        if (btn) btn.addEventListener("click", encerrarSessao);

        // Botão de menu mobile
        this._injectMenuButton();
        // Notificações
        this._injectNotificacoes();
    },

    _injectMenuButton() {
        if (document.getElementById("menuToggle")) return;
        const btn = document.createElement("button");
        btn.id = "menuToggle";
        btn.className = "menu-toggle";
        btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        document.body.appendChild(btn);

        btn.addEventListener("click", () => {
            const dash = document.querySelector(".dashboard");
            if (dash) dash.classList.toggle("sidebar-open");
        });

        // Fecha ao clicar fora (overlay)
        document.addEventListener("click", (e) => {
            const dash = document.querySelector(".dashboard");
            if (!dash) return;
            if (dash.classList.contains("sidebar-open") &&
                !e.target.closest(".sidebar") &&
                !e.target.closest("#menuToggle")) {
                dash.classList.remove("sidebar-open");
            }
        });
    },

    // ===== Notificações =====
    _injectNotificacoes() {
        if (document.getElementById("btnNotificacoes")) return;
        const sessao = (typeof getSessao === "function") ? getSessao() : null;
        if (!sessao) return;

        const topBar = document.querySelector(".top-bar");
        if (!topBar) return;

        const wrap = document.createElement("div");
        wrap.className = "notif-wrap";
        wrap.innerHTML = `
            <button class="notif-btn" id="btnNotificacoes" aria-label="Notificações" aria-expanded="false">
                <i class="fa-solid fa-bell"></i>
                <span class="notif-badge" id="notifBadge" style="display:none;">0</span>
            </button>
        `;
        topBar.appendChild(wrap);

        const dd = document.createElement("div");
        dd.className = "notif-dropdown";
        dd.id = "notifDropdown";
        dd.setAttribute("aria-hidden", "true");
        dd.innerHTML = `
            <div class="notif-header">
                <strong>Avisos</strong>
                <button class="notif-marcar" id="notifMarcar" type="button">Marcar tudo como lido</button>
            </div>
            <div class="notif-lista" id="notifLista"></div>
        `;
        document.body.appendChild(dd);

        const btn = document.getElementById("btnNotificacoes");
        const posicionarDropdown = () => {
            if (!dd.classList.contains("open")) return;
            const rect = btn.getBoundingClientRect();
            const largura = Math.min(360, window.innerWidth - 16);
            const left = Math.max(8, Math.min(rect.right - largura, window.innerWidth - largura - 8));
            const top = Math.min(rect.bottom + 10, window.innerHeight - 120);
            dd.style.width = `${largura}px`;
            dd.style.left = `${left}px`;
            dd.style.top = `${top}px`;
            dd.style.right = "auto";
        };

        const fecharDropdown = () => {
            dd.classList.remove("open");
            dd.setAttribute("aria-hidden", "true");
            btn.setAttribute("aria-expanded", "false");
        };

        const abrirDropdown = () => {
            dd.classList.add("open");
            dd.setAttribute("aria-hidden", "false");
            btn.setAttribute("aria-expanded", "true");
            posicionarDropdown();
            this._carregarNotificacoes(sessao);
        };

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (dd.classList.contains("open")) fecharDropdown();
            else abrirDropdown();
        });

        dd.addEventListener("click", (e) => e.stopPropagation());

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".notif-wrap") && !e.target.closest("#notifDropdown")) {
                fecharDropdown();
            }
        });

        window.addEventListener("resize", posicionarDropdown);
        window.addEventListener("scroll", posicionarDropdown, true);

        document.getElementById("notifMarcar").addEventListener("click", () => {
            marcarTodosAvisosLidos(sessao);
            this._carregarNotificacoes(sessao);
        });

        this._posicionarNotifDropdown = posicionarDropdown;
        this._carregarNotificacoes(sessao);
        this._timerNotif = setInterval(() => this._carregarNotificacoes(sessao), 10000);
    },

    _carregarNotificacoes(sessao) {
        const lista = document.getElementById("notifLista");
        const badge = document.getElementById("notifBadge");
        if (!lista || !badge) return;

        const avisos = getAvisosParaUsuario(sessao);
        const chave = chaveUsuario(sessao);
        const naoLidos = avisos.filter(a => !Array.isArray(a.lidoPor) || !a.lidoPor.includes(chave)).length;

        if (naoLidos > 0) {
            badge.textContent = naoLidos > 99 ? "99+" : naoLidos;
            badge.style.display = "flex";
        } else {
            badge.style.display = "none";
        }

        if (avisos.length === 0) {
            lista.innerHTML = `<div class="notif-vazio"><i class="fa-regular fa-bell-slash"></i><span>Nenhum aviso por aqui.</span></div>`;
            if (typeof this._posicionarNotifDropdown === "function") this._posicionarNotifDropdown();
            return;
        }

        lista.innerHTML = avisos.map(a => {
            const lido = Array.isArray(a.lidoPor) && a.lidoPor.includes(chave);
            const data = new Date(a.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            const titulo = String(a.titulo || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const texto = String(a.texto || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const autor = String(a.autor || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const turma = a.turma ? ` • ${String(a.turma).replace(/</g, "&lt;").replace(/>/g, "&gt;")}` : "";
            return `
                <div class="notif-item ${lido ? "lido" : "nao-lido"}" data-id="${a.id}" role="button" tabindex="0">
                    <div class="notif-titulo">${titulo}</div>
                    <div class="notif-texto">${texto}</div>
                    <div class="notif-meta">${autor} • ${data}${turma}</div>
                </div>
            `;
        }).join("");

        lista.querySelectorAll(".notif-item").forEach(el => {
            const marcar = () => {
                const id = Number(el.dataset.id);
                marcarAvisoLido(id, sessao);
                this._carregarNotificacoes(sessao);
            };
            el.addEventListener("click", marcar);
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    marcar();
                }
            });
        });

        if (typeof this._posicionarNotifDropdown === "function") this._posicionarNotifDropdown();
    },

    // Gera as iniciais para avatar
    iniciais(nome) {
        return nome.split(" ").filter(Boolean).slice(0, 2)
            .map(p => p[0].toUpperCase()).join("");
    }
};
