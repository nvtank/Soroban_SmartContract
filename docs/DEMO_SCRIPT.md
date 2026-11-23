# Kịch bản trình diễn (khung, Agent H hoàn thiện)

Thời lượng mục tiêu: 3–5 phút.

## Chuẩn bị
- [ ] Chạy seed: 1 chủ nhà, 2 người thuê, 3 hợp đồng
- [ ] Kiểm tra `/api/health`
- [ ] Mở sẵn tab Chủ nhà và Người thuê

## Luồng
1. Tạo và xác nhận hợp đồng
2. Nạp cọc (MÔ PHỎNG)
3. Thu tiền thuê, quá hạn, phí trễ
4. Hoàn cọc hoặc khấu trừ
5. Từ chối khấu trừ, chuyển sang chờ xử lý tranh chấp

## Phương án dự phòng
- [ ] Chuyển `PAYMENT_MODE=simulated`
- [ ] Video quay sẵn
- [ ] Danh sách giao dịch Testnet mẫu đã kiểm chứng
