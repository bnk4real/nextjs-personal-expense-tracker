'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, FileText } from 'lucide-react';
import EnhancedDashboard from '../../components/app/EnhancedDashboard';
import ReportsPage from '../../components/app/ReportsPage';

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState('analysis');

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Financial Analysis</h1>
                    <p className="text-lg text-gray-600">Analyze expenses, income, accounts, and long-term money movement</p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 lg:w-96">
                        <TabsTrigger value="analysis" className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Analysis
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            View Reports
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="analysis" className="space-y-6">
                        <EnhancedDashboard />
                    </TabsContent>

                    <TabsContent value="reports" className="space-y-6">
                        <ReportsPage />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
