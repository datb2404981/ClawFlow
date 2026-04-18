from langchain.tools import tool


# Tool format
@tool
async def Format_As_Table(data: str)-> str:
    """chuyển dữ liệu thành bảng Markdown"""
    # Tool trả về prompt cụ thể để LLM trả về dạng bảng
    return f"""Hãy định dạng dữ liệu sau thành bảng Markdown:
    | Cột 1 | Cột 2 | ... |
    |-------|-------|-----|
    Dữ liệu: {data}
    """

@tool
async def Format_As_List(data: str)-> str:
    """chuyển dữ liệu thành danh sách Markdown"""
    return f"""Hãy định dạng dữ liệu sau thành danh sách Markdown:
    - Mục 1
    - Mục 2
    - Mục 3
    Dữ liệu: {data}
    """

@tool
async def Format_As_Mermaid_Chart(data: str)-> str:
    """chuyển dữ liệu thành Mermaid Chart"""
    return f"""Hãy định dạng dữ liệu sau thành Mermaid Chart:
    Dữ liệu: {data}
    """

# Template Tool
@tool 
async def Get_Blog_Template(topic: str) -> str:
    """Lấy khung bài blog chuẩn SEO. Dùng khi cần viết blog"""
    return f"""Hãy viết blog về chủ đề: {topic}
Sử dụng đúng cấu trúc sau:

# [Tiêu đề hấp dẫn, có từ khoá SEO]

## Mở Bài (2-3 câu hook)
[Câu hỏi hoặc số liệu gây tò mò từ dữ liệu đã tìm được]

## Phần 1: Vấn đề
[Nội dung]

## Phần 2: Giải pháp
[Nội dung]

## Phần 3: Ví dụ thực tế
[Nội dung]

## Kết luận
[Tóm tắt + Call to Action]

*Tags: [tag1], [tag2], [tag3]*"""

@tool
async def Get_Report_Template(topic: str) -> str:
    """Lấy khung báo cáo chuyên nghiệp. Dùng khi cần viết báo cáo phân tích, tổng kết."""
    return f"""Hãy viết báo cáo chuyên nghiệp về chủ đề: {topic}
Sử dụng đúng cấu trúc sau:

# BÁO CÁO: [Tiêu đề báo cáo]

**Ngày:** [Ngày tháng năm]
**Người thực hiện:** ClawFlow AI

---

## 1. Tóm tắt điều hành (Executive Summary)
[2-3 câu tóm tắt toàn bộ nội dung và kết luận chính]

## 2. Bối cảnh & Mục tiêu
[Lý do viết báo cáo này, mục tiêu cần đạt được]

## 3. Phân tích chi tiết

### 3.1 [Khía cạnh 1]
[Nội dung + số liệu cụ thể]

### 3.2 [Khía cạnh 2]
[Nội dung + số liệu cụ thể]

### 3.3 [Khía cạnh 3]
[Nội dung + số liệu cụ thể]

## 4. Kết quả & Nhận xét

| Tiêu chí | Kết quả | Đánh giá |
|----------|---------|----------|
| [Mục 1]  | [Số liệu] | ✅/⚠️/❌ |
| [Mục 2]  | [Số liệu] | ✅/⚠️/❌ |

## 5. Kết luận & Khuyến nghị
[Kết luận tổng quan + 3 khuyến nghị hành động cụ thể]

---
*Báo cáo được tổng hợp bởi ClawFlow AI*"""

@tool
async def Get_Script_Template(topic: str, platform: str = "YouTube") -> str:
    """Lấy khung kịch bản video. Dùng khi cần viết script TikTok, YouTube, Reels."""
    return f"""Hãy viết kịch bản video {platform} về chủ đề: {topic}
Sử dụng đúng cấu trúc sau:

# KỊCH BẢN: [Tiêu đề video]
**Platform:** {platform} | **Thời lượng ước tính:** [X phút]

---

## 🎬 HOOK (0-5 giây với TikTok / 0-15 giây với YouTube)
[1 câu gây sốc, đặt câu hỏi, hoặc số liệu bất ngờ — phải BẮT MẮT ngay từ đầu]

## 📌 GIỚI THIỆU (15-30 giây)
[Tôi là ai + Video này sẽ giúp bạn làm được gì cụ thể]

## 🎯 NỘI DUNG CHÍNH

### Phần 1: [Điểm chính 1]
**Lời thoại:** [Nội dung nói]
**Hình ảnh/B-roll gợi ý:** [Mô tả cảnh quay]

### Phần 2: [Điểm chính 2]
**Lời thoại:** [Nội dung nói]
**Hình ảnh/B-roll gợi ý:** [Mô tả cảnh quay]

### Phần 3: [Điểm chính 3]
**Lời thoại:** [Nội dung nói]
**Hình ảnh/B-roll gợi ý:** [Mô tả cảnh quay]

## ✅ KẾT THÚC + CTA (30 giây)
[Tóm tắt 1 câu + Kêu gọi Like/Subscribe/Follow/Comment]

---
**Caption mạng xã hội:** [Viết caption ngắn kèm 5 hashtag phù hợp]"""

