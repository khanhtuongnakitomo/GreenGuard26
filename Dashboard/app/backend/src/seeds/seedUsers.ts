import { hashPassword } from "../utils/hash";
import { UserModel } from "../modules/users/user.model";

export async function seedUsers() {
  await UserModel.updateOne(
    { phoneNumber: "0900000001" },
    {
      phoneNumber: "0900000001",
      displayName: "Minh",
      passwordHash: await hashPassword("password123"),
      authMethods: ["password", "sms_otp"],
      role: "user",
      university: "DHBK",
      faculty: "Computer Science",
      totalPoints: 1250,
      lifetimeEarnedPoints: 1850,
      lifetimeRedeemedPoints: 600,
      totalBottles: 1248,
      totalCans: 212,
      totalItems: 1460,
      currentStreak: 8,
      longestStreak: 18,
      membershipTier: "green_member",
      isPhoneVerified: true
    },
    { upsert: true }
  );

  await UserModel.updateOne(
    { phoneNumber: "0900000002" },
    {
      phoneNumber: "0900000002",
      displayName: "Parking Operator",
      passwordHash: await hashPassword("password123"),
      authMethods: ["password"],
      role: "operator",
      isPhoneVerified: true
    },
    { upsert: true }
  );

  await UserModel.updateOne(
    { phoneNumber: "0900000003" },
    {
      phoneNumber: "0900000003",
      displayName: "GreenPoint Admin",
      passwordHash: await hashPassword("password123"),
      authMethods: ["password"],
      role: "admin",
      isPhoneVerified: true
    },
    { upsert: true }
  );
}
