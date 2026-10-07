DROP INDEX "messages_tenant_created_idx";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "event_type" text;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "payload" jsonb;--> statement-breakpoint
CREATE INDEX "api_keys_tenant_created_id_idx" ON "api_keys" USING btree ("tenant_id","created_at","id");--> statement-breakpoint
CREATE INDEX "domains_tenant_created_id_idx" ON "domains" USING btree ("tenant_id","created_at","id");--> statement-breakpoint
CREATE INDEX "messages_tenant_created_id_idx" ON "messages" USING btree ("tenant_id","created_at","id");--> statement-breakpoint
CREATE INDEX "messages_queued_created_idx" ON "messages" USING btree ("created_at") WHERE "messages"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "suppressions_tenant_created_address_idx" ON "suppressions" USING btree ("tenant_id","created_at","address");--> statement-breakpoint
CREATE INDEX "templates_tenant_created_id_idx" ON "templates" USING btree ("tenant_id","created_at","id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_next_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhooks_tenant_created_id_idx" ON "webhooks" USING btree ("tenant_id","created_at","id");