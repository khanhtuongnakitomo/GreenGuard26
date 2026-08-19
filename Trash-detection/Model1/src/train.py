from ultralytics import YOLO


def main():
    # Load pretrained model YOLOv8s (transfer learning)
    # yolov8s: cân bằng tốc độ và độ chính xác, phù hợp cho Raspberry Pi
    model = YOLO('yolov8s.pt')

    # Train the model with hyperparameters and augmentations from bki-train-3.ipynb
    results = model.train(
        # ─── Dataset ───────────────────────────
        data='configs/data.yaml',

        # ─── Cấu hình training ─────────────────
        epochs=150,          # Tối đa 150 epoch
        imgsz=640,           # Kích thước ảnh
        batch=32,            # Batch 32
        patience=30,         # Dừng sớm nếu 30 epoch không cải thiện
        workers=4,

        # ─── Data Augmentation ─────────────────
        degrees=20.0,        # Xoay ngẫu nhiên ±20°
        flipud=0.2,          # Lật dọc 20%
        fliplr=0.5,          # Lật ngang 50%
        mosaic=1.0,          # Ghép 4 ảnh (hiệu quả cao)
        mixup=0.15,          # Trộn ảnh
        hsv_h=0.02,
        hsv_s=0.7,
        hsv_v=0.4,
        perspective=0.001,

        # ─── Optimizer ─────────────────────────
        optimizer='AdamW',
        lr0=0.001,
        lrf=0.01,
        weight_decay=0.0005,
        warmup_epochs=3.0,

        # ─── Xử lý class imbalance ─────────────
        cls=1.5,             # Tăng trọng số loss phân loại

        # ─── Lưu kết quả ───────────────────────
        project='runs/train',
        name='beverage_classifier_v2',
        save=True,
        save_period=10,      # Lưu checkpoint mỗi 10 epoch
        plots=True,
    )

    print("Training complete! Best weights saved at: runs/train/beverage_classifier_v2/weights/best.pt")


if __name__ == '__main__':
    main()
