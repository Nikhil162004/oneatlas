import { SkeletonPage } from '@/components/ui';

/** While this route's server component reads the database, show the page's shape. */
export default function Loading() {
  return <SkeletonPage />;
}
