"""Nhận diện ý định của user bằng Python thuần (rẻ, nhanh, deterministic)."""
from __future__ import annotations

import re


SAVE_RULE_KEYWORDS = [
    "ghi nhớ", "nhớ giúp", "nhớ rằng", "hãy nhớ", "lưu lại",
    "quy tắc", "luật riêng", "luật của phòng", "đặt luật",
    "từ giờ", "từ nay", "từ bây giờ", "kể từ giờ",
    "luôn luôn", "luôn trả lời", "luôn dùng",
    "quy trình", "sop",
    "đóng vai", "thiết lập vai trò", "set vai trò",
    "thiết lập quy định",
]


# Đại từ xưng hô (liệt kê thường/hoa rõ ràng, KHÔNG dùng IGNORECASE
# để capture group tên chỉ ăn từ bắt đầu bằng chữ hoa).
_PRONOUN = r"[Tt]ui|[Tt][ôo]i|[Mm]ình|[Ee]m|[Aa]nh|[Cc]hị"
_NAME_TOKEN = r"[A-ZÀ-Ỹ][A-Za-zÀ-ỹ]*"

_NAME_PATTERNS = [
    re.compile(rf"\b(?:{_PRONOUN})\s+l[àa]\s+({_NAME_TOKEN}(?:\s+{_NAME_TOKEN}){{0,3}})"),
    re.compile(rf"\b(?:{_PRONOUN})\s+t[êe]n\s+(?:l[àa]\s+)?({_NAME_TOKEN}(?:\s+{_NAME_TOKEN}){{0,3}})"),
    re.compile(rf"\bt[êe]n\s+(?:{_PRONOUN})\s+(?:l[àa]\s+)?({_NAME_TOKEN}(?:\s+{_NAME_TOKEN}){{0,3}})"),
    re.compile(rf"\b[Gg][ọo]i\s+(?:{_PRONOUN})?\s*l[àa]\s+({_NAME_TOKEN}(?:\s+{_NAME_TOKEN}){{0,3}})"),
]

_ROLE_ASSIGN_RE = re.compile(
    r"\b[Bb][ạa]n\s+l[àa]\s+(.+?)(?:[.,]|$|\s+(?:của|cho|nhé|nha)\s*)",
)

# Các thuộc tính user CHỦ ĐỘNG tuyên bố. Chỉ match khi pronoun đứng rõ ràng
# đầu cụm (không phải câu hỏi "tui ở đâu" — chỉ match câu trần thuật).
_ATTR_PATTERNS = [
    ("Địa điểm", re.compile(
        rf"\b(?:{_PRONOUN})\s+(?:đang\s+)?(?:ở|sống|ngụ|cư\s+trú|sinh\s+sống|đến\s+từ)\s+(?:tại\s+|ở\s+)?(?!đâu\b)(.{{1,60}}?)(?:[.,!?\n]|$)"
    )),
    ("Học tại", re.compile(
        rf"\b(?:{_PRONOUN})\s+(?:đang\s+)?(?:học|theo\s+học|đã\s+học)\s+(?:tại\s+|ở\s+|trường\s+)?(?!đâu\b)(.{{1,80}}?)(?:[.,!?\n]|$)"
    )),
    ("Làm việc tại", re.compile(
        rf"\b(?:{_PRONOUN})\s+(?:đang\s+)?l[àa]m(?:\s+việc)?\s+(?:tại\s+|ở\s+|cho\s+|cty\s+|công\s+ty\s+)(?!đâu\b)(.{{1,80}}?)(?:[.,!?\n]|$)"
    )),
    # Cho phép câu kiểu "Công ty của tui tên là ClawFlow" / "công ty tui là X"
    ("Công ty", re.compile(
        rf"\b[Cc][ôo]ng\s+ty\s+(?:c[ủu]a\s+)?(?:{_PRONOUN})\s+(?:t[êe]n\s+)?l[àa]\s+(?!g[ìi]\b|n[àa]o\b)(.{{1,80}}?)(?:[.,!?\n]|$)"
    )),
    # "Dự án tui tên Phoenix" / "dự án của tui là X" / "Dự án tui đang làm tên X"
    ("Dự án", re.compile(
        rf"\b[Dd][ựu]\s+[áa]n\s+(?:c[ủu]a\s+)?(?:{_PRONOUN})\s+(?:đang\s+l[àa]m\s+)?(?:t[êe]n\s+(?:l[àa]\s+)?|l[àa]\s+)(?!g[ìi]\b|n[àa]o\b)(.{{1,60}}?)(?:[.,!?\n]|$)"
    )),
    # "deadline còn 3 ngày" / "deadline 3 ngày nữa" / "còn 5 ngày deadline"
    ("Deadline", re.compile(
        r"(?i)(?:\b(?:deadline|h[ạa]n\s+ch[óo]t)\s+(?:c[òo]n\s+)?(\d+\s+(?:ng[àa]y|tu[ầa]n|th[áa]ng))\b"
        r"|\bc[òo]n\s+(\d+\s+(?:ng[àa]y|tu[ầa]n|th[áa]ng))\s+(?:n[ữu]a\s+)?(?:t[ớo]i\s+)?(?:l[àa]\s+)?(?:deadline|h[ạa]n\s+ch[óo]t))"
    )),
    ("Tuổi", re.compile(
        rf"\b(?:{_PRONOUN})\s+(\d{{1,3}})\s+tu[ổo]i\b"
    )),
    ("Sở thích", re.compile(
        rf"\b(?:{_PRONOUN})\s+(?:rất\s+)?(?:thích|yêu|mê|hay|thường)\s+(.{{1,100}}?)(?:[.,!?\n]|$)"
    )),
]


