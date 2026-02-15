from dataclasses import dataclass
import os
from dotenv import load_dotenv


def _parse_cors_allowed_origins(raw_value: str | None) -> list[str]:
    if raw_value:
        origins = [item.strip() for item in raw_value.split(",") if item.strip()]
        if origins:
            return origins
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
    ]


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    anthropic_api_key: str
    flask_secret_key: str
    supabase_jwt_secret: str
    cors_allowed_origins: list[str]

    @classmethod
    def from_env(cls) -> "Config":
        load_dotenv()
        return cls(
            supabase_url=os.environ["SUPABASE_URL"],
            supabase_service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            supabase_anon_key=os.environ["SUPABASE_ANON_KEY"],
            anthropic_api_key=os.environ["ANTHROPIC_API_KEY"],
            flask_secret_key=os.environ["FLASK_SECRET_KEY"],
            supabase_jwt_secret=os.environ["SUPABASE_JWT_SECRET"],
            cors_allowed_origins=_parse_cors_allowed_origins(
                os.environ.get("CORS_ALLOWED_ORIGINS")
            ),
        )
