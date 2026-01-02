import CategoryEditForm from '@/components/app/CategoryEditForm';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CategoryEditForm id={id} />;
}