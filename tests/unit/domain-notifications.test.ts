import { describe, expect, it } from "vitest";
import { FakeDomainRepository } from "@/domain/repository";

describe("domain notifications", () => {
  it("creates, lists, and marks notifications as read", async () => {
    const repo = new FakeDomainRepository();
    const userId = "user-notif-1";

    await repo.notifications.create({
      id: "notif-1",
      user_id: userId,
      type: "CONTRACT_INVITED",
      title: "Lời mời thuê nhà",
      body: "Bạn nhận được lời mời thuê phòng 101",
      read_at: null,
      created_at: new Date().toISOString(),
    });

    await repo.notifications.create({
      id: "notif-2",
      user_id: "other-user",
      type: "RENT_PAID",
      title: "Đã trả tiền",
      body: "Tiền đã nộp",
      read_at: null,
      created_at: new Date().toISOString(),
    });

    // List for userId only
    const userList = await repo.notifications.listByUserId(userId);
    expect(userList.length).toBe(1);
    expect(userList[0].id).toBe("notif-1");
    expect(userList[0].read_at).toBeNull();

    // Mark as read
    const marked = await repo.notifications.markAsRead("notif-1", userId);
    expect(marked).toBe(true);

    const updatedList = await repo.notifications.listByUserId(userId);
    expect(updatedList[0].read_at).not.toBeNull();

    // Cannot mark another user's notification as read
    const wrongUser = await repo.notifications.markAsRead("notif-2", userId);
    expect(wrongUser).toBe(false);
  });
});
