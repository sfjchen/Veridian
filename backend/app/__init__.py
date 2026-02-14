from flask import Flask
from .config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    config = Config.from_env()
    app.config.from_mapping(
        SECRET_KEY=config.flask_secret_key,
        SUPABASE_URL=config.supabase_url,
        SUPABASE_SERVICE_ROLE_KEY=config.supabase_service_role_key,
        SUPABASE_ANON_KEY=config.supabase_anon_key,
        ANTHROPIC_API_KEY=config.anthropic_api_key,
        SUPABASE_JWT_SECRET=config.supabase_jwt_secret,
    )
    from .routes.auth import auth_bp
    app.register_blueprint(auth_bp)

    from .routes.classrooms import classrooms_bp
    app.register_blueprint(classrooms_bp)

    return app
