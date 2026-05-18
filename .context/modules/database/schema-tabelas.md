# Schema Supabase — Descritivo das Tabelas (`public`)

Levantamento via MCP do Supabase (`list_tables` verbose). **61 tabelas** no schema `public`, **100% com RLS habilitado**.

Última sincronização: 2026-05-18

---

## 1. Atendimento / Conversas (WhatsApp + IA)

### `conversations` (298 linhas)
- **Objetivo:** Núcleo do atendimento — uma conversa por contato/telefone do WhatsApp (1:1 ou grupo), com integração de IA para classificação/sumarização e vínculo ao cliente CRM.
- **Colunas-chave:** `id` (PK), `phone` (unique), `name`, `last_message`, `last_message_at`, `unread_count`, `status` (pending/active/resolved), `assigned_to` → profiles, `cliente_id` → clientes_cadastro, `is_group`, `group_id`, `group_subject`, `group_participants_count`, `ai_summary`, `ai_classification` (Reclamacao/Aguardando Ajuste/Normal/Solicitado Ajuste), `ai_confidence`, `ai_pending_messages`, `has_new_messages`, `last_customer_message_at`, `last_agent_message_at`, `marked_as_responded_at`, `chat_lid`, `ai_resumo_alerta`, `is_archived`.
- **Relacionamentos:** Hub do atendimento — recebe FK de messages, conversation_tags, conversation_notes, conversation_ai_analyses, message_reactions, ai_classification_logs, conversation_tag_history.

### `messages` (7.969 linhas)
- **Objetivo:** Cada mensagem trocada dentro de uma `conversation` (texto, mídia, sticker, location, etc.).
- **Colunas-chave:** `conversation_id` (FK), `content`, `sender_type` (customer/agent), `message_id` (id externo Z-API), `status` (sending/sent/delivered/read/failed), `message_type` (text/image/audio/video/document/sticker/location/contact), `media_url`, `media_mime_type`, `media_caption`, `reply_to_message_id`, `sender_id` → auth.users, `group_participant_phone/name`, `deleted_at`.

### `tags` (6 linhas)
- **Objetivo:** Catálogo de etiquetas aplicáveis a conversas (manuais ou só IA).
- **Colunas-chave:** `name` (unique), `color`, `ai_only` (se true, só a IA aplica).

### `conversation_tags` (2 linhas)
- **Objetivo:** Junção N-N entre conversas e tags, com origem (manual/ai).
- **Colunas-chave:** PK composta `(conversation_id, tag_id)`, `source`, `added_at`.

### `conversation_tag_history` (70 linhas)
- **Objetivo:** Auditoria de cada vez que uma tag foi adicionada/removida (com fonte IA/manual e snapshot do classificador).
- **Colunas-chave:** `conversation_id`, `tag_id`, `cliente_id`, `action` (added/removed), `source` (ai/manual), `performed_by`, `ai_classification`, `ai_summary_snapshot`, `responsible_user_id/name`.

### `conversation_notes` (4 linhas)
- **Objetivo:** Notas internas vinculadas a uma conversa.
- **Colunas-chave:** `conversation_id`, `content`, `author_id` → profiles.

### `note_history` (0 linhas)
- **Objetivo:** Versões/edições históricas de cada `conversation_note`.
- **Colunas-chave:** `note_id`, `version`, `content`, `editor_id`, `edited_at`.

### `note_reactions` (0 linhas)
- **Objetivo:** Reações de usuários a notas internas (heart/thumbsup/clap/angry/sad).
- **Colunas-chave:** `note_id`, `user_id`, `reaction_type` (enum `note_reaction_type`).

### `note_acknowledgments` (5 linhas)
- **Objetivo:** Confirmação de leitura/ciência de uma nota por usuário.
- **Colunas-chave:** `note_id`, `user_id`, `acknowledged_at`.

### `message_reactions` (193 linhas)
- **Objetivo:** Reações emoji aplicadas a mensagens individuais do WhatsApp.
- **Colunas-chave:** `conversation_id`, `message_zapi_id`, `emoji`, `sender_type`, `sender_phone`, `group_participant_phone/name`.

### `mensagens_padrao` (4 linhas)
- **Objetivo:** Respostas rápidas (atalho `/`) acionadas dentro do chat — placeholder `{nome}`.
- **Colunas-chave:** `titulo`, `atalho`, `conteudo`, `is_active`.

