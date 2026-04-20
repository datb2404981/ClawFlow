"""Chẩn đoán nhanh lỗi kết nối MongoDB Atlas.

Chạy:
    cd AI_Core
    python -m tests.diagnose_mongo
"""
import os
import socket
import ssl
import sys
from pathlib import Path
from urllib.parse import urlparse

AI_CORE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_CORE))

from dotenv import load_dotenv

load_dotenv(AI_CORE / ".env")

URI = os.getenv("MONGO_URI", "")
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"


def p_ok(msg: str): print(f"  {GREEN}✅ {msg}{RESET}")
def p_err(msg: str): print(f"  {RED}❌ {msg}{RESET}")
def p_info(msg: str): print(f"  {CYAN}ℹ  {msg}{RESET}")
def p_warn(msg: str): print(f"  {YELLOW}⚠  {msg}{RESET}")
def section(msg: str): print(f"\n{CYAN}═══ {msg} ═══{RESET}")


def main():
    print(f"{CYAN}🔍 CHẨN ĐOÁN KẾT NỐI MONGODB{RESET}")
    print(f"Python: {sys.version.split()[0]}")
    print(f"OpenSSL: {ssl.OPENSSL_VERSION}")

    # --- 1. Check URI ---
    section("BƯỚC 1: Kiểm tra URI")
    if not URI:
        p_err("MONGO_URI rỗng trong .env")
        return
    p_ok(f"URI có độ dài {len(URI)} ký tự")

    parsed = urlparse(URI)
    if "mongodb+srv" in URI:
        p_info(f"Dùng SRV record: {parsed.hostname}")
    else:
        p_info(f"Host trực tiếp: {parsed.hostname}:{parsed.port or 27017}")

    host = parsed.hostname
    if not host:
        p_err("Không parse được hostname")
        return

    # --- 2. DNS Resolve ---
    section("BƯỚC 2: Resolve DNS")
    try:
        srv_name = f"_mongodb._tcp.{host}"
        import dns.resolver  # noqa
        try:
            answers = dns.resolver.resolve(srv_name, "SRV")
            shards = [str(a.target).rstrip(".") for a in answers]
            p_ok(f"Resolve SRV được {len(shards)} shard: {shards}")
            test_hosts = shards
        except Exception as e:
            p_warn(f"Không resolve SRV ({e}), fallback sang hostname gốc")
            test_hosts = [host]
    except ImportError:
        p_warn("Chưa cài dnspython → dùng hostname gốc")
        test_hosts = [host]

    # --- 3. TCP Connect ---
    section("BƯỚC 3: TCP Connect (port 27017)")
    any_tcp_ok = False
    for h in test_hosts:
        try:
            sock = socket.create_connection((h, 27017), timeout=10)
            sock.close()
            p_ok(f"TCP OK: {h}:27017")
            any_tcp_ok = True
        except socket.timeout:
            p_err(f"TIMEOUT: {h}:27017 (có thể bị firewall chặn)")
        except Exception as e:
            p_err(f"FAIL: {h}:27017 — {e}")

    if not any_tcp_ok:
        print(f"\n{RED}→ Mạng đang chặn port 27017 hoặc IP không được whitelist.{RESET}")
        p_info("Thử: 1) Đổi mạng 4G 2) Kiểm tra Atlas Network Access 3) Kiểm tra VPN")
        return

    # --- 4. TLS Handshake ---
    section("BƯỚC 4: TLS Handshake")
    ctx = ssl.create_default_context()
    for h in test_hosts[:1]:
        try:
            with socket.create_connection((h, 27017), timeout=10) as sock:
                with ctx.wrap_socket(sock, server_hostname=h) as ssock:
                    p_ok(f"TLS OK: {h} | Protocol: {ssock.version()} | Cipher: {ssock.cipher()[0]}")
        except ssl.SSLError as e:
            p_err(f"TLS lỗi: {e}")
            if "TLSV1_ALERT_INTERNAL_ERROR" in str(e):
                print(f"{RED}→ Đây chính là lỗi anh đang gặp!{RESET}")
                p_info("Nguyên nhân thường gặp:")
                p_info("  (a) IP hiện tại KHÔNG có trong Atlas Network Access whitelist")
                p_info("  (b) Atlas cluster đang paused")
                p_info("  (c) Python 3.14 có incompat với TLS default của Atlas")
        except Exception as e:
            p_err(f"TLS lỗi khác: {e}")

    # --- 5. Thử kết nối bằng pymongo ---
    section("BƯỚC 5: PyMongo ping")
    try:
        from pymongo import MongoClient

        c = MongoClient(URI, serverSelectionTimeoutMS=10000)
        c.admin.command("ping")
        p_ok("PyMongo ping OK → Atlas kết nối được")
        c.close()
    except Exception as e:
        err_str = str(e)[:250]
        p_err(f"PyMongo fail: {err_str}")

        print(f"\n{YELLOW}💡 HƯỚNG XỬ LÝ KHUYẾN NGHỊ:{RESET}")

        if "TLSV1_ALERT_INTERNAL_ERROR" in err_str or "SSL handshake failed" in err_str:
            p_info("1. Vào https://cloud.mongodb.com/ → Network Access → Add IP 0.0.0.0/0 (dev only)")
            p_info("2. Kiểm tra cluster có bị paused không → Resume")
            p_info("3. Thử downgrade Python 3.14 → Python 3.12")
        elif "timeout" in err_str.lower():
            p_info("1. Mạng đang chặn port 27017 → thử 4G")
            p_info("2. Bật/tắt VPN")
        elif "authentication" in err_str.lower():
            p_info("User/password trong URI sai")
        else:
            p_info(f"Copy error này gửi cho AI để debug sâu hơn")


if __name__ == "__main__":
    main()
