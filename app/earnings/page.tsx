import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import IncomeTracker from '@/components/app/IncomeTracker';
import ExpenseList from '@/components/app/ExpenseList';

export default function EarningsPage() {
    return (
        <div className="container max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Spending</h1>
            <Tabs defaultValue="expense" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 border border-gray-200">
                    <TabsTrigger value="expense">Expense</TabsTrigger>
                    <TabsTrigger value="income">Earnings</TabsTrigger>
                </TabsList>
                <TabsContent value="expense" className="mt-6">
                    <ExpenseList />
                </TabsContent>
                <TabsContent value="income" className="mt-6">
                    <IncomeTracker />
                </TabsContent>
            </Tabs>
        </div>
    );
}