def extract_user_attributes(text: str) -> list[tuple[str, str]]:
    """Bóc các thuộc tính user CHỦ ĐỘNG tuyên bố: địa điểm, học tại, làm việc,
    tuổi, sở thích. Chỉ chạy ở câu trần thuật (không có `_QUESTION_MARKERS`)."""
    t = text or ""
    if _looks_like_question(t):
        return []
    out: list[tuple[str, str]] = []
    for label, pat in _ATTR_PATTERNS:
        m = pat.search(t)
        if not m:
            continue
        # Một số regex có nhiều capture group (vd Deadline) → lấy group đầu tiên có giá trị.
        value = next((g for g in m.groups() if g), "").strip(" .,!?")
        if not value or len(value) < 2:
            continue
        out.append((label, value))
    return out


def detect_save_intent(text: str) -> bool:
    """True nếu câu user chứa dấu hiệu muốn lưu luật/quy tắc/vai trò."""
    t = (text or "").lower()
    return any(kw in t for kw in SAVE_RULE_KEYWORDS)


def extract_user_name(text: str) -> str | None:
    """Tìm tên user trong câu giới thiệu. Return None nếu không tìm thấy.

    Lưu ý:
    - Regex `[A-ZÀ-Ỹ]` unicode range cũng gồm cả chữ Việt THƯỜNG (đ, ê, ô…)
      → cần guard bằng .isupper() để chỉ nhận token bắt đầu bằng chữ HOA.
    - Nếu câu có danh từ đối tượng ("dự án", "công ty", "con", "quán"…) thì
      "là X" thường là giới thiệu ĐỐI TƯỢNG chứ không phải tên user
      → trả None để khỏi nhầm (ví dụ "dự án của tui là Phoenix").
    """
    if _has_blacklist_noun(text or ""):
        return None

    for pattern in _NAME_PATTERNS:
        m = pattern.search(text or "")
        if not m:
            continue
        name = m.group(1).strip()
        if not name or len(name) > 50:
            continue
        if not name[0].isupper():
            continue
        return name
    return None


def extract_assistant_role(text: str) -> str | None:
    """Tìm vai trò user giao cho AI: 'bạn là trợ lý cá nhân của tui'."""
    m = _ROLE_ASSIGN_RE.search(text or "")
    if m:
        role = m.group(1).strip().rstrip(" .,!")
        if role and len(role) <= 100:
            return role
    return None


