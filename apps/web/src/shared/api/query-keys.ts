export function makeQueryKeys<ListQuery>(root: string) {
  return {
    all: [root] as const,
    list: (query: ListQuery) => [root, 'list', query] as const,
    detail: (id: string) => [root, 'detail', id] as const,
  };
}
