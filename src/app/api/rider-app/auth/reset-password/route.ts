import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * @swagger
 * /api/rider-app/auth/reset-password:
 *   post:
 *     tags:
 *       - Rider Auth
 *     summary: Rider Reset Password
 *     description: Reset password using the OTP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp, newPassword]
 *             properties:
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Validation error or invalid OTP
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const emailRaw = body.email ? String(body.email).trim().toLowerCase() : undefined;
    const phoneRaw = body.phone ? String(body.phone).trim().replace(/\s+/g, "") : undefined;
    const otp = body.otp;
    const newPassword = body.newPassword;

    if ((!phoneRaw && !emailRaw) || !otp || !newPassword) {
      return NextResponse.json(
        { error: "Phone/email, otp and newPassword are required" },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const rider = await prisma.rider.findFirst({
      where: phoneRaw ? { phone: phoneRaw } : { email: emailRaw },
    });

    if (!rider || !rider.resetOtpHash || !rider.resetOtpExpiry) {
      return NextResponse.json({ error: "Invalid OTP request" }, { status: 400 });
    }

    if (new Date(rider.resetOtpExpiry).getTime() < Date.now()) {
      return NextResponse.json({ error: "OTP expired" }, { status: 400 });
    }

    const incomingHash = hashOtp(String(otp));
    if (incomingHash !== rider.resetOtpHash) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await prisma.rider.update({
      where: { id: rider.id },
      data: {
        password: hashedPassword,
        resetOtpHash: null,
        resetOtpExpiry: null,
      },
    });

    return NextResponse.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Rider reset-password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
