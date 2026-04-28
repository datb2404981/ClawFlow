from langchain_core.tools import tool
import ast
import operator

# Bảng các toán tử được phép an toàn
allowed_operators = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

def safe_eval(expr):
    """
    Đánh giá an toàn một biểu thức toán học.
    Chỉ cho phép các toán tử cơ bản và các con số, ngăn chặn gọi hàm rủi ro.
    """
    try:
        node = ast.parse(expr, mode='eval').body
    except SyntaxError:
        raise ValueError(f"Biểu thức không hợp lệ: {expr}")

    def eval_node(n):
        if isinstance(n, ast.Constant): # python >= 3.8
            if isinstance(n.value, (int, float)):
                return n.value
            raise ValueError(f"Chỉ hỗ trợ số, không hỗ trợ: {type(n.value)}")
        elif isinstance(n, ast.Num): # python < 3.8
            return n.n
        elif isinstance(n, ast.BinOp):
            left = eval_node(n.left)
            right = eval_node(n.right)
            if type(n.op) in allowed_operators:
                return allowed_operators[type(n.op)](left, right)
            else:
                raise ValueError(f"Toán tử không hỗ trợ: {type(n.op).__name__}")
        elif isinstance(n, ast.UnaryOp):
            operand = eval_node(n.operand)
            if type(n.op) in allowed_operators:
                return allowed_operators[type(n.op)](operand)
            else:
                raise ValueError(f"Toán tử một ngôi không hỗ trợ: {type(n.op).__name__}")
        else:
            raise ValueError(f"Loại node không hỗ trợ: {type(n).__name__}")

    return eval_node(node)

@tool
def calculate(expression: str) -> str:
    """
    Sử dụng máy tính để đánh giá biểu thức toán học.
    Đầu vào là một chuỗi biểu thức toán học hợp lệ (ví dụ: "10 * (2 + 3) / 5", "1000 * 0.15").
    Chỉ hỗ trợ số và các toán tử: +, -, *, /, //, **, %. Không được dùng hàm hay biến số.
    Luôn ưu tiên dùng tool này để tính toán thay vì tự nhẩm tính.
    """
    try:
        # Làm sạch chuỗi
        clean_expr = expression.replace("=", "").strip()
        result = safe_eval(clean_expr)
        return f"Kết quả của {clean_expr} là: {result}"
    except Exception as e:
        return f"Lỗi khi tính toán: {str(e)}"

tool_by_name = {
    "calculate": calculate
}
