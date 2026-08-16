-- Migration: Add Indexes for Performance

-- 1. Chat Messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON public.chat_messages(user_id, created_at DESC);

-- 2. Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON public.tasks(user_id, is_complete);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON public.tasks(user_id, created_at DESC);

-- 3. Ideas
CREATE INDEX IF NOT EXISTS idx_ideas_user_created ON public.ideas(user_id, created_at DESC);

-- 4. Journals
CREATE INDEX IF NOT EXISTS idx_journals_user_date ON public.journals(user_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_journals_user_created ON public.journals(user_id, created_at DESC);

-- 5. Finance
CREATE INDEX IF NOT EXISTS idx_finance_user_settled ON public.finance(user_id, is_settled);
CREATE INDEX IF NOT EXISTS idx_finance_user_created ON public.finance(user_id, created_at DESC);

-- 6. Health
CREATE INDEX IF NOT EXISTS idx_health_user_created ON public.health(user_id, created_at DESC);

-- 7. Watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user_watched ON public.watchlist(user_id, is_watched);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_created ON public.watchlist(user_id, created_at DESC);

-- 8. Others
CREATE INDEX IF NOT EXISTS idx_others_user_created ON public.others(user_id, created_at DESC);
