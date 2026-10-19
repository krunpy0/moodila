-- Migration 0023: Add locale to notification_settings and push_subscriptions
-- Supports localized Web Push notifications (en / ru)

ALTER TABLE notification_settings 
    ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'ru';

ALTER TABLE push_subscriptions 
    ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'ru';