### `message_templates` (1 linha)
- **Objetivo:** Templates de mensagens automatizadas categorizadas (boas_vindas, lembrete, atualizacao, finalizacao, cobranca, outro) com variável `{{nome}}`.
- **Colunas-chave:** `type` (enum `message_template_type`, unique), `name`, `content`, `description`, `is_active`.

### `conversation_ai_analyses` (776 linhas)
- **Objetivo:** Histórico completo de todas as análises de IA executadas sobre conversas.
- **Colunas-chave:** `conversation_id`, `summary`, `classification`, `confidence`, `justification`, `messages_analyzed`, `last_message_id`, `new_messages_count`, `previous_classification`, `classification_changed`, `trigger_type` (auto/manual/scheduled/keyword), `model_used` (default `gpt-4o-mini`), `tokens_used`, `processing_time_ms`, `alert_summary`.

### `ai_classification_logs` (15 linhas)
- **Objetivo:** Log de eventos quando alguém resolve/reverte uma classificação de IA.
- **Colunas-chave:** `conversation_id`, `previous_classification`, `previous_summary`, `justification`, `resolved_by` → auth.users, `resolved_by_name`.

### `contacts` (3.534 linhas)
- **Objetivo:** Catálogo simples de contatos (telefone + nome) — lista paralela para autocomplete/iniciar conversa.
- **Colunas-chave:** `phone`, `name`, `created_by` → profiles.

---

## 2. Pipeline / Funil de Clientes (CRM)

### `clientes_cadastro` (871 linhas) — *"Tabela para cadastro de clientes via API pública"*
- **Objetivo:** Entidade central do CRM operacional do Atendy — cadastro com todas as informações comerciais, produção, branding e onboarding agregadas (modelo legado denormalizado).
- **Colunas-chave:** `code` (id externo), `nomecliente`, `name_normalized`, `whatsapp`, `email`, `instagram`, `instagram_link`, `company_name`, `nome_fantasia`, `company_cnpj`, `endereco_completo`, `segment`/`subsegment` + `segmento_id`/`subsegmento_id`/`negocio_id` (FKs), `agency_id`, `channel`, `deal_value`, `valor`, `vigencia`, `inicio_vigencia`, `data_assinatura_contrato`, `data_primeira_entrega`, `prazo_final`, `praca`, `lead_score`, `mql_classification`, `classificacao` (Bronze/Prata/Ouro/Diamante), `current_stage_id` (FK pipeline), `stage_entered_at`, `assigned_to`, `responsavel_atendimento`, `celebridade`, `celebridade_foto`, `celebridade_anterior`, `celebridade_trocada`, `troca_celebridade_solicitada`, `locutor_genero`, `pronuncia_texto`, `pronuncia_audio_url`, `briefing`, `cores` (jsonb), `banco_imagem` (jsonb), `referencia_visual_arquivos` (jsonb), `link_pasta_drive/proposta/entrega/envio_cliente/estatica/video`, `sgc_link`, `drive_links` (jsonb), `notes`, `anexo`, `is_archived`.
- **Relacionamentos:** Tabela "hub" — referenciada por client_phones, client_adjustments, production_tasks, client_comments, conversations, kanban_pecas, client_meetings, client_productions, client_stage_history, conversation_tag_history, celebrity_approvals, celebrity_approval_history, purchases (legacy), clients (legacy), todos os onboarding_*, ai_campaign_*.

### `clients` (3 linhas) — *"Entidade normalizada de cliente, ligada temporariamente a clientes_cadastro."*
- **Objetivo:** Nova tabela de cliente em modelo normalizado para migração progressiva do legado.
- **Colunas-chave:** `legacy_cliente_id` (unique → clientes_cadastro), `name`, `email`, `phone`, `instagram`, `metadata` (jsonb).

### `purchases` (3 linhas) — *"Entidade normalizada de compra/contrato/campanha para migracao progressiva."*
- **Objetivo:** Modelo normalizado de compra/contrato/campanha (substituirá colunas comerciais de clientes_cadastro). Carrega dados de proposta, ClickSign, upsell, MGS, vendedor e histórico de contatos do CRM externo.
- **Colunas-chave:** `client_id` → clients, `legacy_cliente_id` (unique) → clientes_cadastro, `external_compra_id`, `external_lead_id`, `external_cliente_id`, `status` (draft/active/completed/cancelled), `amount`, `valor_total_proposta`, `vigencia_meses`, `celebridade`, `praca`, `data_venda_crm`, `tipo_venda`, `is_mgs`, `pack_promocional_id`, `forma_pagamento`, `parcelado`, `numero_parcelas`, `pagamento_metodos` (jsonb), `pagamento_futuro`, `clicksign_envelope_id/status`, `contrato_url`, `signatario`, `data_envio_assinatura`, `upsell_imagens_qtd`, `upsell_videos_qtd`, `upsell_custom_desc/valor`, `condicao_pagamento_mgs`, `parcelas_mgs`, `vendedor_id/nome/email`, `historico_contatos` (jsonb), `metadata` (jsonb).
- **Relacionamentos:** Hub do onboarding e campanhas IA (referenciada por todas onboarding_* e ai_campaign_*).

