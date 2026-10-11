import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from calculations import calculate_single_activity, calculate_aggregate_impact, IMPACT_FACTORS

app = Flask(__name__)
# Enable CORS for cross-service communication
CORS(app)

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "EcoTrack Environmental Calculation Microservice",
        "version": "1.0.0",
        "status": "healthy",
        "supported_activities": list(IMPACT_FACTORS.keys())
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "EcoTrack Flask Microservice",
        "factors_loaded": len(IMPACT_FACTORS)
    }), 200

@app.route("/calculate-impact", methods=["POST"])
def calculate_impact():
    """
    POST /calculate-impact
    Accepts either:
    1. A single activity payload: { "activityType": "reusable_bottle", "quantity": 5 }
    2. An aggregate activities array: { "activities": [ { "activityType": "...", "quantity": 2 }, ... ] }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({
            "success": False,
            "error": "Invalid request. Expected JSON payload."
        }), 400

    # If an array of activities is supplied
    if "activities" in data:
        activities = data.get("activities")
        if not isinstance(activities, list):
            return jsonify({
                "success": False,
                "error": "'activities' must be an array of activity objects."
            }), 400
        
        result = calculate_aggregate_impact(activities)
        return jsonify(result), 200

    # If a single activity is supplied
    if "activityType" in data or "activity_type" in data:
        act_type = data.get("activityType") or data.get("activity_type")
        qty = data.get("quantity")
        if qty is None:
            return jsonify({
                "success": False,
                "error": "Field 'quantity' is required."
            }), 400
        
        try:
            qty_val = float(qty)
            if qty_val <= 0:
                return jsonify({
                    "success": False,
                    "error": "Quantity must be a positive number greater than 0."
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "error": "Quantity must be a valid number."
            }), 400

        result = calculate_single_activity(act_type, qty_val)
        if not result.get("valid"):
            return jsonify({
                "success": False,
                "error": result.get("error")
            }), 400

        return jsonify({
            "success": True,
            "data": result
        }), 200

    return jsonify({
        "success": False,
        "error": "Payload must include either 'activities' list or 'activityType' with 'quantity'."
    }), 400

@app.route("/factors", methods=["GET"])
def get_factors():
    """Return transparent documentation on all supported impact calculation factors."""
    return jsonify({
        "success": True,
        "factors": IMPACT_FACTORS,
        "is_estimate": True,
        "disclaimer": "All values are educational estimates based on published lifecycle assessments."
    }), 200


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5001))
    print(f"[EcoTrack Flask Service] Running on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
