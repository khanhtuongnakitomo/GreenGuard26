from ultralytics import YOLO
import argparse
import os

def main():
    parser = argparse.ArgumentParser(description="Export YOLOv8 model to TFLite format for Edge AI.")
    parser.add_argument('--weights', type=str, default='models/best.pt', 
                        help='Path to the trained PyTorch weights (.pt file)')
    args = parser.parse_args()

    if not os.path.exists(args.weights):
        print(f"Error: Weights file not found at {args.weights}")
        print("Please train the model first or provide the correct path using --weights")
        return

    print(f"Loading model from {args.weights}...")
    model = YOLO(args.weights)

    print("Exporting model to TFLite (INT8 Quantization) for optimal performance on Raspberry Pi...")
    # int8=True applies quantization, reducing size and increasing speed with minimal accuracy loss
    model.export(format='tflite', int8=True, imgsz=320, data='configs/data.yaml')
    
    print("Export complete!")

if __name__ == '__main__':
    main()