### `client_pipeline_stages` (25 linhas) — *"Etapas do pipeline de clientes"*
- **Objetivo:** Define as colunas/estágios do funil de clientes (Kanban configurável).
- **Colunas-chave:** `name`, `slug` (unique), `description`, `color`, `icon`, `order_index`, `is_active`, `is_final`.

### `client_stage_history` (1.754 linhas) — *"Histórico de mudanças de etapa (linha do tempo)"*
- **Objetivo:** Timeline de movimentações entre etapas e mudanças de responsável.
- **Colunas-chave:** `cliente_id`, `from_stage_id`, `to_stage_id`, `from_assigned_to`, `to_assigned_to`, `changed_by`, `action_type` (default `stage_change`), `reason`, `metadata` (jsonb).

### `client_comments` (2.079 linhas) — *"Comentários internos sobre clientes"*
- **Colunas-chave:** `cliente_id`, `author_id`, `content`, `attachments` (jsonb com `{url, name, type, size}`).

### `client_phones` (806 linhas)
- **Objetivo:** Múltiplos telefones por cliente (1 principal + secundários rotulados).
- **Colunas-chave:** `cliente_id`, `phone`, `label` (default 'Principal'), `is_primary`.

### `client_meetings` (2 linhas) — *"Agendamentos e reuniões com clientes"*
- **Colunas-chave:** `cliente_id`, `title`, `description`, `scheduled_at`, `duration_minutes`, `meeting_type`, `meeting_link`, `status`, `organizer_id`, `participants` (jsonb), `notes`.

### `client_productions` (0 linhas) — *"Produções/trabalhos do cliente"*
- **Objetivo:** Trabalhos/produções do cliente (parece concorrer com production_tasks — possivelmente legado ou granularidade diferente).
- **Colunas-chave:** `cliente_id`, `title`, `production_type`, `status`, `priority`, `deadline`, `completed_at`, `files` (jsonb), `metadata` (jsonb), `assigned_to`, `created_by`.

### `client_adjustments` (2.725 linhas) — *"Tabela para gerenciar ajustes solicitados vinculados a clientes e tarefas de produção"*
- **Objetivo:** Pedidos de ajuste/refação por cliente classificados por tipo.
- **Colunas-chave:** `cliente_id`, `task_id` (nullable), `content`, `attachments` (jsonb), `status` (a_fazer/feito), `adjustment_type` (pedido_cliente/erro_producao/ajuste_nao_feito), `created_by`, `completed_by`, `completed_at`.

### `segmentos` (64) / `subsegmentos` (344) / `negocios` (359)
- **Objetivo:** Hierarquia de categorização de clientes (mercado → subsegmento → tipo de negócio). Todas têm `sgc_uuid` indicando origem externa.
- **Colunas-chave:** `nome`, `active`, `csv_imported`, mais FKs em cadeia (subsegmentos → segmentos; negocios → subsegmentos + segmentos).

### `landing_leads` (0 linhas)
- **Objetivo:** Leads capturados de landing pages externas (default origem `site-amaranto-gallinari`).
- **Colunas-chave:** `nome`, `telefone`, `email`, `assunto`, `mensagem`, `origem`, `lido`.

---

## 3. Produção / Kanban de Peças e Tarefas

### `kanban_pecas` (10.068 linhas)
- **Objetivo:** Peças individuais do Kanban de produção do cliente (cada arte/vídeo a entregar).
- **Colunas-chave:** `cliente_id`, `nome`, `descricao`, `status` (enum `kanban_status`: a_fazer/fazendo/feitas), `ordem`, `tipo` (enum `peca_tipo`: imagem/video), `created_by`, `completed_at`.

