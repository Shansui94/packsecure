-- RPC function to allow drivers to bypass RLS and insert pick-up tasks safely
CREATE OR REPLACE FUNCTION create_driver_pickup_safe(
    p_order_number TEXT,
    p_driver_id UUID,
    p_notes TEXT,
    p_photo_url TEXT
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS and runs as admin
AS $$
DECLARE
    new_order RECORD;
BEGIN
    INSERT INTO sales_orders (
        order_number,
        driver_id,
        status,
        notes,
        proof_of_load_url,
        job_type,
        delivery_address,
        customer,
        order_date,
        deadline,
        pod_timestamp
    ) VALUES (
        p_order_number,
        p_driver_id,
        'Delivered',
        p_notes,
        p_photo_url,
        'Pick Up',
        'AD-HOC PICK UP',
        'Internal Team', -- Fallback customer
        now(),
        now(),
        now()
    ) RETURNING * INTO new_order;

    RETURN row_to_json(new_order)::jsonb;
END;
$$;
