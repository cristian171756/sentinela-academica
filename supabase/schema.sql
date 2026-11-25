-- ============================================================
-- SENTINELA ACADÊMICA — esquema PostgreSQL/Supabase (PREPARAÇÃO)
-- ============================================================
-- Este arquivo NÃO é aplicado automaticamente e NÃO ativa compartilhamento.
-- Aplicar apenas quando houver projeto Supabase próprio e credenciais válidas:
--   Supabase Dashboard -> SQL Editor -> colar este script
--
-- Regras de segurança:
--   * Nunca use a chave service_role no navegador.
--   * Use apenas a chave anon/public no frontend, sempre protegida por RLS.
--   * Senhas devem ser armazenadas como hash (pgcrypto/bcrypt), nunca em texto.
--   * O cálculo do IPA continua exclusivamente em ipa.js; o banco apenas
--     armazena os registros e o histórico calculado (sem segunda fórmula).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Catálogos ----------

create table if not exists public.turmas (
    id bigint generated always as identity primary key,
    nome text not null unique,
    criado_em timestamptz not null default now()
);

create table if not exists public.disciplinas (
    id bigint generated always as identity primary key,
    nome text not null unique
);

-- ---------- Pessoas ----------
-- referencia_id aponta para alunos.id ou professores.id, conforme o papel.

create table if not exists public.alunos (
    id bigint generated always as identity primary key,
    matricula text not null unique,
    nome text not null,
    turma_id bigint references public.turmas(id),
    serie text,
    curso text default 'Regular',
    senha_hash text not null,
    email text,
    observacoes text,
    dados_demonstrativos boolean not null default false,
    criado_em timestamptz not null default now()
);

create table if not exists public.professores (
    id bigint generated always as identity primary key,
    nome text not null,
    email text not null unique,
    senha_hash text not null,
    criado_em timestamptz not null default now()
);

create table if not exists public.coordenadores (
    user_id uuid primary key references auth.users(id) on delete cascade,
    nome text not null,
    email text not null unique,
    criado_em timestamptz not null default now()
);

-- Perfil do usuário autenticado do Supabase Auth.
create table if not exists public.perfis (
    user_id uuid primary key references auth.users(id) on delete cascade,
    papel text not null check (papel in ('coordenacao', 'professor', 'aluno')),
    referencia_id bigint,
    criado_em timestamptz not null default now()
);

-- ---------- Autorização do professor ----------

create table if not exists public.professor_disciplinas (
    professor_id bigint not null references public.professores(id) on delete cascade,
    disciplina_id bigint not null references public.disciplinas(id) on delete cascade,
    primary key (professor_id, disciplina_id)
);

create table if not exists public.professor_turmas (
    professor_id bigint not null references public.professores(id) on delete cascade,
    turma_id bigint not null references public.turmas(id) on delete cascade,
    primary key (professor_id, turma_id)
);

-- ---------- Registros acadêmicos (Fonte dos indicadores F, D, A, E) ----------

create table if not exists public.registros_notas (
    id bigint generated always as identity primary key,
    aluno_id bigint not null references public.alunos(id) on delete cascade,
    disciplina_id bigint not null references public.disciplinas(id),
    bimestre smallint not null check (bimestre between 1 and 4),
    valor numeric(4,2) not null check (valor between 0 and 10),
    origem text not null default 'professor' check (origem in ('professor', 'demonstracao')),
    professor_id bigint references public.professores(id),
    turma_id bigint references public.turmas(id),
    valor_demonstrativo numeric(4,2),
    substituiu_demonstracao boolean not null default false,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    -- impede nota duplicada para o mesmo aluno/disciplina/bimestre (upsert)
    unique (aluno_id, disciplina_id, bimestre)
);

create table if not exists public.registros_frequencia (
    id bigint generated always as identity primary key,
    aluno_id bigint not null references public.alunos(id) on delete cascade,
    disciplina_id bigint not null references public.disciplinas(id),
    data date not null,
    aula_id text not null,
    presenca boolean not null,
    turma_id bigint references public.turmas(id),
    professor_id bigint references public.professores(id),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    -- uma aula identificada por aluno/disciplina/data/aula: correção atualiza, não duplica
    unique (aluno_id, disciplina_id, data, aula_id)
);