@tool
async def Get_Email_Template(topic: str, email_type: str = "marketing") -> str:
    """Lấy khung email chuyên nghiệp. Dùng cho email marketing, outreach, chăm sóc khách hàng."""
    return f"""Hãy viết email {email_type} về chủ đề: {topic}
Sử dụng đúng cấu trúc sau:

**Subject:** [Tiêu đề email ngắn gọn, gây tò mò, dưới 50 ký tự]
**Preview text:** [1 câu tóm tắt hiển thị trong inbox, dưới 90 ký tự]

---

Xin chào [Tên người nhận],

## Mở đầu (1-2 câu — tạo kết nối cá nhân)
[Đề cập vấn đề/nỗi đau cụ thể mà người nhận đang gặp]

## Thân email — Giá trị cốt lõi
[Trình bày giải pháp/thông tin/offer ngắn gọn trong 2-3 đoạn]
[Dùng bullet point nếu có nhiều điểm]

## Call To Action (CTA rõ ràng, 1 hành động duy nhất)
👉 **[Nút CTA: Tìm hiểu thêm / Đăng ký ngay / Liên hệ ngay]**

---
Trân trọng,
[Tên người gửi]
[Chức vụ] | [Công ty]
[Email] | [SĐT]

*Nếu bạn không muốn nhận email từ chúng tôi, [hủy đăng ký tại đây].*"""

# Utility Tool
@tool
async def Translate_Content(content: str, target_language: str) -> str:
    """Dịch nội dung sang ngôn ngữ khác. target_language: 'English', 'Japanese', 'Korean', 'Chinese'..."""
    return f"""Hãy dịch toàn bộ nội dung sau sang {target_language}.
Yêu cầu:
- Dịch tự nhiên, không dịch máy cứng nhắc
- Giữ nguyên toàn bộ định dạng Markdown (##, **, |bảng|, v.v.)
- Giữ nguyên các thuật ngữ chuyên ngành nếu không có từ tương đương

Nội dung cần dịch:
{content}"""

@tool
async def Summarize_Content(content: str, max_words: int = 200) -> str:
    """Tóm tắt nội dung dài thành bản ngắn gọn. Dùng khi nhận dữ liệu quá dài từ Leader."""
    return f"""Hãy tóm tắt nội dung sau trong khoảng {max_words} từ.
Yêu cầu:
- Giữ lại các ý chính và số liệu quan trọng nhất
- Viết súc tích, rõ ràng, dễ hiểu
- Dùng bullet point nếu có nhiều ý

Nội dung cần tóm tắt:
{content}"""

@tool
async def SEO_Optimize(content: str, keyword: str) -> str:
    """Tối ưu nội dung bài viết theo từ khóa SEO. Dùng sau khi đã có bản nháp bài blog."""
    return f"""Hãy tối ưu SEO cho bài viết sau với từ khóa chính: "{keyword}"

Thực hiện các bước sau:
1. **Tiêu đề (H1):** Đảm bảo chứa từ khóa "{keyword}", hấp dẫn, dưới 60 ký tự
2. **Meta description:** Viết 1 đoạn tóm tắt 150-160 ký tự chứa từ khóa
3. **Nội dung:** Điều chỉnh để từ khóa "{keyword}" xuất hiện tự nhiên 3-5 lần
4. **Heading phụ (H2/H3):** Thêm từ khóa LSI liên quan vào tiêu đề phụ
5. **CTA:** Thêm lời kêu gọi hành động ở cuối bài

Bài viết cần tối ưu:
{content}

---
Sau khi tối ưu, liệt kê:
- **Từ khóa chính:** {keyword}
- **Từ khóa LSI gợi ý:** [5 từ khóa liên quan]
- **Mật độ từ khóa mục tiêu:** 1-2%"""

tool_contents = [
  Format_As_Table,
  Format_As_List,
  Format_As_Mermaid_Chart,
  Get_Blog_Template,
  Get_Report_Template,
  Get_Script_Template,
  Get_Email_Template,
  Translate_Content,
  Summarize_Content,
  SEO_Optimize
]
tool_by_name = {t.name: t for t in tool_contents}