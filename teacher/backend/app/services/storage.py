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
    if not result or not result.get("signed_url"):
        raise ValueError(f"Failed to generate upload URL for {path}")
    return result["signed_url"]


def generate_download_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    _validate_path(path)
    client = get_supabase_admin_client()
    try:
        result = client.storage.from_(bucket).create_signed_url(path, expires_in)
    except Exception as e:
        raise ValueError(f"Storage error generating download URL for {path}: {e}") from e
    if not result or not result.get("signedURL"):
        raise ValueError(f"Failed to generate download URL for {path}")
    return result["signedURL"]


def delete_object(bucket: str, path: str) -> None:
    _validate_path(path)
    client = get_supabase_admin_client()
    try:
        client.storage.from_(bucket).remove([path])
    except Exception as e:
        raise ValueError(f"Storage error deleting object {path}: {e}") from e


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
