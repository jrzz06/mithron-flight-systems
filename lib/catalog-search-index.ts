import type { CatalogSearchResult } from "@/services/catalog";



export type CatalogSearchIndexEntry = CatalogSearchResult & {

  searchText: string;

  sortOrder: number;

};



const MIN_QUERY_LENGTH = 2;

const MIN_TOKEN_LENGTH = 2;



function toSearchResult(entry: CatalogSearchIndexEntry): CatalogSearchResult {

  const { searchText: _searchText, sortOrder: _sortOrder, ...result } = entry;

  return result;

}



function tokenizeQuery(query: string) {

  return query

    .trim()

    .toLowerCase()

    .split(/\s+/)

    .filter((token) => token.length >= MIN_TOKEN_LENGTH);

}



function entryMatchesToken(entry: CatalogSearchIndexEntry, token: string) {

  const name = entry.name.toLowerCase();

  const tagline = entry.tagline.toLowerCase();

  const slug = entry.slug.toLowerCase();

  const category = entry.category.toLowerCase();



  return (

    name.includes(token)

    || tagline.includes(token)

    || slug.includes(token)

    || category.includes(token)

    || entry.searchText.includes(token)

  );

}



function scoreSearchEntry(entry: CatalogSearchIndexEntry, normalizedQuery: string, tokens: string[]) {

  if (!normalizedQuery || normalizedQuery.length < MIN_QUERY_LENGTH) return 0;

  if (!tokens.length) return 0;



  const name = entry.name.toLowerCase();

  const tagline = entry.tagline.toLowerCase();

  const slug = entry.slug.toLowerCase();

  const category = entry.category.toLowerCase();



  const allTokensMatch = tokens.every((token) => entryMatchesToken(entry, token));

  if (!allTokensMatch) return 0;



  if (name === normalizedQuery || slug === normalizedQuery) return 1000;

  if (name.startsWith(normalizedQuery) || slug.startsWith(normalizedQuery)) return 900;

  if (tagline.startsWith(normalizedQuery)) return 850;

  if (name.includes(normalizedQuery) || slug.includes(normalizedQuery)) return 800;

  if (tagline.includes(normalizedQuery) || category.includes(normalizedQuery)) return 750;



  return 500 + tokens.length * 40;

}



export function searchCatalogIndex(

  index: CatalogSearchIndexEntry[],

  query: string,

  limit = 24

): CatalogSearchResult[] {

  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery || normalizedQuery.length < MIN_QUERY_LENGTH) return [];



  const tokens = tokenizeQuery(normalizedQuery);

  if (!tokens.length) return [];



  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);



  return index

    .map((entry) => ({

      entry,

      score: scoreSearchEntry(entry, normalizedQuery, tokens)

    }))

    .filter((item) => item.score > 0)

    .sort((left, right) => {

      if (right.score !== left.score) return right.score - left.score;

      if (left.entry.sortOrder !== right.entry.sortOrder) {

        return left.entry.sortOrder - right.entry.sortOrder;

      }

      return left.entry.slug.localeCompare(right.entry.slug);

    })

    .slice(0, boundedLimit)

    .map((item) => toSearchResult(item.entry));

}



export function getFeaturedFromCatalogIndex(

  index: CatalogSearchIndexEntry[],

  limit = 4

): CatalogSearchResult[] {

  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 12);

  const badged = index.filter((entry) => Boolean(entry.badge));

  const featured = badged.length ? badged : index;

  return featured.slice(0, boundedLimit).map(toSearchResult);

}


