from langchain_core.tools import tool

@tool
def delegate_to_integration(task_description: str) -> str:
    """Công cụ ủy quyền công việc cho Integration Agent.
    Sử dụng công cụ này khi người dùng yêu cầu tương tác với ứng dụng bên thứ 3 (như Gmail, Google Drive, Google Calendar, Notion).
    Hệ thống sẽ tự động chuyển giao yêu cầu sang cho Integration Agent thực thi.
    
    Args:
        task_description: Yêu cầu chi tiết để Integration Agent thực hiện. Ví dụ: 'Đọc 5 email mới nhất' hoặc 'Tìm email từ sếp'.
    """
    # Giá trị này sẽ được trả về như một ToolMessage.
    # Router sẽ dựa vào thông báo này để tiếp tục luồng, hoặc router có thể dựa vào việc
    # Tool delegate_to_integration được gọi để chuyển hướng.
    return f"Đã ủy quyền yêu cầu cho Integration Agent: {task_description}"
