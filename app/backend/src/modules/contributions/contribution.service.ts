import { TOKEN_EXPIRY } from "../../config/constants";
import { calculateContributionItems } from "../../utils/pointRules";
import { generateSessionCode } from "../../utils/generateCode";
import { generateClaimToken, hashQrToken } from "../../utils/qrToken";
import { calculateMembershipTier } from "../../utils/membershipTier";
import { buildSignedQrPayload } from "../../utils/qrPayload";
import { HttpError } from "../../utils/httpError";
import { validateMachineApiKey } from "../machines/machine.service";
import { UserModel } from "../users/user.model";
import { createEarnTransaction } from "../points/point.service";
import { checkMilestonesAfterContribution } from "../milestones/milestone.service";
import { ContributionSessionModel } from "./contribution.model";

export async function createSessionFromMachine(input: {
  machineCode: string;
  machineApiKey: string;
  items: Array<{ itemType: "plastic_bottle" | "can"; quantity: number }>;
}) {
  const machine = await validateMachineApiKey(input.machineCode, input.machineApiKey);
  const calculated = calculateContributionItems(input.items);
  const claimToken = generateClaimToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.claimMinutes * 60 * 1000);

  const session = await ContributionSessionModel.create({
    sessionCode: generateSessionCode(),
    machineId: machine._id,
    machineName: machine.name,
    items: calculated.items,
    totalItems: calculated.items.reduce((sum, i) => sum + i.quantity, 0),
    totalPoints: calculated.totalPoints,
    claimTokenHash: hashQrToken(claimToken),
    expiresAt
  });

  machine.totalSessions += 1;
  machine.lastSeenAt = new Date();
  machine.status = "online";
  await machine.save();

  const qrPayload = buildSignedQrPayload({
    claimToken,
    totalItems: session.totalItems,
    totalPoints: session.totalPoints,
    items: input.items,
    expiresAt: expiresAt.toISOString()
  });

  return { session, qrPayload, expiresAt };
}

export async function claimSessionForUser(userId: string, claimToken: string) {
  const session = await ContributionSessionModel.findOne({ claimTokenHash: hashQrToken(claimToken) });
  if (!session) throw new HttpError(404, "Contribution session not found");
  if (session.status !== "unclaimed") throw new HttpError(409, "Contribution session is already claimed");
  if (session.expiresAt.getTime() < Date.now()) {
    session.status = "expired";
    await session.save();
    throw new HttpError(410, "Contribution session has expired");
  }

  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, "User not found");

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

  user.totalBottles += bottles;
  user.totalCans += cans;
  user.totalCarton += cartons;
  user.totalItems += bottles + cans + cartons;
  user.membershipTier = calculateMembershipTier(user.totalItems);
  user.lastContributionAt = new Date();
  await user.save();

  session.status = "claimed";
  session.claimedBy = user._id;
  session.claimedAt = new Date();
  await session.save();

  const milestones = await checkMilestonesAfterContribution(userId);
  return { session, transaction, milestones };
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
