import cv2
import os
import time
import argparse

def main():
    parser = argparse.ArgumentParser(description="Capture dataset images from webcam.")
    parser.add_argument('--class_name', type=str, required=True, 
                        choices=['plastic_bottle', 'milk_carton', 'tin_can'],
                        help='The class of the object being captured')
    parser.add_argument('--count', type=int, default=200, 
                        help='Number of images to capture')
    parser.add_argument('--output', type=str, default='dataset/raw', 
                        help='Output directory')
    args = parser.parse_args()

    out_dir = os.path.join(args.output, args.class_name)
    os.makedirs(out_dir, exist_ok=True)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print(f"Ready to capture {args.count} images for '{args.class_name}'.")
    print("Press 'c' to capture a single image, 'a' to auto-capture (1 img/sec), or 'q' to quit.")

    captured = 0
    auto_mode = False
    last_capture_time = 0

    while captured < args.count:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to read from webcam.")
            break

        # Display info on frame
        display_frame = frame.copy()
        cv2.putText(display_frame, f"Class: {args.class_name} | Captured: {captured}/{args.count}", 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(display_frame, f"Auto Mode: {'ON' if auto_mode else 'OFF'}", 
                    (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
        
        cv2.imshow('Capture Dataset', display_frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('a'):
            auto_mode = not auto_mode
            print(f"Auto mode {'enabled' if auto_mode else 'disabled'}.")
        elif key == ord('c') or (auto_mode and time.time() - last_capture_time > 1.0):
            timestamp = int(time.time() * 1000)
            filename = os.path.join(out_dir, f"{args.class_name}_{timestamp}.jpg")
            cv2.imwrite(filename, frame)
            captured += 1
            last_capture_time = time.time()
            print(f"Captured {captured}/{args.count}: {filename}")

    cap.release()
    cv2.destroyAllWindows()
    print("Capture session finished.")

if __name__ == '__main__':
    main()
