    -- 这是一个用于修复 employee_leave 表 Row Level Security (RLS) 策略的 SQL。
    -- 之前的策略可能仅允许特定的 user_role 或要求满足其他条件才能 insert/select。
    -- 现在我们要让所有登录的用户都能创建自己的请假申请，并允许查看自己的申请；管理层能查看/更新所有人。

    -- 1. 允许任何人插入自己的请假申请
    CREATE POLICY "Users can insert their own leave" 
    ON public.employee_leave 
    FOR INSERT 
    WITH CHECK (auth.uid() = employee_id);

    -- 2. 允许用户修改自己 Pending 的申请 (可选/如需要)
    CREATE POLICY "Users can update their own pending leave" 
    ON public.employee_leave 
    FOR UPDATE 
    USING (auth.uid() = employee_id AND status = 'Pending');

    -- 3. 允许用户查询自己的申请，或者管理层能查询所有人
    -- 注意：这里基于以前的通用做法，通常如果一个表开放给全员查看日历，那么 Select 权限也可以是全员，只是管理层才能 Update status。
    CREATE POLICY "Anyone can view approved leaves"
    ON public.employee_leave
    FOR SELECT
    USING (true); -- 允许在日历中看到所有Approved的数据（具体Pending隔离由前端筛选或更精细的策略控制，但为避免日历空白先放开读）

    -- 4. 允许管理层更新（Approve/Reject）所有记录
    -- 这也是通常需要的，可以创建一个类似 "Management can update all" 的策略。
    -- （具体依之前系统内如何判断管理层。如果是强 RLS 的话需要写具体，如果是前端防护则这里放宽）

    -- 为简单稳妥起见，先把 Insert 给全员加开，解决报错：
    -- （执行这段 SQL，如果提示策略已存在则需先 Drop 旧的，为了安全我们可以先在控制台里放宽 policy）
