import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useClientDocuments } from '@/api/queries';
import type { DocumentCategory } from '@/api/types';
import { useDocumentViewer } from '@/lib/documents';
import { useTheme } from '@/lib/theme-context';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States';
import { DocumentListItem } from '@/components/domain/ListItems';

type Filter = 'ALL' | DocumentCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Tutti' },
  { value: 'PROPOSAL', label: 'Proposte' },
  { value: 'STATEMENT', label: 'Rendiconti' },
  { value: 'CONTRACT', label: 'Contratti' },
  { value: 'REPORT', label: 'Report' },
];

/**
 * DOCUMENTI DEL CLIENTE.
 *
 * Toccando un documento l'app lo scarica in modo autenticato e lo apre nel
 * visualizzatore PDF del telefono, da cui si può anche salvare o inoltrare.
 */
export default function ClientDocumentsScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('ALL');
  const documents = useClientDocuments(filter === 'ALL' ? undefined : filter);
  const viewer = useDocumentViewer();

  const items = documents.data ?? [];

  const header = (
    <ScreenHeader
      title="Documenti"
      subtitle="Schede proposta, rendiconti e contratti"
      below={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.spacing.base }}
        >
          {FILTERS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={filter === option.value}
              onPress={() => setFilter(option.value)}
            />
          ))}
        </ScrollView>
      }
    />
  );

  return (
    <Screen header={header} refreshing={documents.isRefetching} onRefresh={() => void documents.refetch()}>
      {documents.isError ? (
        <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
      ) : documents.isLoading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="folder"
          title="Nessun documento"
          message="I documenti collegati alle proposte e ai rendiconti compariranno qui."
        />
      ) : (
        <>
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              {items.map((document, index) => (
                <View key={document.id} style={{ gap: theme.spacing.sm }}>
                  {index > 0 && <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
                  <DocumentListItem
                    document={document}
                    busy={viewer.isBusy(document.id)}
                    onOpen={() => void viewer.open(document)}
                  />
                </View>
              ))}
            </View>
          </Card>

          <AppText variant="micro" tone="faint" align="center">
            I documenti sono PDF dimostrativi generati dal prototipo.
          </AppText>
        </>
      )}
    </Screen>
  );
}
