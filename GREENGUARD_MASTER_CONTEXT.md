# GreenGuard — Tài liệu trung tâm về dự án và hệ sinh thái GreenPoint

**Ngày đối chiếu:** 24/10/2026, múi giờ Asia/Bangkok.
**Phạm vi:** sản phẩm, mô hình kinh doanh, cơ khí và IoT, AI, ứng dụng, backend, dashboard, dữ liệu truy xuất, lịch sử thử nghiệm, cuộc thi và công việc tiếp theo.
**Bản proposal đi kèm:** [Proposal BKI.docx](competition/final/Proposal%20BKI.docx).

GreenGuard là dự án xây dựng dịch vụ thu gom và chuẩn hóa chai PET, lon nhôm tại nguồn bằng Reverse Vending Machine (RVM), kết hợp AI kiểm tra vật phẩm, GreenPoint để nhận điểm và đổi quà, cùng dashboard theo dõi hoạt động. Định hướng trong proposal Grand Final là **GreenGuard tự triển khai, quản lý và vận hành mạng lưới thu gom**, cung cấp vật liệu đã phân loại và dịch vụ dữ liệu cho các bên trong chuỗi tái chế.

Tài liệu này là **điểm bắt đầu duy nhất cho bối cảnh tổng thể của dự án**, thay thế các bản context/handoff tổng quan cũ. Hướng dẫn từng thành phần, hợp đồng model, mã nguồn và báo cáo thử nghiệm vẫn được giữ để kiểm tra chi tiết. Đây là một snapshot có ngày đối chiếu, không tự chứng nhận rằng hệ thống đã đạt production readiness.

## Mục lục

