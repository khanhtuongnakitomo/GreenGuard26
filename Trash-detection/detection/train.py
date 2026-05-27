from ultralytics import YOLO

def main():
    # Load pretrained model (transfer learning)
    # Using yolov8n.pt as recommended for edge devices (Raspberry Pi 5)
    model = YOLO('yolov8n.pt') 

    # Train the model with hyperparameters and augmentations based on the guide
    results = model.train(
        data='data.yaml',
        epochs=100,              # Start with 100, increase if not converged
        imgsz=640,               # Input image size
        batch=16,                # Reduce to 8 if RAM/VRAM is not enough
        patience=20,             # Early stopping
        
        # Augmentation during training
        degrees=15.0,            # Random rotation
        flipud=0.1,              # Flip up-down
        fliplr=0.5,              # Flip left-right
        mosaic=1.0,              # Combine 4 images into 1 (highly effective)
        mixup=0.1,               # Mix images
        
        # Optimizer
        optimizer='AdamW',
        lr0=0.001,               # Initial learning rate
        lrf=0.01,                # Final learning rate
        weight_decay=0.0005,
        
        # Output
        project='runs/train',
        name='recycling_v1',
        save=True,
        save_period=10,          # Save checkpoint every 10 epochs
        
        # Logging
        plots=True,              # Generate confusion matrix, PR curve automatically
    )
    
    print("Training complete! Best weights are saved in 'runs/train/recycling_v1/weights/best.pt'")

if __name__ == '__main__':
    main()
