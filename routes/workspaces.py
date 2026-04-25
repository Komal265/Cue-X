from flask import Blueprint, request, jsonify
from database import get_connection
from models import insert_workspace, get_workspaces, get_datasets_by_workspace, text, serialize_datetime

workspace_bp = Blueprint("workspaces", __name__, url_prefix="/api/workspaces")

@workspace_bp.route("", methods=["GET"])
def get_workspaces_route():
    print("GET /api/workspaces called")
    try:
        with get_connection() as conn:
            if conn is None:
                return jsonify({"error": "Database connection failed"}), 500
            # Use helper from models.py which includes created_at and formats it
            workspaces = get_workspaces(conn)
            return jsonify(workspaces)
    except Exception as e:
        print(f"Error in GET /api/workspaces: {e}")
        return jsonify({"error": str(e)}), 500

@workspace_bp.route("", methods=["POST"])
def create_workspace():
    try:
        data = request.get_json()
        print("POST /api/workspaces", data)
        name = data.get("name")
        if not name:
            return jsonify({"error": "Name is required"}), 400

        with get_connection() as conn:
            if conn is None:
                return jsonify({"error": "Database connection failed"}), 500
            
            # Using RETURNING id for PostgreSQL
            result = conn.execute(
                text("INSERT INTO workspaces (name) VALUES (:name) RETURNING id"),
                {"name": name}
            )
            workspace_id = result.fetchone()[0]
            conn.commit() # Ensure commit for non-autocommit engines

            return jsonify({"workspace_id": workspace_id})
    except Exception as e:
        print(f"Error in POST /api/workspaces: {e}")
        return jsonify({"error": str(e)}), 500

@workspace_bp.route('/<int:workspace_id>/datasets', methods=['GET'])
def list_datasets(workspace_id):
    print(f"Fetching datasets for workspace {workspace_id}")
    with get_connection() as conn:
        if conn is None:
            return jsonify({'error': 'Database connection failed'}), 500
        try:
            datasets = get_datasets_by_workspace(conn, workspace_id)
            return jsonify(datasets)
        except Exception as e:
            print(f"Error listing datasets: {e}")
            return jsonify({'error': str(e)}), 500

@workspace_bp.route('/dataset/<int:dataset_id>', methods=['GET'])
def get_dataset_summary(dataset_id):
    print(f"Fetching summary for dataset {dataset_id}")
    with get_connection() as conn:
        if conn is None:
            return jsonify({'error': 'Database connection failed'}), 500
        try:
            # Get basic info
            res = conn.execute(text("SELECT id, filename, uploaded_at, row_count, workspace_id FROM datasets WHERE id = :id"), {"id": dataset_id}).fetchone()
            if not res:
                return jsonify({'error': 'Dataset not found'}), 404
            
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
