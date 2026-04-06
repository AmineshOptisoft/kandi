import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * @swagger
 * /api/rider-app/test:
 *   post:
 *     tags:
 *       - helo habibkese ho 
 *     summary: Test rider availability status acha badiya hai 
 *     description: Test rider availability status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [riderId, status]
 *             properties:
 *               riderId:
 *                 type: integer
 *                 example: 1
 *               status:
 *                 type: integer
 *                 enum: [0, 2]
 *                 description: "0 = Active/Online, 2 = Offline"
 *                 example: 0
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Rider not found
 */

export async function POST(request: Request) {
    try {
        const { riderId, status } = await request.json();


        return NextResponse.json({
            message: `Rider is now ${status}`,
            rider: { id: riderId, name: "Test", status: status }
        });
    } catch (error) {
        console.error('Rider status update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