### `production_tasks` (2.580 linhas) — *"Tasks de produção com sistema de prioridades"*
- **Objetivo:** Tarefas de produção (cards no Kanban de produção), com hierarquia parent/subtask e vínculo a etapa do pipeline.
- **Colunas-chave:** `cliente_id`, `pipeline_stage_id`, `assigned_to`, `created_by`, `title`, `description`, `briefing`, `status` (enum `task_status`: a_fazer/fazendo/finalizado), `priority` (enum `task_priority`: baixa/media/alta/critica), `is_urgent`, `is_main_task`, `parent_task_id` (autorrelacionamento), `is_task_started`, `task_work_started_at`, `deadline`, `started_at`, `completed_at`, `ordem`, `referencia_visual_arquivos` (jsonb), `link_pasta_estatica/video`.

### `task_checklist_items` (91 linhas)
- **Colunas-chave:** `task_id`, `label`, `checked`, `ordem`, `created_by`, `checked_by`, `checked_at`.

### `task_scripts` (3.090 linhas) — *"Roteiros vinculados às tarefas de produção"*
- **Objetivo:** Roteiros (textos/links Google Docs) associados a tarefas e opcionalmente a uma peça específica.
- **Colunas-chave:** `task_id`, `peca_id` (nullable), `title`, `status` (enum `script_status`: rascunho/em_revisao/aprovado/em_uso/produzindo/em_aprovacao), `link`, `notes`.

### `task_history` (37.387 linhas) — *"Histórico de atividades e mudanças nas tarefas"*
- **Objetivo:** Audit log granular de mudanças nas production_tasks (timeline da task).
- **Colunas-chave:** `task_id`, `action_type` (enum `task_history_action` com ~17 valores: created, stage_change, status_change, assignment_change, priority_change, deadline_change, title_change, description_change, script_added/updated/removed, subtask_added/removed, checklist_added/completed, adjustment_added/completed, comment_added), `from_stage_id`/`to_stage_id`, `from_assigned_to`/`to_assigned_to`, `field_name`, `old_value`, `new_value`, `metadata` (jsonb), `changed_by`.

### `task_comments` (0 linhas)
- **Objetivo:** Comentários em tarefas, com menções a usuários.
- **Colunas-chave:** `task_id`, `author_id`, `content`, `mentions` (array uuid), `attachments` (jsonb).

### `task_time_entries` (3.101 linhas)
- **Objetivo:** Apontamentos de tempo trabalhado em tarefas (start/pause com motivo) — `duration_seconds` é coluna gerada.
- **Colunas-chave:** `task_id`, `pipeline_stage_id`, `started_by`, `started_at`, `paused_at`, `pause_reason`, `duration_seconds` (generated).

### `task_pecas` (5.179 linhas) — *"Tabela de junção entre tarefas de produção e peças do kanban"*
- **Colunas-chave:** `task_id`, `peca_id`.

---

## 4. Aprovação de Celebridades

### `celebridadesReferencia` (229 linhas)
- **Objetivo:** Catálogo de celebridades disponíveis para campanhas.
- **Colunas-chave:** `nome`, `nomeJuridico`, `nivel`, `gruponovo`, `fotoMobile`, `fotoPrincipal`, `fotoSecundaria`, `instagram_followers`, `description`, `ativo`, `sgc_uuid`.

### `celebridade_frases` (0 linhas) — *"Frases extraídas dos PDFs de celebridades (pasta CELEB)"*
- **Objetivo:** Banco de frases já gravadas/disponíveis por celebridade.
- **Colunas-chave:** `nome_celebridade`, `frase`, `codigo` (ex: AZ001, JB259), `tempo` (MM:SS), `arquivo_origem`.

### `celebrity_approvals` (2.736 linhas)
- **Objetivo:** Fluxo de aprovação de peças pela celebridade (1 registro corrente por peça).
- **Colunas-chave:** `cliente_id`, `peca_id`, `task_id`, `status` (pendente/aprovado/reprovado/aguardando_retorno), `reviewer_id`, `submitted_by`, `submitted_at`, `reviewed_at`, `approval_note`, `comment`, `rejection_reason`, `rejection_attachments` (jsonb).

### `celebrity_approval_history` (331 linhas) — *"Historical records of previous celebrity approval cycles."*
- **Objetivo:** Arquivo histórico de ciclos anteriores (preservados quando peça é resubmetida após rejeição).
- **Colunas-chave:** `approval_id`, `cliente_id`, `peca_id`, `task_id`, `status`, `reviewer_id`, `rejection_reason`, `rejection_attachments` (jsonb), `approval_note`, `comment`, `reviewed_at`, `original_created_at`, `archived_at`.

