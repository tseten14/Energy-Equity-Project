import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";

import { getDataset, listRecentDatasets } from "./datasets";
import {
  compareInput,
  getCompareSeries,
  getFinancialsData,
  getHeadlines,
  getHouseholdData,
  getMichiganContext,
} from "./measures";

// Verified data only changes when the seed is re-run, so cached results stay fresh for the session.
const staleTime = 60 * 60 * 1000;

export const householdQuery = () =>
  queryOptions({ queryKey: ["household"], queryFn: () => getHouseholdData(), staleTime });

export const financialsQuery = () =>
  queryOptions({ queryKey: ["financials"], queryFn: () => getFinancialsData(), staleTime });

export const compareQuery = (input: z.infer<typeof compareInput>) =>
  queryOptions({
    queryKey: ["compare", input.household, input.financial],
    queryFn: () => getCompareSeries({ data: input }),
    staleTime,
  });

export const michiganContextQuery = () =>
  queryOptions({ queryKey: ["michigan-context"], queryFn: () => getMichiganContext(), staleTime });

export const headlinesQuery = () =>
  queryOptions({ queryKey: ["headlines"], queryFn: () => getHeadlines(), staleTime });

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
