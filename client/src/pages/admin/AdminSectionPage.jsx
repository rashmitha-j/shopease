import { EmptyState } from '../../components/ui/StatusMessage.jsx';

// Placeholder for admin sections that are not built yet. It shows no data at all,
// real or made up, until the section is implemented.
export default function AdminSectionPage({ title, description }) {
  return (
    <>
      <title>{`Admin: ${title} | ShopEase`}</title>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <div className="mt-6">
        <EmptyState title="Not available yet" message={description} />
      </div>
    </>
  );
}
