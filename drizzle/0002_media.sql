CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_type_allowed" CHECK ("media"."content_type" IN ('image/jpeg','image/png','image/webp')),
	CONSTRAINT "media_size_cap" CHECK ("media"."byte_size" > 0 AND "media"."byte_size" <= 2097152)
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;