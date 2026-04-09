from flask import Flask, request, jsonify, send_file
import os
import pandas as pd
from datetime import datetime
import joblib
from flask_cors import CORS

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Pre-load ML model and scaler once in global scope for efficiency
model_path = os.path.join(BASE_DIR, "kmeans_model.joblib")
scaler_path = os.path.join(BASE_DIR, "scaler.joblib")

try:
    kmeans_model = joblib.load(model_path)
except Exception as e:
    print("Model load failed:", e)
    kmeans_model = None

try:
    scaler = joblib.load(scaler_path)
except Exception as e:
    print("Scaler load failed:", e)
    scaler = None

@app.route('/')
def home():
    return jsonify({"status": "API running"})


@app.route('/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        return response

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filename = f"{datetime.now().timestamp()}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    try:
        # Step 1: Load data
        customer_data = pd.read_csv(filepath)

        # Validate columns
        required_columns = ['Quantity','Price_Per_Item','Total_Price','Season','Purchase_Date']
        for col in required_columns:
            if col not in customer_data.columns:
                return jsonify({'error': f'Missing column: {col}'}), 400

        # Step 2: Preprocessing
        season_mapping = {'Summer': 0, 'Winter': 1, 'Spring': 2, 'Autumn': 3, 'Monsoon': 4}
        customer_data['Season_Number'] = customer_data['Season'].map(season_mapping)
        customer_data['Purchase_Date'] = pd.to_datetime(customer_data['Purchase_Date'])
        today = datetime.now()
        customer_data['Recency'] = (today - customer_data['Purchase_Date']).dt.days
        # Prevent division by zero
        customer_data['Avg_Order_Value'] = customer_data['Total_Price'] / customer_data['Quantity'].replace(0, 1)

        features = ['Quantity','Price_Per_Item','Total_Price','Season_Number','Recency','Avg_Order_Value']
        
        if scaler is None:
            return jsonify({'error': 'Scaler failed to load on the server'}), 500
        customer_data[features] = scaler.transform(customer_data[features])

        X = customer_data[['Recency', 'Avg_Order_Value']].values

        # Step 3: Use global model
        if kmeans_model is None:
            return jsonify({'error': 'ML Model failed to load on the server'}), 500
        Y = kmeans_model.predict(X)

        print("Y", Y)
        customer_data['Cluster_Label'] = Y

        # Optional mappings
        segment_mapping = {
            0: "Low-Value Frequent Buyers",
            1: "High-Value Loyal Customers",
            2: "Lost Customers",
            3: "Seasonal Buyers"
        }
        campaign_mapping = {
            0: "Discount Coupons & Loyalty Programs",
            1: "Exclusive Membership & VIP Rewards",
            2: "Re-engagement Emails & Offers",
            3: "Seasonal Promotions & Personalized Offers"
        }

        customer_data['Segment'] = customer_data['Cluster_Label'].map(segment_mapping)
        customer_data['Suggested_Campaign'] = customer_data['Cluster_Label'].map(campaign_mapping)

        # Save processed data for download
        output_path = os.path.join(UPLOAD_FOLDER, 'output.csv')
        customer_data.to_csv(output_path, index=False)
        
        # Save session ID for retrieving visualization data
        session_id = datetime.now().strftime("%Y%m%d%H%M%S")
        session_path = os.path.join(UPLOAD_FOLDER, f'session_{session_id}.csv')
        customer_data.to_csv(session_path, index=False)

        BASE_URL = "https://ml-miniproject-2kyl.onrender.com"
        download_url = f"{BASE_URL}/download"
        return jsonify({
            'message': 'File processed successfully!', 
            'download_url': download_url,
            'session_id': session_id,
            'visualization_url': f'/visualization/{session_id}'
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download')
def download_file():
    output_path = os.path.join(UPLOAD_FOLDER, 'output.csv')
    if os.path.exists(output_path):
        return send_file(output_path, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404



@app.route('/api/segment-counts/<session_id>')
def segment_counts(session_id):
    try:
        session_path = os.path.join(UPLOAD_FOLDER, f'session_{session_id}.csv')
        if not os.path.exists(session_path):
            return jsonify({'error': 'Session data not found'}), 404
            
        data = pd.read_csv(session_path)
        segment_counts = data['Segment'].value_counts().to_dict()
        return jsonify({
            'labels': list(segment_counts.keys()),
            'values': list(segment_counts.values())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/spending-by-segment/<session_id>')
def spending_by_segment(session_id):
    try:
        session_path = os.path.join(UPLOAD_FOLDER, f'session_{session_id}.csv')
        if not os.path.exists(session_path):
            return jsonify({'error': 'Session data not found'}), 404
            
        data = pd.read_csv(session_path)
        # Convert back the standardized values to original for visualization
        avg_spending = data.groupby('Segment')['Total_Price'].mean().to_dict()
        return jsonify({
            'labels': list(avg_spending.keys()),
            'values': list(avg_spending.values())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recency-value-scatter/<session_id>')
def recency_value_scatter(session_id):
    try:
        session_path = os.path.join(UPLOAD_FOLDER, f'session_{session_id}.csv')
        if not os.path.exists(session_path):
            return jsonify({'error': 'Session data not found'}), 404
            
        data = pd.read_csv(session_path)
        
        # Create scatter plot data with unstandardized values for visualization
        scatter_data = []
        for segment in data['Segment'].unique():
            segment_data = data[data['Segment'] == segment]
            scatter_data.append({
                'name': segment,
                'data': segment_data[['Recency', 'Avg_Order_Value', 'Customer_ID']].values.tolist()
            })
        
        return jsonify(scatter_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/seasonal-distribution/<session_id>')
def seasonal_distribution(session_id):
    try:
        session_path = os.path.join(UPLOAD_FOLDER, f'session_{session_id}.csv')
        if not os.path.exists(session_path):
            return jsonify({'error': 'Session data not found'}), 404
            
        data = pd.read_csv(session_path)
        
        # Reverse mapping for Season_Number to Season name
        season_mapping = {0: 'Summer', 1: 'Winter', 2: 'Spring', 3: 'Autumn', 4: 'Monsoon'}
        data['Season_Name'] = data['Season_Number'].map({v: k for k, v in season_mapping.items()})
        
        # Count customers by segment and season
        season_segment_counts = data.groupby(['Season', 'Segment']).size().unstack().fillna(0)
        
        # Format for Chart.js
        labels = season_segment_counts.index.tolist()
        datasets = []
        
        for segment in season_segment_counts.columns:
            datasets.append({
                'label': segment,
                'data': season_segment_counts[segment].tolist()
            })
            
        return jsonify({
            'labels': labels,
            'datasets': datasets
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    PORT = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=PORT, debug=False)