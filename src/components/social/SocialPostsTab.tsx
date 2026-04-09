import { DataTable } from '@/components/DataTable';
import { formatDate, formatNumber } from '@/lib/format';
import type { SocialPost } from '@/types/social';
import { socialPlatformLabel } from '@/types/social';

export function SocialPostsTab({ posts }: { posts: SocialPost[] }) {
  return (
    <DataTable
      data={posts}
      columns={[
        { key: 'plataforma', label: 'Rede', render: (item: SocialPost) => socialPlatformLabel(item.plataforma) },
        { key: 'data_publicacao', label: 'Publicação', render: (item: SocialPost) => formatDate(item.data_publicacao) },
        { key: 'titulo_legenda', label: 'Título/Legenda' },
        { key: 'tipo_post', label: 'Tipo' },
        { key: 'engajamento_total', label: 'Engajamento', render: (item: SocialPost) => formatNumber(item.engajamento_total || 0) },
        { key: 'taxa_engajamento', label: 'Taxa', render: (item: SocialPost) => `${Number(item.taxa_engajamento || 0).toFixed(2)}%` },
      ]}
    />
  );
}
