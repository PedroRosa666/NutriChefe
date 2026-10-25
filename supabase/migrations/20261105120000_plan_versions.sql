/*
  Etapa 2 do plano de implementação (HIST): versões do plano alimentar e histórico mínimo.

  - O plano (meal_plans + meal_plan_items) passa a ser o RASCUNHO de quem o fez. "revision" conta
    cada salvamento: quem salva informa a revisão que abriu e, se outra aba ou aparelho salvou antes,
    recebe "version_conflict" sem perder o que editou.
  - Os itens têm identidade fixa: salvar atualiza pelo id (antes apagava e recriava tudo) e guarda a
    ordem em "position".
  - Publicar cria uma VERSÃO imutável (meal_plan_versions) com um retrato do conteúdo: itens, nomes
    e nutrientes das receitas e dos alimentos naquele momento. Editar uma receita ou um alimento
    depois não muda a versão publicada nem o que já foi para o diário.
  - Vigência: a versão vale a partir de hoje; se o paciente já marcou alguma refeição deste plano
    hoje, a partir de amanhã (não mistura duas prescrições no mesmo dia).
  - O paciente vê a versão vigente e escolhe qual plano está "em uso" (client_plan_selection). Um
    plano novo entra em uso sozinho só quando o paciente ainda não tem nenhum.
  - Trocas aprovadas entram no rascunho; se não havia outras alterações por publicar, já publicam
    uma versão nova. "effective_from" diz a partir de quando a troca vale.
  - care_events: histórico mínimo gerado pelo banco (plano publicado, metas alteradas, vínculo
    iniciado/encerrado). Só existe se a gravação de origem deu certo (mesma transação).
  - Planos que já existiam viram a versão 1, marcada como "legacy" (conteúdo de hoje, sem inventar
    versões antigas).
*/

-- 1) Rascunho com revisão e itens com ordem ---------------------------------------------------------
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_revision integer NOT NULL DEFAULT 0;

ALTER TABLE meal_plan_items ADD COLUMN IF NOT EXISTS position smallint NOT NULL DEFAULT 0;

-- 2) Versões publicadas -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number > 0),
  plan_revision integer NOT NULL,
  valid_from date NOT NULL,
  content jsonb NOT NULL,
  published_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  legacy boolean NOT NULL DEFAULT false,
  UNIQUE (plan_id, number)
);
CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON meal_plan_versions(plan_id, valid_from DESC, number DESC);
CREATE INDEX IF NOT EXISTS idx_plan_versions_client ON meal_plan_versions(client_id);

ALTER TABLE meal_plan_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View plan versions" ON meal_plan_versions;
CREATE POLICY "View plan versions"
  ON meal_plan_versions FOR SELECT TO authenticated
  USING (public.can_view_meal_plan(plan_id));
-- Versões só nascem pela publicação (abaixo) e nunca mudam.
REVOKE INSERT, UPDATE, DELETE ON meal_plan_versions FROM anon, authenticated;
GRANT SELECT ON meal_plan_versions TO authenticated;

-- Hoje no fuso do app (o mesmo de my_progress).
CREATE OR REPLACE FUNCTION public.app_today()
RETURNS date
LANGUAGE sql STABLE
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- Retrato do rascunho: o que vai para a versão.
CREATE OR REPLACE FUNCTION public.plan_snapshot(p_plan uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'format', 1,
    'title', p.title,
    'notes', p.notes,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', i.id, 'day', i.day, 'meal', i.meal, 'recipe_id', i.recipe_id, 'servings', i.servings,
               'food_id', i.food_id, 'grams', i.grams, 'measure_label', i.measure_label,
               'option_group', i.option_group, 'note', i.note,
               'food', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
                 'id', f.id, 'taco_id', f.taco_id, 'owner_id', f.owner_id, 'name', f.name, 'category', f.category,
                 'kcal', f.kcal, 'protein', f.protein, 'carbs', f.carbs, 'fat', f.fat, 'fiber', f.fiber,
                 'sodium', f.sodium, 'nutrients', f.nutrients, 'measures', f.measures) END)
             ORDER BY i.day, array_position(ARRAY['breakfast', 'lunch', 'snack', 'dinner'], i.meal), i.position, i.created_at)
      FROM meal_plan_items i LEFT JOIN foods f ON f.id = i.food_id
      WHERE i.plan_id = p.id), '[]'::jsonb),
    'recipes', coalesce((
      SELECT jsonb_object_agg(r.id, jsonb_build_object(
               'title', r.title, 'image', r.image, 'category', r.category, 'prep_time', r.prep_time,
               'difficulty', r.difficulty, 'nutrition_facts', r.nutrition_facts, 'ingredients', r.ingredients))
      FROM recipes r
      WHERE r.id IN (SELECT i.recipe_id FROM meal_plan_items i WHERE i.plan_id = p.id AND i.recipe_id IS NOT NULL)), '{}'::jsonb)
  )
  FROM meal_plans p WHERE p.id = p_plan;
