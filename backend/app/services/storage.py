from app.services.supabase_client import get_supabase_admin_client


def _validate_path(path: str) -> None:
    if ".." in path or path.startswith("/"):
        raise ValueError(f"Invalid storage path: {path}")


def generate_upload_url(bucket: str, path: str) -> str:
    _validate_path(path)
    client = get_supabase_admin_client()
    try:
        result = client.storage.from_(bucket).create_signed_upload_url(path)
    except Exception as e:
        raise ValueError(f"Storage error generating upload URL for {path}: {e}") from e
    if not result or "signed_url" not in result:
        raise ValueError(f"Failed to generate upload URL for {path}")
    return result["signed_url"]


def generate_download_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    _validate_path(path)
    client = get_supabase_admin_client()
    try:
        result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    except Exception as e:
        raise ValueError(f"Storage error generating download URL for {path}: {e}") from e
    if not result or "signedURL" not in result:
        raise ValueError(f"Failed to generate download URL for {path}")
    return result["signedURL"]
