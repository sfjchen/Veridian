from app.services.supabase_client import get_supabase_client


def generate_upload_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    client = get_supabase_client()
    result = client.storage.from_(bucket).create_signed_upload_url(path)
    return result["signed_url"]


def generate_download_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    client = get_supabase_client()
    result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    return result["signedURL"]
