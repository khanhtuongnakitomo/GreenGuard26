# Must match app/backend/src/config/constants.ts POINT_RULES
POINT_RULES = {
    "pet_bottle": 10,
    "metal_can": 8,
    "pp_cup": 6,
}

# The model outputs 'metal_can', 'pet_bottle', 'pp_cup'
CLASS_NAME_MAP = {
    "pet_bottle": "pet_bottle",
    "metal_can": "metal_can",
    "pp_cup": "pp_cup",
}


def calculate_points(items):
    """
    items: list of dicts like [{"itemType": "plastic_bottle", "quantity": 2}, ...]
    """
    return sum(POINT_RULES.get(i["itemType"], 0) * i["quantity"] for i in items)
