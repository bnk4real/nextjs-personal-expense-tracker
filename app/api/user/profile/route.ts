import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to verify JWT token
function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { user_id: string; username: string; email: string; firstName: string; lastName: string };
    } catch (error) {
        return null;
    }
}

// GET /api/user/profile - Get current user profile
export async function GET(request: NextRequest) {
    try {
        // Check for token in cookies first, then Authorization header
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const user = await prisma.people.findUnique({
            where: { user_id: decoded.user_id },
            select: {
                user_id: true,
                username: true,
                email: true,
                first_name: true,
                last_name: true,
                created_at: true,
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            createdAt: user.created_at,
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/user/profile - Update user profile
export async function PUT(request: NextRequest) {
    try {
        // Check for token in cookies first, then Authorization header
        const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { firstName, lastName, email, username } = await request.json();

        // Check if email is already taken by another user
        if (email !== decoded.email) {
            const existingUser = await prisma.people.findUnique({
                where: { email }
            });
            if (existingUser && existingUser.user_id !== decoded.user_id) {
                return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
            }
        }

        // Check if username is already taken by another user
        if (username !== decoded.username) {
            const existingUser = await prisma.people.findUnique({
                where: { username }
            });
            if (existingUser && existingUser.user_id !== decoded.user_id) {
                return NextResponse.json({ error: 'Username already in use' }, { status: 400 });
            }
        }

        const updatedUser = await prisma.people.update({
            where: { user_id: decoded.user_id },
            data: {
                first_name: firstName,
                last_name: lastName,
                email,
                username,
            },
            select: {
                user_id: true,
                username: true,
                email: true,
                first_name: true,
                last_name: true,
                created_at: true,
            }
        });

        return NextResponse.json({
            user_id: updatedUser.user_id,
            username: updatedUser.username,
            email: updatedUser.email,
            firstName: updatedUser.first_name,
            lastName: updatedUser.last_name,
            createdAt: updatedUser.created_at,
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}