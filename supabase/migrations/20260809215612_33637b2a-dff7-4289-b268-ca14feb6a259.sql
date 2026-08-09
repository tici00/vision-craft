CREATE TYPE public.upload_status AS ENUM ('none', 'preparing', 'uploading', 'finalizing', 'uploaded', 'error');

ALTER TABLE public.projects
  ADD COLUMN source_stored_file_name text,
  ADD COLUMN source_format text,
  ADD COLUMN source_uploaded_at timestamp with time zone,
  ADD COLUMN upload_status public.upload_status NOT NULL DEFAULT 'none',
  ADD COLUMN upload_error text;