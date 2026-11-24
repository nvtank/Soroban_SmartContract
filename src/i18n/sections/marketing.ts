export const marketingVi = {
  nav: {
    problem: "01 Vấn đề",
    solution: "02 Giải pháp",
    howItWorks: "03 Cách hoạt động",
    blockchain: "04 Blockchain",
    comparison: "05 So sánh",
    tryIt: "06 Dùng thử",
    transparency: "Minh bạch & Đạo đức",
    tryDemo: "Dùng thử demo",
    readingProgress: "Tiến trình đọc",
    openMenu: "Mở danh mục điều hướng",
    closeMenu: "Đóng danh mục điều hướng",
  },
  hero: {
    tagline: "Bảo chứng tiền cọc & Thu tiền thuê nhà",
    titleLine1: "Giữ cọc công bằng,",
    titleLine2: "thu tiền nhà nhẹ nhàng.",
    description:
      "RentFlow là dịch vụ bảo chứng tiền cọc trung lập và tự động hóa thu tiền thuê nhà qua VietQR. Khóa cọc an toàn, chỉ giải ngân khi cả hai bên xác nhận; lưu bằng chứng bất biến trên Stellar Testnet mà không lộ bất kỳ dữ liệu cá nhân nào.",
    ctaPrimary: "Dùng thử demo ngay",
    ctaSecondary: "Xem cách hoạt động",
    badgeIdeathon: "Stellar Ideathon — Track 4 & 5 (Custody & Soroban)",
    trustNote: "Bản demo: ngân hàng và giải ngân là mô phỏng. Bằng chứng chạy trên Stellar Testnet.",
  },
  chapter01: {
    number: "01",
    subtitle: "Thực trạng nhức nhối",
    title: "Ba nỗi đau người thuê và chủ nhà đối mặt mỗi ngày",
    description:
      "Thị trường thuê nhà truyền thống phụ thuộc hoàn toàn vào niềm tin cá nhân và những thỏa thuận miệng, dẫn đến sự bất an cho cả hai phía.",
    cards: [
      {
        id: "giam-coc",
        badge: "Nỗi đau 01",
        title: "Người thuê bị giam cọc hoặc trừ cọc vô lý",
        description:
          "Khi kết thúc hợp đồng, nhiều chủ nhà tìm mọi lý do hư hỏng hao mòn tự nhiên để trừ tiền hoặc kéo dài thời gian hoàn cọc nhiều tháng.",
        impact: "Mất niềm tin, căng thẳng, rủi ro mất trắng số tiền tương đương 1-2 tháng tiền thuê.",
      },
      {
        id: "bung-tien",
        badge: "Nỗi đau 02",
        title: "Chủ nhà bị trễ tiền, bùng tiền, mệt mỏi nhắc nợ",
        description:
          "Đến kỳ thanh toán phải nhắn tin, gọi điện đòi tiền nhiều lần. Người thuê chậm trễ không có cơ chế chế tài rõ ràng và minh bạch.",
        impact: "Đứt gãy dòng tiền sinh hoạt, hao tổn thời gian và phá vỡ mối quan hệ giữa hai bên.",
      },
      {
        id: "tranh-chap",
        badge: "Nỗi đau 03",
        title: "Tranh chấp khi trả phòng, bằng chứng rải rác",
        description:
          "Ảnh bàn giao phòng, tin nhắn thỏa thuận thất lạc qua Zalo, Messenger. Khi xảy ra xích mích không có biên bản bất biến để đối chiếu.",
        impact: "Không có trọng tài khách quan; người thuê yếu thế, chủ nhà mang tiếng xấu.",
      },
    ],
    nextBridge: "Vậy RentFlow giải quyết ba bài toán này như thế nào? ↓",
  },
  chapter02: {
    number: "02",
    subtitle: "Mô hình giải pháp",
    title: "Chuyển hóa nỗi đau thành sự an tâm tuyệt đối",
    description:
      "Mỗi bài toán nhức nhối trong thực tế được RentFlow giải quyết bằng cơ chế kỹ thuật rõ ràng, trung lập và minh bạch.",
    pairs: [
      {
        painTitle: "Giam cọc / Trừ cọc vô lý",
        painDesc:
          "Tiền cọc nằm hoàn toàn trong tay chủ nhà, người thuê luôn ở thế bị động khi kết thúc kỳ hạn.",
        solutionTitle: "Két cọc hai chìa khóa (Dual-Key Vault)",
        solutionDesc:
          "Tiền cọc được giữ ở trạng thái trung lập (mô phỏng escrow). Chỉ được giải ngân khi CẢ HAI BÊN cùng dùng Passkey xác nhận cùng số tiền.",
        pillar: "Bảo chứng độc lập",
      },
      {
        painTitle: "Trễ tiền & Mất công đòi nợ",
        painDesc: "Không có chuẩn hóa lịch thu, nhắc nợ thủ công, cãi vã về số ngày quá hạn và tiền phạt.",
        solutionTitle: "VietQR động & Quy tắc phạt trễ tự động",
        solutionDesc:
          "Hệ thống tự phát sinh mã VietQR theo từng kỳ thuê, tự động tính phí trễ hạn minh bạch theo %/ngày đã cam kết trước trong hợp đồng.",
        pillar: "Thu nợ tự động",
      },
      {
        painTitle: "Bằng chứng rải rác, khó phân xử",
        painDesc: "Hợp đồng giấy dễ sửa đổi, ảnh hiện trạng phân tán, không có nguồn sự thật khách quan.",
        solutionTitle: "Bằng chứng SHA-256 trên Stellar Testnet",
        solutionDesc:
          "Mọi mốc quan trọng (ký hợp đồng, nạp cọc, biên bản trả phòng) đều băm SHA-256 kèm muối ngẫu nhiên và lưu lên sổ cái Soroban bất biến.",
        pillar: "Bất biến & Trung thực",
      },
    ],
    nextBridge: "Khám phá quy trình 5 bước vận hành thực tế ↓",
  },
  chapter03: {
    number: "03",
    subtitle: "Quy trình vận hành",
    title: "Hành trình 5 bước minh bạch từ ký kết đến kết thúc",
    description:
      "Từng bước trong vòng đời thuê nhà được kiểm soát bởi hợp đồng thông minh Soroban, loại bỏ mọi góc khuất.",
    steps: [
      {
        step: "SIGN",
        stepNumber: "01",
        name: "Ký hợp đồng",
        shortDesc: "Chủ nhà tạo hợp đồng — Người thuê xác nhận bằng Passkey",
        detail:
          "Chủ nhà nhập thông tin hợp đồng (tiền cọc, tiền thuê, ngày đến hạn, phí trễ). Hợp đồng được chuẩn hóa và tính mã băm SHA-256 có muối. Người thuê xác thực danh tính và ký điện tử qua Passkey/WebAuthn.",
        onchainAction: "Ghi nhận mã băm hợp đồng và địa chỉ ví của hai bên lên Soroban contract.",
        deepLink: "/dang-nhap?demo=landlord&next=/app/hop-dong/ct-001#tong-quan",
      },
      {
        step: "DEPOSIT",
        stepNumber: "02",
        name: "Nạp cọc bảo chứng",
        shortDesc: "Người thuê quét VietQR — Cọc đưa vào két bảo chứng",
        detail:
          "Người thuê quét mã VietQR tự sinh. Sau khi cổng thanh toán xác nhận đúng số tiền, backend đưa giao dịch vào hàng đợi Outbox. Soroban chuyển trạng thái tiền cọc sang RECORDED.",
        onchainAction: "Oracle ghi nhận payment_ref_hash và xác nhận cọc đã vào két.",
        deepLink: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-001#tien-coc",
      },
      {
        step: "RENT",
        stepNumber: "03",
        name: "Thu thuê hàng tháng",
        shortDesc: "Tự phát VietQR từng kỳ — Tính phí trễ hạn nếu quá hạn",
        detail:
          "Đến hạn hàng tháng, VietQR kỳ thuê được phát hành tự động. Nếu thanh toán trễ, hệ thống tự tính phí phạt chính xác theo công thức quy định và cập nhật công nợ.",
        onchainAction: "Cập nhật trạng thái từng kỳ thuê và phí trễ hạn (late_fee) lên contract.",
        deepLink: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-002#tien-thue",
      },
      {
        step: "SETTLE",
        stepNumber: "04",
        name: "Nghiệm thu & Hoàn cọc",
        shortDesc: "Hai chìa khóa cùng xoay — Két mở hoàn cọc đồng thuận",
        detail:
          "Khi trả phòng, chủ nhà đề xuất hoàn cọc toàn bộ hoặc khấu trừ chi phí hợp lý. Chỉ khi cả hai bên dùng Passkey đồng thuận cùng một số tiền, két mới mở giải ngân.",
        onchainAction: "Contract phát sự kiện release_authorized khi cả hai bên khớp chữ ký.",
        deepLink: "/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002#hoan-coc",
      },
      {
        step: "DISPUTE",
        stepNumber: "05",
        name: "Xử lý tranh chấp",
        shortDesc: "Bất đồng ý kiến — Khóa cọc an toàn, không tự giải ngân",
        detail:
          "Nếu người thuê từ chối mức khấu trừ, hệ thống chuyển sang trạng thái PENDING_DISPUTE. Tiền cọc bị khóa cứng, RentFlow tuyệt đối không tự phán quyết bên nào đúng.",
        onchainAction: "Khóa cọc trên contract, chờ hai bên đàm phán hoặc trọng tài can thiệp.",
        deepLink: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-003#hoan-coc",
      },
    ],
    safeStatusLocked: "Két cọc: Đang khóa bảo chứng (RECORDED)",
    safeStatusUnlocked: "Két cọc: Mở giải ngân (REFUNDED)",
    safeStatusDisputed: "Két cọc: Khóa tranh chấp (PENDING_DISPUTE)",
    interactiveHint: "Cuộn trang hoặc chọn bước bên dưới để điều khiển két cọc mô phỏng:",
    nextBridge: "Dữ liệu được lưu trữ on-chain và off-chain như thế nào? ↓",
  },
  chapter04: {
    number: "04",
    subtitle: "Kiến trúc công nghệ",
    title: "Phân chia ranh giới On-Chain và Off-Chain tuyệt đối",
    description:
      "Quy tắc đạo đức cốt lõi của RentFlow: Blockchain là sổ cái bất biến để chống gian lận, không phải nơi lưu thông tin nhạy cảm của người dùng.",
    gameTitle: "Tương tác: Kéo thả phân loại dữ liệu",
    gameInstruction:
      "Hãy kéo từng mảnh dữ liệu (hoặc bấm chọn) vào đúng vùng lưu trữ Off-chain (Supabase) hoặc On-chain (Stellar Soroban):",
    gameSuccessMessage: "Chính xác! Dữ liệu đã được phân loại đúng nguyên tắc kiến trúc.",
    marqueeTitle: "Băng giao dịch Stellar Testnet mới nhất",
    marqueeEmpty: "Chưa có giao dịch nào được ghi nhận trên Testnet trong phiên làm việc này.",
    marqueeNote:
      "Dữ liệu được lấy trực tiếp từ hàng đợi onchain_txs. Bấm vào giao dịch để mở Stellar Expert Explorer.",
    techCards: [
      {
        name: "Stellar & Soroban",
        role: "Sổ cái trạng thái & Chống gian lận",
        status: "ĐÃ TRIỂN KHAI",
        desc: "Smart contract Soroban quản lý máy trạng thái và kiểm tra chữ ký của từng bên. Contract không giữ tiền VNĐ: nó chỉ cho phép phát lệnh giải ngân (mô phỏng) khi cả hai bên cùng xác nhận.",
      },
      {
        name: "Passkey (WebAuthn)",
        role: "Ký thao tác quan trọng không cần mật khẩu",
        status: "ĐÃ CHẠY THỬ",
        desc: "Đăng ký và xác thực Passkey được kiểm tra trên Chrome bằng thiết bị Passkey ảo; ký hợp đồng dùng mã bước hai một lần do máy chủ cấp. Chưa kiểm tra trên điện thoại thật. Ví do máy chủ giữ hộ (custodial), người dùng không phải nhớ 12 từ khóa.",
      },
      {
        name: "CAP-15 Fee-Bump",
        role: "Nền tảng trả phí thay người dùng",
        status: "ĐÃ CHẠY TRÊN TESTNET",
        desc: "Giao dịch được bọc FeeBumpTransaction, tài khoản nền tảng trả phí nên người dùng không cần sở hữu XLM. Người dùng chỉ ký phần ủy quyền của mình.",
      },
      {
        name: "SEP-10 & Stellar Anchor",
        role: "Xác thực ví chuẩn Stellar và cầu nối nạp rút VND",
        status: "LỘ TRÌNH DÀI HẠN",
        desc: "Chưa triển khai trong bản demo. Hướng phát triển: SEP-10 cho xác thực ví và SEP-24 với tổ chức tài chính được cấp phép để nạp rút tiền định danh VND.",
      },
    ],
    nextBridge: "Xem bảng so sánh RentFlow với các mô hình hiện tại ↓",
  },
  chapter05: {
    number: "05",
    subtitle: "So sánh khách quan",
    title: "RentFlow định vị ở đâu trên thị trường?",
    description:
      "So sánh trung thực với ngân hàng truyền thống, phần mềm quản lý trọ và các dự án Web3 thuần túy. Thông tin căn cứ theo Brief thiết kế.",
    columns: [
      "Tiêu chí",
      "RentFlow (Đề xuất)",
      "Ngân hàng truyền thống",
      "App quản lý phòng trọ",
      "Dự án Web3 thuần",
    ],
    rows: [
      {
        criteria: "Bảo chứng tiền cọc",
        rentflow: "Két cọc 2 chìa khóa (mô phỏng escrow), chỉ giải ngân khi cả hai bên ký",
        bank: "Có tài khoản ký quỹ nhưng thủ tục phức tạp, chi phí cao, không áp dụng cho phòng trọ nhỏ lẻ",
        rentalApp: "Không bảo chứng, tiền nằm trực tiếp trong tài khoản chủ nhà",
        web3: "Smart contract khóa crypto, rủi ro biến động giá và đòi hỏi ví crypto cá nhân",
      },
      {
        criteria: "Thu tiền thuê & phạt trễ",
        rentflow: "Tự động phát VietQR từng kỳ, phạt trễ tự động theo %/ngày thỏa thuận",
        bank: "Ủy nhiệm chi tự động nhưng không linh hoạt xử lý thiếu/thừa hoặc trễ hạn theo hợp đồng thuê",
        rentalApp: "Chỉ nhắc nợ bằng thông báo, chủ nhà vẫn phải đối soát sao kê ngân hàng thủ công",
        web3: "Trừ token tự động từ ví người thuê, đòi hỏi người thuê phải nạp sẵn crypto",
      },
      {
        criteria: "Bằng chứng khi có tranh chấp",
        rentflow: "Hash SHA-256 có muối lưu trên Stellar Testnet, bất biến, khóa cọc khi bất đồng",
        bank: "Sao kê chuyển khoản thuần túy, không lưu giữ ảnh hiện trạng bàn giao hay điều khoản hợp đồng",
        rentalApp: "Dữ liệu lưu tập trung ở máy chủ công ty phần mềm, có thể bị chỉnh sửa hoặc mất dữ liệu",
        web3: "Lưu trên chuỗi nhưng thường để lộ địa chỉ ví công khai hoặc metadata nhạy cảm",
      },
      {
        criteria: "Trải nghiệm người dùng phổ thông",
        rentflow: "Giao diện tiếng Việt, quét VietQR thân thuộc, đăng nhập Passkey, không chạm XLM hay gas",
        bank: "Quen thuộc nhưng rườm rà giấy tờ tại quầy giao dịch",
        rentalApp: "Quen thuộc, dễ dùng nhưng thiếu tính bảo vệ pháp lý và bảo chứng dòng tiền",
        web3: "Rào cản lớn: cài ví MetaMask/Freighter, mua XLM trả gas, ký hex transaction khó hiểu",
      },
      {
        criteria: "Bảo vệ dữ liệu cá nhân",
        rentflow: "Tuyệt đối không đưa CCCD, SĐT, họ tên, ảnh lên blockchain; phân quyền RLS chặt chẽ",
        bank: "Tuân thủ bảo mật ngân hàng",
        rentalApp: "Tập trung dữ liệu, phụ thuộc vào chính sách bảo mật của từng nhà phát triển app",
        web3: "Dễ sơ suất đưa siêu dữ liệu (metadata) cá nhân vào IPFS hoặc tham số contract",
      },
    ],
    nextBridge: "Sẵn sàng trải nghiệm ngay trên hệ thống demo? ↓",
  },
  chapter06: {
    number: "06",
    subtitle: "Trải nghiệm thực tế",
    title: "Chọn vai trò và khám phá RentFlow ngay",
    description:
      "Hệ thống đã chuẩn bị sẵn tài khoản demo có đầy đủ dữ liệu giả lập cho cả hai bên để bạn trải nghiệm trọn vẹn luồng 5 bước.",
    landlordCard: {
      role: "CHỦ NHÀ",
      badge: "Tài khoản demo",
      title: "Trải nghiệm với vai trò Chủ nhà",
      benefits: [
        "Tạo hợp đồng mới với điều khoản tiền cọc và biểu phí phạt trễ rõ ràng",
        "Theo dõi danh sách hợp đồng và trạng thái cọc đã vào két bảo chứng",
        "Kiểm tra lịch sử thanh toán VietQR từng kỳ thuê",
        "Đề xuất mức khấu trừ hao mòn có đính kèm lý do khi trả phòng",
      ],
      cta: "Đăng nhập nhanh Chủ nhà",
      link: "/dang-nhap?demo=landlord&next=/app",
    },
    tenantCard: {
      role: "NGƯỜI THUÊ",
      badge: "Tài khoản demo",
      title: "Trải nghiệm với vai trò Người thuê",
      benefits: [
        "Xác nhận hợp đồng thuê bằng bảo mật Passkey",
        "Quét VietQR nạp cọc vào két bảo chứng an toàn",
        "Thanh toán tiền thuê hàng tháng chỉ với một chạm",
        "Yêu cầu hoàn cọc hoặc từ chối khấu trừ vô lý để khóa cọc",
      ],
      cta: "Đăng nhập nhanh Người thuê",
      link: "/dang-nhap?demo=tenant&next=/app",
    },
    demoScriptLink: "Xem kịch bản trình diễn chuẩn (Demo Script)",
  },
  footer: {
    brandDesc:
      "Dịch vụ bảo chứng tiền cọc và thu tiền thuê nhà tự động trên nền tảng Stellar Soroban. Đơn giản hóa bất động sản cho người Việt.",
    navigation: "Điều hướng",
    resources: "Tài nguyên",
    legal: "Đạo đức & Minh bạch",
    transparencyLink: "Trang Minh bạch & Đạo đức",
    contractsDoc: "Hợp đồng giao tiếp (docs/CONTRACTS.md)",
    demoNotice: "Thông báo bản quyền & Demo",
    copyright: "© 2026 RentFlow Team. Dự án tham dự cuộc thi Stellar Ideathon.",
    disclaimer:
      "Lưu ý quan trọng: RentFlow hiện là bản demo tham gia cuộc thi. Dịch vụ ngân hàng, giải ngân và tài khoản ký quỹ hoàn toàn là mô phỏng. Mọi giao dịch blockchain được thực hiện trên Stellar Testnet và không có giá trị tiền tệ thực tế.",
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
            source: "Người dùng tự nhập khi đăng nhập nhận mã xác thực OTP.",
            purpose: "Định danh tài khoản và gửi thông báo nhắc đến hạn thanh toán / hoàn cọc.",
          },
          {
            field: "Thông tin hợp đồng & Phòng trọ",
            source: "Chủ nhà tự nhập khi khởi tạo hợp đồng thuê.",
            purpose: "Lập biên bản thỏa thuận, tính toán chu kỳ phát mã VietQR và mức phạt quá hạn.",
          },
          {
            field: "Mã khóa công khai Passkey (WebAuthn)",
            source: "Trình duyệt của thiết bị người dùng sinh ra khi đăng ký.",
            purpose:
              "Xác thực hành vi ký hợp đồng và mở khóa két hoàn cọc, thay thế chữ ký tay truyền thống.",
          },
        ],
      },
      onOffChainTable: {
        title: "2. Phân định dữ liệu On-Chain và Off-Chain",
        description:
          "Để bảo vệ quyền riêng tư theo chuẩn đạo đức Web3, dữ liệu được phân chia ranh giới vật lý nghiêm ngặt:",
        offchainHeader: "Off-chain (Supabase — Lưu trữ bảo mật)",
        onchainHeader: "On-chain (Stellar Soroban — Bất biến công khai)",
        items: [
          {
            category: "Danh tính cá nhân",
            offchain: "Họ tên, Số điện thoại, Số CCCD / CMND, Ảnh đại diện.",
            onchain: "CHỈ lưu địa chỉ ví Stellar ngẫu nhiên (ví dụ G...ABC). Tuyệt đối cấm PII.",
          },
          {
            category: "Nội dung hợp đồng",
            offchain: "Toàn văn điều khoản, tên phòng (room_label), ảnh hiện trạng bàn giao.",
            onchain: "CHỈ lưu mã băm SHA-256 chuẩn hóa có kèm chuỗi muối ngẫu nhiên (doc_hash).",
          },
          {
            category: "Trạng thái cọc & Thuê",
            offchain: "Lịch sử chi tiết, nhật ký thao tác (audit logs), thông báo hệ thống.",
            onchain: "Mã trạng thái số nguyên (ContractStatus, DepositStatus, RentStatus).",
          },
          {
            category: "Thanh toán & Phí trễ",
            offchain: "Mã đơn hàng payOS, dữ liệu mã VietQR, biên nhận chuyển khoản off-chain.",
            onchain: "Số tiền VND số nguyên, số ngày trễ, mã băm thanh toán (payment_ref_hash).",
          },
        ],
      },
      privacySecurity: {
        title: "3. Quyền riêng tư & Bảo mật đa tầng",
        points: [
          "Không lưu dữ liệu định danh (PII) trên blockchain: Mọi dữ liệu trên chuỗi là công khai vĩnh viễn, vì vậy RentFlow dùng hàm băm SHA-256 có muối (salt) 32-byte ngẫu nhiên để ngăn chặn hoàn toàn việc dò ngược văn bản gốc.",
          "Chính sách bảo mật hàng (Row Level Security - RLS): Cơ sở dữ liệu Postgres áp dụng chính sách RLS nghiêm ngặt. Người dùng chỉ có quyền đọc hợp đồng của chính mình, không thể truy cập dữ liệu của hợp đồng khác.",
          "Nhật ký kiểm toán minh bạch (Audit Logs): Mọi thao tác thay đổi trạng thái, yêu cầu khấu trừ hoặc giải ngân đều được lưu vết chi tiết phục vụ đối soát.",
        ],
      },
      assetProtection: {
        title: "4. Cơ chế bảo vệ tài sản & Tiền cọc",
        points: [
          "Nguyên tắc hai chìa khóa (Dual Confirmation): Tiền cọc sau khi nạp được giữ ở trạng thái trung lập. Hệ thống KHÔNG cho phép chủ nhà tự ý rút cọc, và cũng không cho phép người thuê tự ý hủy khi chưa có sự đồng thuận.",
          "Hệ thống không tự phán quyết khi có tranh chấp: Khi người thuê bấm từ chối đề xuất khấu trừ, cọc lập tức bị khóa on-chain ở trạng thái PENDING_DISPUTE. Smart contract được lập trình cứng để chặn mọi lệnh giải ngân tự động.",
          "Tính trung thực về mô hình Custodial: Ở phiên bản Ideathon demo, ví của người dùng được quản lý theo mô hình Custodial với khóa chủ (master key) mã hóa AES-256-GCM. Đây là giải pháp phù hợp để người dùng phổ thông không cần quản lý seed phrase, nhưng trong thực tế sản xuất cần nâng cấp lên phần cứng chuyên dụng (HSM / AWS KMS).",
        ],
      },
      aiEthics: {
        title: "5. Đạo đức Trí tuệ Nhân tạo (AI Ethics)",
        declaration:
          "RentFlow khẳng định: Bản demo hiện tại TUYỆT ĐỐI KHÔNG SỬ DỤNG AI để đưa ra quyết định nghiệp vụ, đánh giá độ tin cậy của người thuê, hay tự động phán quyết kết quả tranh chấp tiền cọc.",
        detail:
          "Mọi quyết định tài chính đều thuộc quyền kiểm soát 100% của hai bên con người tham gia hợp đồng thông qua chữ ký số Passkey. Nếu trong tương lai có tích hợp AI (ví dụ gợi ý soạn thảo nội dung khấu trừ), tính năng đó sẽ chỉ mang tính chất tham khảo và bắt buộc phải có sự xác nhận của người dùng.",
      },
      simulationList: {
        title: "6. Danh mục các thành phần MÔ PHỎNG trong bản Demo",
        notice:
          "Để đảm bảo sự trung thực tuyệt đối (tiêu chí Đạo đức chiếm 40% điểm thi), chúng tôi công khai rõ ràng các tính năng đang chạy ở chế độ mô phỏng:",
        items: [
          {
            feature: "Tài khoản ký quỹ ngân hàng (Escrow Account)",
            status: "MÔ PHỎNG",
            note: "Hệ thống chưa kết nối tài khoản phong tỏa của ngân hàng thương mại thật. Tiền cọc được ghi nhận trạng thái bảo chứng ảo trên server và sổ cái Soroban.",
          },
          {
            feature: "Cổng thanh toán VietQR",
            status: "MÔ PHỎNG / TEST MODE",
            note: "Sử dụng môi trường kiểm thử của payOS kết hợp chế độ giả lập thanh toán (Simulated mode) để thử nghiệm các ca nộp thiếu, nộp thừa hoặc lỗi mạng.",
          },
          {
            feature: "Giải ngân hoàn cọc về tài khoản",
            status: "MÔ PHỎNG",
            note: "Khi smart contract phát sự kiện release_authorized, hệ thống chỉ cập nhật trạng thái UI và tạo giao dịch mô phỏng, không có lệnh chuyển tiền liên ngân hàng thật.",
          },
          {
            feature: "Khôi phục tài khoản (eKYC)",
            status: "MÔ PHỎNG",
            note: "Luồng quét CCCD và nhận diện khuôn mặt được mô phỏng qua giao diện demo để minh họa cơ chế cấp lại quyền truy cập ví.",
          },
        ],
      },
      roadmap: {
        title: "7. Lộ trình hoàn thiện pháp lý và kỹ thuật",
        items: [
          "Tích hợp tổ chức lưu ký được cấp phép (Licensed Custodian / Stellar Anchor) để bảo chứng dòng tiền thật theo chuẩn SEP-24.",
          "Nâng cấp hạ tầng quản lý khóa sang HSM (Hardware Security Module) đạt chuẩn FIPS 140-2.",
          "Triển khai CAP-15 Fee-Bump toàn diện để bao trợ toàn bộ phí gas Testnet / Mainnet cho người dùng cuối.",
          "Kết nối với Trung tâm Trọng tài Thương mại để có quy trình hòa giải tranh chấp ngoài chuỗi có giá trị pháp lý.",
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