1. [Cách đọc và mức độ bằng chứng](#1-cách-đọc-và-mức-độ-bằng-chứng)
2. [Bài toán và giá trị sản phẩm](#2-bài-toán-và-giá-trị-sản-phẩm)
3. [Mô hình kinh doanh tuần hoàn](#3-mô-hình-kinh-doanh-tuần-hoàn)
4. [Người dùng và các luồng sử dụng](#4-người-dùng-và-các-luồng-sử-dụng)
5. [Bản đồ repository và quyền sở hữu dữ liệu](#5-bản-đồ-repository-và-quyền-sở-hữu-dữ-liệu)
6. [Phần cứng và ranh giới điều khiển máy](#6-phần-cứng-và-ranh-giới-điều-khiển-máy)
7. [AI và hợp đồng quyết định](#7-ai-và-hợp-đồng-quyết-định)
8. [Model đang hoạt động và các candidate](#8-model-đang-hoạt-động-và-các-candidate)
9. [Lịch sử thử nghiệm và bài học](#9-lịch-sử-thử-nghiệm-và-bài-học)
10. [GreenPoint Backend và mô hình dữ liệu](#10-greenpoint-backend-và-mô-hình-dữ-liệu)
11. [QR nhận điểm và chống nhận trùng](#11-qr-nhận-điểm-và-chống-nhận-trùng)
12. [Ứng dụng GreenPoint](#12-ứng-dụng-greenpoint)
13. [Voucher và barcode inventory](#13-voucher-và-barcode-inventory)
14. [Dashboard vận hành và cách hiểu chỉ số](#14-dashboard-vận-hành-và-cách-hiểu-chỉ-số)
15. [Truy xuất dữ liệu và giới hạn EPR](#15-truy-xuất-dữ-liệu-và-giới-hạn-epr)
16. [Triển khai và cách chạy](#16-triển-khai-và-cách-chạy)
17. [Kinh tế đơn vị và giả định tài chính](#17-kinh-tế-đơn-vị-và-giả-định-tài-chính)
18. [Bối cảnh cuộc thi và tài liệu gốc](#18-bối-cảnh-cuộc-thi-và-tài-liệu-gốc)
19. [Đội ngũ và các bên liên quan](#19-đội-ngũ-và-các-bên-liên-quan)
20. [Khoảng trống và lộ trình kiểm chứng](#20-khoảng-trống-và-lộ-trình-kiểm-chứng)
21. [Hướng dẫn tiếp nhận dự án](#21-hướng-dẫn-tiếp-nhận-dự-án)
22. [Danh mục nguồn và việc hợp nhất tài liệu](#22-danh-mục-nguồn-và-việc-hợp-nhất-tài-liệu)

## 1. Cách đọc và mức độ bằng chứng

Các nhãn dưới đây áp dụng cho toàn bộ tài liệu:

- **Đã đối chiếu:** thấy trực tiếp trong mã nguồn, cấu hình, manifest, hash hoặc tệp hiện có ngày 24/10/2026. Việc đọc mã không đồng nghĩa đã chạy thử chức năng.
- **Kết quả báo cáo:** số liệu của một lần thử nghiệm được lưu lại; không phải kết quả đo mới trong lần tổng hợp này.
- **Theo proposal:** nội dung do đội dự án mô tả trong `Proposal BKI.docx`; có thể phản ánh phần cứng hoặc phiên bản khác với checkout.
- **Định hướng:** mô hình sản phẩm, kinh doanh hoặc công việc muốn thực hiện; chưa phải doanh thu, hợp đồng hay triển khai được xác nhận.
- **Chưa kiểm chứng / NOT_MEASURED:** chưa có đủ bằng chứng để kết luận, nhất là thiết bị thực tế, vận hành liên tục, khách hàng và tác động môi trường.

Khi các nguồn khác nhau, dùng mã nguồn đang chạy, cấu hình được chọn và hash của artifact để xác định hành vi phần mềm. Dùng proposal để hiểu định hướng kinh doanh và lời trình bày của đội. Dùng log và báo cáo có điều kiện đo cụ thể để nói về hiệu năng. Không tự suy ra một phiên bản mới đã thay thế bản đang dùng chỉ vì có checkpoint hoặc tệp export mới.

**Trạng thái ngắn gọn của snapshot này:**

- Có mã nguồn cho runtime Windows, bundle Jetson, GreenPoint API, ứng dụng người dùng và dashboard.
- Có ba luồng vật liệu nghiệp vụ: `aluminum`, `pet_clean`, `pet_bad`; API detection còn nhận `reject` cho đối tượng bị loại.
- PC Model 1 đang được cấu hình là bản `m1quickft_20260909_seed42_r1`; cấu hình ghi `FAILED_ACCEPTANCE_ACTIVE_OVERRIDE`.
- Model 1-B là challenger riêng, mang trạng thái `FAILED_PARITY_CANDIDATE` và camera thực tế `NOT_MEASURED` trong manifest.
- Dashboard mặc định hiển thị dữ liệu demo. Có chế độ truy vấn live nhưng sự tồn tại của chế độ đó không chứng minh dữ liệu đang đến từ máy vật lý.
- Chưa xác nhận trong lần tổng hợp này một chuỗi chạy liên tục từ máy thật → ghi nhận vật phẩm → QR → cộng điểm → dashboard → bàn giao vật liệu cho recycler.

## 2. Bài toán và giá trị sản phẩm

Chai PET và lon nhôm có thể thu hồi giá trị, nhưng đầu vào phân tán, trộn vật liệu, còn nắp/nhãn/vòng cổ chai và chi phí thu gom làm giảm tính ổn định của dòng vật liệu. GreenGuard đặt công đoạn hướng dẫn, phân loại và ghi nhận gần nơi phát sinh rác, trước khi vật liệu đi sâu vào chuỗi tái chế.

Sản phẩm phối hợp ba lớp:

1. **Máy RVM:** tiếp nhận vật phẩm, kiểm tra bằng camera, quyết định luồng phân loại và kết nối bộ điều khiển cơ khí.
2. **GreenPoint:** cho người dùng nhận điểm bằng QR, xem lịch sử và đổi ưu đãi từ đối tác.
3. **Dashboard và backend:** lưu sự kiện, phiên đóng góp, điểm thưởng và thông tin máy; hỗ trợ vận hành và đối chiếu dữ liệu.

Phạm vi hiện tại tập trung vào chai PET và lon nhôm. Hộp giấy, PP/HDPE, nhận diện thương hiệu và các vật liệu khác xuất hiện trong một số nghiên cứu cũ; không được mặc định là chức năng của runtime hiện tại.

`pet_clean` có nghĩa hẹp trong phần mềm: chai PET không bị phát hiện vi phạm nắp, nhãn hoặc vòng cổ chai theo model và ngưỡng hiện tại. Nó không phải kết quả kiểm nghiệm hóa học, chứng nhận food-grade, kiểm tra mọi loại dị vật hoặc bảo đảm đầu ra đáp ứng quy cách của nhà máy.

Giá trị kỳ vọng cho từng bên:

- Người dùng nhận hướng dẫn và động lực vật chất khi bỏ vật phẩm đúng cách.
- Đơn vị đặt máy có một điểm thu gom và dữ liệu hoạt động tại địa điểm.
- Đơn vị thu gom có thể gom riêng các dòng vật liệu thay vì phân loại lại toàn bộ.
- Recycler nhận nguyên liệu có quy cách ổn định hơn nếu quy trình phân loại và QC được chứng minh.
- Nhãn hàng có thể tài trợ chiến dịch, voucher hoặc dịch vụ thu gom có dữ liệu để đối soát.

Các lợi ích trên là logic giá trị của giải pháp. Mức tiết kiệm, giá bán cao hơn và hành vi quay lại cần được đo qua pilot.

## 3. Mô hình kinh doanh tuần hoàn

### 3.1. Định hướng mới trong proposal Grand Final

Proposal mô tả sự chuyển đổi từ bán công nghệ hoặc máy sang **full-service circular economy operator**. GreenGuard giữ vai trò triển khai và vận hành mạng lưới, kiểm soát chất lượng thu gom ban đầu và cung cấp đầu ra vật liệu cùng dữ liệu.

Ba dòng đầu ra được mô tả là lon nhôm đã ép, PET đạt tiêu chí kiểm tra ban đầu và PET chưa đạt. Với PET chưa đạt, proposal nêu phương án để người thu gom trong mạng lưới xử lý thủ công trước khi đưa vào dòng PET đủ tiêu chuẩn. Đây là thiết kế chuỗi vận hành; cần quy trình, nhân sự và tiêu chuẩn nghiệm thu để triển khai.

### 3.2. Luồng vật liệu, tiền và dữ liệu

```text
Vật liệu:
Người dùng → RVM → tách nhôm / PET đạt / PET chưa đạt
  → thu gom và xử lý bổ sung khi cần → đối tác tiếp nhận → tái chế

Tiền và ưu đãi:
Đối tác mua vật liệu / tài trợ chiến dịch / mua dịch vụ
  → nguồn thu dự kiến của GreenGuard
  → chi phí máy, điểm thưởng, vận hành, thu gom và xử lý
Người dùng → điểm trong GreenPoint → voucher từ đối tác

Dữ liệu:
Sự kiện máy → phiên đóng góp → claim → giao dịch điểm → voucher
  → đối soát vận hành và báo cáo theo phạm vi có bằng chứng
```

### 3.3. Khách hàng và đối tác tiềm năng

- **Bên mua vật liệu:** recycler PET, đơn vị xử lý vật liệu, doanh nghiệp thu gom và đầu mối phế liệu. Proposal nhắc Duy Tân Recycling, LAGOM Vietnam và Viet Duc Scrap như các bên tiềm năng.
- **Bên mua hoặc tài trợ dịch vụ:** doanh nghiệp FMCG, đồ uống, đơn vị có mục tiêu thu hồi bao bì hoặc chiến dịch engagement.
- **Đơn vị địa điểm:** trường đại học, căng tin, bãi xe và các điểm tập trung người dùng; mở rộng ra các urban hubs là định hướng.
- **Đối tác rewards:** bãi xe, căng tin, nhà bán lẻ hoặc thương hiệu cung cấp ưu đãi thực sự dùng được.
- **Người thu gom:** một mắt xích của logistics và xử lý bổ sung, cần thiết kế lợi ích và trách nhiệm rõ ràng.

Proposal ghi rõ **chưa có formal off-take contracts**. Không gọi các tổ chức trên là khách hàng đã ký, khách hàng trả tiền hoặc cam kết bao tiêu. Các hướng doanh thu gồm bán vật liệu, dịch vụ thu gom/giám sát/báo cáo và hợp tác tài trợ; chưa có bằng chứng doanh thu thương mại được kiểm tra trong snapshot.

### 3.4. Điều cần chứng minh để mô hình hoạt động

Đầu ra phải có người nhận, quy cách và giá mua; điểm thưởng phải có chi phí thực; tuyến thu gom phải đủ hiệu quả; mỗi địa điểm cần sản lượng phù hợp. Giá trị dữ liệu phụ thuộc độ tin cậy và khả năng đối soát với vật liệu thực. Dashboard đẹp hoặc số event lớn không tự tạo ra nhu cầu mua dữ liệu.

## 4. Người dùng và các luồng sử dụng

### 4.1. Luồng người gửi vật phẩm

1. Người dùng tháo nắp, nhãn và vòng cổ chai theo hướng dẫn. Proposal mô tả một cụm cơ khí bên ngoài hỗ trợ thao tác thủ công.
2. Đặt một vật phẩm vào khoang quan sát.
3. M1 xác định lon nhôm hoặc chai PET. Lon nhôm đi thẳng tới kết quả; PET được kiểm tra thêm bằng M2.
4. Runtime hoàn thành cửa sổ quan sát và đưa ra một kết quả cho vật phẩm.
5. Bộ điều khiển nhận tín hiệu để xử lý và phân loại theo tích hợp phần cứng đã cấu hình.
6. Lớp tích hợp ghi sự kiện và tạo phiên đóng góp, sau đó hiển thị QR cho người dùng.
7. Người dùng quét QR trong GreenPoint, đăng nhập nếu cần và nhận điểm sau khi API chấp nhận claim.
8. Người dùng đổi điểm ở catalog; voucher đã cấp nằm trong wallet.
9. Dashboard đọc dữ liệu từ backend/database để hiển thị hoạt động tương ứng.

Các bước 2–4 và giao diện serial có implementation cụ thể trong PC runtime. Các API ở bước 6–9 có trong hệ sinh thái. **Cầu nối tự động giữa runtime hiện tại và API, cũng như phản hồi cơ khí thực tế, cần kiểm tra độc lập.** Không ghép các thành phần có sẵn thành lời khẳng định rằng toàn bộ chuỗi đã chạy.

### 4.2. Luồng đội vận hành

Đội vận hành quan sát tình trạng máy và các sự kiện, kiểm tra lỗi, thu gom vật liệu theo từng ngăn, xử lý PET chưa đạt, bàn giao cho đối tác và đối soát cân nặng/giá trị. Phần mềm hiện có thông tin máy, bins, heartbeat và các thống kê; không có đủ bằng chứng cho một hệ thống quản lý đội thu gom, điều tuyến và chain-of-custody hoàn chỉnh.

### 4.3. Luồng quản trị ưu đãi

Admin quản lý catalog và đối tác; tải ảnh barcode vào inventory của reward; người dùng đổi điểm để được cấp một mã; nhân viên đối tác kiểm tra và sử dụng voucher theo quyền được cấp. Phân biệt QR nhận điểm từ máy với barcode đổi ưu đãi để tránh dùng sai token hoặc sai màn hình.

## 5. Bản đồ repository và quyền sở hữu dữ liệu

`D:\Code\Project\bki` là thư mục chứa nhiều dự án, **không phải Git root**.

```text
bki/
├── GreenGuard26/                  # Repo nhận diện, runtime, dashboard và tài liệu trung tâm
│   ├── GREENGUARD_MASTER_CONTEXT.md
│   ├── README.md
│   ├── competition/final/Proposal BKI.docx
│   ├── Trash-detection/
│   │   ├── pc-demo/               # Runtime Windows
│   │   ├── jetson-runtime/        # Bundle Jetson độc lập
│   │   ├── training/              # Training, candidate và nghiên cứu
│   │   ├── validation/            # Fixture, parity, hợp đồng và báo cáo
│   │   ├── docs/                  # Hợp đồng model và kiến trúc chi tiết
│   │   └── scripts/               # Công cụ đóng gói
│   └── Dashboard/
│       ├── frontend/             # Expo / React Native Web
│       └── backend/              # BFF thiên về đọc dữ liệu
├── FRONTEND_GREENPOINT/           # Repo ứng dụng người dùng
├── GreenPoint-Backend/            # Repo nghiệp vụ, xác thực và database writes
├── competition/final/            # Tài liệu cuộc thi gốc trong workspace
├── Document/                     # Nguồn nghiên cứu, bản Word, ảnh và bảng tính
├── output/pdf/                   # Proposal PDF và nguồn xuất bản hiện có
└── workspace-docs/               # Chỉ giữ hồ sơ kỹ thuật riêng còn cần thiết
```

Repository và revision đã đọc trước commit tài liệu:

- [GreenGuard26](https://github.com/khanhtuongnakitomo/GreenGuard26): `a27ac03d1e07aac0fe89c20b93677967be03890c`. Đã fetch và xác nhận local `main` bằng `origin/main` lúc kiểm tra.
- [GreenPoint-Backend](https://github.com/khanhtuongnakitomo/GreenPoint-Backend): local `fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3`.
- [FRONTEND_GREENPOINT](https://github.com/TuanKhoa1708/FRONTEND_GREENPOINT): local `edc3bd2f58422ca895c3684c4f2864c63f6f0fc0`.

Hai revision GreenPoint là revision local đã đọc, không phải kết luận đã đồng bộ remote trong lần này.

**Quyền sở hữu nghiệp vụ:** GreenPoint-Backend quản lý schema chuẩn, xác thực, ingestion, phiên đóng góp, điểm và voucher. Dashboard BFF đọc các schema mirror và tính projection; không trở thành nơi ghi telemetry hoặc ghi voucher riêng. UI quản lý voucher trong Dashboard gọi GreenPoint API trực tiếp bằng địa chỉ và quyền riêng.

## 6. Phần cứng và ranh giới điều khiển máy

### 6.1. Thiết kế vật lý được mô tả

Tài liệu đội mô tả camera trong khoang máy, máy tính edge Jetson Nano B01, vi điều khiển ESP32-S3 N16R8, cảm biến hiện diện vật phẩm, cơ cấu chuyển hướng và các ngăn chứa. Đây là bối cảnh thiết kế từ tài liệu dự án; lần tổng hợp này không xác nhận BOM, sơ đồ chân hoặc firmware đang nạp trên thiết bị.

Proposal Grand Final mô tả các cải tiến:

- Cụm hỗ trợ người dùng tháo nhãn và vòng cổ chai.
- Chuyển từ hệ khí nén sang electric linear actuator 800 N vì kích thước và chi phí vận hành.
- Ép theo phương ngang để giảm bất lợi hành trình khi kích thước chai thay đổi.
- Hai linear guide rails và tấm ép thép dày trên 6 mm để xử lý tải lệch tâm.
- Đèn LED khuếch tán trong khoang để giảm bóng và thay đổi độ phơi sáng.
- Thoát chất lỏng, ép và phân loại vật liệu theo luồng.

Đó là **mô tả trong proposal**, không phải kết quả kiểm định lực ép, tuổi thọ, an toàn cơ khí hay nghiệm thu trong lần này. Có chỗ proposal mô tả máy thực hiện tháo thành phần, trong khi flow chi tiết là người dùng thao tác với bộ phận hỗ trợ; khi trình bày cần dùng đúng mô tả sau.

### 6.2. Giao tiếp Windows hiện tại

Nguồn: [serial_transport.py](Trash-detection/pc-demo/src/serial_transport.py), [machine_app.py](Trash-detection/pc-demo/src/machine_app.py), [machine_workflow.py](Trash-detection/pc-demo/src/machine_workflow.py).

- Camera cố định ở index `1`; không có lựa chọn chuyển camera trong machine mode.
- Máy khởi động ở trạng thái dừng `WAITING TO START`.
- Camera không đọc được thì `CAMERA 1 REQUIRED`; không suy luận hoặc gửi lệnh.
- COM được cấu hình rõ ràng được ưu tiên. Khi không cấu hình, chỉ tự chọn nếu tìm đúng một USB serial device.
- Không có hoặc có nhiều thiết bị phù hợp thì dùng terminal fallback.
- Baudrate `115200`; mỗi kết quả gửi một ASCII byte và flush, không newline, ACK hoặc retry.
- Lỗi write đóng cổng và đưa kết quả đó ra terminal một lần; không tự gửi lại vào cơ cấu.
- Terminal fallback ghi một dòng `1`, `2` hoặc `3` ra stdout; diagnostics đi stderr.

```text
Kết quả                     Giá trị nội bộ    Byte ở biên điều khiển
ALUMINUM_CAN / CANS                0                 ASCII '1'
PET_CLEAN / GOOD                  1                 ASCII '2'
PET_REJECT / BAD                  2                 ASCII '3'
```

Giá trị `0/1/2` trong workflow không phải byte serial. Cũng không được dùng giao thức chuỗi `SORT_BIN_X`, `READY`, `TABLE_HOME`, ACK/retry từ context cũ để mô tả runtime Windows này. Phản ứng của controller và ngăn thực tế cần xác nhận trên bộ máy được nối dây.

## 7. AI và hợp đồng quyết định

### 7.1. Model 1

M1 nhận ảnh camera và tạo HBB detections cho `metal_can`, `pet_bottle`. Runtime tách ngưỡng tạo candidate khỏi ngưỡng chấp nhận nghiệp vụ.

Cấu hình đang chọn trong [default.json](Trash-detection/pc-demo/config/default.json):

- Input `640 × 640`; inference candidate confidence `0.05`.
- Decision confidence theo lớp: can `0.81`, PET `0.72`; fallback `decision_conf = 0.81`.
- Diện tích vật thể tối thiểu `0.02` diện tích frame.
- Public classes `[metal_can, pet_bottle]`; `ignored_class_ids` rỗng ở bản hiện tại.
- Runtime mặc định `device = cpu`, `target_fps = 5.0`. Target cấu hình không phải FPS đã đo.

Các mô tả cũ về M1 ba lớp có `pp_cup`, threshold `0.65` hoặc hash cũ không đại diện cho cấu hình này. Ly PP vẫn là tình huống âm tính quan trọng để đánh giá, dù không còn là một lớp public của M1 đang chọn.

### 7.2. Model 2

M2 chỉ áp dụng cho PET, dùng OBB với ba lớp `cap`, `label`, `ring`. PC dùng ảnh `640 × 640`; inference confidence `0.10`, violation threshold `0.50`.

Trong kiến trúc hiện tại, M2 suy luận trên full frame rồi lọc theo tâm nằm trong vùng PET; giữ hit có confidence cao nhất cho từng lớp. Đọc class probabilities ở các kênh `4:4+class_count` và angle ở kênh cuối; không áp thêm sigmoid một lần nữa.

M2 không có lớp `foreign` hoặc `liquid`. Không diễn giải ba lớp trên thành khả năng bảo đảm chai không còn nước hay mọi dị vật.

### 7.3. Quyết định theo thời gian

Nguồn hành vi chính: [decision_core.py](Trash-detection/pc-demo/src/decision_core.py).

```text
Đang chạy và có vật phẩm
  → mở cửa sổ M1 đúng 7 quan sát
  → cần ít nhất 4 phiếu cùng loại sau khi hoàn tất cửa sổ
      nhôm → ALUMINUM_CAN
      PET  → warmup 0.5 giây → cửa sổ M2 đúng 7 quan sát
                cap/label/ring >= 0.50 → phiếu BAD
                quan sát PET hợp lệ không có vi phạm → phiếu GOOD
                thiếu quan sát hoặc mất PET tracking → abstain
                4 BAD → PET_REJECT; 4 GOOD → PET_CLEAN
  → giữ kết quả 1.5 giây
  → yêu cầu lấy vật ra
  → 8 frame M1 trống liên tiếp mới re-arm
```

Quorum 4/7 **không cho phép phát kết quả ngay ở quan sát thứ tư**. Quan sát thiếu vẫn chiếm vị trí trong cửa sổ, dưới dạng abstention. Không đạt quorum thì không phát kết quả hoặc lệnh.

Một vật phẩm chỉ phát một kết quả. Pause dừng inference và hủy cửa sổ chưa hoàn tất; nếu đã bắt đầu xử lý vật phẩm thì resume vẫn phải chờ clear gate. Kết quả đã gửi tiếp tục theo vòng đời giữ kết quả và lấy vật ra.

## 8. Model đang hoạt động và các candidate

### 8.1. Artifact đã đối chiếu hash trực tiếp

**PC M1 đang được chọn** — [manifest](Trash-detection/pc-demo/models/manifest.json):

```text
File: Trash-detection/pc-demo/models/m1_detect_640.onnx
Run: m1quickft_20260909_seed42_r1
Input: [1,3,640,640]    Output ghi trong manifest: [1,6,8400]
SHA-256: 58E6D6D4492554913A4105FF2A3F7F961ACF77F970016803561B7EED2B50A852
Config status: FAILED_ACCEPTANCE_ACTIVE_OVERRIDE
```

**PC M2**:

```text
File: Trash-detection/pc-demo/models/m2_obb_640.onnx
Nguồn đóng gói: m2revamped_20260829_seed42_n640
Input: [1,3,640,640]    Output ghi trong manifest: [1,8,8400]
SHA-256: 2DF4F8F9F7D941998029E65809EB53BBF401199EB4D0A8489E7B259503AD1449
```

**Jetson M2**:

```text
File: Trash-detection/jetson-runtime/models/m2_obb_416.onnx
SHA-256: FDA4C7986ADCE3262686842DC751AFBEAE14BD6C059C794926E3A5872BE62FA7
```

Các hash trên được tính từ tệp hiện có. Shape là metadata trong manifest, không phải kết quả chạy suy luận mới. PC và Jetson có manifest riêng; không suy ra hai gói cùng phiên bản M1.

### 8.2. M1-B challenger

Nguồn: [m1_candidate_manifest.json](Trash-detection/pc-demo/models/m1_candidate_manifest.json) và [m1_candidate.json](Trash-detection/pc-demo/config/m1_candidate.json).

```text
Run: m1efficientft_20260909_seed42_r3
File: models/candidates/m1_efficient_current.onnx
SHA-256 theo manifest: 14DE7A4BEA542F28C8BEF3971BB59F7B907E6B691B407D4823E32A3126E76B5C
Can threshold: 0.88    PET threshold: 0.74
Status: FAILED_PARITY_CANDIDATE
Physical camera status: NOT_MEASURED
```

Candidate dùng riêng trong `demo_model1_candidate.bat`, `demo-model1-b.bat` và công cụ so sánh. Nó không tự thay thế M1 active, không nối vào M2/full workflow và không khởi tạo serial trong các chế độ M1 riêng.

M1-B hoàn thành training không có nghĩa đã qua acceptance. Manifest có `source_checkpoint_sha256 = null`; không điền một hash giả để làm provenance có vẻ đầy đủ.

### 8.3. Candidate M2 và promotion

Context cũ có run `m2edgeft_20260830_seed42_n640_e30`, được ghi là candidate-only, `production_ready=false`, không sửa production/Jetson. Không lấy việc tệp export tồn tại làm bằng chứng đã promotion. Muốn dùng model mới phải xác định đúng run, report, hash, kiểm tra parity, dữ liệu holdout và kết quả camera thực tế.

## 9. Lịch sử thử nghiệm và bài học

### 9.1. Từ miền ảnh chung sang khoang máy

Proposal kể lại việc model trên ảnh vật phẩm dựng ngoài trời giảm hiệu quả khi vào khoang hẹp, vật nằm ngang và có che khuất. Đội thử U-Net cho neck ring rồi chuyển trọng tâm sang ánh sáng khuếch tán và dataset đúng môi trường máy.

Proposal đưa ra các con số `<55%`, `>85%`, dataset `1.500+` ảnh và `>94,5%` accuracy trên một model nhẹ. Đây là **số liệu được proposal trình bày**, chưa đối chiếu được một evaluation protocol thống nhất với artifact đang active. Đặc biệt, mô tả một model trong proposal khác với runtime M1 → M2 đang có. Giữ hai lớp thông tin này riêng khi viết pitch hoặc báo cáo kỹ thuật.

### 9.2. M1-B ngày 09/09/2026

Hồ sơ training cũ ghi run `m1efficientft_20260909_seed42_r3` kéo dài khoảng 85,5 phút, gồm smoke 1 epoch, phase A 4 epoch và phase B 32 epoch. Budget 420 phút là giới hạn mục tiêu, không buộc training phải chạy hết thời gian.

Hồ sơ ghi 37 frame mới gồm 8 can, 27 PET và 2 empty; các pool/sampling quota không phải số ảnh nguồn độc nhất. Kết quả được ghi lại:

- Can mới: nhận đúng `2/8`, recall `25%`.
- PET mới: nhận `18/27`, recall `66,7%`; precision báo cáo `94,7%`.
- PET nhãn trắng holdout: `0/6` được chấp nhận.
- Hai ảnh empty không có accepted false positive; mẫu nhỏ này không chứng minh môi trường trống an toàn trong mọi điều kiện.
- Old holdout: recall can khoảng `87,43%`, recall PET khoảng `76,95%`.
- Parity PyTorch/ONNX không đạt giới hạn kiểm tra của run; file ONNX load được nhưng package vẫn `FAILED_PARITY_CANDIDATE`.

Các chi tiết số học trên được chuyển từ hồ sơ context/training cũ, không đo lại trong lần tổng hợp. Trạng thái fail và candidate-only được manifest hiện tại xác nhận. Một trường `early_result` trong mô tả replay cũ không nhất quán với `emitted_before_seven=false`; không lấy riêng trường đó làm bằng chứng phát lệnh sớm.

### 9.3. Vấn đề M1 được người dùng báo cáo

Handoff trước ghi người dùng nói model bắt đầu “hallucinate”. Chưa có đủ trace để phân loại đó là false positive ở khoang trống, sai lớp, reflection, raw candidate thấp bị lọc, temporal flicker hay vấn đề khác.

Đây là **triệu chứng được báo cáo**, chưa phải root cause. Hướng thu thập bằng chứng là cho A và B xử lý cùng frame, lưu raw/accepted detections, confidence, area, lý do reject, model/config hash và kết quả 7/4. Cần có cảnh empty, tay, reflection, ly PP, lon, PET và nhiều điều kiện ánh sáng. `diagnose_m1.py` theo hồ sơ cũ chỉ load default config; phải kiểm tra khả năng chọn config trước khi gọi trace của nó là trace M1-B.

Không kết luận ONNX export là nguyên nhân chung chỉ từ việc model chạy sai ngoài thực tế. Các bản model khác nhau có kết quả parity khác nhau; phải gắn chẩn đoán với đúng artifact.

### 9.4. Thử nghiệm fixed-camera hai model tháng 10/2026

Nguồn local còn giữ: `Trash-detection/training/experiments/fixed_view_compare_20261012/report.md`. Thư mục thử nghiệm chưa được đưa vào commit tài liệu này; người clone repository có thể chưa có các file đó.

- 649 ảnh RGB đã deduplicate: train 493, validation 111, locked test 45.
- Không có clean-PET được review trong bất kỳ split nào; không có foreign-object được xác nhận.
- Model A: MobileNetV3-Large, một full-frame input 384 × 384, state head.
- Model B: cùng backbone, full frame cùng ba vertical strips, các head material/state/defect riêng.
- State head của cả A và B nhận đúng `0/8` lon trong locked test.
- A nhận đúng `25/25` rejected PET và `2/2` empty; B nhận `7/25` rejected PET và `2/2` empty.
- Accuracy trên 35 frame có state label: A `77,1%`, B `25,7%`; accuracy A che khuất việc bỏ sót toàn bộ lon.
- Material head B và state head bất đồng; chưa có routing rule kết hợp được đánh giá.
- Signal clean-PET bị tắt vì thiếu dữ liệu. Không phát signal đó không đồng nghĩa model đã học được an toàn.

**Kết luận báo cáo:** không có model thắng đủ điều kiện làm sorter; không promotion hoặc thay runtime. Split dùng nhóm suy luận từ hình/session, không phải danh tính vật phẩm được xác minh hoàn toàn. Latency nghiên cứu trên RTX 3060/CPU không phải latency Jetson hoặc end-to-end của máy.

### 9.5. Các bài học còn áp dụng

Đánh giá theo loại lỗi và điều kiện triển khai, không chỉ aggregate accuracy. Tách raw inference, filter, temporal voter, serial transport và cơ khí khi tìm lỗi. Giữ tập test khóa và nhóm ảnh liên quan để tránh leakage. Không đổi nhãn uncertain thành empty; không diễn giải head chưa được huấn luyện thành khả năng phát hiện dị vật.

## 10. GreenPoint Backend và mô hình dữ liệu

Nguồn: [repository backend](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/tree/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/src). Stack trong package: Express 4, TypeScript, Mongoose 8, Zod, JWT và bcrypt. Port mặc định `4000`; health route `/api/health`.

Các module hiện có gồm `auth`, `users`, `machines`, `detections`, `machine-sessions`, `contributions`, `points`, `partners`, `rewards`, `vouchers`, `barcodes`, `operator`, `admin`, `milestones`, `leaderboard`, `campaigns`.

### 10.1. Các entity quan trọng

- **Machine:** `machineCode`, tên, địa điểm, trạng thái, `apiKeyHash`, heartbeat, tổng session, bins, tọa độ tùy chọn. Machine code hiện được validate là bốn chữ số `0001–9999`.
- **DetectionEvent:** `eventId` unique, `machineId`, `machineCode`, `detectedType`, confidence, FPS/latency/snapshot tùy chọn, `sortingStatus`, `syncStatus`, `capturedAt` và timestamps.
- **ContributionSession:** `sessionCode`, máy, danh sách item/quantity/pointsPerItem/avgConfidence, totals, `claimTokenHash` unique, status, người claim, thời điểm claim và expiry.
- **User:** tài khoản, số dư và thống kê đóng góp; các tổng vật liệu dùng key `pet_clean`, `pet_bad`, `aluminum`.
- **PointTransaction:** ledger phát sinh điểm; phân biệt lịch sử giao dịch và số dư hiện tại.
- **Reward:** mẫu ưu đãi/catalog. **UserVoucher:** ưu đãi đã cấp cho một người. **Barcode inventory:** mã hoặc ảnh barcode có thể cấp phát cho reward tương ứng.

`syncStatus` trên DetectionEvent hiện chỉ có `synced` trong schema. Database cloud không thể biết máy còn bao nhiêu record chưa gửi nếu thiếu telemetry về local queue.

### 10.2. Điểm thưởng hiện hành

Nguồn: [constants.ts](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/src/config/constants.ts).

```text
pet_clean: 10 điểm / vật phẩm
pet_bad:    5 điểm / vật phẩm
aluminum:   8 điểm / vật phẩm

Ví dụ: 2 pet_clean + 1 pet_bad + 3 aluminum
     = 2×10 + 1×5 + 3×8 = 49 điểm cho 6 vật phẩm.
```

Không dùng bảng cũ chai 10 / lon 8 / carton 6. Có module campaigns nhưng không suy ra mọi claim đều được áp một hệ số điểm động theo khu vực; cần kiểm tra đường tính điểm thực sự được gọi.

### 10.3. Các endpoint cốt lõi

```text
GET  /api/health
POST /api/detections                 # machine authentication
GET  /api/detections
POST /api/machine-sessions           # tạo session từ cửa sổ detection
POST /api/machines/heartbeat
POST /api/contributions              # đường tạo session với credentials trong nghiệp vụ
POST /api/contributions/claim        # user authentication
GET  /api/rewards
POST /api/rewards/:rewardId/redeem    # user authentication
/api/wallet                         # ví ưu đãi người dùng
/api/operator                       # nghiệp vụ xác nhận/sử dụng voucher
/api/admin                          # nghiệp vụ quản trị và báo cáo
```

Danh sách trên là bản đồ entrypoint, không phải cam kết mọi endpoint đã được kiểm thử live hoặc có cùng mô hình auth. Đọc routes, validation và service tương ứng trước khi tích hợp.

## 11. QR nhận điểm và chống nhận trùng

### 11.1. Luồng server-backed

Máy gửi detection với `eventId` và credentials. `recordDetection` upsert theo `eventId`, giúp cùng event không tạo nhiều document. `createSessionFromWindow` lấy detection của máy trong cửa sổ mặc định 20 giây, nhóm theo loại, tính quantity/avgConfidence/điểm và tạo token có hạn dùng.

QR được app parse, sau đó gửi `claimToken` và chuỗi `rawQr` tới `/api/contributions/claim`. Backend kiểm tra cấu trúc, token, expiry và trạng thái session. Token được lưu dưới dạng hash. Thời hạn mặc định trong cấu hình là 15 phút, có thể thay qua `CLAIM_TOKEN_EXPIRES_MINUTES`.

Claim dùng điều kiện cập nhật `status: unclaimed` sang `claimed`; claim lặp lại nhận conflict. Sau đó tạo ledger điểm, cập nhật thống kê user và kiểm tra milestone. **Cơ chế chống claim trùng có trong code; mức độ atomic của toàn bộ chuỗi ghi và khả năng phục hồi khi tiến trình lỗi vẫn cần test phù hợp.**

App retry lỗi `404` tối đa ba lần, cách nhau 800 ms để xử lý trường hợp request tạo session từ máy vẫn đang tới server. Đây không phải hàng đợi offline bền vững.

### 11.2. Hai dạng payload QR

Nguồn: [scanPayload.ts](https://github.com/TuanKhoa1708/FRONTEND_GREENPOINT/blob/edc3bd2f58422ca895c3684c4f2864c63f6f0fc0/src/services/scanPayload.ts) và backend `src/utils/qrPayload.ts`.

- Dạng đầy đủ có `claimToken`, `totalItems`, `totalPoints`, `items`, `expiresAt`, tùy chọn `machineCode`.
- Dạng compact v1 có `v`, `t`, `n`, `p`, `i`, `e`, `m`; item shorthand `c=pet_clean`, `b=pet_bad`, `a=aluminum`.
- Số lượng phải là số nguyên dương; loại vật liệu phải hợp lệ; expiry phải parse được.

Đây là payload JSON trong các đường đã đọc. JWT dùng cho account authentication không chứng minh QR đóng góp là encrypted JWT.

### 11.3. Chế độ demo unsigned QR

`ALLOW_UNSIGNED_QR_CLAIM` mặc định `false` khi `NODE_ENV=production`, mặc định `true` ngoài production. Khi bật, nếu không có session, backend có thể tạo session từ dữ liệu QR và dùng máy demo theo logic service.

Chế độ này phục vụ demo khi không có máy, không bảo đảm vật phẩm đã được nộp thật. Đối với điểm/voucher có giá trị thực, cấu hình cần `false` và session phải do luồng máy được xác thực tạo ra. Không công bố demo QR như bằng chứng thu gom thực.

### 11.4. Các ranh giới cần kiểm tra tiếp

Idempotency theo `eventId` không tự bảo đảm cùng một tập detection không bị đưa vào nhiều session. Cửa sổ tạo session hiện được chọn theo thời gian và loại vật liệu; cần đánh giá liên kết event → session và `sortingStatus` trước khi kết luận chống double counting xuyên toàn chuỗi. Chống claim cùng token cũng không thay thế kiểm soát này.

## 12. Ứng dụng GreenPoint

Nguồn: [repository ứng dụng](https://github.com/TuanKhoa1708/FRONTEND_GREENPOINT/tree/edc3bd2f58422ca895c3684c4f2864c63f6f0fc0).

Package đang khai báo Expo `^55.0.27`, React Native `^0.83.6`, React `^19.2.0`, TypeScript `~5.9.2`, Expo Router, Zustand, React Query, Axios, i18next và thư viện quét mã. Package manager được khai báo `pnpm@10.34.5`. Đây là dependency declarations, không phải chứng nhận runtime trên mọi thiết bị.

Các màn hình và module có trong mã:

- Đăng ký, đăng nhập, OTP, quên/reset mật khẩu.
- Home, rewards, profile, map và navigation phù hợp web/mobile.
- Quét QR, preview và claim đóng góp.
- Wallet, lịch sử, impact, sửa hồ sơ và settings.
- Tasks/brand-task, milestone/leaderboard và dịch vụ liên quan theo phạm vi từng màn hình.
- Theme và nội dung tiếng Việt/tiếng Anh.

Map đang dùng danh sách station mẫu tĩnh theo README hiện tại. Không gọi đó là bản đồ fleet live. Một route, màn hình hoặc tên API có sẵn cũng không đủ chứng minh toàn bộ hành trình người dùng đã hoạt động trên thiết bị.

### 12.1. Quản lý session

Private query keys có user ID. Session transition hủy và xóa query state, reset profile; requests mang session generation để response cũ không điền vào tài khoản mới. Các lỗi 401 đồng thời dùng một refresh attempt, request replay không lặp vô hạn. Credential writes được điều phối để refresh cũ không ghi đè lần đăng nhập mới.

Nguồn chính: `src/services/session.ts`, `src/services/api.ts`, `src/services/queryClient.ts`. Khi kiểm thử, cần account A → logout → account B, request chậm trong lúc logout, hết hạn token và recovery sau mất kết nối.

### 12.2. API URL

`EXPO_PUBLIC_API_URL` của app phải trỏ tới GreenPoint API và bao gồm `/api`; mặc định được mô tả là `http://localhost:4000/api`. Đây là URL public được đóng vào frontend build, không phải nơi chứa secret.

## 13. Voucher và barcode inventory

Nguồn chi tiết: [VOUCHERS.md](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/VOUCHERS.md), module `barcodes`, `rewards`, `vouchers` và các service app.

Hiện có hai khái niệm cần giữ riêng:

1. **QR recycling claim:** nối phiên gửi vật phẩm với việc nhận điểm.
2. **Reward barcode:** tài sản ưu đãi được cấp khi đổi điểm, có inventory và quyền truy cập.

Workflow inventory có admin upload ảnh PNG/JPEG; route upload dùng raw body, giới hạn 2 MB. Ảnh được lưu trong MongoDB theo tài liệu backend, không phụ thuộc file tạm của máy chủ. API cấp mã có kiểm soát inventory; app dùng `Idempotency-Key` cho một lần redeem và giữ key khi retry lỗi không rõ kết quả.

Sau redeem thành công, app đưa voucher vào wallet. Ảnh gốc chỉ được lấy khi mở voucher; hiển thị trên vùng nền trắng có padding để giữ quiet zone. Không tự dựng lại ảnh từ chuỗi code hoặc công khai ảnh inventory bằng public URL. Voucher legacy không có ảnh sẽ hiển thị unavailable theo thiết kế hiện tại.

Dashboard có màn hình quản lý ưu đãi nhưng các thao tác ghi đi qua GreenPoint API, dưới quyền admin. Không ghi ảnh voucher hoặc điều chỉnh số dư qua Dashboard BFF.

`data/vouchers.json` và seed tools là một luồng quản trị dữ liệu khác đã có. Chạy seed thay đổi database được chọn, không phải thao tác đọc. Không dùng seed hoặc bootstrap admin để “kiểm tra cho nhanh” vào database thật.

Cash redemption xuất hiện trong proposal nhưng chưa xác nhận một luồng thanh toán/rút tiền thực trong mã đã đọc. Catalog voucher đang có không phải bằng chứng đã có quan hệ thương mại với mọi thương hiệu hiển thị.

## 14. Dashboard vận hành và cách hiểu chỉ số

Nguồn: [Dashboard README](Dashboard/README.md), [API client](Dashboard/frontend/src/services/api.ts), [dashboard controller](Dashboard/backend/src/controllers/dashboard.controller.ts).

Frontend khai báo Expo `~57.0.2`, React Native `0.86.0`, React `19.2.3`, TypeScript `~6.0.3`; không đồng nhất version với ứng dụng GreenPoint. Backend là Express/TypeScript/Mongoose.

### 14.1. Chế độ dữ liệu

- `EXPO_PUBLIC_DEMO_MODE` khác chuỗi `false` thì demo mode bật, kể cả khi biến chưa được đặt.
- Demo mode lấy dữ liệu presentation từ `demoData.ts`; Dashboard và Analytics không poll live.
- Live mode dùng `EXPO_PUBLIC_API_URL`, mặc định `http://localhost:3003`; Dashboard poll khoảng 3,5 giây, Analytics 4 giây.
- Timeout request 15 giây. Live refresh lỗi giữ snapshot đầy đủ gần nhất và báo stale; lỗi lần đầu hiển thị unavailable.
- Smart Bins và Reports vẫn là presentation pages, kể cả trong live mode; UI action không chứng minh đã có fleet management hoặc report export thực.
- Quản lý voucher dùng API riêng, xác thực riêng; không được hiểu demo mode là giả lập an toàn cho mọi thao tác admin.

### 14.2. Định nghĩa chỉ số

`acceptRate = số detection khác reject / tổng detection × 100%`.

`purityRate = pet_clean / (pet_clean + pet_bad) × 100%`.

`pet_bad` vẫn là một dòng được thu gom riêng; nó không phải detection `reject`. Accept Rate không đo accuracy AI. Purity Rate không phải hóa nghiệm độ tinh khiết hoặc tỷ lệ recycler chấp nhận. Confidence trung bình là score model, không phải xác suất đúng đã hiệu chuẩn.

FPS, confidence hoặc latency thiếu mẫu trả `null`; `pendingSync` legacy là `null` vì không có device queue telemetry; `uptimePct` là `null` khi không có lịch sử uptime. Số reward session chưa claim là `unclaimedSessions`, không phải số record chưa đồng bộ từ máy.

### 14.3. Chỉ số môi trường

[impact.ts](Dashboard/backend/src/services/impact.ts) tính impact theo contribution session; controller hiện chọn claimed sessions. Tháng được nhóm theo thời gian tạo session ở UTC, không phải lúc claim. Item không có ngày hợp lệ được tính vào lifetime/`undatedItems`, không bị gán một tháng giả.

[impactFactors.ts](Dashboard/backend/src/config/impactFactors.ts) hiện dùng hệ số cho từng vật phẩm:

```text
                         pet_clean   pet_bad   aluminum
CO2 kg / vật phẩm           0.045      0.025     0.082
Nước lít / vật phẩm         1.2        0.6       2.5
Điện kWh / vật phẩm         0.055      0.030     0.140
Khối lượng kg / vật phẩm    0.022      0.024     0.015
```

Đây là hệ số trong code; provenance của trích dẫn tổng quát trong comment chưa được xác thực ở lần này. Cần ghi là ước tính theo hệ số, không phải số cân, công tơ hoặc LCA được đo độc lập cho GreenGuard. Legacy `plastic_bottle` và `can` được service map để đọc dữ liệu cũ; không mở lại phạm vi carton hiện hành.

## 15. Truy xuất dữ liệu và giới hạn EPR

Giá trị số của GreenGuard là liên kết được hoạt động vật lý với bản ghi có định danh. Các trường hiện có hỗ trợ một phần chuỗi này: event/session ID, máy và địa điểm, thời điểm, loại vật liệu, confidence, trạng thái sorting, quantity, claim và giao dịch điểm.

Để truy xuất đủ từ người gửi tới đầu ra tái chế, còn cần thiết kế hoặc chứng minh:

- Một vật phẩm thực chỉ tạo một event nghiệp vụ; event thuộc về một session rõ ràng.
- Kết quả phần mềm tương ứng với ngăn cơ khí thực tế, bao gồm trường hợp sorting thất bại.
- Batch thu gom có cân nặng, người nhận/giao, thời gian và địa điểm.
- PET xử lý lại có liên kết tới batch gốc, kết quả QC và hao hụt.
- Đối tác downstream có phiếu nhận, quy cách chấp nhận và chứng từ đầu ra.
- Có ranh giới sở hữu dữ liệu và ngăn đếm trùng giữa địa điểm, chiến dịch, thương hiệu và bên tái chế.

Không khẳng định hệ thống đã đáp ứng pháp lý EPR, có chứng chỉ recycling credit hoặc bảo đảm hồ sơ hợp lệ chỉ vì có dashboard. Proposal định vị dữ liệu như một hỗ trợ giám sát/đối soát; yêu cầu pháp lý và điều kiện chấp nhận của bên mua cần được xác minh riêng theo thời điểm sử dụng.

Tương tự, có tọa độ trên Machine không phải GPS đo tại mỗi transaction; đếm vật phẩm không phải khối lượng cân thực; không có lớp brand trong M1/M2 đang chọn để khẳng định đã theo dõi nhãn hàng từng vật phẩm.

## 16. Triển khai và cách chạy

Các lệnh dưới đây là hướng dẫn lấy từ script/package hiện có; **không được chạy để cài lại, training hoặc vận hành máy trong lần viết tài liệu này**. Đọc cấu hình và chọn môi trường được phép trước khi thực hiện.

### 16.1. Windows detection

Từ `GreenGuard26/Trash-detection`, setup được tài liệu runtime hướng dẫn bằng `setup.ps1`; runtime có môi trường `.venv` riêng. Dependencies gồm OpenCV, ONNX Runtime, PyTorch, Ultralytics và `pyserial>=3.5,<4`.

Các operator launcher hiện có:

```powershell
.\demo_model1.bat             # M1 active, diagnostic
.\demo_model1_candidate.bat   # M1 challenger, diagnostic
.\demo-model1-b.bat           # M1-B riêng
.\compare_model1.bat          # A/B trên cùng frame
.\demo_model2.bat             # M2 diagnostic
.\full_demo.bat               # M1 → M2 diagnostic
.\full-workflow-machine.bat   # Camera 1 và machine transport
```

Diagnostic mode bắt đầu paused, có overlay và camera switch. Candidate được ghi `CANDIDATE — NOT ACTIVE`. Phím trong diagnostic: S/Space chạy, P pause, C đổi camera, Q/Esc thoát. Machine mode chỉ có ảnh, trạng thái/kết quả và Run/Pause; không có box, confidence, FPS, counter hoặc camera switch.

Chạy bộ kiểm tra offline từ `pc-demo` khi cần xác nhận thay đổi runtime:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

Handoff trước ghi năm lỗi M1 parity/filter đã biết. Lần tổng hợp này không chạy lại test nên không xác nhận số lỗi hiện tại. Không skip, hạ gate hoặc sửa expected chỉ để có màu xanh. Test giả lập không chứng minh camera, COM, controller hoặc an toàn máy thật.

### 16.2. Jetson

[jetson-runtime](Trash-detection/jetson-runtime/README.md) là bundle độc lập cho Jetson Nano B01, theo tài liệu nhắm JetPack 4.6.6, L4T R32.7.6, CUDA 10.2 và TensorRT 8.2. Source tương thích Python 3.6, không phụ thuộc Ultralytics/PyTorch như runtime PC.

Copy riêng bundle lên thiết bị, kiểm tra môi trường bằng `setup.sh --check`, build engine bằng `build_engines.sh`, rồi chạy `run.sh` theo README. Engine gắn với ONNX hash và engine manifest; không tái sử dụng engine khác thiết bị/version một cách mặc định.

[DEVICE_VALIDATION.md](Trash-detection/jetson-runtime/DEVICE_VALIDATION.md) yêu cầu ma trận camera và soak tối thiểu 30 phút. Mục tiêu PET end-to-end ≥5 FPS trong checklist là tiêu chí cần đo, không phải kết quả đã đạt. Không mặc định hướng dẫn Jetson Nano áp dụng cho Orin hoặc TensorRT 10.

### 16.3. API và ứng dụng

Trong `GreenPoint-Backend`, package có `dev`, `typecheck`, `test`, `build`, `start`; cần `MONGODB_URI`, JWT secrets và cấu hình origin phù hợp. Dùng lockfile của repository. Không dùng production database để chạy fixture, seed hoặc thử nghiệm.

Trong `FRONTEND_GREENPOINT`, dùng pnpm và lockfile đã check in:

```powershell
pnpm install --frozen-lockfile
pnpm web
pnpm typecheck
pnpm test
pnpm build:web
```

Lệnh `build:web` đồng bộ WASM reader rồi export web. Web build hoặc test mô phỏng không thay thế test camera và barcode trên thiết bị đích.

### 16.4. Dashboard

Trong `Dashboard/backend`, script phát triển là `npm run dev`; `PORT` fallback trong source là `3001`, còn frontend mặc định gọi `3003`. Cần cấu hình port hai bên khớp nhau. Trong frontend, `npm run web` mở Expo Web. Chạy typecheck/test trong từng package khi sửa code.

Ba biến public có mục đích khác nhau:

```text
GreenPoint app:
  EXPO_PUBLIC_API_URL=http://localhost:4000/api

Dashboard frontend:
  EXPO_PUBLIC_API_URL=http://localhost:3003
  EXPO_PUBLIC_DEMO_MODE=false                  # chỉ khi cần dữ liệu live
  EXPO_PUBLIC_GREENPOINT_API_URL=http://localhost:4000/api
```

Thay biến build-time cần restart/rebuild frontend. Không sao chép secret JWT, API key máy hoặc MongoDB credentials vào các biến `EXPO_PUBLIC_*`.

### 16.5. Ranh giới deployment

Có cấu hình web và tài liệu triển khai không chứng minh endpoint đang live, đúng database hoặc đã xác thực. Snapshot này không kiểm tra hosting, endpoint production hay phiên đăng nhập. Không có deploy, migration, seed hoặc bootstrap admin trong công việc tổng hợp.

Thiết kế offline SQLite queue, background sync và QR JWT được nhắc trong proposal/context cũ. Đường PC hiện tại đã đọc tập trung inference/UI/serial; chưa thấy cầu nối HTTP/SQLite tương ứng ở các entrypoint đã rà. Vì vậy không mô tả khả năng offline end-to-end, `<0,2s`, uptime 100% hoặc zero data loss là tính chất đã chứng minh của checkout này.

## 17. Kinh tế đơn vị và giả định tài chính

Các số trong mục này là **dự phóng của proposal BKI**, không phải doanh thu hoặc dòng tiền đã ghi nhận:

- CAPEX một máy `19.000.000 VND`; mục tiêu `16.000.000 VND` khi sản xuất lô 15 máy.
- Doanh thu dự kiến `6.202.500 VND/máy/tháng`.
- Technical maintenance OPEX `1.270.000 VND/tháng`.
- Logistics OPEX phân bổ `3.267.000 VND/tháng`.
- Proposal ghi Gross Profit `1.665.000 VND/tháng`, Gross Margin `26,8%`.
- Giả định lifespan 36 tháng, discount rate 1% mỗi tháng.
- Proposal ghi DPP `12,18 tháng`, NPV `31.128.996 VND`, annualized IRR `158%`.

**Điểm số học cần thống nhất:** `6.202.500 − 1.270.000 − 3.267.000 = 1.665.500 VND`, lệch `500 VND` với lợi nhuận được ghi. Đây có thể là làm tròn nhưng cần được giải thích trong mô hình tính. Không dùng tên Gross Profit hoặc IRR để suy ra đã bao gồm thuế, depreciation, toàn bộ nhân sự, chi phí tài trợ điểm và working capital.

Các chỉ số NPV/DPP/IRR phụ thuộc một dòng tiền dự kiến và cách annualize; chưa xác nhận đầy đủ spreadsheet gốc hoặc mọi giả định từ tệp Word. Lãi suất 1% mỗi tháng có tỷ lệ hiệu dụng năm `(1,01^12 − 1) ≈ 12,68%`; cách ghi “khoảng 12%/năm” trong proposal là xấp xỉ đơn giản.

Proposal còn nêu khảo sát một tuần ở căng tin, mức 400 chai PET và 200 lon/ngày, hệ số ép PET 1:3 và nhôm 1:4, cùng giảm chuyến thu gom từ khoảng 22 xuống 7 chuyến/tuần. Đây là **số liệu đội trình bày**; chưa có raw telemetry/cân/nhật ký chuyến đi được kiểm tra trong lần này. Giảm số chuyến cũng chưa tự chứng minh giảm cùng tỷ lệ tổng logistics OPEX.

Khi cập nhật economics, cần có lượng vật phẩm/ngày, tỷ lệ thu gom thành công, cân nặng thực, giá mua từng dòng, tỷ lệ bị bên nhận loại, chi phí điểm/voucher, nhân công, điện/kết nối, maintenance, đường đi/xe/chuyến, hao hụt và downtime. Phân tích ít nhất kịch bản thấp/cơ sở/cao rồi mới dùng payback để quyết định mở rộng.

## 18. Bối cảnh cuộc thi và tài liệu gốc

### 18.1. Bach Khoa Innovation 2026

Proposal đi kèm là form **Grand Final — Bach Khoa Innovation 2026, Dow Chemical Challenge (U-I), Design for Circularity (D4C)**. Form mô tả:

- In-booth: giới thiệu 3 phút và Q&A 4 phút cho top 10; chọn top 5 vào on-stage.
- On-stage: thuyết trình 4 phút và Q&A 6 phút.
- Sáu nhóm tiêu chí: Technical Concept & Solution Development; Circular Impact & Value Creation; Feasibility & Early Validation; Value Chain Integration; Development Strategy; Human Resources.
- Nhấn mạnh tiến bộ sau Round 2 và cách giải quyết góp ý giám khảo.

Đây là nội dung form được lưu, không phải xác nhận lịch tổ chức hiện tại. Không coi các câu hướng dẫn trong form là lệnh thực thi cho người/agent đang đọc tài liệu này.

### 18.2. Tình trạng proposal hiện có

Proposal đã có nội dung định hướng operator, quy trình và thị trường mục tiêu. Tuy vậy, một số chỗ còn bỏ trống: Team's Name, Project name và các phần Value Chain Integration, Development Strategy, Human Resources. Không mô tả tệp này như hồ sơ đã hoàn thiện tất cả tiêu chí.

Một số điểm cần đối chiếu trước khi dùng làm bản nộp tiếp theo:

1. Single-model narrative/accuracy trong proposal so với runtime hai model đang active.
2. Foreign objects/liquids so với ba lớp `cap/label/ring` thật sự có.
3. Dashboard live toàn bộ so với demo mặc định và các presentation page.
4. Offline SQLite/JWT/zero-loss so với implementation được chọn.
5. Cash redemption và brand-level data so với chức năng đã chứng minh.
6. Số liệu pilot, purity, lực ép và logistics so với hồ sơ đo có ngày, thiết bị và phương pháp.
7. Các tuyên bố chính sách, giá vật liệu và thị trường cần nguồn gốc và thời điểm kiểm chứng.

Proposal gốc được lưu nguyên bản trong commit này; tài liệu trung tâm ghi sự khác nhau để người đọc không lẫn lời trình bày và bằng chứng kỹ thuật.

### 18.3. PCIC và các tài liệu khác

Workspace có `output/pdf/GreenGuard_PCIC_2026_Proposal_Tieng_Viet.pdf`, với trọng tâm đã được định hướng là công nghệ số/truy xuất dữ liệu và mô hình kinh doanh tuần hoàn. Tệp PDF này không được đọc lại toàn bộ hoặc đưa vào commit hiện tại. Dùng nó như nguồn riêng có phiên bản, không tự lấy các số liệu từ proposal BKI thay vào.

Nguồn cuộc thi còn có báo cáo Round 2, báo cáo Grand Final PDF, deck `GG-PreFinal.pptx`, `GREENGUARD_PPT_OFFICIAL.pptx` và `DEMO PROCESS.mp4` tại workspace. Sự tồn tại của video/deck không phải chứng cứ nội dung đã được rà trong lần này; các file lớn đó không thuộc commit tài liệu này.

Nghiên cứu cũ trong `Document/marketfeasibility_analysis.md`, `Document/waste_recycling_stat.md` và bảng tính buyer research vẫn là tư liệu đầu vào. Những số như tỷ lệ tái chế, quy mô thị trường, năng lực nhà máy, giá nhôm, tỷ lệ thu hồi quốc tế và quy định EPR/PPWR trong các bản này chưa được tái xác minh online trong lần tổng hợp. Không trình bày chúng như số liệu hiện hành được tài liệu trung tâm chứng nhận.

## 19. Đội ngũ và các bên liên quan

Theo proposal và hồ sơ đội cũ, dự án gắn với đội **InnoLab**, HCMUT, BKI 2026.

- **Huỳnh Khánh Tường:** team leader; hồ sơ cũ mô tả thêm trách nhiệm phần mềm. Proposal xác nhận tên trưởng nhóm.
- **Thái Trọng Đăng:** AI/ML và phần giao diện hoặc hình ảnh theo các bản phân công cũ.
- **Vi Tuấn Khoa:** thiết kế, biên tập và multimedia theo hồ sơ cũ.
- **Huỳnh Hòa Minh:** phần cứng/cơ khí theo hồ sơ cũ.
- **Nguyễn Trọng Vinh:** embedded/cơ khí theo hồ sơ cũ.
- **Lương Thanh Nhật:** mentor được ghi trong proposal, thuộc Faculty of Mechanical Engineering.

Vai trò chi tiết của các thành viên khác nhau giữa các bản tài liệu; danh sách này giữ bối cảnh lịch sử, chưa thay thế một bảng phân công hiện tại được cả đội xác nhận. Proposal mục Human Resources còn trống. Thông tin liên hệ được giữ ở bản Word gốc; không cần nhân bản số điện thoại hoặc mã số sinh viên vào mọi tài liệu kỹ thuật.

Các bên cần xác định chủ thể và trách nhiệm khi pilot gồm đơn vị cho đặt máy, người phụ trách bảo trì, người thu gom, nơi xử lý PET chưa đạt, nơi tiếp nhận vật liệu, đối tác voucher và người quản trị dữ liệu. Không tự gán trách nhiệm vận hành thực tế chỉ từ chức danh trong đội dự thi.

## 20. Khoảng trống và lộ trình kiểm chứng

### 20.1. Những điểm ảnh hưởng quyết định hiện tại

1. **Model active có acceptance override.** Cần đánh giá theo camera/domain máy; candidate fail không được mặc định tốt hơn bản active.
2. **Thiếu dữ liệu cho một số điều kiện quan trọng.** Clean PET và foreign objects thiếu trong thử nghiệm fixed-camera; không mở rộng claim ngoài tập đã đo.
3. **Chưa chứng minh cầu nối phần cứng tới rewards.** Cần trace cùng một lượt nộp qua event, session, claim và giao dịch điểm.
4. **Demo/live dễ bị lẫn.** Kiểm tra biến build và nhãn nguồn dữ liệu trước khi trình diễn.
5. **Chống trùng có nhiều tầng.** Một-command-per-item, unique event, claim token và idempotent redeem giải quyết các rủi ro khác nhau.
6. **Chưa có off-take chính thức được xác nhận.** Quy cách đầu ra và logistics cần xác thực với bên mua trước khi scale.
7. **Số liệu kinh tế/tác động phần lớn là giả định hoặc nội dung proposal.** Cần raw measurement và provenance.

### 20.2. Trình tự phát triển được đề xuất

**Bước 1 — Khóa phiên bản demo có thể lặp lại.** Ghi model/config hash, phiên bản app/API, chế độ dữ liệu và thiết bị. Chạy ma trận can/PET clean/PET cap/label/ring/empty/ngoài phạm vi, cùng pause, mất camera, mất serial và lấy vật ra.

**Bước 2 — Chứng minh một lượt end-to-end.** Một vật phẩm → một kết quả → cơ khí đúng ngăn → một event → một session → một claim → một giao dịch điểm; đối soát dashboard live và trường hợp lỗi/retry. Không dùng seed làm vật phẩm thật.

**Bước 3 — Pilot có đo lường.** Ghi số lượt/ngày, rejected/failed sorts, false acceptance/rejection, latency toàn chu trình, giờ hoạt động, lỗi và recovery, tỷ lệ claim/return, cân nặng từng batch, tạp chất và thời gian thu gom. Theo dõi đồng thời session phần mềm và vật liệu thực.

**Bước 4 — Xác thực thương mại.** Lấy quy cách nhận hàng, báo giá, thử giao batch và phản hồi QC; xác định cơ chế đối tác tài trợ voucher, chi phí điểm và trách nhiệm thu gom. Pilot agreement/LOI khác với doanh thu đã thu.

**Bước 5 — Chuẩn hóa trước khi mở rộng.** Dựa vào số liệu để sửa cơ khí/model/quy trình; hoàn thiện vận hành, an toàn, bảo trì, truy xuất batch và data governance. Chỉ nhân rộng khi chất lượng đầu ra và economics đủ rõ.

Đây là lộ trình đề xuất, không phải lịch trình đã được đội phê duyệt hay các phase đã hoàn tất.

## 21. Hướng dẫn tiếp nhận dự án

Đọc tài liệu này trước, sau đó đọc đúng nguồn cho công việc cần làm:

- Runtime Windows: [README detection](Trash-detection/README.md), [README PC](Trash-detection/pc-demo/README.md), [kiến trúc](Trash-detection/docs/ARCHITECTURE.md), [model contract](Trash-detection/docs/MODEL_CONTRACT.md).
- Model: config/manifest/hash thực tế rồi report của đúng run; training không được runtime import.
- Jetson: README, config, manifest và device checklist của bundle Jetson.
- App/API: package và README hiện tại của từng repository, routes/validation/service liên quan.
- Dashboard: README hiện tại, `api.ts`, `dashboardQueries.ts`, controllers và schema mirrors.
- Kinh doanh/cuộc thi: proposal có phiên bản, phản hồi giám khảo thật, raw pilot data và hồ sơ đối tác.

Tại ngày tổng hợp, GreenGuard26 đã có các log bị xóa và nhiều dataset, candidate, report, experiment chưa track; backend có thay đổi `.gitignore`. Chúng không thuộc phạm vi commit tài liệu. Phải kiểm tra lại Git status trước mỗi công việc, không xem snapshot này là trạng thái sạch.

Mọi thay đổi model, ngưỡng, protocol hoặc deployment cần được gắn với yêu cầu cụ thể và verification tương ứng. Việc người đọc nhận một context file không tự cho phép training, kích hoạt model, vận hành máy, seed dữ liệu, xóa dataset hoặc publish code.

Đường dẫn `deliverables/windows-rvm-demo` từng được handoff dùng để chỉ bundle ngoài runtime; ở snapshot này thư mục đó không thấy trong workspace root. Không giả định có bộ demo portable hiện hành nếu chưa tìm và kiểm tra được.

Một yêu cầu tiếp nhận đủ rõ có thể viết:

```text
Đọc GREENGUARD_MASTER_CONTEXT.md để nắm dự án, rồi kiểm tra Git status,
cấu hình và nguồn liên quan tới nhiệm vụ hiện tại. Phân biệt dữ liệu demo,
chức năng trong code, kết quả thử nghiệm cũ và điều chưa được đo trên máy.
Trước khi sửa model hoặc tích hợp, xác định đúng artifact và failure cần xử lý.
```

## 22. Danh mục nguồn và việc hợp nhất tài liệu

### 22.1. Nguồn được đọc và đối chiếu

**Tại repository này:**

- [README](README.md), [detection README](Trash-detection/README.md), [PC README](Trash-detection/pc-demo/README.md).
- [Model contract](Trash-detection/docs/MODEL_CONTRACT.md), [architecture](Trash-detection/docs/ARCHITECTURE.md), [default config](Trash-detection/pc-demo/config/default.json), [active manifest](Trash-detection/pc-demo/models/manifest.json), [candidate manifest](Trash-detection/pc-demo/models/m1_candidate_manifest.json).
- [Decision core](Trash-detection/pc-demo/src/decision_core.py), [inference pipeline](Trash-detection/pc-demo/src/pipeline.py), [machine entrypoint](Trash-detection/pc-demo/src/machine_app.py), [transport](Trash-detection/pc-demo/src/serial_transport.py).
- [Jetson README](Trash-detection/jetson-runtime/README.md), [device validation](Trash-detection/jetson-runtime/DEVICE_VALIDATION.md).
- [Dashboard README](Dashboard/README.md), [frontend package](Dashboard/frontend/package.json), [backend package](Dashboard/backend/package.json), [API client](Dashboard/frontend/src/services/api.ts), [voucher admin client](Dashboard/frontend/src/services/voucherAdmin.ts), [impact factors](Dashboard/backend/src/config/impactFactors.ts), [impact calculation](Dashboard/backend/src/services/impact.ts), [controller](Dashboard/backend/src/controllers/dashboard.controller.ts).
- [Proposal BKI gốc đi kèm](competition/final/Proposal%20BKI.docx), nội dung văn bản và bảng trong DOCX. Không chỉnh nội dung hoặc bố cục Word trong lần này.

**GreenPoint-Backend tại revision đã đọc:**

- [app.ts](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/src/app.ts), [env.ts](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/src/config/env.ts), [constants.ts](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/src/config/constants.ts).
- [Detection service](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/src/modules/detections/detection.service.ts), [contribution service](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/src/modules/contributions/contribution.service.ts), các model và routes tương ứng.
- [Voucher guide](https://github.com/khanhtuongnakitomo/GreenPoint-Backend/blob/fbaea1ea6b4762c57dd1ad2ea2c77562fbcdebd3/VOUCHERS.md), module rewards/barcodes/vouchers/admin.

**FRONTEND_GREENPOINT tại revision đã đọc:**

- [README](https://github.com/TuanKhoa1708/FRONTEND_GREENPOINT/blob/edc3bd2f58422ca895c3684c4f2864c63f6f0fc0/README.md), [package](https://github.com/TuanKhoa1708/FRONTEND_GREENPOINT/blob/edc3bd2f58422ca895c3684c4f2864c63f6f0fc0/package.json), [scan parser](https://github.com/TuanKhoa1708/FRONTEND_GREENPOINT/blob/edc3bd2f58422ca895c3684c4f2864c63f6f0fc0/src/services/scanPayload.ts), [scan service](https://github.com/TuanKhoa1708/FRONTEND_GREENPOINT/blob/edc3bd2f58422ca895c3684c4f2864c63f6f0fc0/src/services/scan.service.ts), session/API services.

**Nguồn local bổ sung:** report fixed-view trong `training/experiments/fixed_view_compare_20261012`, report M1-B, tài liệu nghiên cứu trong `bki/Document` và các context cũ được đối chiếu trước khi hợp nhất. Các nguồn local chưa track không tự xuất hiện trên GitHub cùng tài liệu này.

### 22.2. Tài liệu tổng quan được thay thế

Những tệp dưới đây được loại khỏi vị trí tài liệu hoạt động sau khi chuyển bối cảnh còn dùng được vào tài liệu trung tâm. Đây là danh mục lịch sử, không phải liên kết cần mở:

```text
GreenGuard26/DOCUMENTATION.md
GreenGuard26/AGENT_HANDOFF.md
GreenGuard26/Document/app.md
GreenGuard26/Document/dashboard.md
GreenGuard26/Trash-detection/docs/archive/project_overview.md
GreenGuard26/Trash-detection/training/model1/context.md
GreenGuard26/Trash-detection/training/model1/REBUILD_CONTEXT_FOR_BRAINSTORM.md
bki/workspace-docs/AGENT_HANDOFF.md
bki/workspace-docs/context.md
bki/workspace-docs/PROJECT_CONTEXT.md
bki/workspace-docs/GREENPOINT_PLAN.md
bki/Document/GreenGuard_AI_Context_Feeder.md
bki/Document/HANDOFF_GREENGUARD.md
bki/Document/PLAN_HANDOFF_GREENGUARD_V2.md
bki/Document/trash_detection_codebase_report.md
```

Không xóa dataset, model, log thí nghiệm, báo cáo đánh giá, tài liệu nghiên cứu có nguồn, tài liệu cuộc thi gốc hoặc README chuyên biệt khi hợp nhất. `workspace-docs/Detection-rebuild-HANDOFF.md` được giữ như hồ sơ của workspace legacy đã tách khỏi runtime; nó không phải entrypoint tổng quan cho GreenGuard hiện tại.

### 22.3. Duy trì một nguồn bối cảnh

Khi dự án thay đổi, cập nhật mục liên quan và ngày đối chiếu trong chính tài liệu này, kèm nguồn thực tế của thay đổi. README và chỉ dẫn đọc khác trỏ về đây, thay vì tạo thêm một bản “full context” cạnh tranh. Hợp đồng chi tiết vẫn nằm cạnh component; nếu contract và artifact khác nhau thì sửa tài liệu liên quan sau khi xác định đúng phiên bản, không chỉnh model để khớp một đoạn mô tả cũ.

Tài liệu này ghi lại điều đã biết cùng giới hạn của bằng chứng, để lần làm việc tiếp theo có thể bắt đầu đúng trạng thái và kiểm chứng phần còn thiếu.
