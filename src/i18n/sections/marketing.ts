export const marketingVi = {
  nav: {
    problem: "01 Vấn đề",
    solution: "02 Giải pháp",
    howItWorks: "03 Hành trình",
    blockchain: "04 Bằng chứng",
    comparison: "05 Sự thật",
    tryIt: "06 Dùng thử",
    transparency: "Minh bạch & Đạo đức",
    tryDemo: "Dùng thử demo",
    readingProgress: "Tiến trình đọc",
    openMenu: "Mở danh mục điều hướng",
    closeMenu: "Đóng danh mục điều hướng",
  },
  hero: {
    tagline: "Bảo chứng tiền cọc (mô phỏng) & Thu tiền thuê nhà",
    titleLine1: "Tiền cọc & tiền nhà,",
    titleLine2: "bắt đầu từ niềm tin.",
    description:
      "RentFlow là mô hình két bảo chứng trung lập và theo dõi thanh toán qua VietQR (mô phỏng). Mọi trạng thái do smart contract Soroban kiểm soát trên Stellar Testnet, bảo đảm hai bên cùng xác nhận mới giải ngân và tuyệt đối không lưu dữ liệu cá nhân.",
    ctaPrimary: "Dùng thử demo ngay",
    ctaSecondary: "Xem hành trình 5 bước",
    badgeIdeathon: "Stellar Ideathon — Két cọc trung lập Soroban",
    trustNote:
      "Bản demo: ngân hàng, VietQR, OTP và giải ngân là mô phỏng. Bằng chứng chạy trên Stellar Testnet.",
  },
  chapter01: {
    number: "01",
    subtitle: "Mở đầu • Điểm tựa niềm tin",
    title: "Tiền cọc và tiền nhà là chuyện niềm tin giữa hai người",
    description:
      "Một hợp đồng thuê nhà thành công luôn bắt đầu từ sự tin tưởng. Nhưng khi chỉ dựa vào thỏa thuận miệng, niềm tin rất dễ bị lung lay.",
  },
  chapter02: {
    number: "02",
    subtitle: "Vấn đề • Đứt gãy niềm tin",
    title: "Ba nỗi đau người thuê và chủ nhà đối mặt mỗi ngày",
    description:
      "Thiếu cơ chế bảo vệ khách quan khiến cả hai phía luôn trong tình trạng bất an và mệt mỏi.",
    cards: [
      {
        id: "giam-coc",
        badge: "Nỗi đau 01",
        title: "Người thuê bị giam cọc vô lý",
        description:
          "Khi kết thúc hợp đồng, người thuê luôn ở thế yếu, lo bị chủ nhà viện cớ hao mòn tự nhiên để trừ tiền hoặc kéo dài thời gian hoàn cọc.",
        impact: "Căng thẳng tâm lý và rủi ro mất 1–2 tháng tiền thuê.",
      },
      {
        id: "bung-tien",
        badge: "Nỗi đau 02",
        title: "Chủ nhà mệt mỏi vì trễ tiền thuê",
        description:
          "Đến kỳ thanh toán phải gọi điện, nhắn tin nhắc nợ nhiều lần. Không có cơ chế tự động tính phí phạt trễ hạn minh bạch.",
        impact: "Đứt gãy dòng tiền sinh hoạt và rạn nứt quan hệ thuê trọ.",
      },
      {
        id: "tranh-chap",
        badge: "Nỗi đau 03",
        title: "Tranh chấp không có bằng chứng",
        description:
          "Thỏa thuận và tin nhắn trao đổi rải rác qua mạng xã hội, dễ thất lạc. Khi xảy ra xích mích không có biên bản bất biến để đối chiếu.",
        impact: "Không có căn cứ phân xử khách quan và công bằng.",
      },
    ],
  },
  chapter03: {
    number: "03",
    subtitle: "Giải pháp • Bước ngoặt",
    title: "Két cọc hai chìa khóa: Cần cả hai bên mới mở được",
    description:
      "Hợp đồng thông minh Soroban trên Testnet kiểm soát trạng thái cọc; chỉ giải ngân mô phỏng khi cả Chủ nhà và Người thuê cùng ký xác nhận bằng Passkey (contract không giữ tiền VNĐ).",
    principles: [
      {
        title: "Không ai tự ý rút cọc",
        desc: "Chủ nhà không thể tự lấy tiền cọc; người thuê không thể tự hủy cam kết.",
      },
      {
        title: "Hai chìa khóa cùng xoay",
        desc: "Giải ngân chỉ kích hoạt khi chữ ký hai bên khớp chính xác cùng một số tiền.",
      },
      {
        title: "Khóa an toàn khi bất đồng",
        desc: "Khi phát sinh tranh chấp, két tự động khóa cứng, hệ thống không tự phán quyết.",
      },
    ],
  },
  chapter04: {
    number: "04",
    subtitle: "Hành trình • 5 bước",
    title: "Hành trình 5 bước minh bạch từ ký kết đến hoàn tất",
    description:
      "Từng bước trong vòng đời thuê trọ được ghi nhận minh bạch trên sổ cái Stellar Testnet, bảo vệ trọn vẹn cả hai bên.",
    steps: [
      {
        step: "SIGN",
        stepNumber: "01",
        name: "Ký hợp đồng",
        shortDesc: "Chủ nhà tạo hợp đồng — Người thuê xác nhận bằng Passkey",
        detail:
          "Hợp đồng được chuẩn hóa và tính mã băm SHA-256 có muối ngẫu nhiên 32-byte. Người thuê ký xác nhận bằng Passkey (thử nghiệm trên thiết bị ảo).",
        onchainAction: "Ghi nhận mã băm hợp đồng (doc_hash) và số tiền lên Soroban Testnet.",
        deepLink: "/dang-nhap?demo=landlord&next=/app/hop-dong/ct-001#tong-quan",
      },
      {
        step: "DEPOSIT",
        stepNumber: "02",
        name: "Nạp cọc bảo chứng",
        shortDesc: "Quét VietQR mô phỏng — Cọc vào két bảo chứng Soroban",
        detail:
          "Người thuê quét mã VietQR mô phỏng. Sau khi xác nhận thanh toán, trạng thái cọc chuyển sang RECORDED trên hợp đồng Soroban. Contract không giữ tiền VNĐ.",
        onchainAction: "Oracle ghi nhận payment_ref_hash và xác nhận cọc đã vào két.",
        deepLink: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-001#tien-coc",
      },
      {
        step: "RENT",
        stepNumber: "03",
        name: "Thu thuê hàng tháng",
        shortDesc: "Theo dõi kỳ thuê — Tự động tính phạt trễ hạn minh bạch",
        detail:
          "Đến hạn hàng tháng, mã VietQR kỳ thuê được phát hành (mô phỏng). Nếu trễ hạn, hệ thống tự tính phí phạt chính xác theo tỷ lệ cam kết.",
        onchainAction: "Ghi nhận trạng thái thanh toán hoặc số ngày trễ lên Testnet.",
        deepLink: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-002#tien-thue",
      },
      {
        step: "SETTLE",
        stepNumber: "04",
        name: "Hoàn cọc đồng thuận",
        shortDesc: "Hai chìa khóa cùng xoay — Két mở hoàn cọc đồng thuận",
        detail:
          "Khi trả phòng, chủ nhà đề xuất mức hoàn cọc hoặc khấu trừ có lý do. Chỉ khi hai bên khớp số tiền bằng Passkey, smart contract mới phát sự kiện giải ngân (mô phỏng).",
        onchainAction: "Phát sự kiện release_authorized khi cả hai bên khớp chữ ký xác nhận.",
        deepLink: "/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002#hoan-coc",
      },
      {
        step: "DISPUTE",
        stepNumber: "05",
        name: "Xử lý tranh chấp",
        shortDesc: "Bất đồng ý kiến — Khóa cọc an toàn, không tự giải ngân",
        detail:
          "Nếu có bất đồng hoặc số tiền gửi lệch nhau, cọc bị khóa cứng ở trạng thái PENDING_DISPUTE trên chuỗi cho đến khi hai bên tìm được tiếng nói chung.",
        onchainAction: "Khóa cọc trên contract, chặn hoàn cọc cho đến khi đạt thỏa thuận chung.",
        deepLink: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-003#hoan-coc",
      },
    ],
    safeStatusLocked: "Két cọc: Đang khóa bảo chứng (RECORDED)",
    safeStatusUnlocked: "Két cọc: Mở giải ngân (REFUNDED)",
    safeStatusDisputed: "Két cọc: Khóa tranh chấp (PENDING_DISPUTE)",
    interactiveHint: "Cuộn ngang để xem từng bước trong hành trình:",
  },
  chapter05: {
    number: "05",
    subtitle: "Bằng chứng • On-Chain",
    title: "Mỗi bước để lại dấu vết bất biến trên Stellar Testnet",
    description:
      "Blockchain là sổ cái công khai chống gian lận; tuyệt đối không lưu họ tên, số điện thoại, CCCD hay bất kỳ dữ liệu cá nhân nào.",
    marqueeTitle: "Băng giao dịch Stellar Testnet mới nhất",
    marqueeEmpty: "Chưa có giao dịch nào được ghi nhận trên Testnet trong phiên làm việc này.",
    marqueeNote:
      "Dữ liệu được lấy trực tiếp từ hàng đợi onchain_txs. Bấm vào giao dịch để mở Stellar Expert Explorer.",
    techCards: [
      {
        name: "Smart Contract Soroban",
        role: "Sổ cái trạng thái & Chống gian lận",
        status: "ĐÃ TRIỂN KHAI TRÊN TESTNET",
        desc: "Quản lý máy trạng thái cọc và hợp đồng. Contract không giữ tiền VNĐ, chỉ phát sự kiện giải ngân khi cả hai bên cùng xác nhận.",
      },
      {
        name: "Passkey (WebAuthn)",
        role: "Ký bảo mật không cần mật khẩu",
        status: "ĐÃ CHẠY THỬ (THIẾT BỊ ẢO)",
        desc: "Ký hợp đồng và duyệt hoàn cọc an toàn qua WebAuthn. Ví custodial do máy chủ giữ hộ, người dùng không cần nhớ cụm từ khóa.",
      },
      {
        name: "CAP-15 Fee-Bump",
        role: "Nền tảng tài trợ toàn bộ phí giao dịch",
        status: "ĐÃ CHẠY TRÊN TESTNET",
        desc: "Giao dịch được bọc Fee-Bump, máy chủ trả phí mạng trên Testnet. Người dùng không cần sở hữu bất kỳ token nào.",
      },
    ],
  },
  chapter06: {
    number: "06",
    subtitle: "Sự thật • Thẳng thắn",
    title: "Minh bạch tuyệt đối: Phần nào thật, phần nào mô phỏng?",
    description:
      "Chúng tôi công khai rõ ràng ranh giới kỹ thuật để bảo đảm tính trung thực tuyệt đối của bản demo Ideathon.",
    realSectionTitle: "Chạy thật trên Stellar Testnet",
    simulatedSectionTitle: "Mô phỏng trong bản demo",
    realFeatures: [
      "Smart contract Soroban quản lý trạng thái cọc và hợp đồng",
      "Mã băm SHA-256 có muối (doc_hash, payment_ref_hash) lưu bất biến trên chain",
      "Nền tảng trả phí mạng Testnet qua giao dịch CAP-15 Fee-Bump",
      "Xác thực Passkey (WebAuthn) thử nghiệm trên trình duyệt Chrome",
    ],
    simulatedFeatures: [
      "Tiền VNĐ và tài khoản ký quỹ ngân hàng (contract không giữ tiền VNĐ, chưa kết nối tài khoản phong tỏa)",
      "Cổng thanh toán VietQR và đối soát (chạy trong sandbox thử nghiệm, payOS chưa kiểm chứng)",
      "Giải ngân hoàn cọc liên ngân hàng (chỉ cập nhật trạng thái UI, không có lệnh chuyển tiền thật)",
      "Mã xác thực OTP qua SMS (sử dụng mã mặc định 123456)",
    ],
    transparencyCta: "Xem chi tiết cam kết Đạo đức & Kỹ thuật",
    transparencyLink: "/minh-bach",
  },
  chapter07: {
    number: "07",
    subtitle: "Dùng thử • Trải nghiệm",
    title: "Chọn vai trò và khám phá RentFlow ngay",
    description:
      "Hệ thống đã chuẩn bị sẵn tài khoản demo có đầy đủ dữ liệu cho cả Chủ nhà và Người thuê để trải nghiệm trọn vẹn quy trình 5 bước.",
    landlordCard: {
      role: "CHỦ NHÀ",
      badge: "Tài khoản demo",
      title: "Trải nghiệm vai trò Chủ nhà",
      benefits: [
        "Tạo hợp đồng với điều khoản cọc và phí phạt trễ hạn minh bạch",
        "Theo dõi trạng thái tiền cọc đã ghi nhận vào két bảo chứng",
        "Kiểm tra lịch sử thanh toán VietQR từng kỳ thuê",
        "Đề xuất mức khấu trừ hao mòn có đính kèm lý do khi trả phòng",
      ],
      cta: "Đăng nhập nhanh Chủ nhà",
      link: "/dang-nhap?demo=landlord&next=/app",
    },
    tenantCard: {
      role: "NGƯỜI THUÊ",
      badge: "Tài khoản demo",
      title: "Trải nghiệm vai trò Người thuê",
      benefits: [
        "Xác nhận hợp đồng thuê bằng Passkey an toàn",
        "Quét VietQR nạp cọc vào két bảo chứng (mô phỏng)",
        "Thanh toán tiền thuê hàng tháng chỉ với một chạm",
        "Đồng thuận hoàn cọc hoặc từ chối khấu trừ vô lý để khóa cọc",
      ],
      cta: "Đăng nhập nhanh Người thuê",
      link: "/dang-nhap?demo=tenant&next=/app",
    },
    demoScriptLink: "Xem kịch bản trình diễn chuẩn (Demo Script)",
  },
  footer: {
    brandDesc:
      "Mô hình bảo chứng tiền cọc và theo dõi thanh toán tiền thuê nhà trên nền tảng Stellar Soroban. Bản demo Ideathon: ngân hàng và giải ngân là mô phỏng.",
    navigation: "Điều hướng",
    resources: "Tài nguyên",
    legal: "Đạo đức & Minh bạch",
    transparencyLink: "Trang Minh bạch & Đạo đức",
    contractsDoc: "Hợp đồng giao tiếp (docs/CONTRACTS.md)",
    demoNotice: "Thông báo bản quyền & Demo",
    copyright: "© 2026 RentFlow Team. Dự án tham dự cuộc thi Stellar Ideathon.",
    disclaimer:
      "Lưu ý quan trọng: RentFlow hiện là bản demo tham gia cuộc thi Stellar Ideathon. Dịch vụ ngân hàng, VietQR, OTP, giải ngân và tài khoản ký quỹ hoàn toàn là mô phỏng. Smart contract Soroban không giữ tiền VNĐ. Mọi giao dịch blockchain được thực hiện trên Stellar Testnet và không có giá trị tiền tệ thực tế.",
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
