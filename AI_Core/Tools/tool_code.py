from langchain_core.tools import tool
import sys
import io
import contextlib
import traceback

@tool
def python_repl(code: str) -> str:
    """
    Công cụ chạy mã Python. 
    Nó thực thi mã Python và trả về kết quả in ra từ hàm print() hoặc giá trị biến cuối cùng.
    HƯỚNG DẪN:
    1. Đưa mã Python hoàn chỉnh, thụt lề chuẩn.
    2. Nếu muốn in ra kết quả, phải sử dụng hàm print().
    3. Tool này bị giới hạn về quyền hệ thống để đảm bảo an toàn. Không gọi hệ điều hành (os), không xóa file.
    4. Thích hợp để phân tích dữ liệu, xử lý thuật toán phức tạp, hoặc kiểm tra logic.
    """
    # Môi trường từ điển cô lập
    # Chặn một số module nguy hiểm nếu import bằng __import__
    restricted_globals = {
        "__builtins__": {
            k: v for k, v in __builtins__.items() 
            if k not in ['open', 'exec', 'eval', '__import__']
        },
        "print": print,
        "sum": sum, "min": min, "max": max, "abs": abs, "round": round,
        "len": len, "range": range, "enumerate": enumerate, "zip": zip,
        "list": list, "dict": dict, "set": set, "tuple": tuple, "str": str, "int": int, "float": float, "bool": bool
    }

    # Custom __import__ an toàn hơn
    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        allowed_modules = ['math', 'datetime', 'json', 're', 'collections', 'itertools']
        if name in allowed_modules:
            return __import__(name, globals, locals, fromlist, level)
        raise ImportError(f"Importing module '{name}' is restricted in this sandbox environment.")

    restricted_globals['__builtins__']['__import__'] = safe_import

    # Bắt đầu bắt output
    output = io.StringIO()
    try:
        with contextlib.redirect_stdout(output):
            with contextlib.redirect_stderr(output):
                exec(code, restricted_globals)
    except Exception as e:
        error_info = traceback.format_exc(limit=1)
        return f"Lỗi khi chạy code:\n{error_info}"
    
    result = output.getvalue()
    if not result:
        return "Mã thực thi thành công nhưng không có kết quả in ra (bạn chưa dùng hàm print)."
    return result

tool_by_name = {
    "python_repl": python_repl
}
