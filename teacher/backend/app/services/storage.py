from app.services.supabase_client import get_supabase_admin_client


def _validate_path(path: str) -> None:
    if not path or ".." in path or path.startswith("/") or "\x00" in path:
        raise ValueError(f"Invalid storage path: {path}")


def generate_upload_url(bucket: str, path: str) -> str:
    _validate_path(path)
    client = get_supabase_admin_client()
    try:
        result = client.storage.from_(bucket).create_signed_upload_url(path)
    except Exception as e:
        raise ValueError(f"Storage error generating upload URL for {path}: {e}") from e
    url = _extract_signed_url(result) if result else None
    if not url:
        raise ValueError(f"Failed to generate upload URL for {path}")
    return url


def delete_object(bucket: str, path: str) -> None:
    _validate_path(path)
    client = get_supabase_admin_client()
    try:
        client.storage.from_(bucket).remove([path])
    except Exception as e:
        raise ValueError(f"Storage error deleting object {path}: {e}") from e


def _extract_signed_url(result: dict) -> str | None:
    """Extract signed URL from Supabase response (key varies by SDK version)."""
    return (
        result.get("signedURL")
        or result.get("signed_url")
        or result.get("signedUrl")
        or result.get("url")
    )


def generate_download_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    _validate_path(path)
    client = get_supabase_admin_client()
    try:
        result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    except Exception as e:
        raise ValueError(f"Storage error generating download URL for {path}: {e}") from e
    url = _extract_signed_url(result) if result else None
    if not url:
        raise ValueError(f"Failed to generate download URL for {path}")
    return url


def move_object(bucket: str, from_path: str, to_path: str) -> None:
    _validate_path(from_path)
    _validate_path(to_path)
    if from_path == to_path:
        return
    client = get_supabase_admin_client()
    try:
        client.storage.from_(bucket).move(from_path, to_path)
    except Exception as e:
        raise ValueError(f"Storage error moving object from {from_path} to {to_path}: {e}") from e
