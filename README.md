# 2D Arena Shooter - Realtime Multiplayer with Bots

Dự án game bắn súng 2D multiplayer góc nhìn từ trên xuống (Top-down Arena Shooter) chạy trên nền tảng Web, tích hợp kết nối mạng thời gian thực và Bot AI thông minh hoàn toàn xử lý ở server-side. Game được xây dựng bằng HTML5 Canvas (Client) và Node.js WebSocket (Server).

---

## 🚀 Các Tính Năng Nổi Bật

1. **Kết Nối Realtime & Mạng LAN (Multiplayer)**:
   * Chạy mượt mà trên môi trường mạng cục bộ LAN.
   * Tự động cấu hình mở cổng **3000** trong Windows Firewall khi server khởi động (nếu chạy bằng quyền Administrator) và tự động thu hồi/đóng cổng khi tắt server để bảo mật.
2. **Chế Độ Chơi Đa Dạng**:
   * **Người vs Bot (Solo)**: Đối đầu với đội quân Bot phe đỏ (Red team).
   * **Người + Bot phe ta vs Bot địch (Co-op)**: Phối hợp cùng các Bot đồng đội màu xanh (Blue team) đi săn lùng Bot đối thủ phe đỏ.
   * **Người vs Người (FFA)**: Đấu đơn tự do giành thứ hạng cao nhất.
   * **Team Battle**: Chia đội chiến đấu cân bằng (Xanh vs Đỏ).
3. **Cấu Hình Bot Linh Hoạt**:
   * Chọn số lượng Bot đối thủ **N** tùy chỉnh (phe ta tự động sinh ra **N - 1** Bot đồng đội trong chế độ Co-op).
   * 3 cấp độ khó:
     * *Dễ*: Di chuyển chậm, ngắm lệch, bắn chậm.
     * *Vừa*: Bám đuổi mục tiêu, biết né tránh cơ bản.
     * *Khó*: Giữ khoảng cách theo súng, dự đoán hướng chạy của đối thủ để bắn chặn, lướt Dash cực kỳ linh hoạt để né đạn.
4. **Hệ Thống Tuỳ Biến Loadout**:
   * **Vũ khí**: Pistol, SMG, Rifle, Shotgun, Sniper với các chỉ số riêng về sát thương, tầm bắn, tốc độ đạn và thời gian nạp đạn.
   * **Perks bổ trợ**: Tăng tốc chạy, tăng máu tối đa, nạp đạn nhanh, tăng sát thương đạn, hoặc trang bị Giáp tự phục hồi.
   * **Ngoại hình**: 5 Skin màu sắc và 4 Phụ kiện trang trí (Mũ bảo hiểm, Balo, Kính visor, Giáp vai).
5. **Radar Mini-map HUD**:
   * Hiển thị thu nhỏ góc trên bên trái, ánh xạ chính xác vị trí chướng ngại vật và định vị thực thể: Pulsing Yellow (bản thân), Blue (đồng đội), Red (kẻ địch).
6. **Web Audio API**:
   * Tự động tổng hợp âm thanh synth trực tiếp (bắn súng, trúng đạn, chết chóc, đếm ngược) hoàn toàn bằng code, không cần tải file âm thanh ngoài.
7. **Kết Thúc & Vinh Danh MVP**:
   * Đếm ngược thời gian trận đấu (1, 2, 3, 5 phút).
   * Bảng tổng kết GameOver chia 2 cột phe Ta vs phe Địch chi tiết chỉ số Kills, Deaths, K/D.
   * Vinh danh MVP (người có thành tích K/D xuất sắc nhất) của mỗi đội.

---

## 🛠️ Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu Cầu Hệ Thống
* Đã cài đặt **Node.js** (Phiên bản v16 trở lên).

### Các Bước Thực Hiện

1. **Tải dependencies**:
   Mở terminal tại thư mục dự án và chạy lệnh sau để tải các thư viện cần thiết (`express`, `ws`):
   ```bash
   npm install
   ```

2. **Khởi chạy Server**:
   * **Đề xuất (Khuyên dùng)**: Mở CMD hoặc PowerShell bằng quyền quản trị viên (**Run as Administrator**) rồi chạy lệnh:
     ```bash
     node server.js
     ```
     *Lưu ý: Chạy dưới quyền Administrator giúp Server có quyền tự động cấu hình Windows Firewall mở cổng 3000 để các máy khác trong mạng LAN kết nối được.*

3. **Tham Gia Trận Đấu**:
   * **Trên máy chủ**: Mở trình duyệt và truy cập:
     ```
     http://localhost:3000
     ```
   * **Trên máy khách khác (cùng Wi-Fi/LAN)**: Tìm địa chỉ IP nội bộ của máy chủ (ví dụ: `192.168.1.15`) và truy cập bằng địa chỉ:
     ```
     http://192.168.1.15:3000
     ```

4. **Tắt Server**:
   * Nhấn `Ctrl + C` trên terminal máy chủ. Tường lửa Windows Firewall sẽ tự động xoá rule mở cổng 3000 để bảo mật an toàn cho máy bạn.

---

## 🎮 Hướng Dẫn Điều Khiển

* **WASD**: Di chuyển nhân vật.
* **Chuột**: Di chuyển chuột quanh nhân vật để ngắm xoay góc súng.
* **Chuột Trái (Left Click)**: Bắn đạn.
* **Phím R**: Nạp đạn thủ công (khi hết đạn súng tự động nạp).
* **Phím Space (Dấu cách)**: Lướt nhanh (Dash) về hướng di chuyển hiện tại để né đạn (cooldown 3 giây).
* **Nút Thoát Trận (🚪)**: Ở góc HUD bên trái, click để rời phòng ngay lập tức về Menu chính.