$$;
REVOKE ALL ON FUNCTION public.plan_snapshot(uuid) FROM public, anon, authenticated;

-- 3) Plano em uso pelo paciente --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_plan_selection (
  client_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  selected_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE client_plan_selection ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own plan selection" ON client_plan_selection;
CREATE POLICY "Read own plan selection"
  ON client_plan_selection FOR SELECT TO authenticated
  USING (client_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON client_plan_selection FROM anon, authenticated;
GRANT SELECT ON client_plan_selection TO authenticated;

CREATE OR REPLACE FUNCTION public.select_active_plan(p_plan uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM meal_plans WHERE id = p_plan AND client_id = auth.uid())
     OR NOT public.can_view_meal_plan(p_plan) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  INSERT INTO client_plan_selection (client_id, plan_id) VALUES (auth.uid(), p_plan)
  ON CONFLICT (client_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, selected_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.select_active_plan(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.select_active_plan(uuid) TO authenticated;

-- 4) Histórico mínimo ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS care_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Profissional dono da origem (plano dele, vínculo com ele). NULL: visível a todo nutricionista
  -- com vínculo ativo (ex.: metas, que todos eles enxergam).
  nutritionist_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('plan_published', 'goals_changed', 'link_started', 'link_ended')),
  entity_id uuid,
  entity_version integer,
  -- Só campos permitidos (nada de conteúdo clínico completo).
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_care_events_client ON care_events(client_id, occurred_at DESC, id);

ALTER TABLE care_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View care events" ON care_events;
CREATE POLICY "View care events"
  ON care_events FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR (public.is_my_patient(client_id) AND (nutritionist_id IS NULL OR nutritionist_id = auth.uid()))
  );
-- Eventos só pelo banco; ninguém altera nem apaga pela API.
REVOKE INSERT, UPDATE, DELETE ON care_events FROM anon, authenticated;
GRANT SELECT ON care_events TO authenticated;

CREATE OR REPLACE FUNCTION public.record_care_event(
  p_client uuid, p_nutritionist uuid, p_kind text, p_entity uuid, p_version integer, p_summary jsonb, p_dedupe text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO care_events (client_id, nutritionist_id, actor_id, kind, entity_id, entity_version, summary, dedupe_key)
  VALUES (p_client, p_nutritionist, auth.uid(), p_kind, p_entity, p_version, coalesce(p_summary, '{}'::jsonb), p_dedupe)
  ON CONFLICT (dedupe_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.record_care_event(uuid, uuid, text, uuid, integer, jsonb, text) FROM public, anon, authenticated;

-- Metas alteradas (por quem quer que seja): um evento por transação.
CREATE OR REPLACE FUNCTION public.event_goals_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.calories, NEW.protein, NEW.carbs, NEW.fat, NEW.fiber)
                          IS NOT DISTINCT FROM (OLD.calories, OLD.protein, OLD.carbs, OLD.fat, OLD.fiber) THEN
    RETURN NEW;
  END IF;
  PERFORM public.record_care_event(
    NEW.user_id, NULL, 'goals_changed', NEW.user_id, NULL,
    jsonb_build_object('calories', NEW.calories, 'protein', NEW.protein, 'carbs', NEW.carbs, 'fat', NEW.fat,
                       'fiber', NEW.fiber, 'set_by', NEW.set_by),
    'goals:' || NEW.user_id || ':' || txid_current());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_goals_changed() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_event_goals ON nutrition_goals;
CREATE TRIGGER trg_event_goals AFTER INSERT OR UPDATE ON nutrition_goals
  FOR EACH ROW EXECUTE FUNCTION public.event_goals_changed();

-- Vínculo iniciado / encerrado.
CREATE OR REPLACE FUNCTION public.event_link_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  PERFORM public.record_care_event(
    NEW.client_id, NEW.nutritionist_id,
    CASE WHEN NEW.status = 'active' THEN 'link_started' ELSE 'link_ended' END,
    NEW.id, NULL, '{}'::jsonb,
    'link:' || NEW.id || ':' || NEW.status || ':' || txid_current());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.event_link_changed() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_event_link ON nutritionist_clients;
CREATE TRIGGER trg_event_link AFTER INSERT OR UPDATE ON nutritionist_clients
  FOR EACH ROW EXECUTE FUNCTION public.event_link_changed();

-- 5) Trocas: versão pedida e quando a troca passa a valer -------------------------------------------
ALTER TABLE food_swap_requests
  ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES meal_plan_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS effective_from date;

-- Marcações: a versão que valia no dia.
ALTER TABLE meal_plan_checks
  ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES meal_plan_versions(id) ON DELETE SET NULL;

-- Versão de um plano que vale numa data (a de maior número entre as que já começaram).
CREATE OR REPLACE FUNCTION public.plan_version_on(p_plan uuid, p_date date)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id FROM meal_plan_versions v
  WHERE v.plan_id = p_plan AND v.valid_from <= p_date
  ORDER BY v.valid_from DESC, v.number DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.plan_version_on(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.plan_version_on(uuid, date) TO authenticated;

-- 6) Publicar --------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_plan_internal(p_plan uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan meal_plans;
  v_last meal_plan_versions;
  v_from date;
  v_number integer;
  v_id uuid;
BEGIN
  SELECT * INTO v_plan FROM meal_plans WHERE id = p_plan FOR UPDATE;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'resource_archived';
  END IF;
  -- Usuário do app: só o autor, com o paciente ainda vinculado (ou o próprio paciente).
  -- Sem usuário (rotinas do servidor, como as contas demo): liberado.
  IF auth.uid() IS NOT NULL AND NOT (
       v_plan.created_by = auth.uid() AND (v_plan.client_id = auth.uid() OR public.is_my_patient(v_plan.client_id))) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  SELECT * INTO v_last FROM meal_plan_versions WHERE plan_id = p_plan ORDER BY number DESC LIMIT 1;
  -- Nada mudou desde a última publicação: devolve a versão atual.
  IF v_last.id IS NOT NULL AND v_plan.published_revision = v_plan.revision THEN
    RETURN jsonb_build_object('version_id', v_last.id, 'number', v_last.number, 'valid_from', v_last.valid_from, 'new', false);
  END IF;

  v_from := public.app_today();
  IF EXISTS (SELECT 1 FROM meal_plan_checks WHERE plan_id = p_plan AND check_date = v_from) THEN
    v_from := v_from + 1;
  END IF;
  -- Nunca antes de uma versão já agendada.
  IF v_last.valid_from > v_from THEN
    v_from := v_last.valid_from;
  END IF;
  v_number := coalesce(v_last.number, 0) + 1;

  INSERT INTO meal_plan_versions (plan_id, client_id, number, plan_revision, valid_from, content, published_by)
  VALUES (p_plan, v_plan.client_id, v_number, v_plan.revision, v_from, public.plan_snapshot(p_plan), auth.uid())
  RETURNING id INTO v_id;

  UPDATE meal_plans SET published_revision = revision, updated_at = now() WHERE id = p_plan;

  -- Trocas aprovadas que estavam esperando publicação passam a valer junto.
  UPDATE food_swap_requests SET effective_from = v_from
  WHERE plan_id = p_plan AND status IN ('approved', 'rejected') AND applied AND effective_from IS NULL;

  -- Primeiro plano do paciente: entra em uso sozinho. Se já há um em uso, o paciente escolhe.
  INSERT INTO client_plan_selection (client_id, plan_id) VALUES (v_plan.client_id, p_plan)
  ON CONFLICT (client_id) DO NOTHING;

  PERFORM public.record_care_event(
    v_plan.client_id, CASE WHEN v_plan.created_by = v_plan.client_id THEN NULL ELSE v_plan.created_by END,
    'plan_published', p_plan, v_number,
    jsonb_build_object('title', v_plan.title, 'number', v_number, 'valid_from', v_from, 'version_id', v_id),
    'plan:' || p_plan || ':' || v_number);

  RETURN jsonb_build_object('version_id', v_id, 'number', v_number, 'valid_from', v_from, 'new', true);
END;
$$;
-- As RPCs de salvar/publicar rodam como o usuário e chamam esta; ela confere sozinha quem pode.
REVOKE ALL ON FUNCTION public.publish_plan_internal(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.publish_plan_internal(uuid) TO authenticated;

/*
  Salva o rascunho (e, com p_publish, publica na mesma transação).
  - p_expected_revision: a revisão que a tela abriu; diferente da atual -> version_conflict.
  - p_operation: id da operação; repetir devolve o mesmo resultado (op_begin/op_finish).
  - Itens com "id" são atualizados; sem id, criados; os que sumiram da lista, apagados.
  SECURITY INVOKER: as regras de quem edita o plano (RLS) valem para tudo.
*/
CREATE OR REPLACE FUNCTION public.save_plan_draft(
  p_plan uuid, p_client uuid, p_title text, p_notes text, p_items jsonb,
  p_expected_revision integer, p_publish boolean, p_operation uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_done jsonb;
  v_id uuid := p_plan;
  v_revision integer;
  v_version jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  v_done := public.op_begin(p_operation, 'save_plan_draft',
    jsonb_build_object('plan', p_plan, 'client', p_client, 'title', p_title, 'notes', p_notes, 'items', p_items,
                       'rev', p_expected_revision, 'publish', p_publish));
  IF v_done IS NOT NULL THEN
    RETURN v_done;
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 400 THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO meal_plans (client_id, created_by, title, notes)
    VALUES (p_client, auth.uid(), coalesce(nullif(left(trim(p_title), 120), ''), 'Plano alimentar'), left(coalesce(p_notes, ''), 2000))
    RETURNING id, revision INTO v_id, v_revision;
  ELSE
    SELECT revision INTO v_revision FROM meal_plans WHERE id = v_id AND created_by = auth.uid() FOR UPDATE;
    IF v_revision IS NULL THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
    IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_revision THEN
      RAISE EXCEPTION 'version_conflict';
    END IF;
    UPDATE meal_plans
    SET title = coalesce(nullif(left(trim(p_title), 120), ''), 'Plano alimentar'),
        notes = left(coalesce(p_notes, ''), 2000),
        revision = revision + 1,
        updated_at = now()
    WHERE id = v_id
    RETURNING revision INTO v_revision;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_allowed';
    END IF;
  END IF;

  -- Um id que já pertence a outro plano não pode ser "puxado" para este.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
    JOIN meal_plan_items i ON i.id = nullif(e->>'id', '')::uuid
    WHERE i.plan_id <> v_id
  ) THEN
    RAISE EXCEPTION 'validation_failed';
  END IF;

  DELETE FROM meal_plan_items i
  WHERE i.plan_id = v_id
    AND i.id NOT IN (SELECT nullif(e->>'id', '')::uuid FROM jsonb_array_elements(p_items) e WHERE nullif(e->>'id', '') IS NOT NULL);

  INSERT INTO meal_plan_items (id, plan_id, day, meal, recipe_id, servings, food_id, grams, measure_label, option_group, note, position)
  SELECT coalesce(x.id, gen_random_uuid()), v_id, x.day, x.meal,
         CASE WHEN x.food_id IS NULL THEN x.recipe_id END,
         CASE WHEN x.food_id IS NULL THEN coalesce(x.servings, 1) ELSE 1 END,
         x.food_id,
         CASE WHEN x.food_id IS NOT NULL THEN x.grams END,
         CASE WHEN x.food_id IS NOT NULL THEN nullif(left(coalesce(x.measure_label, ''), 120), '') END,
         x.option_group,
         left(coalesce(x.note, ''), 300),
         least(x.ord, 32000)
  FROM jsonb_to_recordset(
         (SELECT coalesce(jsonb_agg(e || jsonb_build_object('ord', o)), '[]'::jsonb)
          FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, o))
       ) AS x(id uuid, day smallint, meal text, recipe_id uuid, servings numeric, food_id uuid, grams numeric,
              measure_label text, option_group smallint, note text, ord integer)
  ON CONFLICT (id) DO UPDATE
  SET day = EXCLUDED.day, meal = EXCLUDED.meal, recipe_id = EXCLUDED.recipe_id, servings = EXCLUDED.servings,
      food_id = EXCLUDED.food_id, grams = EXCLUDED.grams, measure_label = EXCLUDED.measure_label,
      option_group = EXCLUDED.option_group, note = EXCLUDED.note, position = EXCLUDED.position;

  IF p_publish THEN
    v_version := public.publish_plan_internal(v_id);
  END IF;

  v_result := jsonb_build_object('plan_id', v_id, 'revision', v_revision, 'version', v_version);
  RETURN public.op_finish(p_operation, v_result);
END;
$$;
REVOKE ALL ON FUNCTION public.save_plan_draft(uuid, uuid, text, text, jsonb, integer, boolean, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_plan_draft(uuid, uuid, text, text, jsonb, integer, boolean, uuid) TO authenticated;

-- Publicar o rascunho atual (botão "Publicar" do nutricionista).
CREATE OR REPLACE FUNCTION public.publish_plan(p_plan uuid, p_expected_revision integer, p_operation uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_done jsonb;
  v_revision integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  v_done := public.op_begin(p_operation, 'publish_plan', jsonb_build_object('plan', p_plan, 'rev', p_expected_revision));
  IF v_done IS NOT NULL THEN
    RETURN v_done;
  END IF;
  SELECT revision INTO v_revision FROM meal_plans WHERE id = p_plan;
  IF v_revision IS NULL THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_revision THEN
    RAISE EXCEPTION 'version_conflict';
  END IF;
  RETURN public.op_finish(p_operation, public.publish_plan_internal(p_plan));
END;
$$;
REVOKE ALL ON FUNCTION public.publish_plan(uuid, integer, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.publish_plan(uuid, integer, uuid) TO authenticated;

-- Apps antigos (ainda abertos) usam save_meal_plan: continua funcionando, agora salvando e publicando.
CREATE OR REPLACE FUNCTION public.save_meal_plan(p_plan uuid, p_client uuid, p_title text, p_notes text, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  RETURN (public.save_plan_draft(p_plan, p_client, p_title, p_notes, p_items, NULL, true, NULL) ->> 'plan_id')::uuid;
END;
$$;

-- 7) Aviso ao paciente só quando há versão nova (não a cada rascunho salvo) ------------------------
CREATE OR REPLACE FUNCTION public.notify_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by = NEW.client_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' OR NEW.published_revision <= OLD.published_revision THEN
    RETURN NEW;
  END IF;
  -- Mudança feita ao responder uma troca já gerou o aviso swap_answered (mesma transação).
  IF EXISTS (SELECT 1 FROM food_swap_requests WHERE plan_id = NEW.id AND resolved_at = now()) THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify(NEW.client_id, 'plan_updated', NEW.id, jsonb_build_object(
    'name', public.profile_name(NEW.created_by), 'title', NEW.title,
    'new', NOT EXISTS (SELECT 1 FROM meal_plan_versions WHERE plan_id = NEW.id AND number > 1)));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_plan_change() FROM public, anon, authenticated;

-- 8) Trocas -----------------------------------------------------------------------------------------
-- A troca muda o rascunho (nova revisão).
CREATE OR REPLACE FUNCTION public.apply_swap_to_plan(
  p_request food_swap_requests, p_food uuid, p_grams numeric, p_label text, p_recipe uuid, p_servings numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item uuid;
BEGIN
  SELECT i.id INTO v_item
  FROM meal_plan_items i
  WHERE i.plan_id = p_request.plan_id
    AND i.day = p_request.day
    AND i.meal = p_request.meal
    AND i.option_group IS NOT DISTINCT FROM p_request.option_group
    AND (i.recipe_id = p_request.original_recipe_id OR i.food_id = p_request.original_food_id)
  ORDER BY i.position, i.created_at
  LIMIT 1;

  IF v_item IS NULL THEN
    RETURN false;
  END IF;

  IF p_recipe IS NOT NULL THEN
    UPDATE meal_plan_items
    SET recipe_id = p_recipe, servings = coalesce(p_servings, 1), food_id = NULL, grams = NULL, measure_label = NULL
    WHERE id = v_item;
  ELSE
    UPDATE meal_plan_items
    SET recipe_id = NULL, food_id = p_food, grams = p_grams, servings = 1, measure_label = left(p_label, 120)
    WHERE id = v_item;
  END IF;

  UPDATE meal_plans SET revision = revision + 1, updated_at = now() WHERE id = p_request.plan_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_swap_to_plan(food_swap_requests, uuid, numeric, text, uuid, numeric) FROM public, anon, authenticated;

-- O pedido guarda a versão que o paciente estava vendo.
CREATE OR REPLACE FUNCTION public.swap_remember_version()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.version_id := public.plan_version_on(NEW.plan_id, public.app_today());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.swap_remember_version() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_swap_version ON food_swap_requests;
CREATE TRIGGER trg_swap_version BEFORE INSERT ON food_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.swap_remember_version();

-- Depois de responder: se a troca entrou no plano e não havia outras alterações por publicar,
-- publica já (a troca vale a partir da data da versão). Senão, fica para a próxima publicação.
CREATE OR REPLACE FUNCTION public.publish_after_swap()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan meal_plans;
BEGIN
  IF NOT NEW.applied OR OLD.status <> 'pending' OR NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_plan FROM meal_plans WHERE id = NEW.plan_id;
  -- apply_swap_to_plan somou 1 à revisão: sem outras alterações, a diferença é exatamente 1.
  IF v_plan.revision = v_plan.published_revision + 1 THEN
    PERFORM public.publish_plan_internal(NEW.plan_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_after_swap() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_publish_after_swap ON food_swap_requests;
CREATE TRIGGER trg_publish_after_swap AFTER UPDATE ON food_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.publish_after_swap();

-- 9) Marcação guarda a versão do dia -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_remember_version()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.version_id := public.plan_version_on(NEW.plan_id, NEW.check_date);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.check_remember_version() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_check_version ON meal_plan_checks;
CREATE TRIGGER trg_check_version BEFORE INSERT OR UPDATE OF plan_id, check_date ON meal_plan_checks
  FOR EACH ROW EXECUTE FUNCTION public.check_remember_version();

-- 10) Contas demo: o plano criado pelo Laboratório já sai publicado ---------------------------------
CREATE OR REPLACE FUNCTION public.publish_seeded_plan()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Só para planos gravados sem usuário do app (rotinas do servidor) que ainda não têm versão.
  IF auth.uid() IS NULL AND NOT EXISTS (SELECT 1 FROM meal_plan_versions WHERE plan_id = NEW.plan_id) THEN
    PERFORM public.publish_plan_internal(NEW.plan_id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_seeded_plan() FROM public, anon, authenticated;
-- Uma vez por comando, depois de todos os itens: o retrato já sai completo.
DROP TRIGGER IF EXISTS trg_publish_seeded_plan ON meal_plan_items;

CREATE OR REPLACE FUNCTION public.publish_seeded_plans()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RETURN NULL;
  END IF;
  FOR v_plan IN SELECT DISTINCT n.plan_id FROM new_items n LOOP
    IF EXISTS (SELECT 1 FROM meal_plan_versions WHERE plan_id = v_plan) THEN
      -- Itens acrescentados depois: o rascunho muda e a versão é refeita.
      UPDATE meal_plans SET revision = revision + 1 WHERE id = v_plan;
    END IF;
    PERFORM public.publish_plan_internal(v_plan);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_seeded_plans() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS trg_publish_seeded_plans ON meal_plan_items;
CREATE TRIGGER trg_publish_seeded_plans AFTER INSERT ON meal_plan_items
  REFERENCING NEW TABLE AS new_items
  FOR EACH STATEMENT EXECUTE FUNCTION public.publish_seeded_plans();
DROP FUNCTION IF EXISTS public.publish_seeded_plan();

-- 11) Planos que já existiam: versão 1 "legacy" com o conteúdo atual --------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT p.id, p.client_id, p.created_by, p.revision, p.created_at FROM meal_plans p
           WHERE NOT EXISTS (SELECT 1 FROM meal_plan_versions v WHERE v.plan_id = p.id) LOOP
    UPDATE meal_plan_items i SET position = s.rn
    FROM (SELECT id, row_number() OVER (PARTITION BY day, meal ORDER BY created_at, id) AS rn
          FROM meal_plan_items WHERE plan_id = r.id) s
    WHERE i.id = s.id;
    INSERT INTO meal_plan_versions (plan_id, client_id, number, plan_revision, valid_from, content, published_by, published_at, legacy)
    VALUES (r.id, r.client_id, 1, r.revision, (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
            public.plan_snapshot(r.id), r.created_by, now(), true);
    UPDATE meal_plans SET published_revision = revision WHERE id = r.id;
  END LOOP;
END $$;

UPDATE meal_plan_checks c SET version_id = public.plan_version_on(c.plan_id, c.check_date) WHERE version_id IS NULL;
UPDATE food_swap_requests s SET version_id = public.plan_version_on(s.plan_id, (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date)
WHERE version_id IS NULL;
-- Trocas já respondidas valiam na hora (o plano era editado direto).
UPDATE food_swap_requests SET effective_from = (resolved_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE applied AND effective_from IS NULL AND resolved_at IS NOT NULL;

-- Plano em uso: o mais recente de cada paciente (o que a tela abria primeiro).
INSERT INTO client_plan_selection (client_id, plan_id)
SELECT DISTINCT ON (client_id) client_id, id FROM meal_plans ORDER BY client_id, updated_at DESC
ON CONFLICT (client_id) DO NOTHING;

-- 12) Leitura para a tela: planos visíveis com a versão vigente, a próxima e o estado do rascunho ---
CREATE OR REPLACE FUNCTION public.plan_views(p_client uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'client_id', p.client_id, 'created_by', p.created_by, 'title', p.title, 'notes', p.notes,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'revision', p.revision, 'published_revision', p.published_revision,
    'author_name', (SELECT a.full_name FROM profiles a WHERE a.id = p.created_by),
    'active', EXISTS (SELECT 1 FROM client_plan_selection s WHERE s.client_id = p.client_id AND s.plan_id = p.id),
    'current', (SELECT to_jsonb(v) - 'client_id' FROM meal_plan_versions v
                WHERE v.plan_id = p.id AND v.valid_from <= public.app_today()
                ORDER BY v.valid_from DESC, v.number DESC LIMIT 1),
    'next', (SELECT jsonb_build_object('id', v.id, 'number', v.number, 'valid_from', v.valid_from)
             FROM meal_plan_versions v
             WHERE v.plan_id = p.id AND v.valid_from > public.app_today()
             ORDER BY v.valid_from DESC, v.number DESC LIMIT 1)
  ) ORDER BY p.updated_at DESC), '[]'::jsonb)
  FROM meal_plans p
  WHERE p.client_id = p_client;
$$;
REVOKE ALL ON FUNCTION public.plan_views(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.plan_views(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.app_today() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.app_today() TO authenticated;
