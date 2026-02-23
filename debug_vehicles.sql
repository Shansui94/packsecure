-- CHECK LORRIES DATA
SELECT count(*) as lorry_count FROM lorries;

SELECT * FROM lorries LIMIT 5;

-- CHECK POLICIES
SELECT * FROM pg_policies WHERE tablename = 'lorries';
