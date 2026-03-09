
-- Drop restrictive ALL policies and replace with permissive ones for suppliers
DROP POLICY IF EXISTS "Users manage own suppliers" ON public.suppliers;
CREATE POLICY "Users select own suppliers" ON public.suppliers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own suppliers" ON public.suppliers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Drop restrictive ALL policies and replace with permissive ones for products_canonical
DROP POLICY IF EXISTS "Users manage own products_canonical" ON public.products_canonical;
CREATE POLICY "Users select own products" ON public.products_canonical FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON public.products_canonical FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON public.products_canonical FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON public.products_canonical FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix other tables with same issue
DROP POLICY IF EXISTS "Users manage own events" ON public.events;
CREATE POLICY "Users select own events" ON public.events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own events" ON public.events FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own evidence" ON public.evidence;
CREATE POLICY "Users select own evidence" ON public.evidence FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own evidence" ON public.evidence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own evidence" ON public.evidence FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own evidence" ON public.evidence FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own quotes" ON public.quotes;
CREATE POLICY "Users select own quotes" ON public.quotes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own quotes" ON public.quotes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own quotes" ON public.quotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own quote_items" ON public.quote_items;
CREATE POLICY "Users select own quote_items" ON public.quote_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own quote_items" ON public.quote_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own quote_items" ON public.quote_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own quote_items" ON public.quote_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own review_queue" ON public.review_queue;
CREATE POLICY "Users select own review_queue" ON public.review_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own review_queue" ON public.review_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own review_queue" ON public.review_queue FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own review_queue" ON public.review_queue FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own audit_log" ON public.audit_log;
CREATE POLICY "Users select own audit_log" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own feedback" ON public.feedback;
CREATE POLICY "Users select own feedback" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
