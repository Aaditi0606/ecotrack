"""
EcoTrack - Environmental Impact Calculation Engine
This module contains transparent, science-backed environmental estimation formulas
for the EcoTrack sustainability tracker.

DISCLAIMER & METHODOLOGY:
All impact figures are educational estimates based on published life cycle assessments (LCA)
and governmental carbon accounting benchmarks (e.g., US EPA WARM, UK DEFRA GHG Conversion Factors).
They are intended to illustrate relative individual contributions and promote sustainable habits,
not to serve as certified carbon credits or verified regulatory offsets.
"""

# Documented estimation factors (in kg CO2e per unit)
# Note: Distinct units and factors are maintained for each activity type to prevent
# treating different actions as equivalent.
IMPACT_FACTORS = {
    "reusable_bottle": {
        "co2e_per_unit": 0.083,  # kg CO2e avoided per disposable 500ml PET bottle
        "unit_name": "bottles avoided",
        "description": "Lifecycle emissions of manufacturing, shipping, and disposing 1 PET bottle (~83g CO2e).",
        "source": "EPA Waste Reduction Model (WARM) & Life Cycle Assessment of PET Packaging"
    },
    "public_transport": {
        "co2e_per_unit": 0.102,  # kg CO2e saved per passenger-km compared to single-occupant petrol car
        "unit_name": "km traveled",
        "description": "Baseline car emission (~0.170 kg/km) minus average public transit emission (~0.068 kg/km).",
        "source": "UK Department for Environment, Food & Rural Affairs (DEFRA) Conversion Factors"
    },
    "cycling_walking": {
        "co2e_per_unit": 0.170,  # kg CO2e avoided per km of active mobility displacing motorized car travel
        "unit_name": "km walked or cycled",
        "description": "Full displacement of average passenger car emissions for urban transit.",
        "source": "European Environment Agency (EEA) Urban Mobility Benchmark"
    },
    "waste_segregation": {
        "co2e_per_unit": 0.120,  # kg CO2e avoided per segregation session by diverting organic/recyclables
        "unit_name": "segregation sessions",
        "description": "Diversion of organic materials from anaerobic landfill methane generation & recycling credit.",
        "source": "EPA Municipal Solid Waste Characterization & IPCC Waste Chapter"
    },
    "tree_care": {
        "co2e_per_unit": 0.060,  # kg CO2 sequestered per tree per week of ongoing stewardship
        "unit_name": "trees cared for",
        "description": "Average weekly carbon uptake for an urban tree (~22 kg CO2 absorbed per tree annually).",
        "source": "US Forest Service Urban Carbon Sequestration Guidelines"
    }
}


def calculate_single_activity(activity_type: str, quantity: float) -> dict:
    """
    Calculate estimated environmental impact for a single activity type and quantity.
    """
    if activity_type not in IMPACT_FACTORS:
        return {
            "valid": False,
            "error": f"Unknown activity type: '{activity_type}'. Supported types: {list(IMPACT_FACTORS.keys())}",
            "co2e_saved_kg": 0.0,
            "quantity": quantity
        }

    factor_data = IMPACT_FACTORS[activity_type]
    # Ensure quantity is non-negative
    safe_quantity = max(0.0, float(quantity))
    co2e_saved = round(safe_quantity * factor_data["co2e_per_unit"], 3)

    return {
        "valid": True,
        "activity_type": activity_type,
        "quantity": safe_quantity,
        "unit": factor_data["unit_name"],
        "co2e_saved_kg": co2e_saved,
        "assumption": factor_data["description"],
        "source": factor_data["source"]
    }


def calculate_aggregate_impact(activities_data: list) -> dict:
    """
    Calculate aggregate environmental impact across a list of logged activities.
    Accepts a list of dictionaries with 'activityType' and 'quantity'.
    """
    total_co2e = 0.0
    category_counts = {k: 0.0 for k in IMPACT_FACTORS}
    category_co2e = {k: 0.0 for k in IMPACT_FACTORS}
    activity_count = 0

    for item in activities_data:
        act_type = item.get("activityType") or item.get("activity_type")
        qty = item.get("quantity", 0)

        try:
            qty_num = float(qty)
        except (ValueError, TypeError):
            qty_num = 0.0

        if act_type in IMPACT_FACTORS and qty_num > 0:
            activity_count += 1
            calc = calculate_single_activity(act_type, qty_num)
            category_counts[act_type] += qty_num
            category_co2e[act_type] += calc["co2e_saved_kg"]
            total_co2e += calc["co2e_saved_kg"]

    # Tangible equivalent comparisons for relatable understanding
    bottles_diverted = int(round(category_counts.get("reusable_bottle", 0)))
    transit_km = round(category_counts.get("public_transport", 0), 1)
    active_km = round(category_counts.get("cycling_walking", 0), 1)
    waste_sessions = int(round(category_counts.get("waste_segregation", 0)))
    trees_cared = int(round(category_counts.get("tree_care", 0)))

    # Documented transparent assumptions
    assumptions_list = [
        "Estimates rely on recognized life-cycle carbon accounting values (EPA WARM & UK DEFRA).",
        "Reusable bottle impact assumes 500ml single-use PET bottle displacement (0.083 kg CO2e/bottle).",
        "Public transport and active mobility savings assume displacement of single-occupancy petrol vehicle trips.",
        "Tree stewardship reflects pro-rated weekly carbon sequestration of mature urban trees (0.06 kg CO2/tree/week).",
        "Waste segregation values reflect emissions avoided through landfill diversion and recycling."
    ]

    return {
        "success": True,
        "total_activities_computed": activity_count,
        "total_co2e_saved_kg": round(total_co2e, 2),
        "category_totals": {
            "reusable_bottle": {
                "label": "Reusable Bottle",
                "quantity": bottles_diverted,
                "unit": "bottles avoided",
                "co2e_saved_kg": round(category_co2e["reusable_bottle"], 2)
            },
            "public_transport": {
                "label": "Public Transport",
                "quantity": transit_km,
                "unit": "km traveled",
                "co2e_saved_kg": round(category_co2e["public_transport"], 2)
            },
            "cycling_walking": {
                "label": "Cycling / Walking",
                "quantity": active_km,
                "unit": "km active commute",
                "co2e_saved_kg": round(category_co2e["cycling_walking"], 2)
            },
            "waste_segregation": {
                "label": "Waste Segregation",
                "quantity": waste_sessions,
                "unit": "sessions",
                "co2e_saved_kg": round(category_co2e["waste_segregation"], 2)
            },
            "tree_care": {
                "label": "Tree Care",
                "quantity": trees_cared,
                "unit": "trees nurtured",
                "co2e_saved_kg": round(category_co2e["tree_care"], 2)
            }
        },
        "tangible_metrics": {
            "bottles_diverted": bottles_diverted,
            "clean_transit_km": round(transit_km + active_km, 1),
            "waste_sorting_sessions": waste_sessions,
            "trees_stewarded": trees_cared
        },
        "is_estimate": True,
        "methodology_note": "Calculated by EcoTrack Python/Flask Analytics Microservice",
        "assumptions": assumptions_list
    }
