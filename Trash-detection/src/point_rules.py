POINT_RULES = {
    "plastic_bottle": 8,
    "can": 10,
    "carton": 6,
}

# The model outputs 'tin_can' and 'milk_carton', but the backend expects 'can' and 'carton'
CLASS_NAME_MAP = {
    "plastic_bottle": "plastic_bottle",
    "tin_can": "can",
    "milk_carton": "carton",
}

def calculate_points(items):
    """
    items: list of dicts like [{"itemType": "plastic_bottle", "quantity": 2}, ...]
    """
    return sum(POINT_RULES.get(i["itemType"], 0) * i["quantity"] for i in items)
