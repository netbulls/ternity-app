-- Add entry_split action to the audit enum for split entry tracking
ALTER TYPE "entry_audit_action" ADD VALUE IF NOT EXISTS 'entry_split';
