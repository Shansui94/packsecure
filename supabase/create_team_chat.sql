-- 1. Create team chat threads table
CREATE TABLE IF NOT EXISTS public.team_chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT '未命名对话',
    canvas_document TEXT DEFAULT '',
    members UUID[] DEFAULT '{}'::uuid[],
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create team chat messages table
CREATE TABLE IF NOT EXISTS public.team_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.team_chat_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create team chat tasks table
CREATE TABLE IF NOT EXISTS public.team_chat_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.team_chat_threads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_name TEXT DEFAULT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for all tables
ALTER TABLE public.team_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "Allow authenticated read threads" ON public.team_chat_threads;
DROP POLICY IF EXISTS "Allow authenticated insert threads" ON public.team_chat_threads;
DROP POLICY IF EXISTS "Allow authenticated update threads" ON public.team_chat_threads;
DROP POLICY IF EXISTS "Allow authenticated delete threads" ON public.team_chat_threads;

DROP POLICY IF EXISTS "Allow authenticated read messages" ON public.team_chat_messages;
DROP POLICY IF EXISTS "Allow authenticated insert messages" ON public.team_chat_messages;
DROP POLICY IF EXISTS "Allow authenticated delete messages" ON public.team_chat_messages;

DROP POLICY IF EXISTS "Allow authenticated read tasks" ON public.team_chat_tasks;
DROP POLICY IF EXISTS "Allow authenticated insert tasks" ON public.team_chat_tasks;
DROP POLICY IF EXISTS "Allow authenticated update tasks" ON public.team_chat_tasks;
DROP POLICY IF EXISTS "Allow authenticated delete tasks" ON public.team_chat_tasks;

-- RLS Policies for threads (All authenticated users can collaborate)
CREATE POLICY "Allow authenticated read threads" ON public.team_chat_threads 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert threads" ON public.team_chat_threads 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow authenticated update threads" ON public.team_chat_threads 
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete threads" ON public.team_chat_threads 
    FOR DELETE TO authenticated USING (auth.uid() = created_by OR EXISTS (
        SELECT 1 FROM public.users_public WHERE id = auth.uid() AND role IN ('SuperAdmin', 'Admin')
    ));

-- RLS Policies for messages
CREATE POLICY "Allow authenticated read messages" ON public.team_chat_messages 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert messages" ON public.team_chat_messages 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated delete messages" ON public.team_chat_messages 
    FOR DELETE TO authenticated USING (sender_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users_public WHERE id = auth.uid() AND role IN ('SuperAdmin', 'Admin')
    ));

-- RLS Policies for tasks
CREATE POLICY "Allow authenticated read tasks" ON public.team_chat_tasks 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert tasks" ON public.team_chat_tasks 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update tasks" ON public.team_chat_tasks 
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete tasks" ON public.team_chat_tasks 
    FOR DELETE TO authenticated USING (true);

-- Enable real-time for tables (Wrapped in DO block to prevent error if already exists in publication)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'team_chat_threads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_threads;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'team_chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'team_chat_tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_tasks;
    END IF;
END $$;
