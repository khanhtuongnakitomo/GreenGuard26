from ultralytics import YOLO
import cv2
import os

# Đường dẫn tới file model bạn vừa tải về
model_path = '../models/best.pt'

# Kiểm tra xem file best.pt đã được copy vào cùng thư mục chưa
if not os.path.exists(model_path) and os.path.exists('models/best.pt'):
    model_path = 'models/best.pt'
    
if not os.path.exists(model_path):
    print("❌ LỖI: Không tìm thấy file model!")
    print("Vui lòng đảm bảo file 'best.pt' nằm trong thư mục 'models/'.")
    exit()

print("📥 Đang tải mô hình AI...")
model = YOLO(model_path)

print("📷 Đang kết nối với Webcam...")
# Khởi động webcam (0 là ID của camera mặc định trên máy tính)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ LỖI: Không thể mở webcam. Vui lòng kiểm tra lại camera.")
    exit()

print("✅ Đã mở Webcam thành công. Đưa vỏ chai/hộp sữa/lon vào trước camera để test nghiệm!")
print("🛑 Bấm phím 'q' trên bàn phím để thoát chương trình.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Lỗi khi đọc khung hình từ webcam.")
        break
        
    # Cho model dự đoán trên khung hình (chỉ hiện kết quả có độ tin cậy >= 65%)
    results = model.predict(source=frame, conf=0.65, verbose=False)
    
    # Vẽ hộp (bounding box) và tên vật thể lên khung hình
    annotated_frame = results[0].plot()
    
    # Hiển thị cửa sổ
    cv2.imshow("Test AI Phân Loại Rác Tái Chế (Bấm 'q' để thoát)", annotated_frame)
    
    # Đợi phím 'q' để thoát
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Giải phóng bộ nhớ camera và đóng cửa sổ
cap.release()
cv2.destroyAllWindows()
