/**
 * React Query options shared by route loaders and page components.
 * Loaders call `ensureQueryData` with these; components call `useSuspenseQuery`.
 */
import { queryOptions } from "@tanstack/react-query";

import { getDataset, listRecentDatasets } from "./datasets";
import {
  getFinancialsData,
  getHouseholdData,
  getMichiganContext,
  getOverviewData,
} from "./measures";

// Verified data only changes when the seed is re-run, so cached results stay fresh for the session.
const staleTime = 60 * 60 * 1000;

export const householdQuery = () =>
  queryOptions({ queryKey: ["household"], queryFn: () => getHouseholdData(), staleTime });

export const financialsQuery = () =>
  queryOptions({ queryKey: ["financials"], queryFn: () => getFinancialsData(), staleTime });

export const michiganContextQuery = () =>
  queryOptions({ queryKey: ["michigan-context"], queryFn: () => getMichiganContext(), staleTime });

export const overviewQuery = () =>
  queryOptions({ queryKey: ["overview"], queryFn: () => getOverviewData(), staleTime });

export const recentDatasetsQuery = () =>
  queryOptions({
    queryKey: ["datasets"],
    queryFn: () => listRecentDatasets(),
    staleTime: 30 * 1000,
  });

// A saved upload never changes, so its results can stay cached.
export const datasetQuery = (id: string) =>
  queryOptions({
    queryKey: ["dataset", id],
    queryFn: () => getDataset({ data: { id } }),
    staleTime: Infinity,
  });