---

## 5. Onboarding (entrada de novos clientes)

### `onboarding_links` (2) — *"Links publicos revogaveis do onboarding nativo do Atendy."*
- **Colunas-chave:** `token_hash` (unique), `purchase_id`, `clientes_cadastro_id`, `status` (active/revoked/expired/completed), `expires_at`, `created_by`, `last_accessed_at`.

### `onboarding_progress` (1)
- **Objetivo:** Estado da jornada de onboarding por compra (passo atual 1-8, respostas acumuladas).
- **Colunas-chave:** `purchase_id` (unique), `clientes_cadastro_id`, `current_step` (1-8), `answers` (jsonb), `completed_at`.

### `onboarding_acceptances` (1)
- **Objetivo:** Aceites granulares (item por item) durante o onboarding — auditável via `item_hash`.
- **Colunas-chave:** `purchase_id`, `clientes_cadastro_id`, `step_key`, `item_key`, `item_text`, `item_hash`, `copy_source`, `accepted_at`.

### `onboarding_identity` (0)
- **Objetivo:** Identidade visual coletada (logo, paleta, fonte, brand name).
- **Colunas-chave:** `purchase_id` (unique), `clientes_cadastro_id`, `choice` (add_now/later), `logo_path`, `site_url`, `instagram_handle`, `brand_display_name`, `brand_palette` (jsonb), `font_choice`, `campaign_notes`.

### `onboarding_identity_submissions` (0)
- **Objetivo:** Snapshots imutáveis (jsonb) de cada submissão de identidade.
- **Colunas-chave:** `purchase_id`, `clientes_cadastro_id`, `snapshot` (jsonb), `submitted_at`.

### `onboarding_logo_history` (0)
- **Objetivo:** Histórico de uploads de logo (qual está ativa).
- **Colunas-chave:** `purchase_id`, `logo_path`, `original_filename`, `mime_type`, `size_bytes`, `source`, `is_active`, `uploaded_by_user_id`, `uploaded_at`.

### `onboarding_briefings` (0)
- **Objetivo:** Briefing gerado por IA (Perplexity etc.) durante onboarding.
- **Colunas-chave:** `purchase_id` (unique), `clientes_cadastro_id`, `mode` (default 'ai'), `brief_text`, `briefing_json` (jsonb), `citations_json` (jsonb), `provider`, `provider_model`, `prompt_version`, `status` (pending/processing/done/error), `error_code`.

### `onboarding_enrichment_jobs` (0)
- **Objetivo:** Job orquestrador (extrai paleta, detecta fonte, gera briefing e dispara campanha IA com fases independentes).
- **Colunas-chave:** `purchase_id` (unique), `status`, `phase_colors_status`, `phase_font_status`, `phase_briefing_status`, `phase_campaign_status`, `extracted_palette` (array), `extracted_palette_source`, `detected_font`, `detected_font_source`, `font_validated`, `briefing_generated`, `campaign_job_id` → ai_campaign_jobs, `error_phase`, `error_message`, `phases_log` (jsonb).

### `onboarding_copy` (1) — singleton (`id boolean` com check)
- **Objetivo:** Cópia (textos) viva do fluxo de onboarding.
- **Colunas-chave:** `content` (jsonb), `version`, `published_by`, `updated_at`.

### `onboarding_copy_versions` (0)
- **Objetivo:** Histórico versionado dos textos do onboarding.
- **Colunas-chave:** `version`, `content` (jsonb), `changed_etapas` (array text), `notes`, `published_by`.

---

## 6. IA / Campanhas Generativas

### `ai_campaign_jobs` (0)
- **Objetivo:** Job orquestrador de geração de campanhas/criativos (snapshot reprodutível de prompt+config).
- **Colunas-chave:** `purchase_id`, `clientes_cadastro_id`, `status`, `provider`, `provider_model`, `prompt_version`, `input_hash`, `prompt_snapshot` (jsonb), `config_snapshot` (jsonb), `started_at`, `completed_at`.

### `ai_campaign_assets` (0)
- **Objetivo:** Assets (imagens etc.) gerados por um campaign job.
- **Colunas-chave:** `job_id`, `purchase_id`, `clientes_cadastro_id`, `asset_type` (default 'image'), `storage_path`, `public_url`, `prompt`, `metadata` (jsonb), `status`.

