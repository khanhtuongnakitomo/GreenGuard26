import cv2
import time
import numpy as np

def draw_session_ui(frame, session, fps):
    annotated = frame.copy()
    h, w = annotated.shape[:2]
    now = time.time()
    
    state = session.state
    
    # Common HUD (always show FPS)
    cv2.putText(annotated, f"{int(fps)} FPS", (w - 80, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
    
    # Draw accumulated items so far
    y_offset = 30
    cv2.putText(annotated, "Collected:", (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    y_offset += 25
    for item_type, qty in session.items.items():
        cv2.putText(annotated, f"- {item_type}: {qty}", (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        y_offset += 25

    if state == "idle":
        text = "Please insert your beverage"
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1, 2)[0]
        text_x = (w - text_size[0]) // 2
        text_y = (h + text_size[1]) // 2
        cv2.putText(annotated, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
    elif state == "detecting":
        text = "Scanning..."
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.5, 3)[0]
        text_x = (w - text_size[0]) // 2
        text_y = (h + text_size[1]) // 2
        cv2.putText(annotated, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 200, 255), 3)
        
        # If we have a detection, draw a box
        best = session.last_best_detection
        if best:
            x1, y1, x2, y2 = [int(v) for v in best["bbox"]]
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 200, 255), 2)
            cv2.putText(annotated, f"{best['class_name']} {best['confidence']:.1%}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2)
            
    elif state == "accepted":
        best = session.last_best_detection
        cls_name = best["class_name"] if best else "Item"
        text = f"ACCEPTED: {cls_name}!"
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.5, 3)[0]
        text_x = (w - text_size[0]) // 2
        text_y = (h + text_size[1]) // 2
        cv2.rectangle(annotated, (0, 0), (w, h), (0, 255, 0), 10)
        cv2.putText(annotated, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
        
    elif state == "countdown":
        elapsed = now - session.state_start_time
        remaining = max(0, session.countdown_time - elapsed)
        secs = int(np.ceil(remaining))
        
        text1 = "Insert next item or wait..."
        text_size1 = cv2.getTextSize(text1, cv2.FONT_HERSHEY_SIMPLEX, 1, 2)[0]
        cv2.putText(annotated, text1, ((w - text_size1[0]) // 2, h // 2 - 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        text2 = f"{secs}"
        text_size2 = cv2.getTextSize(text2, cv2.FONT_HERSHEY_SIMPLEX, 3, 5)[0]
        cv2.putText(annotated, text2, ((w - text_size2[0]) // 2, h // 2 + 50), cv2.FONT_HERSHEY_SIMPLEX, 3, (0, 0, 255), 5)
        
    elif state == "loading":
        text = "Generating your reward code..."
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1, 2)[0]
        cv2.putText(annotated, text, ((w - text_size[0]) // 2, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
    elif state == "qr_display":
        if session.qr_image is not None:
            # Resize QR to fit nicely
            qr_h, qr_w = session.qr_image.shape[:2]
            target_h = int(h * 0.7)
            scale = target_h / qr_h
            target_w = int(qr_w * scale)
            qr_resized = cv2.resize(session.qr_image, (target_w, target_h))
            
            # Center QR
            x_offset = (w - target_w) // 2
            y_offset = (h - target_h) // 2
            
            # Darken background
            annotated = (annotated * 0.3).astype(np.uint8)
            
            # Overlay QR
            annotated[y_offset:y_offset+target_h, x_offset:x_offset+target_w] = qr_resized
            
            # Text
            cv2.putText(annotated, f"Scan to earn {session.points_earned} points!", (x_offset, y_offset - 20), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            # Countdown bar
            elapsed = now - session.state_start_time
            ratio = max(0, 1.0 - (elapsed / session.qr_display_time))
            bar_w = int(w * ratio)
            cv2.rectangle(annotated, (0, h - 20), (bar_w, h), (0, 255, 0), -1)
            
    return annotated
