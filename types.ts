
export enum AppStep {
  SELECT_PERSON = 1,
  SELECT_CLOTHES = 2,
  GENERATING = 3,
  RESULT = 4
}

export interface HistoryItem {
  id: string;
  imageUrl: string;
  personUrl: string;
  clothesUrl: string;
  timestamp: number;
}