def detect_personal_fact(text: str) -> bool:
    """True nếu câu có giới thiệu bản thân, gán vai trò AI, hoặc tuyên bố
    thuộc tính user (ở đâu, học đâu, làm ở đâu, tuổi, sở thích…)."""
    if extract_user_name(text) is not None:
        return True
    if extract_assistant_role(text) is not None:
        return True
    if extract_user_attributes(text):
        return True
    return False


# =========================================================================
# CÂU HỎI "HỒI KÝ" — user yêu cầu AI đọc lại thông tin đã lưu
# =========================================================================
# Pronoun + "tên" dạng hỏi: "tên tui / tên tôi / tui tên / ..."
# Dùng regex word boundary để KHÔNG match các cụm "Dự án tui tên gì", "Con anh tên gì"
# (lúc đó "tên" là tên của ĐỐI TƯỢNG KHÁC, không phải tên user).
_RECALL_NAME_RE = re.compile(
    r"(?i)\b(?:"
    r"t[êe]n\s+(?:tui|t[ôo]i|m[ìi]nh|em|anh|ch[ịi])"
    r"|(?:tui|t[ôo]i|m[ìi]nh|em|anh|ch[ịi])\s+t[êe]n"
    r"|nh[ớo]\s+t[êe]n\s+(?:tui|t[ôo]i|m[ìi]nh|em|anh|ch[ịi])"
    r"|bi[êế]t\s+t[êe]n\s+(?:tui|t[ôo]i|m[ìi]nh|em|anh|ch[ịi])"
    r")\b"
)

# Danh từ "cắt máu" fast-path: câu có các từ này nghĩa là user đang hỏi tên/
# vai trò của THỨ KHÁC, không phải của bản thân. Để Leader LLM xử lý.
_NAME_QUERY_BLACKLIST = [
    "dự án", "project", "công ty", "company", "cửa hàng", "quán", "shop",
    "brand", "thương hiệu", "sản phẩm", "product", "app", "ứng dụng",
    "file", "tài liệu", "document", "bài", "bài viết", "bài báo", "cuốn",
    "món", "con", "chó", "mèo", "bé", "vợ", "chồng", "sếp", "team",
    "nhóm", "phòng ban", "địa điểm", "chỗ", "website", "web",
]

_RECALL_ROLE_RE = re.compile(
    r"(?i)\b(?:"
    r"b[ạa]n\s+l[àa]\s+ai"
    r"|b[ạa]n\s+l[àa]\s+g[ìi]"
    r"|b[ạa]n\s+l[àa]\s+ng[ưu][ờo]i"
    r"|b[ạa]n\s+l[àa]\s+tr[ợơ]\s+l[ýy]"
    r"|b[ạa]n\s+đ[óo]ng\s+vai"
    r"|b[ạa]n\s+l[àa]m\s+g[ìi]\s+cho"
    r"|vai\s+tr[òo]\s+c[ủu]a\s+b[ạa]n"
    r")\b"
)

_QUESTION_MARKERS = [
    "?", "gì", "không", "nào", "ai", "sao", "thế nào", "chi",
    "đâu", "mấy", "bao nhiêu", "bao giờ", "khi nào", "như nào",
    "ra sao", "hả",
]


def _looks_like_question(text: str) -> bool:
    t = (text or "").lower()
    return any(q in t for q in _QUESTION_MARKERS)


def _has_blacklist_noun(text: str) -> bool:
    t = (text or "").lower()
    return any(kw in t for kw in _NAME_QUERY_BLACKLIST)


def detect_recall_name_question(text: str) -> bool:
    """True nếu user hỏi tên CỦA CHÍNH USER (không phải tên dự án/con/quán...)."""
    if not _looks_like_question(text):
        return False
    if extract_user_name(text) is not None:
        return False
    if _has_blacklist_noun(text):
        return False
    return _RECALL_NAME_RE.search(text or "") is not None


