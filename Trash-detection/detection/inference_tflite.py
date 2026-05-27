import numpy as np
import cv2
from tflite_runtime.interpreter import Interpreter

class BeverageClassifier:
    def __init__(self, model_path, conf_threshold=0.5):
        self.conf_threshold = conf_threshold
        # Corresponding to data.yaml
        self.labels = ['plastic_bottle', 'milk_carton', 'tin_can']
        
        print(f"Loading TFLite model from {model_path}...")
        self.interpreter = Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.input_shape = self.input_details[0]['shape']  # Usually [1, H, W, 3]
    
    def preprocess(self, frame):
        """Resize and normalize frame for the model."""
        h, w = self.input_shape[1], self.input_shape[2]
        img = cv2.resize(frame, (w, h))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = np.expand_dims(img, axis=0).astype(np.uint8)
        return img
    
    def predict(self, frame):
        """Returns a list of detections: [(class_name, confidence, bbox), ...]"""
        img = self.preprocess(frame)
        
        self.interpreter.set_tensor(self.input_details[0]['index'], img)
        self.interpreter.invoke()
        
        # YOLOv8 TFLite output typically [1, num_detections, 6] (x,y,w,h,conf,class)
        # depending on exact export parameters
        output = self.interpreter.get_tensor(self.output_details[0]['index'])
        
        detections = []
        # output[0] contains detections for the first image in batch
        for det in output[0]:
            conf = float(det[4])
            if conf >= self.conf_threshold:
                class_id = int(det[5])
                if 0 <= class_id < len(self.labels):
                    class_name = self.labels[class_id]
                    detections.append((class_name, conf, det[:4]))
        
        return detections
    
    def classify_single_object(self, frame):
        """Classify a single object - useful for the recycling bin context."""
        detections = self.predict(frame)
        if not detections:
            return None, 0.0
        # Get the detection with the highest confidence
        best = max(detections, key=lambda x: x[1])
        return best[0], best[1]

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Test TFLite Inference.")
    parser.add_argument('--model', type=str, default='runs/train/recycling_v1/weights/best_saved_model/best_int8.tflite', help='Path to TFLite model')
    parser.add_argument('--conf', type=float, default=0.60, help='Confidence threshold')
    args = parser.parse_args()
    
    import os
    if not os.path.exists(args.model):
        print(f"Error: Model not found at {args.model}")
        print("Please ensure you have exported the model to TFLite format.")
        return

    classifier = BeverageClassifier(model_path=args.model, conf_threshold=args.conf)
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return
        
    print("Starting inference... Press 'q' to quit.")
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        class_name, confidence = classifier.classify_single_object(frame)
        
        if class_name:
            cv2.putText(frame, f"[{class_name}] {confidence:.1%}", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                        
        cv2.imshow('TFLite Inference', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
