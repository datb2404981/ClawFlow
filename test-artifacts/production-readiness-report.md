# Production Readiness Report (Workspace-Skill-Task)

- Thời gian chạy: 2026-04-29 (time-box vài tiếng)
- Môi trường: `http://localhost:8080/api/v1` (staging-like docker stack đang chạy)
- Phạm vi: Workspace, Skill Template, Agent, Task, Security baseline

## 1) Kết quả Smoke Test

- File evidence: `test-artifacts/workspace-skill-task-smoke-security.json`
- Tổng case: `19`
- Pass: `19`
- Fail: `0`

Các luồng đã pass:
- Auth register cho 2 user test.
- Workspace: create/list/update + chặn truy cập chéo workspace.
- Skill template: create/list/update/delete + validation icon.
- Agent: create agent với skill template.
- Task: create/get/patch status/append message.
- Validation: chặn append message rỗng.

## 2) Quick Performance Check

- File evidence: `test-artifacts/tasks-list-quick-perf.json`
- Bài test: `GET /tasks` lặp `30` lần liên tiếp.
- Kết quả:
  - `30/30` request HTTP `200`
  - `p95 ~ 199.22ms`
  - `avg ~ 183.3ms`
  - `max ~ 220.23ms`

Đánh giá nhanh: ổn cho smoke traffic mức thấp.

## 3) Security Baseline Findings

- File evidence: `test-artifacts/security-deep-checks.json`

### Critical
- **IDOR Agent Detail**
  - Case: user B gọi `GET /agents/:id` với `agent_id` của user A.
  - Thực tế: trả về `200` (lộ dữ liệu agent khác workspace/user).
  - Trạng thái: **Critical**.
  - Liên quan code:
    - `Backend/src/module/ai-center/controller/agent.controller.ts` (`findAgentById` không nhận `@User` / không scope workspace)
    - `Backend/src/module/ai-center/service/agents.service.ts` (`findAgentById` query trực tiếp theo `_id`)

### High
- **Không giới hạn kích thước append message**
  - Case: gửi `content` ~200KB tới `POST /tasks/:taskId/messages`.
  - Thực tế: trả về `201`, payload được chấp nhận.
  - Rủi ro: DoS chi phí xử lý/queue/AI inference, tăng dung lượng Mongo.
  - Liên quan code:
    - `Backend/src/module/ai-center/dto/append-task-message.dto.ts` chỉ có `@MinLength(1)`, chưa có `@MaxLength`.

### Passed Security Checks
- Invalid task id (`not-a-valid-id`) bị chặn đúng (`400`).
- Cross-workspace read task/workspace bị chặn (`404`).

## 4) Production Gate Assessment

- Functional: **PASS** (smoke scope).
- Reliability (time-box quick): **PASS có điều kiện**.
- Security: **FAIL** (do 1 Critical + 1 High).

## 5) Go / No-Go

- **Kết luận: NO-GO cho production ở trạng thái hiện tại**.

Lý do:
- Có lỗ hổng Critical IDOR ở endpoint đọc agent theo id.
- Có rủi ro High về payload size abuse cho task message.

## 6) Must-fix trước khi Go-live

1. Bịt IDOR ở `GET /agents/:id`:
   - Bắt buộc verify ownership qua workspace tương tự các endpoint khác.
2. Thêm `MaxLength` cho `AppendTaskMessageDto` (ví dụ 4k–16k tùy policy).
3. Bổ sung rate-limit/throttle cho:
   - `POST /tasks`
   - `POST /tasks/:taskId/messages`
4. Thêm security regression tests cho 2 lỗi trên để chống tái phát.

## 7) Gợi ý retest nhanh sau khi fix

- Re-run 3 artifact scripts trong thư mục `test-artifacts` (smoke/perf/security).
- Tiêu chí Go:
  - Security findings Critical/High = 0
  - Smoke pass >= 95%
  - Perf quick check giữ p95 < 300ms (mức smoke hiện tại)