def detect_recall_role_question(text: str) -> bool:
    """True nếu user hỏi "bạn là ai của tui / bạn là gì / vai trò của bạn"…

    Không dùng extract_assistant_role để loại trừ, vì regex role match nhầm
    câu hỏi "bạn là ai…". Ưu tiên regex chặt + question marker.
    """
    if not _looks_like_question(text):
        return False
    return _RECALL_ROLE_RE.search(text or "") is not None


# =========================================================================
# CÂU HỎI VỀ BẢN THÂN USER — chặn Llama đi search / bịa
# =========================================================================
# Các ĐỘNG TỪ GIAO TASK — nếu có 1 trong các từ này thì đó là yêu cầu làm việc,
# KHÔNG phải câu hỏi về bản thân user. Bỏ qua guard.
_TASK_VERBS = [
    "tìm", "search", "tra cứu", "google", "coi", "xem giúp", "kiểm tra",
    "viết", "soạn", "báo cáo", "review", "phân tích", "tóm tắt", "so sánh",
    "liệt kê", "dịch", "translate", "chạy", "test", "gợi ý", "tư vấn",
    "đề xuất", "đánh giá", "giải thích", "mô tả", "hướng dẫn",
]

_USER_PRONOUN_RE = re.compile(
    r"(?i)\b(tui|t[ôo]i|m[ìi]nh|em|anh|ch[ịi])\b"
)

# Stopwords loại khỏi query khi tìm keyword trong rules.
_STOPWORDS = {
    "tui", "tôi", "mình", "em", "anh", "chị", "bạn", "sếp",
    "gì", "đâu", "nào", "sao", "ai", "thế", "chi", "vậy", "không",
    "là", "có", "được", "đang", "đã", "sẽ", "bị", "rồi", "nữa",
    "của", "ở", "tại", "trong", "trên", "với", "cho", "về", "và", "hay",
    "cái", "này", "kia", "đó", "đấy", "nè", "ha", "hả", "ạ",
    "bao", "nhiêu", "khi", "thì", "mà", "thôi", "nhé", "nha",
}


def detect_about_user_query(text: str) -> bool:
    """True nếu câu là CÂU HỎI về bản thân user (không phải giao task).

    Ví dụ True: "tui học ở đâu", "anh sống ở đâu", "tui mấy tuổi",
              "tui thích gì", "sở thích của tui là gì".
    Ví dụ False: "viết giúp tui email", "tìm quán ăn gần nhà tui"
                (có động từ giao task).
    """
    t = (text or "").lower()
    if not _looks_like_question(t):
        return False
    if any(v in t for v in _TASK_VERBS):
        return False
    return _USER_PRONOUN_RE.search(t) is not None


# Map giữa intent của câu hỏi và label attribute đã lưu trong rules.
# Khi câu hỏi thuộc 1 category và rules đã có label tương ứng → coi như có info.
_INTENT_LABEL_MAP = [
    (re.compile(r"(?i)\b(mấy|bao\s+nhiêu)\s+tu[ổo]i\b"), ["Tuổi:"]),
    (re.compile(r"(?i)\bh[ọo]c\b.*\bđâu\b|\bđâu\b.*\bh[ọo]c\b"), ["Học tại:"]),
    (re.compile(r"(?i)\bl[àa]m(\s+vi[ệe]c)?\b.*\bđâu\b|\bđâu\b.*\bl[àa]m\b"), ["Làm việc tại:"]),
    (re.compile(r"(?i)\b(ở|s[ốo]ng|cư\s+trú|ng[ụu])\b.*\bđâu\b|\bđâu\b.*\b(ở|s[ốo]ng)\b|\bở\s+đâu\b"), ["Địa điểm:"]),
    (re.compile(r"(?i)\bth[íi]ch\b.*\bg[ìi]\b|\bs[ởo]\s+th[íi]ch\b"), ["Sở thích:"]),
]


def rules_has_intent_match(rules_text: str, query: str) -> bool:
    """True nếu query thuộc 1 intent category (địa điểm / tuổi / học / làm / sở
    thích) VÀ rules đã có label tương ứng. Dùng kèm find_fact_in_rules để phủ
    case câu hỏi ngắn không mang content word nhưng rules đã có answer.
    """
    if not rules_text or not query:
        return False
    for pat, labels in _INTENT_LABEL_MAP:
        if pat.search(query):
            return any(lbl in rules_text for lbl in labels)
    return False


