import ExpenseEditForm from '@/components/app/ExpenseEditForm';

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExpenseEditForm id={id} />;
}