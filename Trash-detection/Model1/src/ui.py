import cv2
import time
import numpy as np


CLASS_COLORS = {
    "cap": (0, 140, 255),
    "label": (255, 180, 0),
}


def _box_to_px(bbox, frame_shape):
    height, width = frame_shape[:2]
    values = [float(v) for v in bbox]
    if max(abs(v) for v in values) <= 1.5:
        ymin, xmin, ymax, xmax = values
        return int(xmin * width), int(ymin * height), int(xmax * width), int(ymax * height)
    x1, y1, x2, y2 = values
    return int(x1), int(y1), int(x2), int(y2)


def _draw_bbox(annotated, best, color=(0, 200, 255)):
    """Draw a Model 1 box from either normalized or pixel coordinates."""
    if best is None:
        return
    x1, y1, x2, y2 = _box_to_px(best["bbox"], annotated.shape)
    if x2 > x1 and y2 > y1:
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f"{best['class_name']} {best['confidence']:.1%}"
        cv2.putText(annotated, label, (x1, max(y1 - 10, 15)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)


def _draw_component_inspection(annotated, inspection):
    if not inspection:
        return
    for item in inspection.get("detections", []):
        color = CLASS_COLORS.get(item["class_name"], (0, 255, 255))
        polygon = item.get("polygon")
        if polygon:
            contour = np.array([(int(x), int(y)) for x, y in polygon], dtype=np.int32)
            cv2.polylines(annotated, [contour], True, color, 2)
        else:
            x1, y1, x2, y2 = _box_to_px(item["bbox"], annotated.shape)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)


def _draw_reject_details(annotated, inspection):
    if not inspection:
        return
    height, width = annotated.shape[:2]
    lines = ["REJECT"]
    for item in inspection.get("detections", []):
        lines.append(f"{item['class_name']} {item['confidence']:.2f}")
    if len(lines) == 1:
        lines.append(inspection.get("reason", "violation"))

    cv2.rectangle(annotated, (0, 0), (width, height), (0, 0, 255), 10)
    y = height // 2 - 20 * len(lines)
    for index, text in enumerate(lines):
        scale = 1.5 if index == 0 else 0.9
        thickness = 3 if index == 0 else 2
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)[0]
        x = (width - text_size[0]) // 2
        cv2.putText(annotated, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 255), thickness)
        y += text_size[1] + 18


def draw_session_ui(frame, session, fps):
    annotated = frame.copy()
    h, w = annotated.shape[:2]
    now = time.time()
    
    state = session.state
    inspection = getattr(session, "last_component_inspection", None)
    
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
        if getattr(session, 'demo_mode', False):
            text = "Detection Paused. Press [F] to start."
            cv2.putText(annotated, "DETECTION: OFF", (10, h - 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1, 2)[0]
        text_x = (w - text_size[0]) // 2
        text_y = (h + text_size[1]) // 2
        cv2.putText(annotated, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
    elif state == "detecting":
        text = "Scanning..."
        
        if getattr(session, 'demo_mode', False):
            cv2.putText(annotated, "DETECTION: ON", (10, h - 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.5, 3)[0]
        text_x = (w - text_size[0]) // 2
        text_y = (h + text_size[1]) // 2
        cv2.putText(annotated, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 200, 255), 3)
        
        best = session.last_best_detection
        _draw_bbox(annotated, best, color=(0, 200, 255))
        _draw_component_inspection(annotated, inspection)
            
    elif state == "accepted":
        best = session.last_best_detection
        cls_name = best["class_name"] if best else "Item"
        text = f"ACCEPTED: {cls_name}!"
        text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 1.5, 3)[0]
        text_x = (w - text_size[0]) // 2
        text_y = (h + text_size[1]) // 2
        cv2.rectangle(annotated, (0, 0), (w, h), (0, 255, 0), 10)
        cv2.putText(annotated, text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
        _draw_bbox(annotated, best, color=(0, 255, 0))
        _draw_component_inspection(annotated, inspection)

    elif state == "rejected":
        _draw_bbox(annotated, session.last_best_detection, color=(0, 0, 255))
        _draw_component_inspection(annotated, inspection)
        _draw_reject_details(annotated, inspection)
        
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
            
            # Countdown bar (only if not demo mode)
            if not getattr(session, 'demo_mode', False):
                elapsed = now - session.state_start_time
                ratio = max(0, 1.0 - (elapsed / session.qr_display_time))
                bar_w = int(w * ratio)
                cv2.rectangle(annotated, (0, h - 20), (bar_w, h), (0, 255, 0), -1)
                
    if getattr(session, 'demo_mode', False):
        # Draw demo mode keyboard shortcuts
        legend = "[Q] Quit  |  [F] Toggle Detection  |  [G] Generate/Clear QR"
        cv2.putText(annotated, legend, (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
            
    return annotated
