'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquare, Plus, Send, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/app/WorkspaceUI';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    createdAt: string;
}

interface ChatSession {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages?: Message[];
}

const welcomeMessage: Message = {
    id: 'welcome',
    content: "Hello! I'm your AI financial assistant. Ask me about spending, income, accounts, subscriptions, or monthly breakdowns.",
    role: 'assistant',
    createdAt: new Date().toISOString(),
};

function displayTime(value: string) {
    return new Date(value).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function displayDate(value: string) {
    return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

function InlineMarkdown({ text }: { text: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                    return (
                        <strong key={`${part}-${index}`} className="font-semibold">
                            {part.slice(2, -2)}
                        </strong>
                    );
                }

                return <span key={`${part}-${index}`}>{part}</span>;
            })}
        </>
    );
}

function ChatMessageContent({ content }: { content: string }) {
    const blocks: ReactNode[] = [];
    let paragraph: string[] = [];
    let unorderedItems: string[] = [];
    let orderedItems: string[] = [];

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        const text = paragraph.join('\n');
        blocks.push(
            <p key={`paragraph-${blocks.length}`} className="whitespace-pre-wrap">
                <InlineMarkdown text={text} />
            </p>
        );
        paragraph = [];
    };

    const flushUnorderedList = () => {
        if (unorderedItems.length === 0) return;
        blocks.push(
            <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
                {unorderedItems.map((item, index) => (
                    <li key={`${item}-${index}`}>
                        <InlineMarkdown text={item} />
                    </li>
                ))}
            </ul>
        );
        unorderedItems = [];
    };

    const flushOrderedList = () => {
        if (orderedItems.length === 0) return;
        blocks.push(
            <ol key={`ol-${blocks.length}`} className="list-decimal space-y-1 pl-5">
                {orderedItems.map((item, index) => (
                    <li key={`${item}-${index}`}>
                        <InlineMarkdown text={item} />
                    </li>
                ))}
            </ol>
        );
        orderedItems = [];
    };

    const flushLists = () => {
        flushUnorderedList();
        flushOrderedList();
    };

    content.split('\n').forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
            flushParagraph();
            flushLists();
            return;
        }

        const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
        if (heading) {
            flushParagraph();
            flushLists();
            blocks.push(
                <p key={`heading-${blocks.length}`} className="font-semibold">
                    <InlineMarkdown text={heading[1]} />
                </p>
            );
            return;
        }

        const unordered = trimmed.match(/^[-*]\s+(.+)$/);
        if (unordered) {
            flushParagraph();
            flushOrderedList();
            unorderedItems.push(unordered[1]);
            return;
        }

        const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
        if (ordered) {
            flushParagraph();
            flushUnorderedList();
            orderedItems.push(ordered[1]);
            return;
        }

        flushLists();
        paragraph.push(trimmed);
    });

    flushParagraph();
    flushLists();

    return <div className="space-y-3 text-sm leading-relaxed">{blocks}</div>;
}

export default function ChatbotPage() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const activeSession = useMemo(
        () => sessions.find((session) => session.id === activeSessionId) || null,
        [activeSessionId, sessions]
    );

    const loadSessions = async () => {
        try {
            const response = await fetch('/api/chatbot');
            if (!response.ok) return;
            const data = await response.json();
            setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        } finally {
            setLoadingSessions(false);
        }
    };

    const loadSession = async (sessionId: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/chatbot?sessionId=${sessionId}`);
            if (!response.ok) return;
            const data = await response.json();
            const sessionMessages = Array.isArray(data.session?.messages) ? data.session.messages : [];
            setActiveSessionId(sessionId);
            setMessages(sessionMessages.length > 0 ? sessionMessages : [welcomeMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const startNewSession = () => {
        setActiveSessionId(null);
        setMessages([welcomeMessage]);
        setInput('');
    };

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `local-${Date.now()}`,
            content: input.trim(),
            role: 'user',
            createdAt: new Date().toISOString(),
        };

        setMessages((current) => [...current, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    sessionId: activeSessionId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                content: data.response,
                role: 'assistant',
                createdAt: new Date().toISOString(),
            };

            setActiveSessionId(data.sessionId);
            setMessages((current) => [...current, assistantMessage]);
            await loadSessions();
        } catch {
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                content: "I couldn't reach the AI service. Please try again.",
                role: 'assistant',
                createdAt: new Date().toISOString(),
            };
            setMessages((current) => [...current, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
            <PageHeader
                title="AI Assistant"
                description="Chat in saved sessions and analyze your real financial data."
                actions={(
                    <Button variant="outline" onClick={startNewSession}>
                        <Plus className="h-4 w-4" />
                        New Chat
                    </Button>
                )}
            />

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                <Card className="hidden min-h-0 rounded-md lg:flex lg:flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <MessageSquare className="h-4 w-4" />
                            Sessions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 p-0">
                        <ScrollArea className="h-full px-3 pb-3">
                            <div className="space-y-2">
                                {loadingSessions ? (
                                    <p className="px-2 py-3 text-sm text-muted-foreground">Loading sessions...</p>
                                ) : sessions.length === 0 ? (
                                    <p className="px-2 py-3 text-sm text-muted-foreground">No saved sessions yet</p>
                                ) : (
                                    sessions.map((session) => (
                                        <button
                                            key={session.id}
                                            type="button"
                                            onClick={() => loadSession(session.id)}
                                            className={cn(
                                                'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                                                activeSessionId === session.id && 'border-primary bg-primary/5'
                                            )}
                                        >
                                            <span className="line-clamp-2 font-medium">{session.title}</span>
                                            <span className="mt-1 block text-xs text-muted-foreground">{displayDate(session.updatedAt)}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="min-h-0 rounded-md">
                    <CardHeader className="border-b">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="h-5 w-5" />
                                {activeSession?.title || 'New financial chat'}
                            </CardTitle>
                            <Badge variant="outline">Session context</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex h-full min-h-0 flex-col p-0">
                        <ScrollArea className="min-h-0 flex-1 p-4" ref={scrollAreaRef}>
                            <div className="space-y-4">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            'flex items-start gap-3',
                                            message.role === 'user' ? 'justify-end' : 'justify-start'
                                        )}
                                    >
                                        {message.role === 'assistant' && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-primary text-primary-foreground">
                                                    <Bot className="h-4 w-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div
                                            className={cn(
                                                'max-w-[82%] rounded-md px-4 py-3',
                                                message.role === 'user'
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted'
                                            )}
                                        >
                                            <ChatMessageContent content={message.content} />
                                            <p className="mt-2 text-xs opacity-70">{displayTime(message.createdAt)}</p>
                                        </div>
                                        {message.role === 'user' && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-secondary text-secondary-foreground">
                                                    <User className="h-4 w-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="bg-primary text-primary-foreground">
                                                <Bot className="h-4 w-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="rounded-md bg-muted px-4 py-3">
                                            <div className="flex gap-1">
                                                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                                                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.1s]" />
                                                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="border-t p-4">
                            <div className="flex items-end gap-2">
                                <Textarea
                                    value={input}
                                    onChange={(event) => setInput(event.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about this month's spending by category..."
                                    disabled={isLoading}
                                    className="min-h-12 flex-1 resize-none"
                                />
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!input.trim() || isLoading}
                                    size="icon"
                                    aria-label="Send message"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