create table if not exists public.atividades (
    id bigint generated always as identity primary key,
    titulo text not null check (length(trim(titulo)) >= 3),
    descricao text,
    disciplina_id bigint not null references public.disciplinas(id),
    turma_id bigint not null references public.turmas(id),
    data_entrega date not null,
    professor_id bigint not null references public.professores(id),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create table if not exists public.entregas (
    id bigint generated always as identity primary key,
    atividade_id bigint not null references public.atividades(id) on delete cascade,
    aluno_id bigint not null references public.alunos(id) on delete cascade,
    status text not null check (status in ('pendente', 'entregue', 'atrasada')),
    atividade_titulo text,
    disciplina_id bigint references public.disciplinas(id),
    turma_id bigint references public.turmas(id),
    professor_id bigint references public.professores(id),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    unique (atividade_id, aluno_id)
);

-- ---------- Histórico do IPA (append-only) ----------

create table if not exists public.historico_ipa (
    id bigint generated always as identity primary key,
    aluno_id bigint not null references public.alunos(id) on delete cascade,
    data timestamptz not null default now(),
    indicadores jsonb not null check (jsonb_typeof(indicadores) = 'object'),
    ipa numeric(5,2) check (ipa between 0 and 100),
    completo boolean not null,
    classificacao text not null,
    classificacao_chave text not null check (classificacao_chave in ('baixa', 'moderada', 'alta', 'incompleto')),
    media_geral numeric(4,2),
    motivo text not null,
    origem text not null check (origem in ('demonstracao', 'registro')),
    criado_em timestamptz not null default now()
);

create or replace function public.historico_ipa_imutavel()
returns trigger
language plpgsql
as $$
begin
    raise exception 'O histórico do IPA é somente leitura (append-only)';
end;
$$;

drop trigger if exists trg_historico_ipa_imutavel on public.historico_ipa;
create trigger trg_historico_ipa_imutavel
before update or delete on public.historico_ipa
for each row execute function public.historico_ipa_imutavel();

create index if not exists idx_historico_ipa_aluno_data
    on public.historico_ipa (aluno_id, data desc);
create index if not exists idx_notas_aluno on public.registros_notas (aluno_id);
create index if not exists idx_freq_aluno_data on public.registros_frequencia (aluno_id, data desc);
create index if not exists idx_entregas_atividade on public.entregas (atividade_id);

-- ---------- Helpers de sessão (SECURITY DEFINER, search_path fixo) ----------

create or replace function public.auth_papel()
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
    select p.papel from public.perfis p where p.user_id = auth.uid();
$$;

create or replace function public.auth_eh_coordenacao()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
    select coalesce(public.auth_papel() = 'coordenacao', false);
$$;

create or replace function public.auth_professor_id()
returns bigint
language sql stable security definer set search_path = public, pg_temp
as $$
    select p.referencia_id from public.perfis p
    where p.user_id = auth.uid() and p.papel = 'professor';
$$;

create or replace function public.auth_aluno_id()
returns bigint
language sql stable security definer set search_path = public, pg_temp
as $$
    select p.referencia_id from public.perfis p
    where p.user_id = auth.uid() and p.papel = 'aluno';
$$;

-- Professor só atua em disciplina/turma explicitamente autorizada.
create or replace function public.professor_autorizado(
    p_professor bigint,
    p_disciplina_id bigint,
    p_turma_id bigint
)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
    select exists (
        select 1
        from public.professor_disciplinas pd
        join public.professor_turmas pt on pt.professor_id = pd.professor_id
        where pd.professor_id = p_professor
          and pd.disciplina_id = p_disciplina_id
          and pt.turma_id = p_turma_id
    );
$$;

revoke all on function public.auth_papel() from public;
revoke all on function public.auth_eh_coordenacao() from public;
revoke all on function public.auth_professor_id() from public;
revoke all on function public.auth_aluno_id() from public;
revoke all on function public.professor_autorizado(bigint, bigint, bigint) from public;
grant execute on function public.auth_papel() to authenticated;
grant execute on function public.auth_eh_coordenacao() to authenticated;
grant execute on function public.auth_professor_id() to authenticated;
grant execute on function public.auth_aluno_id() to authenticated;
grant execute on function public.professor_autorizado(bigint, bigint, bigint) to authenticated;

-- ---------- RLS ----------

alter table public.turmas enable row level security;
alter table public.disciplinas enable row level security;
alter table public.alunos enable row level security;
alter table public.professores enable row level security;
alter table public.coordenadores enable row level security;
alter table public.perfis enable row level security;
alter table public.professor_disciplinas enable row level security;
alter table public.professor_turmas enable row level security;
alter table public.registros_notas enable row level security;
alter table public.registros_frequencia enable row level security;
alter table public.atividades enable row level security;
alter table public.entregas enable row level security;
alter table public.historico_ipa enable row level security;

-- Catálogos: leitura para qualquer usuário autenticado; escrita só coordenação.
create policy "turmas_leitura" on public.turmas for select to authenticated using (true);
create policy "turmas_coord" on public.turmas for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

create policy "disciplinas_leitura" on public.disciplinas for select to authenticated using (true);
create policy "disciplinas_coord" on public.disciplinas for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

-- Perfis: cada usuário vê o próprio; coordenação vê todos.
create policy "perfis_proprio" on public.perfis for select to authenticated
    using (user_id = auth.uid() or public.auth_eh_coordenacao());
create policy "perfis_coord" on public.perfis for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

-- Alunos: coordenação tudo; professor vê sua turma; aluno vê a si mesmo.
create policy "alunos_leitura_coord" on public.alunos for select to authenticated
    using (public.auth_eh_coordenacao());
create policy "alunos_leitura_prof" on public.alunos for select to authenticated
    using (exists (
        select 1 from public.professor_turmas pt
        where pt.professor_id = public.auth_professor_id() and pt.turma_id = alunos.turma_id
    ));
create policy "alunos_leitura_proprio" on public.alunos for select to authenticated
    using (id = public.auth_aluno_id());
create policy "alunos_coord_escrita" on public.alunos for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

-- Professores: coordenação tudo; professor vê a própria ficha.
create policy "professores_leitura" on public.professores for select to authenticated
    using (public.auth_eh_coordenacao() or id = public.auth_professor_id());
create policy "professores_coord_escrita" on public.professores for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

create policy "coordenadores_proprio" on public.coordenadores for select to authenticated
    using (user_id = auth.uid() or public.auth_eh_coordenacao());
create policy "coordenadores_coord" on public.coordenadores for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

create policy "prof_disc_proprio" on public.professor_disciplinas for select to authenticated
    using (professor_id = public.auth_professor_id() or public.auth_eh_coordenacao());
create policy "prof_disc_coord" on public.professor_disciplinas for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

create policy "prof_turmas_proprio" on public.professor_turmas for select to authenticated
    using (professor_id = public.auth_professor_id() or public.auth_eh_coordenacao());
create policy "prof_turmas_coord" on public.professor_turmas for all to authenticated
    using (public.auth_eh_coordenacao()) with check (public.auth_eh_coordenacao());

-- Notas: leitura para coordenação, professor autorizado e o próprio aluno.
-- Escrita somente pelo professor autorizado (registro identificado como dele).
create policy "notas_leitura_coord" on public.registros_notas for select to authenticated
    using (public.auth_eh_coordenacao());
create policy "notas_leitura_prof" on public.registros_notas for select to authenticated
    using (public.professor_autorizado(
        public.auth_professor_id(), disciplina_id,
        (select turma_id from public.alunos a where a.id = registros_notas.aluno_id)
    ));
create policy "notas_leitura_aluno" on public.registros_notas for select to authenticated
    using (aluno_id = public.auth_aluno_id());
create policy "notas_prof_escrita" on public.registros_notas for insert to authenticated
    with check (
        professor_id = public.auth_professor_id()
        and public.professor_autorizado(
            professor_id, disciplina_id,
            (select turma_id from public.alunos a where a.id = registros_notas.aluno_id)
        )
    );
create policy "notas_prof_correcao" on public.registros_notas for update to authenticated
    using (
        professor_id = public.auth_professor_id()
        and public.professor_autorizado(
            professor_id, disciplina_id,
            (select turma_id from public.alunos a where a.id = registros_notas.aluno_id)
        )
    )
    with check (
        professor_id = public.auth_professor_id()
        and public.professor_autorizado(
            professor_id, disciplina_id,
            (select turma_id from public.alunos a where a.id = registros_notas.aluno_id)
        )
    );

-- Frequência: mesma regra de autorização; a unique key evita aulas duplicadas.
create policy "freq_leitura_coord" on public.registros_frequencia for select to authenticated
    using (public.auth_eh_coordenacao());
create policy "freq_leitura_prof" on public.registros_frequencia for select to authenticated
    using (public.professor_autorizado(
        public.auth_professor_id(), disciplina_id,
        (select turma_id from public.alunos a where a.id = registros_frequencia.aluno_id)
    ));
create policy "freq_leitura_aluno" on public.registros_frequencia for select to authenticated
    using (aluno_id = public.auth_aluno_id());
create policy "freq_prof_escrita" on public.registros_frequencia for insert to authenticated
    with check (
        professor_id = public.auth_professor_id()
        and public.professor_autorizado(
            professor_id, disciplina_id,
            (select turma_id from public.alunos a where a.id = registros_frequencia.aluno_id)
        )
    );
create policy "freq_prof_correcao" on public.registros_frequencia for update to authenticated
    using (
        professor_id = public.auth_professor_id()
        and public.professor_autorizado(
            professor_id, disciplina_id,
            (select turma_id from public.alunos a where a.id = registros_frequencia.aluno_id)
        )
    )
    with check (
        professor_id = public.auth_professor_id()
        and public.professor_autorizado(
            professor_id, disciplina_id,
            (select turma_id from public.alunos a where a.id = registros_frequencia.aluno_id)
        )
    );

-- Atividades: criação apenas pelo professor autorizado na turma/disciplina.
create policy "atividades_leitura" on public.atividades for select to authenticated
    using (
        public.auth_eh_coordenacao()
        or professor_id = public.auth_professor_id()
        or public.professor_autorizado(public.auth_professor_id(), disciplina_id, turma_id)
        or exists (
            select 1 from public.alunos a
            where a.id = public.auth_aluno_id() and a.turma_id = atividades.turma_id
        )
    );
create policy "atividades_criar" on public.atividades for insert to authenticated
    with check (
        professor_id = public.auth_professor_id()
        and public.professor_autorizado(professor_id, disciplina_id, turma_id)
    );
create policy "atividades_alterar" on public.atividades for update to authenticated
    using (professor_id = public.auth_professor_id() or public.auth_eh_coordenacao())
    with check (professor_id = public.auth_professor_id() or public.auth_eh_coordenacao());

-- Entregas: somente o professor responsável pela atividade registra/altera.
create policy "entregas_leitura" on public.entregas for select to authenticated
    using (
        public.auth_eh_coordenacao()
        or aluno_id = public.auth_aluno_id()
        or exists (
            select 1 from public.atividades a
            where a.id = entregas.atividade_id and a.professor_id = public.auth_professor_id()
        )
    );
create policy "entregas_prof_escrita" on public.entregas for insert to authenticated
    with check (
        exists (
            select 1 from public.atividades a
            where a.id = entregas.atividade_id and a.professor_id = public.auth_professor_id()
        )
    );
create policy "entregas_prof_correcao" on public.entregas for update to authenticated
    using (
        exists (
            select 1 from public.atividades a
            where a.id = entregas.atividade_id and a.professor_id = public.auth_professor_id()
        )
    )
    with check (
        exists (
            select 1 from public.atividades a
            where a.id = entregas.atividade_id and a.professor_id = public.auth_professor_id()
        )
    );

-- Coordenação pode excluir registros acadêmicos (comum em correções de cadastro).
create policy "notas_coord_delete" on public.registros_notas for delete to authenticated
    using (public.auth_eh_coordenacao());
create policy "freq_coord_delete" on public.registros_frequencia for delete to authenticated
    using (public.auth_eh_coordenacao());
create policy "atividades_coord_delete" on public.atividades for delete to authenticated
    using (public.auth_eh_coordenacao());
create policy "entregas_coord_delete" on public.entregas for delete to authenticated
    using (public.auth_eh_coordenacao());

-- Histórico: leitura restrita; inserção somente pela RPC validada abaixo.
create policy "historico_leitura" on public.historico_ipa for select to authenticated
    using (
        public.auth_eh_coordenacao()
        or aluno_id = public.auth_aluno_id()
        or exists (
            select 1 from public.alunos a
            join public.professor_turmas pt on pt.turma_id = a.turma_id
            where a.id = historico_ipa.aluno_id and pt.professor_id = public.auth_professor_id()
        )
    );

-- RPC de inserção do histórico: valida permissão e dados antes de gravar.
create or replace function public.registrar_historico_ipa(
    p_aluno_id bigint,
    p_indicadores jsonb,
    p_ipa numeric,
    p_completo boolean,
    p_classificacao text,
    p_classificacao_chave text,
    p_media_geral numeric,
    p_motivo text,
    p_origem text
)
returns bigint
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
    v_id bigint;
    v_turma bigint;
    v_permitido boolean;
begin
    select turma_id into v_turma from public.alunos where id = p_aluno_id;
    if v_turma is null then
        raise exception 'Aluno não encontrado';
    end if;

    v_permitido := public.auth_eh_coordenacao() or exists (
        select 1 from public.professor_turmas
        where professor_id = public.auth_professor_id() and turma_id = v_turma
    );
    if not coalesce(v_permitido, false) then
        raise exception 'Sem permissão para registrar histórico deste aluno';
    end if;

    if p_classificacao_chave not in ('baixa', 'moderada', 'alta', 'incompleto') then
        raise exception 'Classificação inválida';
    end if;
    if p_completo and (p_ipa is null or p_ipa < 0 or p_ipa > 100) then
        raise exception 'IPA completo precisa estar entre 0 e 100';
    end if;
    if not p_completo and p_ipa is not null then
        raise exception 'IPA incompleto não pode ter valor definitivo';
    end if;

    insert into public.historico_ipa (
        aluno_id, indicadores, ipa, completo, classificacao,
        classificacao_chave, media_geral, motivo, origem
    ) values (
        p_aluno_id, p_indicadores, p_ipa, p_completo, p_classificacao,
        p_classificacao_chave, p_media_geral, p_motivo, p_origem
    ) returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.registrar_historico_ipa(bigint, jsonb, numeric, boolean, text, text, numeric, text, text) from public;
grant execute on function public.registrar_historico_ipa(bigint, jsonb, numeric, boolean, text, text, numeric, text, text) to authenticated;

-- ---------- Permissões ----------
-- service_role não é concedida ao frontend; o Supabase já a possui no servidor.

grant usage on schema public to authenticated;

grant select on public.turmas, public.disciplinas, public.perfis,
    public.alunos, public.professores, public.coordenadores,
    public.professor_disciplinas, public.professor_turmas,
    public.registros_notas, public.registros_frequencia,
    public.atividades, public.entregas, public.historico_ipa
    to authenticated;

grant insert, update on public.turmas, public.disciplinas, public.perfis,
    public.alunos, public.professores, public.coordenadores,
    public.professor_disciplinas, public.professor_turmas,
    public.registros_notas, public.registros_frequencia,
    public.atividades, public.entregas
    to authenticated;

-- historico_ipa: sem INSERT/UPDATE/DELETE para authenticated; apenas a RPC.
-- Delete nas demais tabelas fica restrito à coordenação via policies + grant.
grant delete on public.turmas, public.disciplinas, public.perfis,
    public.alunos, public.professores, public.coordenadores,
    public.professor_disciplinas, public.professor_turmas,
    public.registros_notas, public.registros_frequencia,
    public.atividades, public.entregas
    to authenticated;

-- ============================================================
-- Após aplicar: popular perfis (user_id -> papel/referencia_id), turmas,
-- disciplinas e as autorizações professor_disciplinas/professor_turmas.
-- Sem esses vínculos, as policies negam escrita (fail-closed).
-- ============================================================
