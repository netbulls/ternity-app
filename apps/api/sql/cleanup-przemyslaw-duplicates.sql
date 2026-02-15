-- Cleanup: Merge Przemyslaw's duplicate user rows
-- Run this AFTER verifying the IDs match your local database.
--
-- Row A: JIT-created (has external_auth_id, no togglId) — to be deleted
-- Row B: Synced from Toggl (has togglId, no external_auth_id) — keeper
-- Row C: Test account (przemek@ternity.xyz) — to be deleted
--
-- Step 1: Run the SELECT to identify the rows
-- Step 2: Fill in the IDs below
-- Step 3: Run the transaction

-- ═══════════════════════════════════════════════════════════════════
-- Step 1: Identify rows
-- ═══════════════════════════════════════════════════════════════════

SELECT id, display_name, email, external_auth_id, global_role, toggl_id
FROM users
WHERE email LIKE '%przemyslaw%'
   OR email LIKE '%przemek%'
   OR display_name LIKE '%Przem%'
ORDER BY created_at;

-- ═══════════════════════════════════════════════════════════════════
-- Step 2: Fill in the IDs from the query above, then run Step 3
-- ═══════════════════════════════════════════════════════════════════

-- Replace these placeholders with actual UUIDs:
-- ROW_A_ID = <JIT-created row with external_auth_id set, no togglId>
-- ROW_B_ID = <synced row with togglId set, no external_auth_id>
-- ROW_C_ID = <test account row, przemek@ternity.xyz>
-- LOGTO_SUB = <the external_auth_id value from Row A>

-- ═══════════════════════════════════════════════════════════════════
-- Step 3: Run the cleanup (uncomment and fill in IDs)
-- ═══════════════════════════════════════════════════════════════════

-- BEGIN;
--
-- -- Move external_auth_id from Row A → Row B
-- UPDATE users SET external_auth_id = NULL WHERE id = 'ROW_A_ID';
-- UPDATE users SET external_auth_id = 'LOGTO_SUB', global_role = 'admin' WHERE id = 'ROW_B_ID';
--
-- -- Reassign any time entries from Row A to Row B
-- UPDATE time_entries SET user_id = 'ROW_B_ID' WHERE user_id = 'ROW_A_ID';
--
-- -- Clean up project memberships for rows being deleted
-- DELETE FROM project_members WHERE user_id = 'ROW_A_ID';
-- DELETE FROM project_members WHERE user_id = 'ROW_C_ID';
--
-- -- Delete the duplicate rows
-- DELETE FROM users WHERE id IN ('ROW_A_ID', 'ROW_C_ID');
--
-- COMMIT;
