import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/server-auth';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const body = await request.json();
        const title = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : '';
        if (!title) {
            return NextResponse.json({ error: 'Session name is required' }, { status: 400 });
        }
        if (title.length > 80) {
            return NextResponse.json({ error: 'Session name must be 80 characters or fewer' }, { status: 400 });
        }

        const session = await prisma.chatSession.findFirst({
            where: { id, user_id: user.user_id },
            select: { id: true },
        });
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const updatedSession = await prisma.chatSession.update({
            where: { id },
            data: { title },
        });
        return NextResponse.json({ session: updatedSession });
    } catch (error) {
        console.error('Error renaming chat session:', error);
        return NextResponse.json({ error: 'Failed to rename session' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getRequestUser(request);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const session = await prisma.chatSession.findFirst({
            where: { id, user_id: user.user_id },
            select: { id: true },
        });
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        await prisma.chatSession.delete({ where: { id } });
        return NextResponse.json({ message: 'Session deleted' });
    } catch (error) {
        console.error('Error deleting chat session:', error);
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }
}
