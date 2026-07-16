import cv2
import numpy as np
import random
from datetime import datetime, timedelta, timezone

from point_rules import calculate_points
import qr_generator

def main():
    print("Generating random QR code demo...")
    
    # Generate random items
    items_list = []
    classes = ["plastic_bottle", "can", "carton"]
    
    for cls in classes:
        # Randomly decide to include this class or not (80% chance)
        if random.random() < 0.8:
            qty = random.randint(1, 5)
            items_list.append({"itemType": cls, "quantity": qty})
            
    if not items_list:
        # Guarantee at least one item if all failed the 80% check
        items_list.append({"itemType": "plastic_bottle", "quantity": 1})
        
    points = calculate_points(items_list)
    
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    expires_str = expires_at.isoformat().replace('+00:00', 'Z')
    
    qr_string, claim_token = qr_generator.build_signed_payload(
        items=items_list,
        total_points=points,
        expires_at_str=expires_str
    )
    
    qr_img = qr_generator.generate_qr_image(qr_string, box_size=10, border=4)
    
    # Create a blank canvas to display the QR and the text
    h, w = qr_img.shape[:2]
    canvas_h = h + 200
    canvas_w = max(w + 100, 500)
    canvas = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
    
    # Center QR
    x_offset = (canvas_w - w) // 2
    y_offset = 50
    canvas[y_offset:y_offset+h, x_offset:x_offset+w] = qr_img
    
    # Draw text
    cv2.putText(canvas, f"Total Points: {points}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    
    y_text = y_offset + h + 40
    cv2.putText(canvas, "Items Scanned:", (20, y_text), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    y_text += 30
    
    for item in items_list:
        cv2.putText(canvas, f"- {item['itemType']}: {item['quantity']}", (20, y_text), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
        y_text += 25
        
    cv2.putText(canvas, "Press any key to close", (canvas_w - 250, canvas_h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)
    
    print(f"Generated QR with {points} points. Token: {claim_token}")
    print("Press any key in the window to close.")
    
    cv2.imshow("Random QR Demo", canvas)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
