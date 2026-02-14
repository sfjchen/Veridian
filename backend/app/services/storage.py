from app.services.supabase_client import get_supabase_client


def generate_upload_url(bucket: str, path: str) -> str:
    client = get_supabase_client()
    result = client.storage.from_(bucket).create_signed_upload_url(path)
    if not result or "signed_url" not in result:
        raise ValueError(f"Failed to generate upload URL for {path}")
    return result["signed_url"]


def generate_download_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    client = get_supabase_client()
    result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    if not result or "signedURL" not in result:
        raise ValueError(f"Failed to generate download URL for {path}")
    return result["signedURL"]
