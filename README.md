# 🛡️ Sentinela Acadêmica

> Plataforma inteligente para identificação preventiva de possíveis sinais de burnout em estudantes por meio da análise de indicadores acadêmicos.

![Status](https://img.shields.io/badge/status-Em%20Desenvolvimento-blue)
![Versão](https://img.shields.io/badge/versão-2.0-green)
![Licença](https://img.shields.io/badge/licença-MIT-lightgrey)

---

## 📖 Sobre o Projeto

O **Sentinela Acadêmica** é um protótipo desenvolvido para a Feira de Ciências da **Escola Estadual Professor Abel Freire Coelho**.

A plataforma foi criada com o objetivo de auxiliar a equipe pedagógica na identificação preventiva de estudantes que apresentem sinais de desgaste acadêmico, utilizando indicadores como frequência, desempenho escolar e participação.

> **Importante:** o sistema **não realiza diagnósticos médicos ou psicológicos**. Seu propósito é fornecer indicadores que auxiliem a equipe pedagógica na tomada de decisões e no acompanhamento dos estudantes.

---

## 🎯 Objetivos

- Monitorar indicadores acadêmicos dos estudantes;
- Identificar mudanças significativas no desempenho escolar;
- Gerar alertas preventivos para a coordenação;
- Facilitar o acompanhamento individual dos alunos;
- Contribuir para ações de prevenção à evasão escolar.

---

## ✨ Funcionalidades

- 🔐 Login e cadastro de contas com dois perfis (Coordenação e Aluno)
- 🧑‍🎓 **Portal do Aluno**: o estudante acessa com matrícula e senha e visualiza seu desempenho (média, frequência, IPA, gráficos de evolução, notas por disciplina e observações)
- 📊 Dashboard com indicadores gerais dinâmicos
- 👨‍🎓 Gerenciamento de alunos com busca e filtros funcionais
- 🏫 Visualização de turmas com agregação automática
- ⚠️ Alertas preventivos ordenados por risco
- 📈 Relatórios e gráficos (distribuição, IPA por turma, desempenho por disciplina)
- 👤 Perfil individual dos estudantes (compartilhado entre coordenação e aluno)
- 🧮 **IPA dinâmico** recalculado automaticamente a partir de notas, frequência, atividades e evolução (módulo único `ipa.js`)
- 🗓️ Registro e correção de frequência por aula identificada (nº/horário), sem aulas duplicadas
- 📝 Cadastro, edição e exclusão de atividades; controle de entregas (pendente / entregue / atrasada), com exclusão auditada
- ✏️ Edição e exclusão de notas pelo professor responsável, com recálculo automático
- 💾 Dados de exemplo identificados como demonstrativos, preservados com backup e recuperação pela coordenação
- 📱 Interface responsiva com menu off-canvas no mobile
- 💬 Chat por turma para alunos e coordenação
- 📢 Sistema de avisos com notificações
- 👥 Gestão de contas e acessos pela coordenação

---

## 🔑 Acesso de Demonstração

- **Coordenação:** `coordenador@abel.edu.br` / `123456` (ou crie uma nova conta na tela de login)
- **Aluno:** matrícula (ex.: `2024001`) / senha padrão `1234` (ou cadastre-se na tela de login; a matrícula é gerada automaticamente)
- **Professor:** `cintia@abel.edu.br` / `1234` (ajuste disciplinas e turmas em *Professores*)

> Os números de IPA e notas exibidos no primeiro acesso são **demonstrativos**, e cada registro traz sua origem. Um aluno deixa de ser sinalizado como demonstrativo quando todos os registros passam a ser lançamentos reais. Nenhum vínculo de professor/turma é inferido das notas: a coordenação define disciplinas e turmas em *Professores*.

---

## 🧮 IPA dinâmico (fonte única de cálculo)

Fórmula oficial, implementada somente em `ipa.js`:

```
IPA = 100 − (F × 0,35 + D × 0,30 + A × 0,20 + E × 0,15)
```

| Indicador | Origem real | Regra |
|---|---|---|
| **F** — Frequência | `registrosFrequencia` (turma/disciplina/aluno/data/`aulaId`/presença) | `(presenças ÷ aulas registradas) × 100`; duas aulas no mesmo dia são distintas; correções atualizam o registro, nunca duplicam |
| **D** — Desempenho | `registrosNotas` de todas as disciplinas | média das médias por disciplina × 10; notas ausentes **não** viram zero |
| **A** — Atividades | `atividades` + `entregas` | entregas vencidas no prazo ou atrasadas contam como entregues; atividades futuras não entram |
| **E** — Evolução | médias recalculadas por bimestre | `limitar(50 + (média atual − média anterior) × 10, 0, 100)`; exige dois bimestres comparáveis |

Classificação: **0–39,99** baixa necessidade; **40–69,99** moderada; **70–100** alta necessidade. Resultado exibido com duas casas decimais (ex.: `21,25`).

Se qualquer indicador não puder ser calculado, o IPA fica **pendente de dados** (`null`), sem classificação definitiva, e a tela lista o que falta. A fórmula é somada em precisão total e arredondada apenas no resultado final. Todo lançamento/nota/frequência/entrega dispara recálculo imediato e grava no histórico (data, F/D/A/E, IPA, classificação e motivo) **somente quando os números mudam**; o motivo é metadado e não gera entradas espúrias. O mesmo resultado aparece em todas as telas, incluindo o painel por indicador da coordenação e a lista de presenças/faltas no portal do aluno.

Exemplo de verificação obrigatória: `F=85, D=75, A=80, E=70` ⇒ **IPA 21,25 — Baixa necessidade de acompanhamento**.

### Migração e recuperação

Ao abrir uma instalação antiga, os dados são copiados para `sentinela_dados_v4_backup` **antes** de qualquer alteração. A migração até a versão 5 converte as notas demonstrativas em registros rastreáveis (`origem: "demonstracao"`); os campos manuais antigos (`ipa`, `media`, `frequencia`, `historicoIPA`) permanecem intactos para auditoria (`ipaLegado`), e o IPA exibido passa a ser o calculado. A versão 6 acrescenta vínculos explícitos professor↔turma, `turma` nos registros de nota e frequência, `aulaId` na frequência e contexto (turma/disciplina/professor) nas entregas, preservando registros antigos. Em *Configurações*, a coordenação pode recuperar os dados originais; o estado anterior é guardado em `sentinela_dados_v4_antes_restauracao`. Alunos criados depois não recebem notas fictícias.

---

## ☁️ Supabase / PostgreSQL — apenas preparado

**Nenhum compartilhamento real está ativo.** O projeto funciona integralmente em modo local (`localStorage`) e não envia dados à rede.

- `supabase/schema.sql`: tabelas, restrições de unicidade (evitam notas/faltas/entregas duplicadas), RLS por papel (coordenação, professor, aluno) e autorização explícita professor ↔ disciplina ↔ turma. O histórico do IPA é **append-only** e gravado por RPC validada.
- `config.supabase.example.js`: modelo de configuração. Copie para `config.supabase.js` (ignorado pelo Git) somente com sua `url` e chave `anon`.
- `repositorio.js`: fronteira de persistência. Em modo local, delega para `dados.js`. Se `modo: "supabase"` for selecionado sem implementação/validação, as operações remotas lançam erro explícito — não há simulação de nuvem.
- **Nunca** use a chave `service_role` no navegador; ela não deve aparecer em nenhum arquivo versionado.

Para ativar no futuro: aplicar o SQL, criar perfis/autorizações, gerar o cliente autenticado e implementar os pontos indicados em `Repositorio.PENDENTES`.

---

## ✅ Testes

Sem dependências ou build:

```bash
node --test tests/*.test.js
```

Os 36 testes cobrem a fórmula e os limites de classificação, arredondamento apenas no resultado, o exemplo oficial (21,25) com registros reais persistidos, indicadores ausentes, notas em várias disciplinas, atribuição por turma sem notas prévias, evolução com limites, duas aulas no mesmo dia, correção e exclusão de registros, deduplicação do histórico, atividades futuras/atrasadas, migração v5/v6 com backup, recuperação dos originais, validações de acesso (sem inferência de turmas) e o modo local do adaptador. Também há checagem estática de sintaxe (`node --check *.js`) e de IDs referenciados pelas páginas.

---

## 🖥️ Tecnologias

- HTML5
- CSS3
- JavaScript (vanilla)
- Chart.js
- localStorage (persistência client-side)
- Git
- GitHub

---

## 🎨 Protótipo

O design da interface foi desenvolvido no Figma, priorizando uma experiência moderna, intuitiva e acessível para a equipe pedagógica.

---

## 👨‍💻 Desenvolvedor

**Cristian Davi**

Curso Técnico em Informática

Escola Estadual Professor Abel Freire Coelho

---

## 📄 Licença

Este projeto foi desenvolvido exclusivamente para fins educacionais e de apresentação na Feira de Ciências.