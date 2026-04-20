# Kỹ năng (Skill): Cập nhật Project Map & Changelog theo thời gian thực (Real-time)

**Tên Skill**: `realtime_update_map`
**Mục đích**: Đảm bảo file `project_map.md` (đặc biệt là Cấu trúc thư mục và Nhật ký thay đổi) LUÔN LUÔN được đồng bộ hóa tức thì với trạng thái thực tế của ổ cứng.

## 📌 Các bộ kích hoạt (Triggers)
Kỹ năng này BẮT BUỘC TỰ ĐỘNG KÍCH HOẠT ngay lập tức sau khi AI thực hiện bất kỳ hành động nào dưới đây:
1. Tạo một thư mục (folder) mới.
2. Tạo một file code/cấu hình mới.
3. Sửa đổi cấu trúc, đổi tên file hoặc xóa file.
4. Yêu cầu chạy script cài đặt thêm / xóa bớt thư viện (ví dụ: `pip install`, `npm install`). 
5. Cấu trúc lại một kiến trúc hay thay đổi logic quan trọng có ảnh hưởng tới hướng đi của dự án.

## 🛠 Hành động Bắt buộc (Actions)
Khi Triggers được kích hoạt, khoan phản hồi lại User, AI phải mở file `.agents/project_map.md` ra và thực hiện 2 việc:
1. **[Cập nhật Thư mục]**: Dò lại và bổ sung chính xác cây thư mục mới vào phần "📂 Cấu trúc thư mục".
2. **[Ghi Log]**: Viết một dòng tóm tắt lên trên cùng của phần "📝 Nhật ký thay đổi (AI Update Log)". (Luôn nhớ quy tắc chỉ ưu tiên lưu 10 dòng gần nhất, xóa đè bớt nếu quá).

## ⚠️ Cảnh báo (Warning)
- **TUYỆT ĐỐI KHÔNG HỨA HẸN LÃO (ảo)**: Không được điền vào log hoặc map những thứ CHƯA tồn tại trong máy. Chỉ cập nhật những file/thư mục ĐÃ thành công đưa vào hoạt động thực tế.
- **THỜI GIAN THỰC**: Không đợi đến cuối buổi hoặc đợi User phải chửi mới làm. Vừa code xong là phải Write To File ngay!