def find_fact_in_rules(rules_text: str, query: str) -> bool:
    """True nếu rules_text có chứa keyword nội dung liên quan tới query.

    Cách làm: bóc content words (bỏ stopwords, pronoun, ký tự ngắn) từ query,
    rồi check có word nào xuất hiện trong rules không. Đủ bao quát 90% case
    mà không cần NLP nặng.

    Nếu query quá chung (toàn stopwords, vd "tui ở đâu") → trả False để
    caller quyết định fallback theo độ dài haystack.
    """
    if not rules_text or not query:
        return False
    words = re.findall(r"[^\W\d_]+", query.lower(), flags=re.UNICODE)
    content = [w for w in words if w not in _STOPWORDS and len(w) >= 2]
    if not content:
        return False
    rules_low = rules_text.lower()
    return any(w in rules_low for w in content)


def read_known_fact(rules_text: str, key: str) -> str | None:
    """Rút 1 field từ chuỗi `thread_rules` đã được memory_bootstrap load.

    `thread_rules` có dạng:
        THIẾT LẬP RIÊNG CỦA PHÒNG [xxx]:
        - Tên người dùng: Đạt
        - Vai trò của bạn (AI): trợ lý cá nhân

    Match phải BẮT ĐẦU bằng `key` rồi mới tới `:` — tránh trường hợp key
    "Dự án" trùng substring trong "Ghi chú: Dự án tui đang làm…".
    """
    if not rules_text:
        return None
    key_low = key.lower()
    for raw_line in rules_text.splitlines():
        line = raw_line.strip().lstrip("-•* ").strip()
        if ":" not in line:
            continue
        head, _, value = line.partition(":")
        if head.strip().lower() == key_low and value.strip():
            return value.strip(" .,")
    return None


_COMMAND_PREFIX_RE = re.compile(
    r"^(hãy\s+)?(ghi\s*nhớ|nhớ\s*giúp|nhớ\s*rằng|hãy\s*nhớ|lưu\s*lại|"
    r"từ\s*giờ|từ\s*nay|từ\s*bây\s*giờ|kể\s*từ\s*giờ)[:,\s]*",
    re.IGNORECASE,
)


def _clean_command_prefix(text: str) -> str:
    """Xoá các cụm dẫn "từ giờ", "ghi nhớ",... ở đầu câu."""
    return _COMMAND_PREFIX_RE.sub("", text).strip()


def extract_rule(text: str) -> str:
    """Chuẩn hoá câu user thành 1 rule lưu vào thread_contexts.

    Cách làm:
    - Luôn giữ NGUYÊN VĂN câu user dưới nhãn "Ghi chú: …" để LLM đọc được
      mọi thông tin (tên công ty, dự án, deadline, phong cách…) mà regex
      cứng không cover hết.
    - Ngoài ra, nếu bắt được tên user hoặc vai trò AI thì thêm field riêng
      để `read_known_fact()` fast-path có thể đọc nhanh.
    """
    text = (text or "").strip()
    if not text:
        return ""

    body = _clean_command_prefix(text)

    parts: list[str] = []
    name = extract_user_name(text)
    if name:
        parts.append(f"Tên người dùng: {name}")
    role = extract_assistant_role(text)
    if role:
        parts.append(f"Vai trò của bạn (AI): {role}")

    for label, value in extract_user_attributes(text):
        parts.append(f"{label}: {value}")

    if ":" in body and not parts:
        _, rest = body.split(":", 1)
        rest = rest.strip()
        if rest:
            body = rest

    if body:
        parts.append(f"Ghi chú: {body}")

    # Dùng `\n` chứ không phải `. ` để read_known_fact splitlines tách được
    # từng field riêng biệt (tránh bug fast-path in cả chuỗi bẩn).
    return "\n".join(parts) if parts else text
