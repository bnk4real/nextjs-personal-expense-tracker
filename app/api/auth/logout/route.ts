import { NextResponse } from 'next/server';

export async function POST() {
    try {
        // Create response that clears the token cookie
        const response = NextResponse.json({ message: 'Logged out successfully' });

        // Clear the token cookie
        response.cookies.set('token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 0,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}