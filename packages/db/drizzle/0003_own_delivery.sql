ALTER TABLE "byo_ses_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "byo_ses_accounts" CASCADE;--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "ses_message_id" TO "mta_queue_id";--> statement-breakpoint
DROP INDEX "messages_ses_message_id_idx";--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dkim_selector" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dkim_public_key" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "dkim_private_key_encrypted" "bytea";--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "return_path_domain" text;--> statement-breakpoint
CREATE INDEX "messages_mta_queue_id_idx" ON "messages" USING btree ("mta_queue_id");--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN "region";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN "dkim_tokens";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN "custom_mail_from";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN "ses_identity_arn";--> statement-breakpoint
ALTER TABLE "domains" DROP COLUMN "ses_config_set";