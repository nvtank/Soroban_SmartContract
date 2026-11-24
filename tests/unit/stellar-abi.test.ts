import { describe, it, expect } from "vitest";
import { encodeContractArgs, getRequiredSignerKind } from "@/lib/stellar/abi";
import { ApiError } from "@/lib/api/http";

describe("Stellar ABI Argument Encoding", () => {
  const dummyUUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const dummyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const dummyAddrLandlord = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const dummyAddrTenant = "GAH4YJWAPLQUY6KXV6CBFEQLK7GN4VKBQ6RMKY26UTEPDTNV7EIZDOFK";

  it("mã hóa thành công create_contract theo cả dạng object lẫn array", () => {
    const objArgs = {
      id: dummyUUID,
      landlord: dummyAddrLandlord,
      tenant: dummyAddrTenant,
      doc_hash: dummyHash,
      deposit: "10000000",
      rent: "5000000",
      due_day: 5,
      late_fee_bps_per_day: 50,
    };

    const scVals1 = encodeContractArgs("create_contract", objArgs);
    expect(scVals1).toHaveLength(8);

    const arrArgs = [dummyUUID, dummyAddrLandlord, dummyAddrTenant, dummyHash, "10000000", "5000000", 5, 50];
    const scVals2 = encodeContractArgs("create_contract", arrArgs);
    expect(scVals2).toHaveLength(8);

    // XDR của 2 cách truyền phải tương đương
    expect(scVals1[0].toXDR("hex")).toBe(scVals2[0].toXDR("hex"));
    expect(scVals1[3].toXDR("hex")).toBe(scVals2[3].toXDR("hex"));
  });

  it("mã hóa thành công tenant_confirm", () => {
    const scVals = encodeContractArgs("tenant_confirm", {
      id: dummyUUID,
      tenant: dummyAddrTenant,
    });
    expect(scVals).toHaveLength(2);
  });

  it("mã hóa thành công record_deposit_paid", () => {
    const scVals = encodeContractArgs("record_deposit_paid", {
      id: dummyUUID,
      payment_ref_hash: dummyHash,
      amount: "10000000",
    });
    expect(scVals).toHaveLength(3);
  });

  it("mã hóa thành công record_rent_paid", () => {
    const scVals = encodeContractArgs("record_rent_paid", {
      id: dummyUUID,
      period: 1,
      amount: "5000000",
      payment_ref_hash: dummyHash,
    });
    expect(scVals).toHaveLength(4);
  });

  it("mã hóa thành công mark_overdue và calc_late_fee", () => {
    const scVals1 = encodeContractArgs("mark_overdue", {
      id: dummyUUID,
      period: 1,
      days_late: 10,
    });
    expect(scVals1).toHaveLength(3);

    const scVals2 = encodeContractArgs("calc_late_fee", {
      id: dummyUUID,
      period: 1,
      days_late: 10,
    });
    expect(scVals2).toHaveLength(3);
  });

  it("mã hóa thành công extend_due", () => {
    const scVals = encodeContractArgs("extend_due", {
      id: dummyUUID,
      period: 1,
      new_due_ts: 1770000000,
    });
    expect(scVals).toHaveLength(3);
  });

  it("mã hóa thành công request_refund và approve_refund", () => {
    const scVals1 = encodeContractArgs("request_refund", {
      id: dummyUUID,
      party: dummyAddrTenant,
    });
    expect(scVals1).toHaveLength(2);

    const scVals2 = encodeContractArgs("approve_refund", {
      id: dummyUUID,
      party: dummyAddrLandlord,
      refund_amount: "10000000",
    });
    expect(scVals2).toHaveLength(3);
  });

  it("mã hóa thành công propose_deduction và respond_deduction", () => {
    const scVals1 = encodeContractArgs("propose_deduction", {
      id: dummyUUID,
      landlord: dummyAddrLandlord,
      amount: "2000000",
      reason_hash: dummyHash,
    });
    expect(scVals1).toHaveLength(4);

    const scVals2 = encodeContractArgs("respond_deduction", {
      id: dummyUUID,
      tenant: dummyAddrTenant,
      accept: true,
    });
    expect(scVals2).toHaveLength(3);
  });

  it("mã hóa thành công open_dispute và resolve_dispute", () => {
    const scVals1 = encodeContractArgs("open_dispute", {
      id: dummyUUID,
      party: dummyAddrTenant,
    });
    expect(scVals1).toHaveLength(2);

    const scVals2 = encodeContractArgs("resolve_dispute", {
      id: dummyUUID,
      party: dummyAddrLandlord,
      agreed_amount: "8000000",
    });
    expect(scVals2).toHaveLength(3);
  });

  it("mã hóa thành công view functions: get_contract và get_rent_period", () => {
    expect(encodeContractArgs("get_contract", { id: dummyUUID })).toHaveLength(1);
    expect(encodeContractArgs("get_rent_period", { id: dummyUUID, period: 2 })).toHaveLength(2);
  });

  it("báo lỗi nếu action không tồn tại trong danh sách", () => {
    expect(() => encodeContractArgs("non_existent_action", {})).toThrow(ApiError);
  });

  it("xác định đúng loại ký bắt buộc getRequiredSignerKind", () => {
    expect(getRequiredSignerKind("init")).toBe("PLATFORM");
    expect(getRequiredSignerKind("record_deposit_paid")).toBe("ORACLE");
    expect(getRequiredSignerKind("record_rent_paid")).toBe("ORACLE");
    expect(getRequiredSignerKind("mark_overdue")).toBe("ORACLE");
    expect(getRequiredSignerKind("create_contract")).toBe("USER");
    expect(getRequiredSignerKind("tenant_confirm")).toBe("USER");
    expect(getRequiredSignerKind("approve_refund")).toBe("USER");
  });
});
