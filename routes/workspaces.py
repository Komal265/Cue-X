from flask import Blueprint, request, jsonify
from database import get_connection
from models import insert_workspace, get_workspaces, get_datasets_by_workspace, text, serialize_datetime
from utils.auth import login_required

workspace_bp = Blueprint("workspaces", __name__, url_prefix="/api/workspaces")

@workspace_bp.route("", methods=["GET"])
@login_required
def get_workspaces_route(user_id):
    print("GET /api/workspaces called")
    try:
        with get_connection() as conn:
            if conn is None:
                return jsonify({"error": "Database connection failed"}), 500
            # Use helper from models.py which filters by user_id
            workspaces = get_workspaces(conn, user_id)
            return jsonify(workspaces)
    except Exception as e:
        print(f"Error in GET /api/workspaces: {e}")
        return jsonify({"error": str(e)}), 500

@workspace_bp.route("", methods=["POST"])
@login_required
def create_workspace(user_id):
    try:
        data = request.get_json(silent=True) or {}
        print("POST /api/workspaces", data)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400

        with get_connection() as conn:
            if conn is None:
                return jsonify({"error": "Database connection failed"}), 500

            workspace_id = insert_workspace(conn, name, user_id)
            if not workspace_id:
                conn.rollback()
                return jsonify({"error": "Failed to create workspace"}), 500

            return jsonify({"workspace_id": workspace_id})
    except Exception as e:
        print(f"Error in POST /api/workspaces: {e}")
        return jsonify({"error": str(e)}), 500

@workspace_bp.route('/<int:workspace_id>/datasets', methods=['GET'])
@login_required
def list_datasets(user_id, workspace_id):
    print(f"Fetching datasets for workspace {workspace_id}")
    with get_connection() as conn:
        if conn is None:
            return jsonify({'error': 'Database connection failed'}), 500
        try:
            # First check if the workspace belongs to the user
            ws = conn.execute(text("SELECT id FROM workspaces WHERE id = :id AND user_id = :user_id"), {"id": workspace_id, "user_id": user_id}).fetchone()
            if not ws:
                return jsonify({'error': 'Workspace not found or unauthorized'}), 403
                
            datasets = get_datasets_by_workspace(conn, workspace_id)
            return jsonify(datasets)
        except Exception as e:
            print(f"Error listing datasets: {e}")
            return jsonify({'error': str(e)}), 500

@workspace_bp.route('/dataset/<int:dataset_id>', methods=['GET'])
@login_required
def get_dataset_summary(user_id, dataset_id):
    print(f"Fetching summary for dataset {dataset_id}")
    with get_connection() as conn:
        if conn is None:
            return jsonify({'error': 'Database connection failed'}), 500
        try:
            # Check ownership via workspace
            res = conn.execute(text("""
                SELECT d.id, d.filename, d.uploaded_at, d.row_count, d.workspace_id 
                FROM datasets d
                JOIN workspaces w ON d.workspace_id = w.id
                WHERE d.id = :id AND w.user_id = :user_id
            """), {"id": dataset_id, "user_id": user_id}).fetchone()
            
            if not res:
                return jsonify({'error': 'Dataset not found or unauthorized'}), 404
            
            dataset = dict(res._mapping)
            if 'uploaded_at' in dataset:
                dataset['uploaded_at'] = serialize_datetime(dataset['uploaded_at'])
            
            # Get cluster counts
            counts = conn.execute(text("SELECT segment_label, COUNT(*) as count FROM customers WHERE dataset_id = :id GROUP BY segment_label"), {"id": dataset_id}).fetchall()
            dataset['segments'] = [dict(r._mapping) for r in counts]
            
            return jsonify(dataset)
        except Exception as e:
            print(f"Error fetching dataset summary: {e}")
            return jsonify({'error': str(e)}), 500
