import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const { username, email, firstName, lastName, password } = await request.json();

        // Validate required fields
        if (!username || !email || !password) {
            return NextResponse.json(
                { error: 'Username, email, and password are required' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.people.findFirst({
            where: {
                OR: [
                    { username },
                    { email }
                ]
            }
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Username or email already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user in people table
        const user = await prisma.people.create({
            data: {
                user_id: randomUUID(),
                username,
                email,
                first_name: firstName || '',
                last_name: lastName || '',
                password_hash: hashedPassword,
                created_at: new Date(),
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
            message: 'User created successfully',
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                createdAt: user.created_at,
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}