@@ .. @@
 DROP TRIGGER IF EXISTS update_goal_current_value_trigger ON goal_progress;
 CREATE TRIGGER update_goal_current_value_trigger
   AFTER INSERT ON goal_progress
   FOR EACH ROW
   EXECUTE FUNCTION update_goal_current_value();
+
+-- Função para calcular estatísticas em tempo real
+CREATE OR REPLACE FUNCTION get_nutritionist_stats(nutritionist_uuid uuid)
+RETURNS TABLE (
+  total_clients bigint,
+  active_clients bigint,
+  total_reviews bigint,
+  average_rating numeric,
+  total_sessions bigint,
+  completed_goals bigint
+) AS $$
+BEGIN
+  RETURN QUERY
+  SELECT 
+    COALESCE(COUNT(DISTINCT mr.client_id), 0) as total_clients,
+    COALESCE(COUNT(DISTINCT CASE WHEN mr.status = 'active' THEN mr.client_id END), 0) as active_clients,
+    COALESCE(COUNT(DISTINCT r.id), 0) as total_reviews,
+    COALESCE(ROUND(AVG(r.rating), 1), 0) as average_rating,
+    COALESCE(COUNT(DISTINCT ms.id), 0) as total_sessions,
+    COALESCE(COUNT(DISTINCT CASE WHEN cg.status = 'completed' THEN cg.id END), 0) as completed_goals
+  FROM profiles p
+  LEFT JOIN mentoring_relationships mr ON mr.nutritionist_id = p.id
+  LEFT JOIN recipes rec ON rec.author_id = p.id
+  LEFT JOIN reviews r ON r.recipe_id = rec.id
+  LEFT JOIN mentoring_sessions ms ON ms.mentoring_relationship_id = mr.id
+  LEFT JOIN client_goals cg ON cg.nutritionist_id = p.id
+  WHERE p.id = nutritionist_uuid
+  GROUP BY p.id;
+END;
+$$ language 'plpgsql';