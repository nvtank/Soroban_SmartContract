export const marketingVi = {
  nav: {
    transparency: "Minh bạch & Đạo đức",
  },
  /**
   * Chữ của trang chủ. Mỗi câu phải nằm trong phạm vi docs/COPY_AUDIT.md:
   * ngân hàng, VietQR, payOS, OTP và giải ngân là mô phỏng; contract không giữ tiền VND;
   * dữ liệu cá nhân nằm trong database off-chain, không bao giờ lên blockchain.
   */
  landing: {
    hero: {
      lines: ["Tiền cọc là niềm tin.", "Đừng để một bên giữ nó."],
      sub: "Két cọc hai chìa khóa trên Stellar Testnet: chủ nhà và người thuê phải cùng đồng ý mới mở được.",
      primary: "Dùng thử",
      secondary: "Xem câu chuyện",
    },
    problem: {
      title: "Khi niềm tin gãy",
      cards: [
        { title: "Cọc bị giam", text: "Trả phòng xong, tiền cọc bị trừ tùy ý hoặc hẹn mãi không trả." },
        { title: "Tiền nhà trễ", text: "Đến hạn lại phải nhắn, gọi, nhắc. Không ai tính phí trễ rõ ràng." },
        { title: "Không bằng chứng", text: "Thỏa thuận nằm rải rác trong tin nhắn. Khi cãi nhau, không gì để đối chiếu." },
      ],
    },
    solution: {
      title: "Hai chìa khóa. Một két.",
      text: "Tiền cọc chỉ được giải ngân khi cả hai bên cùng ký đúng một số tiền. Lệch nhau thì két tự khóa.",
      keys: ["Chủ nhà", "Người thuê"],
    },
    journey: {
      title: "Năm bước, từ ký đến trả phòng",
      steps: [
        { title: "Ký hợp đồng", text: "Chủ nhà tạo, người thuê xác nhận bằng Passkey.", fn: "tenant_confirm" },
        { title: "Nạp cọc", text: "Quét VietQR (mô phỏng), cọc vào két.", fn: "record_deposit_paid" },
        { title: "Trả tiền nhà", text: "Mỗi kỳ được ghi nhận, trễ hạn tự tính phí.", fn: "record_rent_paid" },
        { title: "Hoàn cọc", text: "Hai bên cùng ký một số tiền thì két mở.", fn: "approve_refund" },
        { title: "Tranh chấp", text: "Không đồng ý thì cọc bị khóa, không ai tự phán.", fn: "open_dispute" },
      ],
    },
    proof: {
      title: "Mỗi bước để lại dấu vết",
      text: "Mười hai thao tác được ghi lên Stellar Testnet. Trên chain chỉ có mã băm và số tiền, không có tên hay số điện thoại.",
      functions: [
        "create_contract",
        "tenant_confirm",
        "record_deposit_paid",
        "record_rent_paid",
        "mark_overdue",
        "extend_due",
        "request_refund",
        "approve_refund",
        "propose_deduction",
        "respond_deduction",
        "open_dispute",
        "resolve_dispute",
      ],
      stamp: "Đã ghi trên Stellar Testnet",
      link: "Xem giao dịch thật",
    },
    truth: {
      title: "Phần nào thật, phần nào mô phỏng",
      realLabel: "Chạy thật",
      real: [
        "Smart contract Soroban trên Stellar Testnet",
        "Mã băm SHA-256 có muối cho hợp đồng và thanh toán",
        "Nền tảng trả phí giao dịch (Fee-Bump)",
        "Passkey, mới thử trên thiết bị ảo",
      ],
      simulatedLabel: "Mô phỏng",
      simulated: [
        "Ngân hàng và tài khoản giữ cọc",
        "VietQR, payOS và đối soát",
        "Giải ngân tiền VND",
        "Mã OTP qua SMS",
      ],
      note: "Contract không giữ tiền VND, chỉ cho phép giải ngân khi hai bên cùng ký.",
      link: "Đọc trang Minh bạch",
    },
    cta: {
      title: "Thử với vai của bạn",
      roles: [
        { role: "Chủ nhà", text: "Tạo hợp đồng, theo dõi cọc và tiền nhà.", link: "/dang-nhap?demo=landlord&next=/app" },
        { role: "Người thuê", text: "Xác nhận hợp đồng, nộp cọc, đòi lại cọc.", link: "/dang-nhap?demo=tenant&next=/app" },
      ],
      action: "Vào demo",
    },
  },
  transparency: {
    pageTitle: "Minh bạch & Đạo đức Kỹ thuật",
    pageSubtitle:
      "Cam kết công khai, trung thực về kiến trúc dữ liệu, cơ chế bảo vệ tài sản và những giới hạn của bản demo RentFlow.",
    breadcrumb: "Trang chủ / Minh bạch & Đạo đức",
    sections: {
      dataCollection: {
        title: "1. Dữ liệu thu thập & Mục đích sử dụng",
        content:
          "RentFlow chỉ thu thập những thông tin tối thiểu do người dùng trực tiếp cung cấp trong quá trình thiết lập hợp đồng. Chúng tôi cam kết tuyệt đối KHÔNG mua, cào (scraping) hoặc thu thập ngầm dữ liệu cá nhân từ bất kỳ bên thứ ba nào.",
        items: [
          {
            field: "Số điện thoại",
            source:
              "Người dùng tự nhập khi đăng nhập nhận mã xác thực OTP (mô phỏng bằng mã 123456 trong bản demo).",
            purpose: "Định danh tài khoản và hiển thị thông báo nhắc đến hạn thanh toán / hoàn cọc.",
          },
          {
            field: "Thông tin hợp đồng & Phòng trọ",
            source: "Chủ nhà tự nhập khi khởi tạo hợp đồng thuê.",
            purpose: "Lập biên bản thỏa thuận, tính toán chu kỳ phát mã VietQR mô phỏng và mức phạt quá hạn.",
          },
          {
            field: "Mã khóa công khai Passkey (WebAuthn)",
            source:
              "Trình duyệt của thiết bị người dùng sinh ra khi đăng ký (kiểm thử trên Chrome với thiết bị Passkey ảo).",
            purpose:
              "Xác thực hành vi ký hợp đồng và duyệt hoàn cọc an toàn, thay thế chữ ký tay truyền thống.",
          },
        ],
      },
      onOffChainTable: {
        title: "2. Phân định dữ liệu On-Chain và Off-Chain khớp mã nguồn",
        description:
          "Căn cứ docs/CONTRACTS.md và src/lib/stellar/resolve-args.ts, dữ liệu được phân chia ranh giới vật lý nghiêm ngặt:",
        offchainHeader: "Off-chain (Supabase — Lưu trữ bảo mật)",
        onchainHeader: "On-chain (Stellar Soroban — Bất biến công khai)",
        items: [
          {
            category: "Danh tính cá nhân (PII)",
            offchain:
              "Họ tên, Số điện thoại, Số CCCD / CMND, thông tin tài khoản ngân hàng nhận tiền. Được bảo vệ bởi Postgres RLS.",
            onchain:
              "CHỈ lưu địa chỉ ví Stellar ngẫu nhiên (ví dụ G...ABC của chủ nhà, người thuê, signer). Tuyệt đối cấm PII.",
          },
          {
            category: "Nội dung hợp đồng & Thông số",
            offchain:
              "Toàn văn điều khoản (terms_text), tên phòng (room_label), chuỗi muối ngẫu nhiên (doc_salt). Hệ thống mới băm nội dung hợp đồng, CHƯA có ảnh bàn giao.",
            onchain:
              "doc_hash: BytesN<32> (băm SHA-256 kèm doc_salt), deposit_amount: i128, rent_amount: i128, due_day: u32, late_fee_bps_per_day: u32, UUID: BytesN<16>.",
          },
          {
            category: "Trạng thái cọc & Quá hạn",
            offchain: "Lịch sử chi tiết, nhật ký thao tác (audit logs), thông báo hệ thống in-app.",
            onchain:
              "Mã trạng thái số nguyên u32 (ContractStatus, DepositStatus, RentStatus), số ngày trễ (days_late: u32), mốc gia hạn (new_due_ts: u64).",
          },
          {
            category: "Thanh toán cọc & Thuê",
            offchain:
              "Mã đơn hàng payOS (chưa kiểm chứng thực tế), chuỗi mã VietQR mô phỏng, chuỗi muối thanh toán (payment_ref_salt), biên nhận chuyển khoản mô phỏng.",
            onchain:
              "payment_ref_hash: BytesN<32> (băm mã thanh toán kèm payment_ref_salt), số tiền VND (amount: i128), kỳ thuê (period: u32).",
          },
          {
            category: "Khấu trừ & Tranh chấp",
            offchain:
              "Toàn văn lý do khấu trừ (reason_text), chuỗi muối lý do (reason_salt), biên bản trao đổi giải quyết tranh chấp.",
            onchain:
              "reason_hash: BytesN<32> (băm lý do kèm reason_salt), số tiền khấu trừ (amount: i128), phản hồi chấp nhận (accept: bool), số tiền thỏa thuận giải quyết (agreed_amount: i128). Contract không giữ tiền VNĐ.",
          },
        ],
      },
      privacySecurity: {
        title: "3. Quyền riêng tư & Bảo mật đa tầng",
        points: [
          "Không lưu dữ liệu định danh (PII) trên blockchain: Mọi dữ liệu trên chuỗi là công khai vĩnh viễn, vì vậy RentFlow dùng hàm băm SHA-256 có muối (salt) 32-byte ngẫu nhiên để ngăn chặn hoàn toàn việc dò ngược văn bản gốc (doc_hash, reason_hash, payment_ref_hash).",
          "Chính sách bảo mật hàng (Row Level Security - RLS): Cơ sở dữ liệu Postgres áp dụng chính sách RLS nghiêm ngặt. Người dùng chỉ có quyền đọc hợp đồng của chính mình, không thể truy cập dữ liệu của hợp đồng khác.",
          "Nhật ký kiểm toán minh bạch (Audit Logs): Mọi thao tác thay đổi trạng thái, yêu cầu khấu trừ hoặc giải ngân đều được lưu vết chi tiết phục vụ đối soát.",
        ],
      },
      assetProtection: {
        title: "4. Cơ chế bảo vệ tài sản & Tiền cọc",
        points: [
          "Nguyên tắc hai chìa khóa (Dual Confirmation): Tiền cọc sau khi nạp được ghi nhận trạng thái bảo chứng trung lập. Hệ thống KHÔNG cho phép chủ nhà tự ý rút cọc, và cũng không cho phép người thuê tự ý hủy khi chưa có sự đồng thuận.",
          "Hệ thống không tự phán quyết khi có tranh chấp: Khi người thuê bấm từ chối đề xuất khấu trừ hoặc số tiền hai bên gửi không khớp, cọc lập tức bị khóa on-chain ở trạng thái PENDING_DISPUTE. Smart contract được lập trình cứng để chặn mọi lệnh giải ngân tự động.",
          "Tính trung thực về mô hình Custodial: Ở phiên bản Ideathon demo, ví của người dùng được quản lý theo mô hình Custodial với khóa chủ (master key) mã hóa AES-256-GCM. Đây là giải pháp phù hợp để người dùng phổ thông không cần quản lý seed phrase, nhưng trong thực tế sản xuất cần nâng cấp lên phần cứng chuyên dụng (HSM / AWS KMS). Contract không giữ tiền VNĐ.",
        ],
      },
      aiEthics: {
        title: "5. Đạo đức Trí tuệ Nhân tạo (AI Ethics)",
        declaration:
          "RentFlow khẳng định: Bản demo hiện tại TUYỆT ĐỐI KHÔNG SỬ DỤNG AI TRONG BẤT KỲ LUỒNG NGHIỆP VỤ NÀO (không dùng AI để chấm điểm tín nhiệm người thuê, không phán xét tranh chấp, không quyết định giải ngân).",
        detail:
          "Mọi quyết định tài chính đều thuộc quyền kiểm soát 100% của hai bên con người tham gia hợp đồng thông qua chữ ký số xác nhận. Nếu trong tương lai có tích hợp AI (ví dụ gợi ý soạn thảo nội dung khấu trừ), tính năng đó sẽ chỉ mang tính chất tham khảo và bắt buộc phải có sự xác nhận của người dùng.",
      },
      simulationList: {
        title: "6. Danh mục các thành phần MÔ PHỎNG trong bản Demo",
        notice:
          "Để đảm bảo sự trung thực tuyệt đối (tiêu chí Đạo đức chiếm 40% điểm thi), chúng tôi công khai rõ ràng các tính năng đang chạy ở chế độ mô phỏng:",
        items: [
          {
            feature: "Tài khoản ký quỹ ngân hàng (Escrow Account)",
            status: "MÔ PHỎNG",
            note: "Hệ thống chưa kết nối tài khoản phong tỏa của ngân hàng thương mại thật. Tiền cọc được ghi nhận trạng thái bảo chứng ảo trên server và sổ cái Soroban; smart contract Soroban không giữ tiền VNĐ.",
          },
          {
            feature: "Cổng thanh toán VietQR & payOS",
            status: "MÔ PHỎNG / TEST MODE",
            note: "Sử dụng môi trường kiểm thử với mã VietQR tự sinh kết hợp chế độ giả lập thanh toán; payOS chưa được kiểm chứng với tài khoản doanh nghiệp thực tế.",
          },
          {
            feature: "Giải ngân hoàn cọc về tài khoản",
            status: "MÔ PHỎNG",
            note: "Khi smart contract phát sự kiện release_authorized, hệ thống chỉ cập nhật trạng thái UI và tạo giao dịch mô phỏng, không có lệnh chuyển tiền liên ngân hàng thật.",
          },
          {
            feature: "Xác thực OTP qua SMS",
            status: "MÔ PHỎNG",
            note: "Đăng nhập sử dụng mã OTP mặc định 123456 trong bản demo, chưa tích hợp nhà cung cấp dịch vụ SMS viễn thông thực tế.",
          },
          {
            feature: "Xác thực Passkey (WebAuthn)",
            status: "THỬ NGHIỆM VỚI THIẾT BỊ ẢO",
            note: "Đã triển khai thật với thư viện SimpleWebAuthn trên trình duyệt Chrome bằng thiết bị Passkey ảo (Virtual Authenticator); chưa kiểm thử trên cảm biến sinh trắc học thiết bị di động thật (Face ID, vân tay).",
          },
          {
            feature: "Khôi phục tài khoản (eKYC)",
            status: "MÔ PHỎNG",
            note: "Luồng quét CCCD và nhận diện khuôn mặt được mô phỏng qua giao diện demo để minh họa cơ chế cấp lại quyền truy cập ví.",
          },
        ],
      },
      roadmap: {
        title: "7. Lộ trình hoàn thiện pháp lý và kỹ thuật (Những gì chưa làm)",
        items: [
          "Tích hợp tổ chức lưu ký được cấp phép (Licensed Custodian / Stellar Anchor) để bảo chứng dòng tiền thật theo chuẩn SEP-24.",
          "Triển khai chuẩn xác thực ví Stellar SEP-10 (hiện dùng OTP và Passkey).",
          "Bổ sung tính năng chụp, lưu trữ và băm mã SHA-256 ảnh hiện trạng bàn giao phòng (hiện mới băm nội dung văn bản hợp đồng).",
          "Nâng cấp hạ tầng quản lý khóa sang HSM (Hardware Security Module) hoặc AWS KMS đạt chuẩn FIPS 140-2.",
          "Bổ sung kênh thông báo đa kênh qua Email, SMS và Web Push Notifications (hiện mới có thông báo in-app).",
          "Thanh toán các khoản điện, nước, phí dịch vụ qua VietQR và ghi lên chain (hiện chủ nhà chỉ ghi nhận khoản nợ và tự xác nhận đã nhận ngoài hệ thống, không phải xác nhận của ngân hàng).",
          "Kết nối với Trung tâm Trọng tài Thương mại để có quy trình hòa giải tranh chấp ngoài chuỗi có giá trị pháp lý thi hành.",
        ],
      },
      factsVerification: {
        title: "8. Nguồn số liệu trích dẫn & Trạng thái kiểm chứng",
        description:
          "Các con số thị trường được sử dụng trong bài trình bày xuất phát từ tài liệu sơ bộ và đang trong tiến trình đối soát độc lập:",
      },
    },
  },
} as const;
