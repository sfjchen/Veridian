from flask import Flask
from flask_cors import CORS
from .config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, origins="*", supports_credentials=True)
    config = Config.from_env()
    app.config.from_mapping(
        SECRET_KEY=config.flask_secret_key,
        SUPABASE_URL=config.supabase_url,
        SUPABASE_SERVICE_ROLE_KEY=config.supabase_service_role_key,
        SUPABASE_ANON_KEY=config.supabase_anon_key,
        ANTHROPIC_API_KEY=config.anthropic_api_key,
        SUPABASE_JWT_SECRET=config.supabase_jwt_secret,
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB
    )
    from .routes.classrooms import classrooms_bp
    app.register_blueprint(classrooms_bp)

    from .routes.convert import convert_bp
    app.register_blueprint(convert_bp)

    from .routes.corpus import corpus_bp
    app.register_blueprint(corpus_bp)

    from .routes.assignments import assignments_bp
    app.register_blueprint(assignments_bp)

    from .routes.live_monitoring import live_monitoring_bp
    app.register_blueprint(live_monitoring_bp)

    from .routes.api_docs import api_docs_bp
    app.register_blueprint(api_docs_bp)

    return app
