-- Function to purge notifications older than retention_days (default 30 days) in batches
CREATE OR REPLACE FUNCTION purge_old_notifications(retention_days INT DEFAULT 30, batch_size INT DEFAULT 5000)
RETURNS INT AS $$
DECLARE
    deleted_count INT := 0;
    batch_deleted INT := 0;
BEGIN
    IF retention_days <= 0 THEN
        retention_days := 30;
    END IF;
    IF batch_size <= 0 THEN
        batch_size := 5000;
    END IF;

    LOOP
        WITH to_delete AS (
            SELECT id FROM notifications
            WHERE created_at < NOW() - (retention_days * INTERVAL '1 day')
            LIMIT batch_size
        )
        DELETE FROM notifications
        WHERE id IN (SELECT id FROM to_delete);

        GET DIAGNOSTICS batch_deleted = ROW_COUNT;
        deleted_count := deleted_count + batch_deleted;

        EXIT WHEN batch_deleted = 0;
        PERFORM pg_sleep(0.05);
    END LOOP;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic daily cleanup via pg_cron at 03:00 UTC if the extension is installed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule previous job if exists to avoid duplicate entries
        BEGIN
            PERFORM cron.unschedule('purge-old-notifications');
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        PERFORM cron.schedule(
            'purge-old-notifications',
            '0 3 * * *',
            'SELECT purge_old_notifications(30, 5000)'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron registration skipped: %', SQLERRM;
END;
$$;
