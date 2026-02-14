from dataclasses import dataclass
import os
from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    anthropic_api_key: str
    flask_secret_key: str
    supabase_jwt_secret: str

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
        )
