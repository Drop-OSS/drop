export type ImageSearchResultType = "image" | "video";


export interface ImageSearchResult {
  id: string; // internal identifier for the result
  url: string;
  type: ImageSearchResultType;
  name?: string;
  size?: number;
}
