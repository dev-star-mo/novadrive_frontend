/** Attachment record returned by Laravel `GET /attachments`. */
export type Attachment = {
  id: string;
  name: string | null;
  file_name: string | null;
  mime_type: string | null;
  url: string;
  thumbnail_url: string | null;
  original_image_url: string | null;
  size: number | null;       // bytes
  attachable_type: string | null; // e.g. "App\Models\Vehicle"
  attachable_id: string | null;   // ID of the related model
  created_at: string;
};
