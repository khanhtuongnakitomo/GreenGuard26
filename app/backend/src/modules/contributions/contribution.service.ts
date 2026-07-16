import { TOKEN_EXPIRY } from "../../config/constants";
import { calculateContributionItems } from "../../utils/pointRules";
import { generateSessionCode } from "../../utils/generateCode";
import { hashQrToken } from "../../utils/qrToken";
import { calculateMembershipTier } from "../../utils/membershipTier";
import { HttpError } from "../../utils/httpError";
import { verifyQrSignature } from "../../utils/qrPayload";
import { validateMachineApiKey } from "../machines/machine.service";
import { MachineModel } from "../machines/machine.model";
import { UserModel } from "../users/user.model";
import { createEarnTransaction } from "../points/point.service";
import { checkMilestonesAfterContribution } from "../milestones/milestone.service";
import { ContributionSessionModel } from "./contribution.model";
import type { ItemType } from "../../types/enums";

export async function createSessionFromMachine(input: {
  machineCode: string;
  machineApiKey: string;
  claimToken: string;
  items: Array<{ itemType: "plastic_bottle" | "can" | "carton"; quantity: number }>;
}) {
  const machine = await validateMachineApiKey(input.machineCode, input.machineApiKey);
  const calculated = calculateContributionItems(input.items);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.claimMinutes * 60 * 1000);
  const claimTokenHash = hashQrToken(input.claimToken);

  const existing = await ContributionSessionModel.findOne({ claimTokenHash });
  if (existing) {
    return { session: existing, expiresAt: existing.expiresAt };
  }

  const session = await ContributionSessionModel.create({
    sessionCode: generateSessionCode(),
    machineId: machine._id,
    machineName: machine.name,
    items: calculated.items,
    totalItems: calculated.items.reduce((sum, i) => sum + i.quantity, 0),
    totalPoints: calculated.totalPoints,
    claimTokenHash,
    expiresAt
  });

  machine.totalSessions += 1;
  machine.lastSeenAt = new Date();
  machine.status = "online";
  await machine.save();

  return { session, expiresAt };
}

/**
 * If the machine never registered the session (or registration lost the race),
 * create it from a verified signed QR payload (Trash-detection HMAC).
 */
async function ensureSessionFromSignedQr(claimToken: string, rawQr: string) {
  const verified = verifyQrSignature(rawQr);
  if (!verified) throw new HttpError(400, "QR code is invalid or tampered");
  if (verified.claimToken !== claimToken) {
    throw new HttpError(400, "QR payload does not match claim token");
  }
  if (new Date(verified.expiresAt).getTime() < Date.now()) {
    throw new HttpError(410, "Contribution session has expired");
  }
  if (!Array.isArray(verified.items) || verified.items.length === 0) {
    throw new HttpError(400, "QR payload has no items");
  }

  const items = verified.items.map((item) => ({
    itemType: item.itemType as ItemType,
    quantity: item.quantity
  }));

  for (const item of items) {
    if (!["plastic_bottle", "can", "carton"].includes(item.itemType) || item.quantity < 1) {
      throw new HttpError(400, "QR payload has invalid items");
    }
  }

  const machineCode = verified.machineCode || "0001";
  const machine = await MachineModel.findOne({ machineCode });
  if (!machine || machine.status === "disabled") {
    throw new HttpError(404, `Machine ${machineCode} not found — run npm run seed`);
  }

  const calculated = calculateContributionItems(items);
  const claimTokenHash = hashQrToken(claimToken);
  const expiresAt = new Date(verified.expiresAt);

  try {
    return await ContributionSessionModel.create({
      sessionCode: generateSessionCode(),
      machineId: machine._id,
      machineName: machine.name,
      items: calculated.items,
      totalItems: calculated.items.reduce((sum, i) => sum + i.quantity, 0),
      totalPoints: calculated.totalPoints,
      claimTokenHash,
      expiresAt
    });
  } catch {
    // Concurrent create from machine POST — fetch existing
    const existing = await ContributionSessionModel.findOne({ claimTokenHash });
    if (existing) return existing;
    throw new HttpError(500, "Failed to create contribution session from QR");
  }
}

export async function claimSessionForUser(userId: string, claimToken: string, rawQr?: string) {
  const claimTokenHash = hashQrToken(claimToken);
  let existing = await ContributionSessionModel.findOne({ claimTokenHash });

  // Race / missing machine POST: create session from signed QR
  if (!existing && rawQr) {
    existing = await ensureSessionFromSignedQr(claimToken, rawQr);
  }

  if (!existing) throw new HttpError(404, "Contribution session not found");
  if (existing.status === "claimed") throw new HttpError(409, "Contribution session is already claimed");
  if (existing.status === "expired" || existing.expiresAt.getTime() < Date.now()) {
    if (existing.status !== "expired") {
      existing.status = "expired";
      await existing.save();
    }
    throw new HttpError(410, "Contribution session has expired");
  }

  const userExists = await UserModel.exists({ _id: userId });
  if (!userExists) throw new HttpError(404, "User not found");

  const session = await ContributionSessionModel.findOneAndUpdate(
    { _id: existing._id, status: "unclaimed" },
    {
      status: "claimed",
      claimedBy: userId,
      claimedAt: new Date()
    },
    { new: true }
  );

  if (!session) throw new HttpError(409, "Contribution session is already claimed");

  let bottles = 0;
  let cans = 0;
  let cartons = 0;
  for (const item of session.items) {
    if (item.itemType === "plastic_bottle") bottles += item.quantity;
    if (item.itemType === "can") cans += item.quantity;
    if (item.itemType === "carton") cartons += item.quantity;
  }

  const transaction = await createEarnTransaction({
    userId,
    points: session.totalPoints,
    description: `Claimed ${bottles} bottles, ${cans} cans, and ${cartons} cartons`,
    contributionSessionId: session._id
  });

  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, "User not found");

  user.totalBottles += bottles;
  user.totalCans += cans;
  user.totalCarton += cartons;
  user.totalItems += bottles + cans + cartons;
  user.membershipTier = calculateMembershipTier(user.totalItems);
  user.lastContributionAt = new Date();
  await user.save();

  const milestones = await checkMilestonesAfterContribution(userId);
  const refreshedUser = await UserModel.findById(userId);

  return {
    session,
    transaction,
    milestones,
    pointsEarned: session.totalPoints,
    totalBalance: refreshedUser?.totalPoints ?? user.totalPoints
  };
}

export async function getContributionSession(sessionId: string) {
  const session = await ContributionSessionModel.findById(sessionId).populate("machineId claimedBy");
  if (!session) throw new HttpError(404, "Contribution session not found");
  return session;
}

export async function listContributions() {
  return ContributionSessionModel.find().populate("machineId claimedBy").sort({ createdAt: -1 }).limit(100);
}

export async function expireOldSessions() {
  return ContributionSessionModel.updateMany(
    { status: "unclaimed", expiresAt: { $lt: new Date() } },
    { status: "expired" }
  );
}
