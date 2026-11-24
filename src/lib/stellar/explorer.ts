/**
 * Tiện ích tạo đường dẫn tới Stellar Explorer trên Testnet.
 */
export function getExplorerTxUrl(txHash: string): string {
  const base = process.env.STELLAR_EXPLORER_TX_URL || "https://stellar.expert/explorer/testnet/tx";
  const cleanBase = base.replace(/\/+$/, "");
  const cleanHash = txHash.trim();
  return `${cleanBase}/${cleanHash}`;
}

/**
 * Nạp XLM thử nghiệm qua Friendbot cho địa chỉ ví Stellar Testnet.
 */
export async function fundWithFriendbot(publicKey: string): Promise<{ success: boolean; message?: string }> {
  const friendbotUrl = process.env.STELLAR_FRIENDBOT_URL || "https://friendbot.stellar.org";
  const url = `${friendbotUrl.replace(/\/+$/, "")}?addr=${encodeURIComponent(publicKey)}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      return { success: true };
    }

    const text = await res.text();
    // Nếu tài khoản đã tồn tại, friendbot có thể trả về lỗi nhưng tài khoản vẫn sẵn sàng
    if (text.includes("createAccountAlreadyExist") || res.status === 400) {
      return { success: true, message: "Account already funded" };
    }

    return { success: false, message: `Friendbot returned status ${res.status}` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Friendbot request failed",
    };
  }
}
