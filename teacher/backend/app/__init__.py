from flask import Flask, Response, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from .config import Config

# Global SocketIO instance
socketio = SocketIO()


def create_app() -> Flask:
    config = Config.from_env()

    app = Flask(__name__)
    CORS(app, origins=config.cors_allowed_origins)
    socketio.init_app(app, cors_allowed_origins=config.cors_allowed_origins)
    app.config.from_mapping(
        SECRET_KEY=config.flask_secret_key,
        SUPABASE_URL=config.supabase_url,
        SUPABASE_SERVICE_ROLE_KEY=config.supabase_service_role_key,
        SUPABASE_ANON_KEY=config.supabase_anon_key,
        ANTHROPIC_API_KEY=config.anthropic_api_key,
        SUPABASE_JWT_SECRET=config.supabase_jwt_secret,
        CORS_ALLOWED_ORIGINS=config.cors_allowed_origins,
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

    from .routes.analytics import analytics_bp
    app.register_blueprint(analytics_bp)

    # Import WebSocket handlers (registers with socketio)
    from .routes import conversion_websocket  # noqa: F401

    @app.route("/health", methods=["GET"])
    def health() -> tuple[Response, int]:
        return jsonify(ok=True), 200

    @app.errorhandler(404)
    def not_found(e: Exception) -> tuple[Response, int]:
        return jsonify(error="Not found"), 404

    @app.errorhandler(405)
    def method_not_allowed(e: Exception) -> tuple[Response, int]:
        return jsonify(error="Method not allowed"), 405

    @app.errorhandler(500)
    def internal_error(e: Exception) -> tuple[Response, int]:
        return jsonify(error="Internal server error"), 500

    return app
