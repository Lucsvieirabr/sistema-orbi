-- Migration: Create storage bucket for company logos
-- This creates a public bucket to store downloaded logos from logo.dev

BEGIN;

-- Create the logos bucket with minimal required columns
INSERT INTO storage.buckets (id, name)
VALUES (
  'company-logos',
  'company-logos'
)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public read access to company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Create policy for authenticated users to upload/update logos
CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to update logos
CREATE POLICY "Authenticated users can update company logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to delete logos
CREATE POLICY "Authenticated users can delete company logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-logos' 
  AND auth.role() = 'authenticated'
);

COMMIT;

