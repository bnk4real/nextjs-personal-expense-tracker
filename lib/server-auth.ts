import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export type RequestUser = {
    user_id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
};

export function getRequestUser(request: NextRequest): RequestUser | null {
    const token = request.cookies.get('token')?.value
        || request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return null;

    try {
        return jwt.verify(token, JWT_SECRET) as RequestUser;
    } catch {
        return null;
    }
}