### `ai_campaign_errors` (0)
- **Objetivo:** Log estruturado de erros em campanhas IA.
- **Colunas-chave:** `job_id`, `purchase_id`, `phase`, `code`, `message`, `details` (jsonb).

### `perplexity_config` / `nanobanana_config` / `enrichment_config` (1 linha cada — singletons)
- **Objetivo:** Configurações vivas das integrações de IA: Perplexity (briefing), Nanobanana (geração de imagem com prompts agrupados por estilo: moderna/clean/retail) e Enrichment (pipeline do onboarding).
- **Colunas-chave:** `id` (boolean true PK), `config`/`moderna`/`clean`/`retail` (jsonb), `updated_by`, `updated_at`.

---

## 7. Plataforma / Usuários / Atividade

### `profiles` (67 linhas)
- **Objetivo:** Perfil estendido do usuário do sistema (espelha auth.users com papel, especialidade e permissões granulares).
- **Colunas-chave:** `id` (PK = auth.users.id), `full_name`, `avatar_url`, `role` (enum `user_role`: admin/supervisor/attendant/producao), `status` (enum `user_status`: pending/active/blocked), `specialty` (enum `user_specialty`: roteirista/video/design/audio/celebridade/atendimento/gestor/aprovacao_celebridade), `is_team_admin`, `permissions` (jsonb com 14 flags: can_view_chat/can_view_team/can_edit_tasks/can_view_tasks/can_manage_team/can_edit_clients/can_view_clients/can_view_reports/can_edit_pipeline/can_send_messages/can_view_pipeline/can_view_settings/can_view_dashboard/can_manage_settings), `autorizado_tirar_analise_ia`.
- **Relacionamentos:** Referenciada por praticamente toda tabela operacional (assigned_to, created_by, author_id, reviewer_id etc.).

### `activity_log` (3.799 linhas)
- **Objetivo:** Log genérico de ações de usuários no sistema (auditoria global).
- **Colunas-chave:** `user_id`, `action`, `entity_type`, `entity_id`, `metadata` (jsonb).

### `system_notifications` (30.890 linhas)
- **Objetivo:** Notificações in-app direcionadas a usuários (lidas/não lidas).
- **Colunas-chave:** `target_user_id` → profiles, `type`, `title`, `message`, `metadata` (jsonb), `read_at`.

### `alarms` (4 linhas) — *"Alarmes/lembretes criados por usuários para membros do time"*
- **Objetivo:** Lembretes/alarmes agendados por um usuário para outro (com ciência e cancelamento opcionais).
- **Colunas-chave:** `created_by`, `target_user_id`, `title`, `description`, `scheduled_at`, `acknowledged_at`, `cancelled_at`.

---

## Observações sobre o modelo

- **Tabela hub do operacional:** `clientes_cadastro` é o ponto central — quase tudo aponta para ela. Existe migração em curso para `clients` + `purchases` (modelo normalizado).
- **Singletons:** `onboarding_copy`, `perplexity_config`, `nanobanana_config`, `enrichment_config` usam o padrão `id boolean DEFAULT true CHECK (id)` para garantir uma única linha.
- **RLS:** habilitado em **100%** das tabelas (61/61).
- **Comentários no banco:** todas as 61 tabelas e 373 colunas-chave possuem `COMMENT ON` correspondente — visíveis no Studio do Supabase e via SQL (`obj_description` / `col_description`).
- **Auditoria/histórico:** sistema rico em tabelas de histórico paralelo — `task_history` (37k), `client_stage_history` (1.7k), `conversation_ai_analyses` (776), `conversation_tag_history`, `note_history`, `celebrity_approval_history`, `onboarding_copy_versions`, `onboarding_logo_history`, `onboarding_identity_submissions`, `activity_log`.
- **Volumes notáveis:** `task_history` (37k), `system_notifications` (31k), `kanban_pecas` (10k), `messages` (8k), `task_pecas` (5,2k), `contacts` (3,5k), `task_scripts` (3,1k), `task_time_entries` (3,1k), `celebrity_approvals` (2,7k), `client_adjustments` (2,7k), `production_tasks` (2,6k), `client_comments` (2k), `client_stage_history` (1,7k).
- **Enums no schema:** `user_role`, `user_status`, `user_specialty`, `note_reaction_type`, `message_template_type`, `kanban_status`, `peca_tipo`, `task_status`, `task_priority`, `script_status`, `task_history_action`.
